/**
 * SystemBehaviorManager — drives pet behavior based on system activity.
 *
 * Receives system-activity IPC (idleTime + cursorMoved) every 2s from main process.
 * Controls StateMachine at priority 2 (below user interactions P3, above idle interrupts P1).
 *
 * Behavior modes:
 *   active-keyboard — user typing → typing animation loop
 *   active-mouse    — user mousing → idle with boosted idle_look
 *   idle            — normal idle, autonomous walk may trigger
 *   sleepy          — 3min idle → sleepy loop
 *   sleeping        — 5min idle → sleeping loop
 *   wakeup          — transitional: wakeup → greeting chain
 *   walking         — autonomous walk in progress
 *   bored           — 15min no pet interaction → bored, may escalate to want_to_talk
 */
class SystemBehaviorManager {
  constructor(stateMachine, spriteRenderer, petAPI, statesData) {
    this.sm = stateMachine
    this.renderer = spriteRenderer
    this.petAPI = petAPI
    this.states = statesData

    // Current behavior mode
    this.mode = 'idle'

    // Thresholds (seconds)
    this.SLEEPY_THRESHOLD = 180   // 3 minutes
    this.SLEEPING_THRESHOLD = 300 // 5 minutes

    // Bored system
    this.BORED_THRESHOLD = 15 * 60 * 1000 // 15 minutes in ms
    this.lastPetInteractionTime = Date.now()
    this.boredActive = false
    this.wantToTalkTimer = null
    this.boredMissCount = 0 // Guaranteed want_to_talk after 3 consecutive misses

    // Walk system
    this.WALK_MIN_INTERVAL = 120000 // 2 minutes
    this.WALK_MAX_INTERVAL = 180000 // 3 minutes
    this.walkTimer = null
    this.walkMoveInterval = null
    this.walkDirection = 1
    this.walkStartTime = 0
    this.walkDuration = 0
    this.jumpAfterWalk = false
    this.walkPhase = 'outbound'       // 'outbound' or 'returning'
    this.walkDistanceTraveled = 0     // signed displacement from origin

    // Bored chain (play twice)
    this.boredPhase = null  // null, 'first', 'second'

    // Wakeup sequence state
    this.wakeupPhase = null // null, 'wakeup', 'greeting', 'greeting_repeat'

    // Track last activity for transition detection
    this.lastIdleTime = 0

    // Foreground window tracking
    this.lastProcessName = ''
    this.curiousCooldownUntil = 0
    this.CURIOUS_COOLDOWN = 30000  // 30s
    this.curiousPhase = null  // null, 'first', 'second'

    // App categories
    this.appCategories = null
    this.currentCategory = null
    this.categoryInterruptsApplied = false
    this._loadAppCategories()

    // Night mode
    this.nightMode = false
    this._updateNightMode()

    // Hook into state machine return-to-idle
    this.sm.onReturnToIdle = () => this._onReturnToIdle()

    // Schedule first walk
    this._scheduleWalk()
  }

  /**
   * Called by renderer.js when system-activity IPC arrives (every 2s).
   */
  onSystemActivity({ idleTime, cursorMoved }) {
    // Update night mode each tick
    this._updateNightMode()

    // Don't override user interactions (P3) or wakeup sequence
    if (this.sm.currentPriority >= 3) {
      this.lastIdleTime = idleTime
      return
    }

    const sleepyThreshold = this._isDeepNight() ? 60 : this.SLEEPY_THRESHOLD

    if (idleTime < 2) {
      this._onUserActive(cursorMoved)
    } else if (idleTime >= this.SLEEPING_THRESHOLD) {
      this._onUserIdle('sleeping')
    } else if (idleTime >= sleepyThreshold) {
      this._onUserIdle('sleepy')
    } else {
      // Mild idle (< 3 min) — return to normal idle if we were in an active mode
      if (this.mode === 'active-keyboard' || this.mode === 'active-mouse') {
        this._setMode('idle')
      }
    }

    this.lastIdleTime = idleTime
  }

