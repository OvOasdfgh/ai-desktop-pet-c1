;(function () {
  const bubble = document.getElementById('bubble')
  const bubbleText = document.getElementById('bubbleText')
  const bubbleChat = document.getElementById('bubbleChat')
  const bubbleChatContent = document.getElementById('bubbleChatContent')

  let mode = 'notification' // 'notification' | 'chat'
  let displayTimer = null
  let fadeTimer = null
  let chatFadeTimer = null

  // Streaming state
  let streamingRawText = ''
  let streamingContentEl = null
  let renderTimer = null

  // Notification queue (for notifications arriving during streaming)
  let pendingNotifications = []
  let hasError = false

  // Screen overflow fallback — cap bubble height to 60% of screen
  function updateMaxHeight() {
    const maxH = Math.floor(window.screen.availHeight * 0.6)
    document.documentElement.style.setProperty('--bubble-max-h', maxH + 'px')
  }
  updateMaxHeight()
  window.addEventListener('resize', updateMaxHeight)
  let hasImages = false
  let isPinned = false

  const CHAT_FADE_TIMEOUT = 60000
  const FADE_DURATIONS = {
    notification: 60000,
    proactive: 60000,
    reminder: 60000,
  }

  // DOMPurify config — strip <img> tags
  const PURIFY_CONFIG = {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'div', 'span',
      'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
      's', 'u', 'sub', 'sup', 'kbd', 'mark', 'ins',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['class', 'href'],
  }

  // Replace <img> with [Image] text during sanitization
  if (typeof DOMPurify !== 'undefined') {
    DOMPurify.addHook('uponSanitizeElement', (node, data) => {
      if (data.tagName === 'img') {
        const text = document.createTextNode('[Image]')
        node.replaceWith(text)
      }
    })
  }

  // --- Shared helpers ---
  function clearTimers() {
    if (displayTimer) { clearTimeout(displayTimer); displayTimer = null }
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
  }

  function clearChatFadeTimer() {
    if (chatFadeTimer) { clearTimeout(chatFadeTimer); chatFadeTimer = null }
  }

  function hide() {
    clearTimers()
    clearChatFadeTimer()
    bubble.classList.add('hidden')
    bubble.classList.remove('fading')
  }

  function startFade() {
    if (isPinned) return
    bubble.classList.add('fading')
    fadeTimer = setTimeout(() => {
      hide()
      window.bubbleAPI.bubbleFaded()
    }, 300)
  }

  function requestResize() {
    requestAnimationFrame(async () => {
      await document.fonts.ready
      const w = bubble.offsetWidth
      const h = bubble.offsetHeight
      window.bubbleAPI.bubbleResize(w, h)
    })
  }

  function renderAndSanitize(rawText) {
    const html = window.bubbleAPI.renderMarkdown(rawText)
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, PURIFY_CONFIG)
    }
    return html
  }

  function autoCloseFences(text) {
    const matches = text.match(/```/g)
    if (matches && matches.length % 2 !== 0) return text + '\n```'
    return text
  }

  // --- Mode switching ---
  window.bubbleAPI.onSetMode((newMode) => {
    mode = newMode
    if (mode === 'notification') {
      clearChatStreaming()
      bubbleChat.classList.add('hidden')
      bubbleText.classList.remove('hidden')
      bubble.classList.remove('chat-mode')
    }
  })

  function clearChatStreaming() {
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null }
    clearChatFadeTimer()
    streamingRawText = ''
    streamingContentEl = null
    delete bubbleChatContent.dataset.state
  }

  // --- Notification mode: show bubble (original behavior) ---
  window.bubbleAPI.onShowBubble(async (data) => {
    isPinned = false
    if (data.theme) {
      document.body.dataset.theme = data.theme
    }

    if (mode === 'chat') {
      // In chat mode: if streaming, queue the notification
      if (streamingContentEl) {
        pendingNotifications.push(data)
        return
      }
      // Not streaming: show in chat area
      clearChatFadeTimer()
      clearChatStreaming()
      bubble.classList.remove('hidden', 'fading')
      bubbleText.classList.add('hidden')
      bubbleChat.classList.remove('hidden')
      bubble.classList.add('chat-mode')
      bubble.classList.remove('clickable')
      const html = window.bubbleAPI.renderMarkdown(data.text)
      bubbleChatContent.innerHTML = DOMPurify.sanitize(html, PURIFY_CONFIG)
      requestResize()
      const duration = FADE_DURATIONS[data.type] || FADE_DURATIONS.notification
      chatFadeTimer = setTimeout(() => startFade(), duration)
      return
    }

    // Notification mode — use same chat-mode layout for consistent styling
    clearTimers()
    bubble.classList.remove('hidden', 'fading')
    bubbleText.classList.add('hidden')
    bubbleChat.classList.remove('hidden')
    bubble.classList.add('chat-mode')
    bubble.classList.add('clickable')
    const html = window.bubbleAPI.renderMarkdown(data.text)
    bubbleChatContent.innerHTML = DOMPurify.sanitize(html, PURIFY_CONFIG)
    requestResize()

    const duration = FADE_DURATIONS[data.type] || FADE_DURATIONS.notification
    displayTimer = setTimeout(() => {
      startFade()
    }, duration)
  })

  // --- Click bubble ---
  bubble.addEventListener('click', () => {
    if (mode === 'notification') {
      hide()
      window.bubbleAPI.bubbleClicked()
    } else if (hasError) {
      hide()
      window.bubbleAPI.bubbleClicked()
      hasError = false
    } else if (hasImages) {
      hide()
      window.bubbleAPI.bubbleClicked()
      hasImages = false
    }
  })

  // --- Mouse hover for click-through ---
  bubble.addEventListener('mouseenter', () => {
    window.bubbleAPI.setIgnoreMouse(false)
  })
  bubble.addEventListener('mouseleave', () => {
    // Only restore click-through in chat mode; notification bubbles stay clickable
    if (mode === 'chat') {
      window.bubbleAPI.setIgnoreMouse(true)
    }
  })

  // --- External links in chat content ---
  bubbleChatContent.addEventListener('click', (e) => {
    const link = e.target.closest('a')
    if (link && link.href) {
      e.preventDefault()
      window.bubbleAPI.openExternalUrl(link.href)
    }
  })

  // --- Chat streaming handlers ---
  window.bubbleAPI.onStreamStart(() => {
    if (mode !== 'chat') return
    isPinned = false
    hasError = false
    hasImages = false
    bubble.classList.remove('clickable')
    clearChatFadeTimer()
    clearChatStreaming()
    bubble.classList.remove('hidden', 'fading')
    bubbleText.classList.add('hidden')
    bubbleChat.classList.remove('hidden')
    bubble.classList.add('chat-mode')

    streamingRawText = ''
    bubbleChatContent.innerHTML = '<span class="typing-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>'
    bubbleChatContent.dataset.state = 'waiting'
    // Synchronously create streamingContentEl to eliminate null race with fast stream-end
    streamingContentEl = document.createElement('div')
    streamingContentEl.className = 'bubble-chat-md'
    bubbleChatContent.appendChild(streamingContentEl)
    requestResize()
  })

  window.bubbleAPI.onStreamChunk((text) => {
    if (mode !== 'chat') return
    if (bubbleChatContent.dataset.state === 'waiting') {
      delete bubbleChatContent.dataset.state
    }
    if (!streamingContentEl) {
      // Defensive: stream-start may not have run (edge case)
      streamingContentEl = document.createElement('div')
      streamingContentEl.className = 'bubble-chat-md'
      bubbleChatContent.appendChild(streamingContentEl)
    }
    streamingRawText += text
    throttledRender()
  })

  function throttledRender() {
    if (renderTimer) return
    renderTimer = setTimeout(() => {
      renderTimer = null
      if (streamingContentEl && streamingRawText) {
        streamingContentEl.innerHTML = renderAndSanitize(autoCloseFences(streamingRawText))
      }
      requestResize()
    }, 60)
  }

  window.bubbleAPI.onStreamEnd(() => {
    if (mode !== 'chat') return
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null }

    // Clear waiting state (hides typing dots via CSS)
    delete bubbleChatContent.dataset.state

    // Final render
    if (streamingContentEl && streamingRawText.trim()) {
      streamingContentEl.innerHTML = renderAndSanitize(streamingRawText)
    }

    // If no content was streamed and no error, hide bubble immediately
    if (!streamingRawText.trim() && !hasImages && !hasError) {
      hide()
      streamingContentEl = null
      streamingRawText = ''
      return
    }

    // Error already handled by onStreamError (which set its own chatFadeTimer).
    // Early return to avoid overwriting that timer (leaked timer would destroy bubble later).
    if (hasError) {
      streamingContentEl = null
      streamingRawText = ''
      requestResize()
      return
    }

    streamingContentEl = null
    streamingRawText = ''

    requestResize()

    // Process queued notifications
    if (pendingNotifications.length > 0) {
      chatFadeTimer = setTimeout(() => {
        const next = pendingNotifications.shift()
        if (next) {
          clearChatFadeTimer()
          bubbleChatContent.innerHTML = renderAndSanitize(next.text)
          requestResize()
          const duration = FADE_DURATIONS[next.type] || FADE_DURATIONS.notification
          chatFadeTimer = setTimeout(() => startFade(), duration)
        }
      }, 3000) // Show AI response for 3s before showing queued notification
    } else {
      chatFadeTimer = setTimeout(() => startFade(), CHAT_FADE_TIMEOUT)
    }
  })

  window.bubbleAPI.onStreamError((errMsg) => {
    if (mode !== 'chat') return
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null }

    // Clear waiting state (hides typing dots via CSS)
    delete bubbleChatContent.dataset.state
    if (streamingContentEl) {
      streamingContentEl.remove()
      streamingContentEl = null
    }
    bubbleChatContent.innerHTML = renderAndSanitize(errMsg || 'Error')
    streamingRawText = ''
    hasError = true

    requestResize()
    chatFadeTimer = setTimeout(() => startFade(), CHAT_FADE_TIMEOUT)
  })

  window.bubbleAPI.onHasImages(() => { hasImages = true })

  // --- Color scheme ---
  window.bubbleAPI.onColorScheme((data) => {
    if (!data || !data.derived) return
    Object.entries(data.derived).forEach(([k, v]) => document.body.style.setProperty(k, v))
  })

  // --- Theme ---
  window.bubbleAPI.onThemeChanged((theme) => {
    document.body.dataset.theme = theme
    if (!bubble.classList.contains('hidden')) {
      requestResize()
    }
  })

  // --- Bubble context menu ---
  bubble.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    if (bubbleChatContent.dataset.state === 'waiting') return
    const text = bubbleChatContent.innerText || ''
    window.bubbleAPI.showBubbleMenu(e.screenX, e.screenY, text)
  })

  // --- Pin/Unpin ---
  window.bubbleAPI.onBubblePinChanged((pinned) => {
    isPinned = pinned
    if (pinned) {
      clearTimers()
      clearChatFadeTimer()
    } else {
      chatFadeTimer = setTimeout(() => startFade(), CHAT_FADE_TIMEOUT)
    }
  })
})()
