/**
 * OpenAI-compatible provider — handles GPT, DeepSeek, Groq, Kimi, Gemini, etc.
 *
 * POST /v1/chat/completions with stream: true
 * SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
 */

const { AIProvider } = require('./provider')
const https = require('https')
const http = require('http')

class OpenAIProvider extends AIProvider {
  async *streamChat(messages, options = {}) {
    const { model, deepThinking = false, signal, temperature, maxTokens, tools } = options

    const body = {
      model,
      messages: messages.map(({ _images, ...rest }) => rest),
      stream: true,
    }

    if (temperature !== undefined) {
      body.temperature = temperature
    }
    if (maxTokens) {
      body.max_tokens = maxTokens
    }

    if (deepThinking) {
      body.reasoning_effort = 'high'
    }

    if (tools && tools.length > 0) {
      body.tools = tools
    }

    const endpoint = this.endpoint.replace(/\/+$/, '')
    const chatPath = endpoint.endsWith('/chat/completions') ? '' : '/chat/completions'
    const url = new URL(endpoint + chatPath)
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
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody),
      },
    }

    // Tool call accumulation: index → { id, name, args }
    const toolCallAccum = {}

    // Use an async queue to bridge Node.js streams → async generator
    const queue = new AsyncQueue()

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
          if (!trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            // Flush accumulated tool calls before done
            for (const tc of Object.values(toolCallAccum)) {
              try { queue.push({ type: 'tool_call', id: tc.id, name: tc.name, arguments: JSON.parse(tc.args) }) }
              catch { queue.push({ type: 'tool_call', id: tc.id, name: tc.name, arguments: {} }) }
            }
            queue.push({ type: 'done' })
            queue.end()
            return
          }

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            if (delta) {
              if (delta.reasoning_content) {
                queue.push({ type: 'thinking', content: delta.reasoning_content })
              }
              if (delta.content) {
                queue.push({ type: 'text', content: delta.content })
              }
              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index
                  if (!toolCallAccum[idx]) toolCallAccum[idx] = { id: '', name: '', args: '' }
                  if (tc.id) toolCallAccum[idx].id = tc.id
                  if (tc.function?.name) toolCallAccum[idx].name = tc.function.name
                  if (tc.function?.arguments) toolCallAccum[idx].args += tc.function.arguments
                }
              }
            }
          } catch { /* skip */ }
        }
      })

      res.on('end', () => {
        // Flush any remaining tool calls
        for (const tc of Object.values(toolCallAccum)) {
          try { queue.push({ type: 'tool_call', id: tc.id, name: tc.name, arguments: JSON.parse(tc.args) }) }
          catch { queue.push({ type: 'tool_call', id: tc.id, name: tc.name, arguments: {} }) }
        }
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

module.exports = { OpenAIProvider }
