;(function () {
  const bubble = document.getElementById('bubble')
  let displayTimer = null
  let fadeTimer = null

  function clearTimers() {
    if (displayTimer) { clearTimeout(displayTimer); displayTimer = null }
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
  }

  function hide() {
    clearTimers()
    bubble.classList.add('hidden')
    bubble.classList.remove('fading')
  }

  function startFade() {
    bubble.classList.add('fading')
    fadeTimer = setTimeout(() => {
      hide()
      window.bubbleAPI.bubbleFaded()
    }, 300)
  }

  // Show bubble
  window.bubbleAPI.onShowBubble(async (data) => {
    clearTimers()
    bubble.textContent = data.text
    if (data.theme) {
      document.body.dataset.theme = data.theme
    }
    bubble.classList.remove('hidden', 'fading')

    bubble.offsetWidth
    await document.fonts.ready

    const w = bubble.offsetWidth
    const h = bubble.offsetHeight
    window.bubbleAPI.bubbleResize(w, h)

    displayTimer = setTimeout(() => {
      startFade()
    }, 5000)
  })

  // Hide immediately
  window.bubbleAPI.onHideBubble(() => {
    hide()
  })

  // Click bubble → open chat panel
  bubble.addEventListener('click', () => {
    hide()
    window.bubbleAPI.bubbleClicked()
  })

  // Make bubble clickable (override window click-through)
  bubble.addEventListener('mouseenter', () => {
    window.bubbleAPI.setIgnoreMouse(false)
  })
  bubble.addEventListener('mouseleave', () => {
    window.bubbleAPI.setIgnoreMouse(true)
  })

  // Color scheme
  window.bubbleAPI.onColorScheme((data) => {
    if (!data || !data.derived) return
    Object.entries(data.derived).forEach(([k, v]) => document.body.style.setProperty(k, v))
  })
})()
