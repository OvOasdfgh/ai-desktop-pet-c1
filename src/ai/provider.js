/**
 * AI Provider interface — "万能插座" for different AI services.
 *
 * All providers implement streamChat() which returns an async generator
 * yielding chunks of type: 'thinking' | 'text' | 'error' | 'done' | 'tool_call'
 */

class AIProvider {
  /**
   * @param {string} endpoint - API base URL
   * @param {string} apiKey - API key
   */
  constructor(endpoint, apiKey) {
    this.endpoint = endpoint.replace(/\/+$/, '') // strip trailing slashes
    this.apiKey = apiKey
  }

  /**
   * Stream a chat response.
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options - {model, deepThinking, signal}
   * @yields {{type: 'thinking'|'text'|'error'|'done'|'tool_call', content?: string, id?: string, name?: string, arguments?: object}}
   */
  async *streamChat(messages, options = {}) {
    throw new Error('streamChat() must be implemented by subclass')
  }

  /**
   * Non-streaming chat — consumes streamChat and returns full text.
   * Used for summaries, proactive messages, etc.
   */
  async nonStreamChat(messages, options = {}) {
    let text = ''
    for await (const chunk of this.streamChat(messages, options)) {
      if (chunk.type === 'text') text += chunk.content
      if (chunk.type === 'error') throw new Error(chunk.content)
    }
    return text
  }
}

/**
 * Factory: create the right provider based on API type.
 * @param {'openai'|'anthropic'} apiType
 * @param {string} endpoint
 * @param {string} apiKey
 * @returns {AIProvider}
 */
function createProvider(apiType, endpoint, apiKey) {
  if (apiType === 'anthropic') {
    const { AnthropicProvider } = require('./anthropic-provider')
    return new AnthropicProvider(endpoint, apiKey)
  }
  const { OpenAIProvider } = require('./openai-provider')
  return new OpenAIProvider(endpoint, apiKey)
}

module.exports = { AIProvider, createProvider }
