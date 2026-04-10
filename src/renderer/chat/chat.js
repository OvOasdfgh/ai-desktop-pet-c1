/**
 * Chat panel renderer — handles messages, streaming, Markdown rendering, input, scrolling, and themes.
 */
;(function () {
  const messageList = document.getElementById('messageList')
  const chatInput = document.getElementById('chatInput')
  const sendBtn = document.getElementById('sendBtn')
  const closeBtn = document.getElementById('closeBtn')
  const minimizeBtn = document.getElementById('minimizeBtn')
  const maximizeBtn = document.getElementById('maximizeBtn')
  const container = document.querySelector('.chat-container')
  const contextBar = document.getElementById('contextBar')
  const attachBtn = document.getElementById('attachBtn')
  const imagePreview = document.getElementById('imagePreview')

  let messages = []
  let userScrolledUp = false
  let newMsgIndicator = null
  let i18n = null
  let isStreaming = false
  let streamingBubble = null
  let streamingThinkingEl = null
  let hasShownSlidingWarning = false
  let userCollapsedThinking = false

  // Markdown streaming state
  let streamingRawText = ''
  let streamingRawThinking = ''
  let streamingContentEl = null
  let renderTimer = null
  let streamingMsgId = null
  const rawContentMap = new Map() // msgId → raw markdown text

  // Image preview state
  let pendingImages = []
  const MAX_IMAGES = 5

  // DOMPurify config
  const PURIFY_CONFIG = {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'div', 'span',
      'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
      's', 'u', 'sub', 'sup', 'kbd', 'mark', 'ins',
      'svg', 'path', 'rect', 'line', 'polyline', 'button'],
    ALLOWED_ATTR: ['class', 'href', 'src', 'alt', 'title', 'width', 'height',
      'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
      'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'rx', 'points'],
  }

  // --- Markdown helpers ---
  function renderAndSanitize(rawText) {
    const html = window.chatAPI.renderMarkdown(rawText)
    return DOMPurify.sanitize(html, PURIFY_CONFIG)
  }

  function autoCloseFences(text) {
    const matches = text.match(/```/g)
    if (matches && matches.length % 2 !== 0) {
      return text + '\n```'
    }
    return text
  }

  function throttledRender() {
    if (renderTimer) return
    renderTimer = setTimeout(() => {
      renderTimer = null
      flushRender()
    }, 60)
  }

  function flushRender() {
    if (streamingContentEl && streamingRawText) {
      streamingContentEl.innerHTML = renderAndSanitize(autoCloseFences(streamingRawText))
    }
    if (streamingThinkingEl && streamingRawThinking) {
      streamingThinkingEl.innerHTML = renderAndSanitize(autoCloseFences(streamingRawThinking))
    }
    if (!userScrolledUp) scrollToBottom()
  }

  function postProcessImages(container) {
    const images = container.querySelectorAll('img.md-image[src^="http"]')
    images.forEach(async (img) => {
      try {
        const dataUrl = await window.chatAPI.proxyImage(img.src)
        if (dataUrl) {
          img.src = dataUrl
          img.onload = () => { if (!userScrolledUp) scrollToBottom() }
        }
      } catch (e) { console.warn('Image proxy failed:', e) }
    })
  }

  // --- Image compression ---
  function compressImage(base64DataUrl) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const MAX_SIDE = 1024
        let w = img.width, h = img.height
        if (w > MAX_SIDE || h > MAX_SIDE) {
          const ratio = Math.min(MAX_SIDE / w, MAX_SIDE / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve({ dataUrl, base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
      }
      img.onerror = () => resolve(null)
      img.src = base64DataUrl
    })
  }

  // --- Base64 to Blob URL (reduces GPU tile memory) ---
  function base64ToBlobUrl(base64, mimeType) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
  }

  // --- Image preview ---
  function addImageToPreview(compressed) {
    if (!compressed || pendingImages.length >= MAX_IMAGES) return
    pendingImages.push(compressed)
    renderImagePreview()
  }

  function renderImagePreview() {
    imagePreview.innerHTML = ''
    if (pendingImages.length === 0) {
      imagePreview.style.display = 'none'
      return
    }
    imagePreview.style.display = 'flex'
    pendingImages.forEach((img, index) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'chat-image-preview-thumb'

      const imgEl = document.createElement('img')
      imgEl.src = img.dataUrl

      const removeBtn = document.createElement('button')
      removeBtn.className = 'chat-image-preview-remove'
      removeBtn.textContent = '\u00d7'
      removeBtn.addEventListener('click', () => {
        pendingImages.splice(index, 1)
        renderImagePreview()
      })

      wrapper.appendChild(imgEl)
      wrapper.appendChild(removeBtn)
      imagePreview.appendChild(wrapper)
    })
  }

  function clearImagePreview() {
    pendingImages = []
    imagePreview.innerHTML = ''
    imagePreview.style.display = 'none'
  }

  // --- Init ---
  let initReceived = false
  let initInProgress = false
  let pendingStreamEvents = []

  window.chatAPI.onInitChat(async (data) => {
    initReceived = true
    initInProgress = true
    applyTheme(data.theme)
    await loadI18n(data.lang)
    if (data.messages && data.messages.length > 0) {
      messages = data.messages
      messages.forEach(msg => appendMessageDOM(msg))
      scrollToBottom()
      setTimeout(scrollToBottom, 150)
    }
    if (data.usageRatio > 0) {
      updateContextBar(data.usageRatio)
    }
    if (data.visionEnabled) {
      attachBtn.style.display = 'flex'
      chatInput.style.paddingLeft = '32px'
    }
    // Resume streaming after DOM is fully built (avoids race with async loadI18n)
    if (data.isStreaming) {
      const allPetBubbles = messageList.querySelectorAll('.msg-pet .msg-bubble')
      if (allPetBubbles.length > 0) {
        const lastBubble = allPetBubbles[allPetBubbles.length - 1]
        const lastMsgDiv = lastBubble.closest('.msg')
        const lastMsg = messages.find(m => String(m.id) === lastMsgDiv?.dataset?.id)
        // Only bind to last bubble if it's actually streaming — otherwise wait for ai-stream-start
        if (lastMsg && lastMsg.streaming) {
          streamingBubble = lastBubble
          streamingBubble.classList.add('streaming')
          streamingThinkingEl = streamingBubble.querySelector('.thinking-content') || null
          streamingContentEl = streamingBubble.querySelector('.msg-content') || null

          // Open thinking block so user sees ongoing thinking
          const thinkingBlock = streamingBubble.querySelector('.thinking-block')
          if (thinkingBlock) thinkingBlock.open = true

          streamingMsgId = lastMsgDiv.dataset.id
          streamingRawText = lastMsg.content || ''
          streamingRawThinking = lastMsg.thinkingContent || ''
          if (streamingRawThinking) userCollapsedThinking = true

          isStreaming = true
          updateSendButton()
        }
      }
    }
    flushPendingStreamEvents()

    // Verify streaming state — catches lost ai-stream-end events
    if (isStreaming) {
      window.chatAPI.getChatState().then(state => {
        if (!state.isStreaming && isStreaming) {
          handleStreamEnd()
        }
      }).catch(() => {})
    }
  })

  window.chatAPI.onVisionEnabledChanged((enabled) => {
    attachBtn.style.display = enabled ? 'flex' : 'none'
    chatInput.style.paddingLeft = enabled ? '32px' : '12px'
    if (!enabled) clearImagePreview()
  })

  // --- I18n ---
  async function loadI18n(lang) {
    try {
      const res = await fetch(`../../i18n/${lang}.json`)
      const data = await res.json()
      i18n = data
    } catch {
      i18n = {}
    }
    applyI18n()
  }

  function applyI18n() {
    const chatI18n = i18n?.chat || {}
    chatInput.placeholder = chatI18n.placeholder || 'Type a message...'
    const label = i18n?.system?.thinkingSummary || 'Thinking process'
    document.querySelectorAll('.thinking-block summary').forEach(s => {
      s.textContent = label
    })
    const retryLabel = i18n?.system?.retry || 'Retry'
    document.querySelectorAll('.msg-retry-btn').forEach(btn => {
      btn.textContent = retryLabel
    })
    // Image viewer i18n
    const saveLabel = document.getElementById('imageViewerSaveLabel')
    const copyLabel = document.getElementById('imageViewerCopyLabel')
    if (saveLabel && chatI18n.save) saveLabel.textContent = chatI18n.save
    if (copyLabel && chatI18n.copyImage) copyLabel.textContent = chatI18n.copyImage
    // Input context menu i18n
    const icm = { cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select All', ...chatI18n }
    document.querySelectorAll('.icm-item').forEach(item => {
      const key = item.dataset.action
      if (key && icm[key]) item.textContent = icm[key]
    })
  }

  // --- Theme ---
  function applyTheme(theme) {
    document.body.dataset.theme = theme
  }

  // Batch theme + color scheme updates into a single rAF to avoid double reflow
  let pendingTheme = null
  let pendingColors = null
  let pendingStyleRAF = null

  function scheduleMergedStyleUpdate() {
    if (pendingStyleRAF) return
    pendingStyleRAF = requestAnimationFrame(() => {
      pendingStyleRAF = null
      if (pendingColors) {
        Object.entries(pendingColors).forEach(([k, v]) => document.body.style.setProperty(k, v))
        pendingColors = null
      }
      if (pendingTheme) {
        applyTheme(pendingTheme)
        pendingTheme = null
        if (!userScrolledUp) scrollToBottom()
      }
    })
  }

  window.chatAPI.onThemeChanged((theme) => {
    pendingTheme = theme
    scheduleMergedStyleUpdate()
  })
  window.chatAPI.onLanguageChanged((lang) => loadI18n(lang))

  // --- Messages ---
  function appendMessageDOM(msg) {
    // Skip hidden messages (tool calls, tool results)
    if (msg.hidden) return

    if (msg.sender === 'system') {
      appendSystemMessageDOM(msg.content, msg.retryable)
      return
    }

    const div = document.createElement('div')
    div.className = `msg msg-${msg.sender}`
    div.dataset.id = msg.id

    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble'

    // Thinking block
    if (msg.sender === 'pet' && msg.thinkingContent) {
      const details = createThinkingBlock(msg.thinkingContent)
      bubble.appendChild(details)
    }

    // Streaming placeholder with typing dots
    if (msg.streaming && !msg.content && !msg.thinkingContent) {
      const dots = document.createElement('span')
      dots.className = 'typing-dots'
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span')
        dot.className = 'dot'
        dots.appendChild(dot)
      }
      bubble.appendChild(dots)
    }

    // User attached images
    if (msg.images && msg.images.length > 0) {
      const imgContainer = document.createElement('div')
      imgContainer.className = 'msg-bubble-image'
      msg.images.forEach(img => {
        const imgEl = document.createElement('img')
        imgEl.src = base64ToBlobUrl(img.base64, img.mimeType)
        imgEl.onload = () => { if (!userScrolledUp) scrollToBottom() }
        imgContainer.appendChild(imgEl)
      })
      bubble.appendChild(imgContainer)
    }

    // Content
    if (msg.content) {
      if (msg.sender === 'pet') {
        const contentDiv = document.createElement('div')
        contentDiv.className = 'msg-content'
        contentDiv.innerHTML = renderAndSanitize(msg.content)
        bubble.appendChild(contentDiv)
        rawContentMap.set(String(msg.id), msg.content)
        postProcessImages(contentDiv)
      } else {
        const textDiv = document.createElement('div')
        textDiv.appendChild(document.createTextNode(msg.content))
        bubble.appendChild(textDiv)
      }
    }

    div.appendChild(bubble)

    // Timestamp + Copy button in footer
    if (!msg.streaming) {
      const isUser = msg.sender === 'user'
      const footer = createMsgFooter(
        msg.timestamp,
        msg.content ? String(msg.id) : null,
        isUser ? msg.content : null,
        isUser
      )
      div.appendChild(footer)
    }

    insertBeforeIndicator(div)
  }

  function createMsgFooter(timestamp, msgId, plainText, isUser) {
    const footer = document.createElement('div')
    footer.className = 'msg-footer'
    const time = document.createElement('span')
    time.className = 'msg-time'
    const d = new Date(timestamp)
    time.textContent = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    let btn = null
    if (msgId) {
      btn = document.createElement('button')
      btn.className = 'msg-copy-btn'
      btn.innerHTML = window.chatAPI.copySvg
      btn.dataset.msgId = msgId
      if (plainText) btn.dataset.plainText = plainText
    }
    if (isUser && btn) {
      footer.appendChild(btn)
      footer.appendChild(time)
    } else {
      footer.appendChild(time)
      if (btn) footer.appendChild(btn)
    }
    return footer
  }

  function appendSystemMessageDOM(content, retryable = false) {
    const div = document.createElement('div')
    div.className = 'msg msg-system'

    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble'
    bubble.textContent = content

    if (retryable) {
      const retryBtn = document.createElement('button')
      retryBtn.className = 'msg-retry-btn'
      retryBtn.textContent = i18n?.system?.retry || 'Retry'
      retryBtn.addEventListener('click', () => {
        retryBtn.disabled = true
        window.chatAPI.retryLast()
      })
      bubble.appendChild(retryBtn)
    }

    div.appendChild(bubble)
    insertBeforeIndicator(div)

    if (!userScrolledUp) scrollToBottom()
  }

  function createThinkingBlock(content) {
    const details = document.createElement('details')
    details.className = 'thinking-block'

    const summary = document.createElement('summary')
    summary.textContent = i18n?.system?.thinkingSummary || 'Thinking process'

    const contentDiv = document.createElement('div')
    contentDiv.className = 'thinking-content'
    contentDiv.innerHTML = renderAndSanitize(content.trim())

    details.appendChild(summary)
    details.appendChild(contentDiv)
    return details
  }

  function insertBeforeIndicator(el) {
    if (newMsgIndicator && messageList.contains(newMsgIndicator)) {
      messageList.insertBefore(el, newMsgIndicator)
    } else {
      messageList.appendChild(el)
    }
  }

  window.chatAPI.onNewMessage((msg) => {
    messages.push(msg)
    appendMessageDOM(msg)

    if (userScrolledUp) {
      showNewMessageIndicator()
    } else {
      scrollToBottom()
    }
  })

  // --- Streaming ---
  function removeTypingDots() {
    if (!streamingBubble) return
    const dots = streamingBubble.querySelector('.typing-dots')
    if (dots) dots.remove()
  }

  function handleStreamStart(msgId) {
    // Idempotent: if already streaming, just update ID (tool loop sends new start)
    if (streamingBubble) {
      streamingMsgId = msgId != null ? String(msgId) : null
      const div = streamingBubble.closest('.msg')
      if (div && streamingMsgId) div.dataset.id = streamingMsgId
      return
    }

    isStreaming = true
    updateSendButton()

    // Reset streaming state
    streamingRawText = ''
    streamingRawThinking = ''
    streamingContentEl = null
    streamingMsgId = msgId != null ? String(msgId) : null
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null }

    const div = document.createElement('div')
    div.className = 'msg msg-pet'
    if (streamingMsgId) div.dataset.id = streamingMsgId

    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble streaming'

    const dots = document.createElement('span')
    dots.className = 'typing-dots'
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span')
      dot.className = 'dot'
      dots.appendChild(dot)
    }
    bubble.appendChild(dots)

    div.appendChild(bubble)
    insertBeforeIndicator(div)

    streamingBubble = bubble
    streamingThinkingEl = null

    if (!userScrolledUp) scrollToBottom()
  }

  function handleStreamThinking(text) {
    if (!streamingBubble) return

    if (!streamingThinkingEl) {
      removeTypingDots()
      const details = document.createElement('details')
      details.className = 'thinking-block'
      details.open = true
      userCollapsedThinking = false

      details.addEventListener('toggle', () => {
        if (!details.open) {
          userCollapsedThinking = true
        }
      })

      const summary = document.createElement('summary')
      summary.textContent = i18n?.system?.thinkingSummary || 'Thinking process'

      const contentDiv = document.createElement('div')
      contentDiv.className = 'thinking-content'

      details.appendChild(summary)
      details.appendChild(contentDiv)

      streamingBubble.insertBefore(details, streamingBubble.firstChild)
      streamingThinkingEl = contentDiv
    }

    if (!streamingRawThinking) {
      text = text.replace(/^\s+/, '')
    }
    streamingRawThinking += text
    throttledRender()
  }

  function handleStreamChunk(text) {
    if (!streamingBubble) return
    removeTypingDots()

    // Auto-collapse thinking block
    if (!userCollapsedThinking) {
      const thinkingBlock = streamingBubble.querySelector('.thinking-block')
      if (thinkingBlock && thinkingBlock.open) {
        thinkingBlock.open = false
      }
    }

    // Create content container on first chunk
    if (!streamingContentEl) {
      streamingContentEl = document.createElement('div')
      streamingContentEl.className = 'msg-content'
      streamingBubble.appendChild(streamingContentEl)
    }

    streamingRawText += text
    throttledRender()
  }

  function handleStreamEnd() {
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null }

    if (streamingBubble) {
      removeTypingDots()
      streamingBubble.classList.remove('streaming')

      // Final render
      if (streamingContentEl && streamingRawText.trim()) {
        streamingContentEl.innerHTML = renderAndSanitize(streamingRawText)
        postProcessImages(streamingContentEl)
      }
      if (streamingThinkingEl && streamingRawThinking.trim()) {
        streamingThinkingEl.innerHTML = renderAndSanitize(streamingRawThinking.trim())
      }

      const hasContent = streamingContentEl && streamingRawText.trim()
      const hasThinking = streamingBubble.querySelector('.thinking-block')
      const hasImages = streamingBubble.querySelector('.msg-bubble-image')

      if (!hasContent && !hasThinking && !hasImages) {
        streamingBubble.parentElement.remove()
      } else {
        // Store raw content for copy
        if (streamingMsgId && streamingRawText) {
          rawContentMap.set(streamingMsgId, streamingRawText)
        }
        // Add footer (timestamp + copy button)
        const footer = createMsgFooter(
          Date.now(),
          hasContent ? streamingMsgId : null
        )
        streamingBubble.parentElement.appendChild(footer)
      }

      // Collapse thinking when content exists (text or images)
      if (streamingRawText.trim() || streamingBubble.querySelector('.msg-bubble-image')) {
        const tb = streamingBubble.querySelector('.thinking-block')
        if (tb && tb.open) tb.open = false
      }
    }

    if (!userScrolledUp) scrollToBottom()
    userCollapsedThinking = false
    streamingBubble = null
    streamingThinkingEl = null
    streamingContentEl = null
    streamingRawText = ''
    streamingRawThinking = ''
    streamingMsgId = null
    isStreaming = false
    updateSendButton()
  }

  function handleStreamError(errMsg) {
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null }

    if (streamingBubble) {
      removeTypingDots()
      streamingBubble.classList.remove('streaming')

      // Final render of partial content
      if (streamingContentEl && streamingRawText.trim()) {
        streamingContentEl.innerHTML = renderAndSanitize(streamingRawText)
        postProcessImages(streamingContentEl)
      }
      if (streamingThinkingEl && streamingRawThinking.trim()) {
        streamingThinkingEl.innerHTML = renderAndSanitize(streamingRawThinking.trim())
      }

      const hasContent = streamingContentEl && streamingRawText.trim()
      const hasThinking = streamingBubble.querySelector('.thinking-block')
      const hasImages = streamingBubble.querySelector('.msg-bubble-image')

      if (!hasContent && !hasThinking && !hasImages) {
        streamingBubble.parentElement.remove()
      } else {
        if (streamingMsgId && streamingRawText) {
          rawContentMap.set(streamingMsgId, streamingRawText)
        }
        const footer = createMsgFooter(
          Date.now(),
          hasContent ? streamingMsgId : null
        )
        streamingBubble.parentElement.appendChild(footer)
      }
    }

    if (!userScrolledUp) scrollToBottom()
    userCollapsedThinking = false
    streamingBubble = null
    streamingThinkingEl = null
    streamingContentEl = null
    streamingRawText = ''
    streamingRawThinking = ''
    streamingMsgId = null
    isStreaming = false
    updateSendButton()
  }

  function handleStreamImages(images) {
    if (!streamingBubble) return
    removeTypingDots()
    const imgContainer = document.createElement('div')
    imgContainer.className = 'msg-bubble-image'
    images.forEach(img => {
      const imgEl = document.createElement('img')
      imgEl.src = base64ToBlobUrl(img.base64, img.mimeType)
      imgEl.onload = () => { if (!userScrolledUp) scrollToBottom() }
      imgContainer.appendChild(imgEl)
    })
    // Insert images before content (images above text)
    if (streamingContentEl) {
      streamingBubble.insertBefore(imgContainer, streamingContentEl)
    } else {
      streamingBubble.appendChild(imgContainer)
    }
    if (!userScrolledUp) scrollToBottom()
  }

  function flushPendingStreamEvents() {
    initInProgress = false
    const events = pendingStreamEvents
    pendingStreamEvents = []
    for (const evt of events) {
      switch (evt.type) {
        case 'start': handleStreamStart(evt.data); break
        case 'thinking': handleStreamThinking(evt.data); break
        case 'chunk': handleStreamChunk(evt.data); break
        case 'end': handleStreamEnd(); break
        case 'images': handleStreamImages(evt.data); break
        case 'error': handleStreamError(evt.data); break
      }
    }
  }

  // IPC listeners
  // Pre-init (initReceived=false): drop events — chatHistory in init-chat is source of truth
  // During init (initInProgress=true): buffer events to apply after async loadI18n + DOM build
  // After init: process directly
  window.chatAPI.onStreamStart((msgId) => {
    if (!initReceived) return
    if (initInProgress) { pendingStreamEvents.push({ type: 'start', data: msgId }); return }
    handleStreamStart(msgId)
  })

  window.chatAPI.onStreamThinking((text) => {
    if (!initReceived) return
    if (initInProgress) { pendingStreamEvents.push({ type: 'thinking', data: text }); return }
    handleStreamThinking(text)
  })

  window.chatAPI.onStreamChunk((text) => {
    if (!initReceived) return
    if (initInProgress) { pendingStreamEvents.push({ type: 'chunk', data: text }); return }
    handleStreamChunk(text)
  })

  window.chatAPI.onStreamEnd(() => {
    if (!initReceived) return
    if (initInProgress) { pendingStreamEvents.push({ type: 'end' }); return }
    handleStreamEnd()
  })

  window.chatAPI.onStreamError((errMsg) => {
    if (!initReceived) return
    if (initInProgress) { pendingStreamEvents.push({ type: 'error', data: errMsg }); return }
    handleStreamError(errMsg)
  })

  window.chatAPI.onStreamImages((images) => {
    if (!initReceived) return
    if (initInProgress) { pendingStreamEvents.push({ type: 'images', data: images }); return }
    handleStreamImages(images)
  })

  // --- Image viewer ---
  const imageViewer = document.getElementById('imageViewer')
  const imageViewerImg = document.getElementById('imageViewerImg')

  function openImageViewer(src) {
    imageViewerImg.src = src
    imageViewer.classList.add('active')
    document.querySelector('.chat-header').style.webkitAppRegion = 'no-drag'
  }

  function closeImageViewer() {
    imageViewer.classList.remove('active')
    imageViewerImg.src = ''
    document.querySelector('.chat-header').style.webkitAppRegion = 'drag'
  }

  document.getElementById('imageViewerClose').addEventListener('click', closeImageViewer)
  imageViewer.addEventListener('click', (e) => {
    if (e.target === imageViewer) closeImageViewer()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageViewer.classList.contains('active')) {
      closeImageViewer()
    }
  })
  async function getImageDataUrl() {
    const res = await fetch(imageViewerImg.src)
    const blob = await res.blob()
    return new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.readAsDataURL(blob)
    })
  }

  document.getElementById('imageViewerSave').addEventListener('click', async () => {
    window.chatAPI.saveImage(await getImageDataUrl())
  })
  document.getElementById('imageViewerCopy').addEventListener('click', async () => {
    window.chatAPI.copyImage(await getImageDataUrl())
  })

  // --- Event delegation for clicks ---
  messageList.addEventListener('click', (e) => {
    // Image viewer — click on any image in bubbles
    const clickedImg = e.target.closest('.msg-bubble-image img, img.md-image')
    if (clickedImg) {
      openImageViewer(clickedImg.src)
      return
    }

    // Code block copy button
    const codeCopyBtn = e.target.closest('.code-copy-btn')
    if (codeCopyBtn) {
      const codeEl = codeCopyBtn.closest('.code-block').querySelector('code')
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.textContent).then(() => {
          codeCopyBtn.innerHTML = window.chatAPI.checkSvg
          setTimeout(() => { codeCopyBtn.innerHTML = window.chatAPI.copySvg }, 2000)
        })
      }
      return
    }

    // Message copy button
    const msgCopyBtn = e.target.closest('.msg-copy-btn')
    if (msgCopyBtn) {
      const msgId = msgCopyBtn.dataset.msgId
      // For user messages, plainText is stored directly; for pet, use rawContentMap
      const text = msgCopyBtn.dataset.plainText || rawContentMap.get(msgId) || ''
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          msgCopyBtn.innerHTML = window.chatAPI.checkSvg
          setTimeout(() => { msgCopyBtn.innerHTML = window.chatAPI.copySvg }, 2000)
        })
      }
      return
    }

    // Markdown links
    const link = e.target.closest('a.md-link')
    if (link) {
      e.preventDefault()
      window.chatAPI.openExternalUrl(link.getAttribute('href'))
      return
    }
  })

  // --- Context progress bar ---
  function updateContextBar(ratio) {
    const pct = Math.min(100, Math.round(ratio * 100))
    contextBar.style.width = pct + '%'

    if (ratio < 0.7) {
      contextBar.style.backgroundColor = 'rgb(170, 185, 200)'
    } else if (ratio < 0.85) {
      contextBar.style.backgroundColor = 'rgb(200, 180, 140)'
    } else {
      contextBar.style.backgroundColor = 'rgb(195, 140, 130)'
    }

    if (ratio >= 0.85 && !hasShownSlidingWarning) {
      hasShownSlidingWarning = true
      const warnText = i18n?.system?.slidingWindow || 'Chat getting long, earlier messages will be gradually forgotten~'
      appendSystemMessageDOM(warnText)
    }
  }

  window.chatAPI.onContextUsage((ratio) => {
    updateContextBar(ratio)
  })

  // --- Send / Stop button ---
  function updateSendButton() {
    if (isStreaming) {
      sendBtn.classList.add('is-streaming')
      sendBtn.querySelectorAll('.send-icon').forEach(el => el.style.display = 'none')
      sendBtn.querySelectorAll('.stop-icon').forEach(el => el.style.display = '')
    } else {
      sendBtn.classList.remove('is-streaming')
      sendBtn.querySelectorAll('.send-icon').forEach(el => el.style.display = '')
      sendBtn.querySelectorAll('.stop-icon').forEach(el => el.style.display = 'none')
    }
  }

  // Immediate streaming state from main (arrives before ai-stream-start)
  window.chatAPI.onStreamingChanged((streaming) => {
    isStreaming = streaming
    updateSendButton()
  })

  // --- Scrolling ---
  let _scrollRAF = null
  function scrollToBottom() {
    if (_scrollRAF) return
    _scrollRAF = requestAnimationFrame(() => {
      _scrollRAF = null
      messageList.scrollTop = messageList.scrollHeight
    })
  }

  messageList.addEventListener('scroll', () => {
    const threshold = 30
    const atBottom = messageList.scrollTop + messageList.clientHeight >= messageList.scrollHeight - threshold
    if (atBottom) {
      userScrolledUp = false
      hideNewMessageIndicator()
    } else {
      userScrolledUp = true
      showNewMessageIndicator()
    }
  })

  messageList.addEventListener('toggle', (e) => {
    if (e.target.classList.contains('thinking-block')) {
      const threshold = 30
      const atBottom = messageList.scrollTop + messageList.clientHeight >= messageList.scrollHeight - threshold
      if (atBottom) {
        userScrolledUp = false
        hideNewMessageIndicator()
      }
      if (e.target.open && !userScrolledUp) scrollToBottom()
    }
  }, true)

  function showNewMessageIndicator() {
    if (newMsgIndicator) return
    newMsgIndicator = document.createElement('div')
    newMsgIndicator.className = 'new-message-indicator'

    const pixelSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    pixelSvg.setAttribute('class', 'icon-pixel')
    pixelSvg.setAttribute('width', '10')
    pixelSvg.setAttribute('height', '10')
    pixelSvg.setAttribute('viewBox', '0 0 10 10')
    pixelSvg.innerHTML = '<line x1="5" y1="2" x2="5" y2="8" stroke="currentColor" stroke-width="1"/><line x1="2" y1="5.5" x2="5" y2="8.5" stroke="currentColor" stroke-width="1"/><line x1="8" y1="5.5" x2="5" y2="8.5" stroke="currentColor" stroke-width="1"/>'

    const cleanSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    cleanSvg.setAttribute('class', 'icon-clean')
    cleanSvg.setAttribute('width', '10')
    cleanSvg.setAttribute('height', '10')
    cleanSvg.setAttribute('viewBox', '0 0 10 10')
    cleanSvg.innerHTML = '<line x1="5" y1="2" x2="5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="2.5" y1="5.5" x2="5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="7.5" y1="5.5" x2="5" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'

    newMsgIndicator.appendChild(pixelSvg)
    newMsgIndicator.appendChild(cleanSvg)
    newMsgIndicator.addEventListener('click', () => {
      scrollToBottom()
      userScrolledUp = false
      hideNewMessageIndicator()
    })
    messageList.appendChild(newMsgIndicator)
  }

  function hideNewMessageIndicator() {
    if (newMsgIndicator) {
      newMsgIndicator.remove()
      newMsgIndicator = null
    }
  }

  // --- Input ---
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto'
    const newHeight = Math.min(chatInput.scrollHeight, 80)
    chatInput.style.height = newHeight + 'px'
    chatInput.style.overflowY = chatInput.scrollHeight > 80 ? 'auto' : 'hidden'
  })

  // --- Input context menu (HTML overlay) ---
  const inputContextMenu = document.getElementById('inputContextMenu')

  chatInput.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 140)
    const y = Math.min(e.clientY, window.innerHeight - 130)
    inputContextMenu.style.left = x + 'px'
    inputContextMenu.style.top = y + 'px'
    inputContextMenu.style.display = 'block'
  })

  inputContextMenu.addEventListener('click', async (e) => {
    const item = e.target.closest('.icm-item')
    if (!item) return
    const action = item.dataset.action
    inputContextMenu.style.display = 'none'
    chatInput.focus()
    if (action === 'cut') {
      const start = chatInput.selectionStart
      const end = chatInput.selectionEnd
      if (start !== end) {
        const selected = chatInput.value.substring(start, end)
        await window.chatAPI.writeClipboard(selected)
        chatInput.value = chatInput.value.substring(0, start) + chatInput.value.substring(end)
        chatInput.selectionStart = chatInput.selectionEnd = start
        chatInput.dispatchEvent(new Event('input'))
      }
    } else if (action === 'copy') {
      const selected = chatInput.value.substring(chatInput.selectionStart, chatInput.selectionEnd)
      if (selected) await window.chatAPI.writeClipboard(selected)
    } else if (action === 'paste') {
      const text = await window.chatAPI.readClipboard()
      if (text) {
        const start = chatInput.selectionStart
        const end = chatInput.selectionEnd
        chatInput.value = chatInput.value.substring(0, start) + text + chatInput.value.substring(end)
        chatInput.selectionStart = chatInput.selectionEnd = start + text.length
        chatInput.dispatchEvent(new Event('input'))
      }
    } else if (action === 'selectAll') {
      chatInput.select()
    }
  })

  document.addEventListener('click', (e) => {
    if (!inputContextMenu.contains(e.target)) {
      inputContextMenu.style.display = 'none'
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && inputContextMenu.style.display !== 'none') {
      inputContextMenu.style.display = 'none'
    }
  })

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendOrStop()
    }
    if (e.key === 'Escape') {
      window.chatAPI.closePanel()
    }
  })

  sendBtn.addEventListener('click', () => handleSendOrStop())

  // --- Image input: file picker ---
  attachBtn.addEventListener('click', async () => {
    const dataUrls = await window.chatAPI.pickImages()
    for (const dataUrl of dataUrls) {
      if (pendingImages.length >= MAX_IMAGES) break
      const compressed = await compressImage(dataUrl)
      addImageToPreview(compressed)
    }
  })

  // --- Image input: paste ---
  chatInput.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue
      e.preventDefault()
      const blob = item.getAsFile()
      if (!blob) continue
      const reader = new FileReader()
      reader.onload = async () => {
        const compressed = await compressImage(reader.result)
        addImageToPreview(compressed)
      }
      reader.readAsDataURL(blob)
    }
  })

  // --- Image input: drag and drop ---
  const inputWrapper = document.querySelector('.chat-input-wrapper')
  const inputArea = document.querySelector('.chat-input-area')

  inputArea.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    inputArea.classList.add('drag-over')
  })

  inputArea.addEventListener('dragleave', (e) => {
    if (!inputArea.contains(e.relatedTarget)) inputArea.classList.remove('drag-over')
  })

  inputArea.addEventListener('drop', (e) => {
    e.preventDefault()
    inputArea.classList.remove('drag-over')
    for (const file of e.dataTransfer.files) {
      if (!file.type.startsWith('image/')) continue
      if (pendingImages.length >= MAX_IMAGES) break
      const reader = new FileReader()
      reader.onload = async () => {
        const compressed = await compressImage(reader.result)
        addImageToPreview(compressed)
      }
      reader.readAsDataURL(file)
    }
  })

  function handleSendOrStop() {
    if (isStreaming) {
      window.chatAPI.stopStreaming()
      return
    }
    sendMessage()
  }

  function sendMessage() {
    const text = chatInput.value.trim()
    if (!text && pendingImages.length === 0) return
    const images = pendingImages.length > 0
      ? pendingImages.map(img => ({ base64: img.base64, mimeType: img.mimeType }))
      : null
    window.chatAPI.sendMessage(text, images)
    clearImagePreview()
    userScrolledUp = false
    hideNewMessageIndicator()
    chatInput.value = ''
    chatInput.style.height = 'auto'
    chatInput.style.overflowY = 'hidden'
  }

  // --- Window controls ---
  minimizeBtn.addEventListener('click', () => {
    window.chatAPI.minimizeWindow()
  })

  maximizeBtn.addEventListener('click', () => {
    window.chatAPI.maximizeWindow()
  })

  window.chatAPI.onMaximizeChanged((isMaximized) => {
    maximizeBtn.querySelectorAll('.maximize-normal').forEach(el => el.style.display = isMaximized ? 'none' : '')
    maximizeBtn.querySelectorAll('.maximize-restored').forEach(el => el.style.display = isMaximized ? '' : 'none')
    if (isMaximized) document.body.classList.add('maximized')
    else document.body.classList.remove('maximized')
    if (!userScrolledUp) {
      scrollToBottom()
      hideNewMessageIndicator()
    }
  })

  // --- Close ---
  closeBtn.addEventListener('click', () => {
    container.classList.remove('entering')
    container.classList.add('leaving')
    setTimeout(() => {
      window.chatAPI.closePanel()
    }, 150)
  })

  container.addEventListener('animationend', (e) => {
    if (e.animationName === 'chatOpen') {
      container.classList.remove('entering')
    }
  })

  // Focus input on load
  setTimeout(() => chatInput.focus(), 200)

  // Color scheme — batched with theme via scheduleMergedStyleUpdate
  window.chatAPI.onColorScheme((data) => {
    if (!data || !data.derived) return
    pendingColors = data.derived
    scheduleMergedStyleUpdate()
  })
})()