  /**
   * Called by renderer.js when foreground-window IPC arrives (every 5s).
   */
  onForegroundWindow({ processName, windowTitle }) {
    const processLower = (processName || '').toLowerCase()

    // Detect process name change
    const processChanged = (processLower !== this.lastProcessName)
    const prevProcessName = this.lastProcessName
    this.lastProcessName = processLower

    // Update category and apply interrupts
    const newCategory = this._matchCategory(processLower)
    if (newCategory !== this.currentCategory) {
      this.currentCategory = newCategory
      // Apply category interrupts only in idle/active-mouse mode
      if (this.mode === 'idle' || this.mode === 'active-mouse' || this.mode === 'active-keyboard') {
        this._applyCategoryInterrupts(newCategory)
      }
    }

    // Trigger curious on process name change (skip first detection)
    if (processChanged && prevProcessName !== '') {
      this._tryCurious()
    }
  }

  /**
   * Called by InteractionManager on any pet interaction (poke/pet/drag).
   */
  onPetInteraction() {
    this.lastPetInteractionTime = Date.now()
    this.boredActive = false
    this.boredPhase = null
    this.boredMissCount = 0
    if (this.wantToTalkTimer) {
      clearTimeout(this.wantToTalkTimer)
      this.wantToTalkTimer = null
    }
    // Stop walk if in progress
    if (this.mode === 'walking') {
      this._stopWalk()
      this.mode = 'idle'
    } else if (this.mode === 'bored') {
      this.mode = 'idle'
    }
  }

  /**
   * Play greeting on every startup.
   */
  checkDailyGreeting() {
    // Small delay to let initial render settle
    setTimeout(() => {
      this.wakeupPhase = 'greeting'
      this.sm.forceState('greeting', { priority: 2 })
    }, 500)
  }

  // --- Internal: Activity handlers ---

  _onUserActive(cursorMoved) {
    const wasAsleep = (this.mode === 'sleepy' || this.mode === 'sleeping')

    if (wasAsleep) {
      this._playWakeupSequence()
      return
    }

    // Don't interrupt wakeup sequence
    if (this.mode === 'wakeup') return

    // Don't interrupt walk — let it finish naturally
    if (this.mode === 'walking') return

    if (cursorMoved) {
      this._setMode('active-mouse')
    } else {
      this._setMode('active-keyboard')
    }

    // Check bored (user active but ignoring pet)
    this._checkBored()
  }

  _onUserIdle(level) {
    // Don't re-trigger if already at this level or deeper
    if (this.mode === level) return
    if (level === 'sleepy' && this.mode === 'sleeping') return

    // _setMode handles walk cleanup via oldMode check
    this._setMode(level)
  }

  // --- Internal: Mode management ---

  _setMode(newMode) {
    if (newMode === this.mode) return
    const oldMode = this.mode
    this.mode = newMode

    // Clean up old mode
    if (oldMode === 'walking' && newMode !== 'walking') {
      this._stopWalk()
      this.sm.returnToIdle()
    }

    // Clean up bored/want_to_talk timer on any mode change
    if (this.wantToTalkTimer) {
      clearTimeout(this.wantToTalkTimer)
      this.wantToTalkTimer = null
      this.boredActive = false
    }

    switch (newMode) {
      case 'active-keyboard':
        this._applyModeInterrupts()
        // Only force typing if we're in idle/interrupt (not during bored/walk)
        if (this.sm.currentPriority <= 1) {
          this.sm.forceState('typing', { priority: 2, hold: true })
        }
        break

      case 'active-mouse':
        this._applyModeInterrupts()
        // Return to idle if we were in typing
        if (this.sm.currentState === 'typing') {
          this.sm.returnToIdle()
        }
        break

      case 'idle':
        this._applyModeInterrupts()
        // Return to idle if we were in a system state
        if (this.sm.currentPriority === 2 && !this.boredActive && !this._isAiAnimating()) {
          this.sm.returnToIdle()
        }
        break

      case 'sleepy':
        if (!this._isAiAnimating()) {
          this.sm.forceState('sleepy', { priority: 2, hold: true })
        }
        this._cancelWalk()
        break

      case 'sleeping':
        if (!this._isAiAnimating()) {
          this.sm.forceState('sleeping', { priority: 2, hold: true })
        }
        this._cancelWalk()
        break

      case 'wakeup':
        // Handled by _playWakeupSequence
        break
    }
  }

