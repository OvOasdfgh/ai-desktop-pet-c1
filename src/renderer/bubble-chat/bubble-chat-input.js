;(function () {
  const input = document.getElementById('bciInput')
  const sendBtn = document.getElementById('bciSend')
  let isStreaming = false
  let FIXED_WIDTH = null
  let currentFactor = 1.0

  // --- Init ---
  window.bubbleChatAPI.onInit((data) => {
    if (data.theme) document.body.dataset.theme = data.theme
    if (data.placeholder) input.placeholder = data.placeholder
  })

  // --- Theme / Color ---
  window.bubbleChatAPI.onThemeChanged((theme) => {
    document.body.dataset.theme = theme
    document.fonts.ready.then(() => resizeInput())
  })

  window.bubbleChatAPI.onColorScheme((data) => {
    if (!data || !data.derived) return
    Object.entries(data.derived).forEach(([k, v]) => document.body.style.setProperty(k, v))
  })

  window.bubbleChatAPI.onLanguageChanged((data) => {
    if (data && data.placeholder) input.placeholder = data.placeholder
  })

  // --- Streaming state ---
  window.bubbleChatAPI.onStreamingChanged((streaming) => {
    isStreaming = streaming
    if (streaming) {
      sendBtn.classList.add('is-streaming')
      sendBtn.querySelectorAll('.send-icon').forEach(el => el.style.display = 'none')
      sendBtn.querySelectorAll('.stop-icon').forEach(el => el.style.display = '')
    } else {
      sendBtn.classList.remove('is-streaming')
      sendBtn.querySelectorAll('.send-icon').forEach(el => el.style.display = '')
      sendBtn.querySelectorAll('.stop-icon').forEach(el => el.style.display = 'none')
    }
  })

  // --- Send / Stop ---
  function handleSendOrStop() {
    if (isStreaming) {
      window.bubbleChatAPI.stopStreaming()
      return
    }
    const text = input.value.trim()
    if (!text) return
    window.bubbleChatAPI.sendMessage(text)
    input.value = ''
    resizeInput()
  }

  sendBtn.addEventListener('click', () => handleSendOrStop())

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendOrStop()
    }
  })

  // --- Auto-grow textarea ---
  function resizeInput() {
    input.style.height = 'auto'
    const h = Math.min(input.scrollHeight, 60)
    input.style.height = h + 'px'
    input.style.overflowY = input.scrollHeight > 60 ? 'auto' : 'hidden'

    // Report physical dimensions (layout size × scale factor)
    const totalH = document.querySelector('.bci-container').offsetHeight
    const physW = Math.round((FIXED_WIDTH || 200) * currentFactor)
    const physH = Math.round(totalH * currentFactor)
    window.bubbleChatAPI.inputResize(physW, physH)
  }

  input.addEventListener('input', resizeInput)

  // --- Scale change: transform scales visually, layout stays constant ---
  const SCALE_MAP = { 4: 0.7, 6: 0.85, 8: 1.0 }
  let initialized = false
  let pendingScale = null

  function applyScale(scale) {
    currentFactor = SCALE_MAP[scale] || 1.0
    document.documentElement.style.transform = `scale(${currentFactor})`
    document.documentElement.style.transformOrigin = 'top center'
    resizeInput()
  }

  window.bubbleChatAPI.onScaleChanged((scale) => {
    if (!initialized) { pendingScale = scale; return }
    applyScale(scale)
  })

  // Initial size report — lock width BEFORE any scale transform applied
  requestAnimationFrame(() => {
    document.fonts.ready.then(() => {
      FIXED_WIDTH = document.querySelector('.bci-container').offsetWidth
      initialized = true
      if (pendingScale != null) {
        applyScale(pendingScale)
      } else {
        resizeInput()
      }
    })
  })
})()
