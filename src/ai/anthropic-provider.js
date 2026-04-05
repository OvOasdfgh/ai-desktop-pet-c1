/**
 * Anthropic native provider — handles Claude models directly.
 *
 * POST /v1/messages with stream: true
 * SSE events: content_block_start, content_block_delta, message_stop, error
 */

const { AIProvider } = require('./provider')
const https = require('https')
const http = require('http')

class AnthropicProvider extends AIProvider {
  async *streamChat(messages, options = {}) {
    const { model, deepThinking = false, signal, temperature, maxTokens, tools } = options

    // Anthropic puts system prompt in top-level 'system' field, not in messages
    let systemPrompt = ''
    const filteredMessages = []
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content
      } else if (msg._images && Array.isArray(msg.content)) {
        // Transform multimodal content to Anthropic format
        const content = msg._images.map(img => ({
          type: 'image',
          source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
        }))
        const textPart = msg.content.find(c => c.type === 'text')
        if (textPart) content.push({ type: 'text', text: textPart.text })
        filteredMessages.push({ role: msg.role, content })
      } else {
        filteredMessages.push({ role: msg.role, content: msg.content })
      }
    }

    const body = {
      model,
      max_tokens: maxTokens || 4096,
      stream: true,
      messages: filteredMessages,
    }

    if (temperature !== undefined) {
      body.temperature = Math.min(temperature, 1.0)
    }

    if (systemPrompt) {
      body.system = systemPrompt
    }

    if (deepThinking) {
      body.thinking = { type: 'enabled', budget_tokens: 10000 }
    }

    if (tools && tools.length > 0) {
      // Convert OpenAI tool format to Anthropic format
      body.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }))
    }

    const url = new URL(this.endpoint + '/v1/messages')
    const isHttps = url.protocol === 'https:'
    const requestModule = isHttps ? https : http

    const requestBody = JSON.stringify(body)

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    }

    const queue = new AsyncQueue()

    // Track current content block type (thinking vs text vs tool_use)
    let currentBlockType = null
    let currentToolUse = null // { id, name, inputStr }

    const req = requestModule.request(requestOptions, (res) => {
      if (res.statusCode !== 200) {
        let errorBody = ''
        res.on('data', (chunk) => { errorBody += chunk.toString() })
        res.on('end', () => {
          let msg
          try {
            const parsed = JSON.parse(errorBody)
            msg = parsed.error?.message || parsed.message || `HTTP ${res.statusCode}`
          } catch {
            msg = `HTTP ${res.statusCode}: ${errorBody.slice(0, 200)}`
          }
          queue.push({ type: 'error', content: msg, statusCode: res.statusCode })
          queue.end()
        })
        return
      }

      let buffer = ''
      res.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue

          // Anthropic SSE: "event: xxx\ndata: {...}"
          if (trimmed.startsWith('event: ')) continue // skip event line, parse data line

          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)

          try {
            const parsed = JSON.parse(data)

            switch (parsed.type) {
              case 'content_block_start':
                currentBlockType = parsed.content_block?.type || 'text'
                if (currentBlockType === 'tool_use') {
                  currentToolUse = {
                    id: parsed.content_block.id,
                    name: parsed.content_block.name,
                    inputStr: '',
                  }
                }
                break

              case 'content_block_delta': {
                const delta = parsed.delta
                if (delta?.type === 'thinking_delta' && delta.thinking) {
                  queue.push({ type: 'thinking', content: delta.thinking })
                } else if (delta?.type === 'text_delta' && delta.text) {
                  queue.push({ type: 'text', content: delta.text })
                } else if (delta?.type === 'input_json_delta' && delta.partial_json && currentToolUse) {
                  currentToolUse.inputStr += delta.partial_json
                }
                break
              }

              case 'content_block_stop':
                if (currentBlockType === 'tool_use' && currentToolUse) {
                  try { queue.push({ type: 'tool_call', id: currentToolUse.id, name: currentToolUse.name, arguments: JSON.parse(currentToolUse.inputStr || '{}') }) }
                  catch { queue.push({ type: 'tool_call', id: currentToolUse.id, name: currentToolUse.name, arguments: {} }) }
                  currentToolUse = null
                }
                currentBlockType = null
                break

              case 'message_stop':
                queue.push({ type: 'done' })
                queue.end()
                return

              case 'message_delta':
                // May contain stop_reason, usage info — ignore for now
                break

              case 'error':
                queue.push({ type: 'error', content: parsed.error?.message || 'Unknown error' })
                queue.end()
                return
            }
          } catch { /* skip unparseable */ }
        }
      })

      res.on('end', () => {
        queue.push({ type: 'done' })
        queue.end()
      })

      res.on('error', (err) => {
        queue.push({ type: 'error', content: err.message })
        queue.end()
      })
    })

    req.on('error', (err) => {
      queue.push({ type: 'error', content: err.message })
      queue.end()
    })

    if (signal) {
      if (signal.aborted) { req.destroy(); return }
      signal.addEventListener('abort', () => {
        req.destroy()
        queue.end()
      }, { once: true })
    }

    req.write(requestBody)
    req.end()

    yield* queue
  }
}

/**
 * Simple async queue: push items from callbacks, consume via async iteration.
 */
class AsyncQueue {
  constructor() {
    this._buffer = []
    this._resolve = null
    this._done = false
  }

  push(item) {
    if (this._done) return
    this._buffer.push(item)
    if (this._resolve) {
      this._resolve()
      this._resolve = null
    }
  }

  end() {
    this._done = true
    if (this._resolve) {
      this._resolve()
      this._resolve = null
    }
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      while (this._buffer.length > 0) {
        yield this._buffer.shift()
      }
      if (this._done) return
      await new Promise((r) => { this._resolve = r })
    }
  }
}

module.exports = { AnthropicProvider }