  // --- Internal: Wakeup sequence ---

  _playWakeupSequence() {
    this.mode = 'wakeup'
    this.wakeupPhase = 'wakeup'
    this.sm.forceState('wakeup', { priority: 2 })
  }

  // --- Internal: onReturnToIdle callback ---

  _onReturnToIdle() {
    if (this._continueWakeupChain()) return
    if (this._continueCuriousChain()) return
    if (this._continueBoredChain()) return
    if (this._handleJumpAfterWalk()) return
    this._reassertMode()
  }

  _continueWakeupChain() {
    if (this.wakeupPhase === 'wakeup') {
      this.wakeupPhase = 'greeting'
      this.sm.forceState('greeting', { priority: 2 })
      return true
    }
    if (this.wakeupPhase === 'greeting') {
      this.wakeupPhase = 'greeting_repeat'
      this.sm.forceState('greeting', { priority: 2 })
      return true
    }
    if (this.wakeupPhase === 'greeting_repeat') {
      this.wakeupPhase = null
      if (this.mode === 'wakeup') this.mode = 'idle'
      this._scheduleWalk()
    }
    return false
  }

  _continueCuriousChain() {
    if (this.curiousPhase === 'first') {
      this.curiousPhase = 'second'
      this.sm.forceState('curious', { priority: 2 })
      return true
    }
    if (this.curiousPhase === 'second') {
      this.curiousPhase = null
    }
    return false
  }

  _continueBoredChain() {
    if (this.boredPhase === 'first') {
      this.boredPhase = 'second'
      this.sm.forceState('bored', { priority: 2 })
      return true
    }
    if (this.boredPhase === 'second') {
      this.boredPhase = null
    }
    // After both plays complete: 30% chance want_to_talk (guaranteed after 3 misses)
    if (this.boredActive && this.sm.currentState === 'idle') {
      const shouldTalk = this.boredMissCount >= 3 || Math.random() < 0.3
      if (shouldTalk) {
        this.boredMissCount = 0
        this.sm.forceState('want_to_talk', { priority: 2, hold: true })
        const duration = 6000 + Math.random() * 2000
        this.wantToTalkTimer = setTimeout(() => {
          this.wantToTalkTimer = null
          this.boredActive = false
          this.mode = 'idle'
          // Notify main process to generate proactive message (hold stays until main sends voice_reply/idle)
          this.petAPI.wantToTalk()
        }, duration)
      } else {
        this.boredMissCount++
        this.boredActive = false
        this.mode = 'idle'
      }
      return true
    }
    return false
  }

  _handleJumpAfterWalk() {
    if (this.jumpAfterWalk) {
      this.jumpAfterWalk = false
      this.sm.forceState('jump', { priority: 2 })
      return true
    }
    return false
  }

  _reassertMode() {
    if (this.mode === 'active-keyboard' && this.sm.currentPriority === 0) {
      this.sm.forceState('typing', { priority: 2, hold: true })
    } else if (this.mode === 'sleepy' && this.sm.currentPriority === 0) {
      this.sm.forceState('sleepy', { priority: 2, hold: true })
    } else if (this.mode === 'sleeping' && this.sm.currentPriority === 0) {
      this.sm.forceState('sleeping', { priority: 2, hold: true })
    } else if (this.mode === 'active-mouse') {
      this._applyModeInterrupts()
    }
  }

