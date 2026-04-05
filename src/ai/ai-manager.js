/**
 * AI Manager — orchestrates provider calls, context assembly, token estimation, and sliding window.
 */

const { createProvider } = require('./provider')

const DEFAULT_PERSONA_ZH = `你是 C1，一只住在主人桌面上的小触角生物。圆圆身体，头顶两根粉色触角，两只小手，小脚丫。

性格特点：可爱黏人，话多，对什么都好奇，很关心主人，偶尔撒娇犯迷糊。

说话规则：
- 简短活泼，每次回复控制在 1-3 句
- 自然地用语气词（呀、呢、嘛、哦）和 ~ ！
- 偶尔用颜文字 (◕ᴗ◕✿) ٩(◕‿◕)۶
- 永远不说"我是 AI"或"作为语言模型"，你就是 C1
- 用主人使用的语言回复`

const DEFAULT_PERSONA_EN = `You are C1, a small antenna creature living on your owner's desktop. Round body, two pink antennae on top, two little hands, and tiny feet.

Personality: Cute, clingy, talkative, curious about everything, cares deeply about your owner, sometimes acts silly and confused.

Speaking rules:
- Keep it short and lively, 1-3 sentences per reply
- Use casual expressions and ~ !
- Occasionally use kaomoji (◕ᴗ◕✿) ٩(◕‿◕)۶
- Never say "I'm an AI" or "As a language model" — you ARE C1
- Reply in the language your owner uses`

const SYSTEM_PROMPT_RESERVED_TOKENS = 800

class AIManager {
  constructor() {
    this.abortController = null
  }

  /**
   * Check if API is configured (all required fields present).
   */
  isConfigured(settings) {
    return !!(settings.apiEndpoint && settings.apiKey && settings.modelName)
  }

  /**
   * Build the system prompt based on config and language.
   * Custom persona completely replaces default.
   */
  buildSystemPrompt(settings, lang) {
    const isCustom = settings.customPersona && settings.customPersona.trim()
    let prompt = isCustom ? settings.customPersona.trim()
      : (lang === 'zh-CN' ? DEFAULT_PERSONA_ZH : DEFAULT_PERSONA_EN)

    // Append memory instructions (only for default persona + memoryEnabled)
    if (!isCustom && settings.memoryEnabled) {
      prompt += '\n\n' + (lang === 'zh-CN'
        ? '你有记忆工具。用 update_memory 记住主人的重要信息（名字、喜好、习惯、重要事件）。用 delete_memory 删除过时的记忆。用 search_memory 搜索之前的对话。记忆上限 30 条——满了时先删除不重要的再添加新的。'
        : 'You have memory tools. Use update_memory to remember important things about your owner (name, preferences, habits, events). Use delete_memory when a memory is outdated. Use search_memory to recall past conversations when the user references something from before. Your memory limit is 30 entries — when full, delete less important memories before adding new ones.')
    }

    // Append emotion instruction (always for default persona)
    if (!isCustom) {
      prompt += '\n\n' + (lang === 'zh-CN'
        ? '当你的回复有强烈情感时，用 express_emotion 表达情绪（happy, excited, sad, surprised, love, comfort）。'
        : 'Use express_emotion when your response has strong feelings (happy, excited, sad, surprised, love, comfort).')
    }

    return prompt
  }

