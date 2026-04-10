(async () => {
  // Load animation metadata
  const res = await fetch('../../output/states.json')
  const statesData = await res.json()

  // Initialize sprite renderer
  const canvas = document.getElementById('pet-canvas')
  const renderer = new SpriteRenderer(canvas)

  // Get initial config and apply scale + theme
  const cfg = await window.petAPI.getConfig()
  const initialScale = cfg.displayScale || 4
  renderer.setScale(initialScale)
  document.body.dataset.theme = cfg.theme || 'pixel'

  // Preload sprite sheets
  await renderer.preloadSheets([
    // Phase 1a
    'idle', 'blink', 'idle_look', 'idle_stretch',
    // Phase 1b
    'drag', 'thrown', 'poked', 'petted',
    // Phase 1c
    'typing', 'sleepy', 'sleeping', 'wakeup', 'greeting',
    'bored', 'want_to_talk', 'walk', 'jump',
    'curious',
    'happy', 'excited', 'surprised', 'comfort',
    // Phase 1d conversation
    'reading', 'thinking', 'speaking',
    'confused', 'error',
    'viewing',
    // Phase 1d batch 3: proactive + reminder animations
    'notify', 'voice_reply',
    // Phase 2: memory + emotion animations
    'learn', 'forget', 'recall',
    'sad', 'love',
  ])

  // Initialize state machine
  const sm = new StateMachine(statesData)
  sm.onFrameChange = (state, frame) => renderer.drawFrame(state, frame)

  // Initialize system behavior manager
  const systemBehavior = new SystemBehaviorManager(sm, renderer, window.petAPI, statesData)

  // Initialize interaction manager (with systemBehavior reference)
  const interaction = new InteractionManager(canvas, renderer, sm, window.petAPI, systemBehavior)

  // Detect character bounds and send to main process
  const charBounds = renderer.detectCharacterBounds('idle', 0)
  if (charBounds) {
    window.petAPI.sendCharacterBounds(charBounds)
  }

  // Draw initial frame
  renderer.drawFrame('idle', 0)

  // Start on-demand animation scheduling (wakes only when a frame is due)
  sm.scheduleNext()

  // Listen for scale changes from menu
  window.petAPI.onScaleChanged((scale) => {
    renderer.setScale(scale)
    renderer.drawFrame(sm.currentState, sm.currentFrame)
  })

  // Wire system activity IPC
  window.petAPI.onSystemActivity((data) => {
    systemBehavior.onSystemActivity(data)
  })

  // Wire foreground window IPC
  window.petAPI.onForegroundWindow((data) => {
    systemBehavior.onForegroundWindow(data)
  })

  // Reload categories when updated via menu
  window.petAPI.onAppCategoriesUpdated(() => {
    systemBehavior._loadAppCategories()
  })

  // Check daily greeting
  systemBehavior.checkDailyGreeting()

  // --- AI animation controller ---
  let currentAiState = null
  const origSmReturnToIdle = sm.onReturnToIdle  // Preserve SM's permanent callback

  const AI_HOLD_STATES = ['thinking', 'speaking']
  const smReturnToIdle = () => {
    if (currentAiState) {
      sm.forceState(currentAiState, {
        priority: 2,
        hold: AI_HOLD_STATES.includes(currentAiState)
      })
      return
    }
    if (origSmReturnToIdle) origSmReturnToIdle()
  }
  sm.onReturnToIdle = smReturnToIdle

  window.petAPI.onAiAnimationState((state) => {
    // Don't let 'confused' override — it's a temporary animation, AI is still thinking
    if (state !== 'confused') {
      currentAiState = (state === 'idle') ? null : state
    }

    // Restore SM callback by default (prevents confused temp callback from leaking)
    // Only confused sets its own temporary callback after this
    if (state !== 'confused') {
      sm.onReturnToIdle = smReturnToIdle
    }

    switch (state) {
      case 'viewing':
        systemBehavior.cancelPendingChains()
        sm.forceState('viewing', { priority: 2 })
        break

      case 'reading':
        systemBehavior.cancelPendingChains()
        sm.forceState('reading', { priority: 2 })
        break

      case 'thinking':
        sm.forceState('thinking', { priority: 2, hold: true })
        break

      case 'confused': {
        // Release thinking hold, play confused once, then back to thinking
        sm.releaseHold()
        sm.forceState('confused', { priority: 2 })
        sm.onReturnToIdle = () => {
          sm.onReturnToIdle = smReturnToIdle  // Restore SM callback
          sm.forceState('thinking', { priority: 2, hold: true })
        }
        break
      }

      case 'confused-once':
        // One-shot confused (for "not configured" case, no return to thinking)
        sm.forceState('confused', { priority: 2 })
        break

      case 'speaking':
        sm.releaseHold()
        sm.forceState('speaking', { priority: 2, hold: true })
        break

      case 'idle':
        sm.releaseHold()
        // Let current animation finish naturally via StateMachine
        break

      case 'error':
        systemBehavior.cancelPendingChains()
        sm.releaseHold()
        sm.forceState('error', { priority: 2, fpsOverride: 1.5 })
        currentAiState = null
        sm.onReturnToIdle = () => {
          sm.onReturnToIdle = smReturnToIdle
          if (origSmReturnToIdle) origSmReturnToIdle()
        }
        break

      case 'notify':
        sm.forceState('notify', { priority: 2 })
        currentAiState = null
        break

      case 'voice_reply':
        sm.releaseHold()
        sm.forceState('voice_reply', { priority: 2 })
        currentAiState = null
        break

      // Memory animations (non-looping, play once → idle)
      case 'learn':
      case 'forget':
      case 'recall':
        sm.forceState(state, { priority: 2 })
        currentAiState = null
        break

      // Emotion animations (non-looping, play once → idle)
      case 'happy':
      case 'excited':
      case 'sad':
      case 'surprised':
      case 'love':
      case 'comfort':
        currentAiState = null
        sm.releaseHold()
        sm.forceState(state, { priority: 2 })
        break
    }
  })

  // Theme changes
  window.petAPI.onThemeChanged((theme) => {
    document.body.dataset.theme = theme
  })

  // Color scheme
  window.petAPI.onColorScheme((data) => {
    if (!data || !data.derived) return
    Object.entries(data.derived).forEach(([k, v]) => document.body.style.setProperty(k, v))
  })

  // State override changed
  window.petAPI.onStateOverrideChanged(async (data) => {
    const stateName = data.stateName
    // Remove cached sheet so it reloads from sprite:// protocol
    renderer.cache.delete(stateName)
    renderer._cacheVersion++
    await renderer.loadSheet(stateName)
    if (sm.currentState === stateName) {
      renderer.drawFrame(stateName, sm.currentFrame)
    }
  })

  // Character changed
  window.petAPI.onCharacterChanged(async (data) => {
    renderer.updateMeta(data.meta)
    renderer.clearCache()
    await renderer.preloadSheets([
      'idle', 'blink', 'idle_look', 'idle_stretch',
      'drag', 'thrown', 'poked', 'petted',
      'typing', 'sleepy', 'sleeping', 'wakeup', 'greeting',
      'bored', 'want_to_talk', 'walk', 'jump',
      'curious',
      'happy', 'excited', 'surprised', 'comfort',
      'reading', 'thinking', 'speaking',
      'confused', 'error',
      'viewing',
      'notify', 'voice_reply',
    ])
    renderer.drawFrame(sm.currentState, sm.currentFrame)

    // Re-detect character bounds
    const charBounds = renderer.detectCharacterBounds('idle', 0)
    if (charBounds) {
      window.petAPI.sendCharacterBounds(charBounds)
    }
  })
})()