  // --- Internal: Mode interrupt helper ---

  _applyModeInterrupts() {
    if (this.currentCategory) {
      this._applyCategoryInterrupts(this.currentCategory)
    } else if (this.mode === 'active-mouse') {
      this.sm.setInterrupts({ blink: 30, idle_look: 50, idle_stretch: 20 })
    } else {
      this.sm.resetInterrupts()
    }
  }

  // --- Internal: Bored system ---

  _checkBored() {
    if (this.boredActive) return
    if (this.mode === 'active-keyboard') return
    if (this.mode === 'walking' || this.mode === 'wakeup') return
    if (this._isAiAnimating()) return

    const threshold = this.nightMode ? 10 * 60 * 1000 : this.BORED_THRESHOLD
    const elapsed = Date.now() - this.lastPetInteractionTime
    if (elapsed >= threshold) {
      this.boredActive = true
      this.boredPhase = 'first'
      this.mode = 'bored'
      this.lastPetInteractionTime = Date.now()
      this.sm.forceState('bored', { priority: 2 })
    }
  }

  // --- Internal: Walk system ---

  _scheduleWalk() {
    this._cancelWalk()
    const nightMultiplier = this.nightMode ? 2 : 1
    const delay = (this.WALK_MIN_INTERVAL + Math.random() * (this.WALK_MAX_INTERVAL - this.WALK_MIN_INTERVAL)) * nightMultiplier
    this.walkTimer = setTimeout(() => {
      this.walkTimer = null
      this._tryStartWalk()
    }, delay)
  }

  _isAiAnimating() {
    const AI_STATES = ['reading', 'thinking', 'speaking', 'confused', 'error', 'notify', 'voice_reply']
    return AI_STATES.includes(this.sm.currentState)
  }

  _cancelWalk() {
    if (this.walkTimer) {
      clearTimeout(this.walkTimer)
      this.walkTimer = null
    }
    // If walk was in progress, clean up (stay at current position)
    if (this.walkMoveInterval) {
      this._clearWalkMovement()
      this.renderer.setFlipped(false)
      this.walkPhase = 'outbound'
      this.walkDistanceTraveled = 0
    }
  }

  _tryStartWalk() {
    // Only walk during idle or active-mouse modes
    if (this.mode !== 'idle' && this.mode !== 'active-mouse') {
      this._scheduleWalk()
      return
    }
    // Don't walk if user interaction or other system state active
    if (this.sm.currentPriority >= 2) {
      this._scheduleWalk()
      return
    }

    this._startWalk()
  }

  _startWalk() {
    this.mode = 'walking'

    // Pick random direction
    this.walkDirection = Math.random() < 0.5 ? -1 : 1
    this.renderer.setFlipped(this.walkDirection === -1)

    // Walk duration: 2-4 seconds (outbound phase)
    this.walkDuration = 2000 + Math.random() * 2000
    this.walkStartTime = Date.now()
    this.walkPhase = 'outbound'
    this.walkDistanceTraveled = 0

    // Start walk animation
    this.sm.forceState('walk', { priority: 2, hold: true })

    // Movement loop: 30px/s at ×4, scales proportionally
    const WALK_SPEED = 30 * (this.renderer.scale / 4)
    let lastMoveTime = Date.now()

    this.walkMoveInterval = setInterval(() => {
      const now = Date.now()
      const dt = (now - lastMoveTime) / 1000
      lastMoveTime = now

      const dx = Math.round(this.walkDirection * WALK_SPEED * dt)

      if (this.walkPhase === 'outbound') {
        // Outbound: walk until duration elapsed, then turn around
        if (dx !== 0) {
          this.walkDistanceTraveled += dx
          this.petAPI.moveWindow(dx, 0)
        }
        if (now - this.walkStartTime >= this.walkDuration) {
          this.walkPhase = 'returning'
          this.walkDirection *= -1
          this.renderer.setFlipped(this.walkDirection === -1)
        }
      } else {
        // Returning: walk back toward origin, stop when displacement crosses zero
        if (dx !== 0) {
          this.walkDistanceTraveled += dx
          this.petAPI.moveWindow(dx, 0)
        }
        const passedOrigin =
          (this.walkDirection === 1 && this.walkDistanceTraveled >= 0) ||
          (this.walkDirection === -1 && this.walkDistanceTraveled <= 0)
        if (passedOrigin) {
          this._finishWalk()
        }
      }
    }, 16)
  }