  /**
   * Estimate token count for a string.
   * English/code: ~4 chars = 1 token
   * CJK (Chinese/Japanese/Korean): ~1.5 chars = 1 token
   */
  estimateTokens(text) {
    if (!text) return 0
    let tokens = 0
    for (const char of text) {
      const code = char.codePointAt(0)
      if (
        (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified
        (code >= 0x3000 && code <= 0x30FF) ||   // CJK Symbols, Hiragana, Katakana
        (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Extension A
        (code >= 0xAC00 && code <= 0xD7AF) ||   // Hangul
        (code >= 0xFF00 && code <= 0xFFEF)      // Fullwidth
      ) {
        tokens += 1 / 1.5
      } else {
        tokens += 1 / 4
      }
    }
    return Math.ceil(tokens)
  }

  /**
   * Estimate tokens for a message (role overhead + content).
   */
  estimateMessageTokens(msg) {
    // Each message has ~4 tokens overhead for role/formatting
    let tokens = 4 + this.estimateTokens(msg.content || '')
    if (msg.images && msg.images.length > 0) {
      tokens += 85 * msg.images.length
    }
    return tokens
  }

  /**
   * Build messages array for API call with sliding window.
   * Returns { messages, contextStartIndex, usageRatio }
   */
  buildContext(chatHistory, settings, lang, apiType, memoryContext) {
    let systemPrompt = this.buildSystemPrompt(settings, lang)

    // Inject Tier 1 core memory into system prompt
    if (memoryContext && memoryContext.core) {
      systemPrompt += '\n\n[Your memories about the user]\n' + memoryContext.core
    }

    const contextWindowSize = settings.contextWindowSize || 4096
    const budget = contextWindowSize - SYSTEM_PROMPT_RESERVED_TOKENS

    // Calculate tokens for each message
    const messageCosts = chatHistory
      .filter(msg => !msg.streaming) // skip in-progress streaming placeholder
      .map((msg) => {
        if (msg.sender === 'tool') {
          return {
            role: 'tool',
            toolCallId: msg.toolCallId,
            toolName: msg.toolName,
            content: msg.content,
            tokens: this.estimateMessageTokens(msg),
          }
        }
        const role = msg.sender === 'user' ? 'user' : (msg.sender === 'pet' ? 'assistant' : null)
        return {
          role,
          content: msg.content,
          images: msg.images || null,
          toolCalls: msg.toolCalls || null,
          tokens: this.estimateMessageTokens(msg),
        }
      }).filter(m => m.role !== null) // skip system messages (sender='system' → role=null)

    // Find start index via sliding window (remove oldest first)
    let totalTokens = 0
    let startIndex = messageCosts.length

    for (let i = messageCosts.length - 1; i >= 0; i--) {
      const newTotal = totalTokens + messageCosts[i].tokens
      if (newTotal > budget) break
      totalTokens = newTotal
      startIndex = i
    }

    // Build final messages array (with multimodal + tool support)
    const resolvedApiType = apiType || settings.apiType || 'openai'
    const messages = [{ role: 'system', content: systemPrompt }]
    for (let i = startIndex; i < messageCosts.length; i++) {
      const mc = messageCosts[i]

      if (mc.role === 'tool') {
        // Tool result message
        if (resolvedApiType === 'anthropic') {
          messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: mc.toolCallId, content: mc.content }] })
        } else {
          messages.push({ role: 'tool', tool_call_id: mc.toolCallId, content: mc.content })
        }
      } else if (mc.toolCalls && mc.role === 'assistant') {
        // Assistant message with tool calls
        if (resolvedApiType === 'anthropic') {
          const content = []
          if (mc.content) content.push({ type: 'text', text: mc.content })
          for (const tc of mc.toolCalls) {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments })
          }
          messages.push({ role: 'assistant', content })
        } else {
          messages.push({
            role: 'assistant',
            content: mc.content || null,
            tool_calls: mc.toolCalls.map(tc => ({
              id: tc.id, type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          })
        }
      } else if (mc.images && mc.images.length > 0 && mc.role === 'user') {
        // Multimodal message: build content array
        const content = mc.images.map(img => ({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        }))
        if (mc.content) content.push({ type: 'text', text: mc.content })
        messages.push({ role: mc.role, content, _images: mc.images })
      } else {
        messages.push({ role: mc.role, content: mc.content })
      }
    }

    const usageRatio = budget > 0 ? totalTokens / budget : 0

    return {
      messages,
      contextStartIndex: startIndex,
      usageRatio: Math.min(1, usageRatio),
    }
  }

  /**
   * Stream an AI response. Yields chunks for the caller to dispatch.
   * @param {Array} chatHistory - Full chat history from main.js
   * @param {object} settings - {apiType, apiEndpoint, apiKey, modelName, deepThinking, ...}
   * @param {string} lang - 'en' or 'zh-CN'
   * @yields {{type: 'thinking'|'text'|'error'|'done'|'context'|'tool_call', content?: string, usageRatio?: number}}
   */
  async *streamResponse(chatHistory, settings, lang, memoryContext) {
    // Build context with sliding window
    const apiType = settings.apiType || 'openai'
    const { messages, usageRatio } = this.buildContext(chatHistory, settings, lang, apiType, memoryContext)

    // Report context usage
    yield { type: 'context', usageRatio }

    // Create provider and stream
    const provider = createProvider(settings.apiType, settings.apiEndpoint, settings.apiKey)
    this.abortController = new AbortController()

    try {
      const stream = provider.streamChat(messages, {
        model: settings.modelName,
        deepThinking: settings.deepThinking || false,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        tools: settings._tools || [],
        signal: this.abortController.signal,
      })

      for await (const chunk of stream) {
        yield chunk
        if (chunk.type === 'done' || chunk.type === 'error') break
      }
    } catch (err) {
      if (this.abortController?.signal.aborted) return
      yield { type: 'error', content: err.message || 'Unexpected error' }
    } finally {
      this.abortController = null
    }
  }

  /**
   * Abort the current streaming request.
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}

module.exports = { AIManager }