  _finishWalk() {
    this._clearWalkMovement()
    this.renderer.setFlipped(false)
    this.walkPhase = 'outbound'
    this.walkDistanceTraveled = 0

    // 15% chance of jump after walk
    this.jumpAfterWalk = Math.random() < 0.15

    this.sm.releaseHold()
    this.mode = 'idle'
    this._scheduleWalk()
  }

  _stopWalk() {
    this._clearWalkMovement()
    this.renderer.setFlipped(false)
    this.jumpAfterWalk = false
    this.walkPhase = 'outbound'
    this.walkDistanceTraveled = 0
    // Stay at current position — caller is responsible for setting mode
    this._scheduleWalk()
  }

  _clearWalkMovement() {
    if (this.walkMoveInterval) {
      clearInterval(this.walkMoveInterval)
      this.walkMoveInterval = null
    }
  }

  // --- Internal: App categories ---

  async _loadAppCategories() {
    try {
      this.appCategories = await this.petAPI.getAppCategories()
    } catch {
      this.appCategories = { categories: {} }
    }
  }

  _matchCategory(processName) {
    if (!this.appCategories || !this.appCategories.categories) return null
    for (const [catName, catConfig] of Object.entries(this.appCategories.categories)) {
      if (catConfig.processes && catConfig.processes.includes(processName)) {
        return catName
      }
    }
    return null
  }

  _applyCategoryInterrupts(category) {
    if (!this.appCategories || !this.appCategories.categories) return

    if (category && this.appCategories.categories[category]) {
      const catConfig = this.appCategories.categories[category]
      if (catConfig.interrupts) {
        this.sm.setInterrupts(catConfig.interrupts)
        this.categoryInterruptsApplied = true
        return
      }
    }

    // No category or no custom interrupts: restore defaults if needed
    if (this.categoryInterruptsApplied) {
      this.sm.resetInterrupts()
      this.categoryInterruptsApplied = false
    }
  }

  // --- Internal: Night mode ---

  _isNightTime() {
    const h = new Date().getHours()
    return h >= 22 || h < 7
  }

  _isDeepNight() {
    const h = new Date().getHours()
    return h >= 0 && h < 6
  }

  _updateNightMode() {
    const isNight = this._isNightTime()
    if (isNight === this.nightMode) return
    this.nightMode = isNight

    if (isNight) {
      this.sm.setInterruptDelay(6000, 16000)
    } else {
      this.sm.resetInterruptDelay()
    }
  }

  // --- Internal: Curious ---

  _tryCurious() {
    // Check cooldown
    if (Date.now() < this.curiousCooldownUntil) return

    // Don't trigger during these modes
    const blockedModes = ['sleepy', 'sleeping', 'wakeup', 'walking', 'bored']
    if (blockedModes.includes(this.mode)) return

    // Don't trigger during user interactions (P3)
    if (this.sm.currentPriority >= 3) return

    // Don't trigger during want_to_talk
    if (this.sm.currentState === 'want_to_talk') return
    if (this._isAiAnimating()) return

    // Set cooldown and play twice (chain via curiousPhase)
    this.curiousCooldownUntil = Date.now() + this.CURIOUS_COOLDOWN
    this.curiousPhase = 'first'
    this.sm.forceState('curious', { priority: 2 })
  }
}
