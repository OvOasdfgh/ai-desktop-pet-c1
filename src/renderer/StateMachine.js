class StateMachine {
  constructor(statesData) {
    this.states = statesData
    this.currentState = 'idle'
    this.currentFrame = 0
    this.lastFrameTime = 0
    this.onFrameChange = null

    // Priority system: 0=idle, 1=interrupts, 2=system behaviors, 3=interactions
    this.currentPriority = 0
    this.holdLoop = false

    // Hold last frame mechanism
    this.holdLastFrameDuration = 0
    this.holdingLastFrame = false
    this.holdStartTime = 0

    // Freeze on last frame (caller controls unfreeze)
    this.freezeOnLastFrame = false
    this.freezing = false

    // FPS override (0 = use meta.fps)
    this.fpsOverride = 0

    // Interrupt config: state name -> weight (configurable)
    this.defaultInterrupts = { blink: 45, idle_look: 35, idle_stretch: 20 }
    this.interrupts = { ...this.defaultInterrupts }
    this.totalWeight = 100

    // Interrupt delay range (configurable for night mode)
    this.interruptMinDelay = 3000
    this.interruptMaxDelay = 8000

    // Callback when returning to idle (for SystemBehaviorManager)
    this.onReturnToIdle = null

    // On-demand scheduling (replaces 60fps rAF loop)
    this._scheduledTimer = null
    this._scheduledRAF = null

    this.scheduleNextInterrupt()
  }

  setInterrupts(weights) {
    this.interrupts = weights
    this.totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  }

  resetInterrupts() {
    this.interrupts = { ...this.defaultInterrupts }
    this.totalWeight = 100
  }

  setInterruptDelay(min, max) {
    this.interruptMinDelay = min
    this.interruptMaxDelay = max
  }

  resetInterruptDelay() {
    this.interruptMinDelay = 3000
    this.interruptMaxDelay = 8000
  }

  scheduleNextInterrupt() {
    const delay = this.interruptMinDelay + Math.random() * (this.interruptMaxDelay - this.interruptMinDelay)
    this.nextInterruptTime = performance.now() + delay
  }

  pickInterrupt() {
    let roll = Math.random() * this.totalWeight
    for (const [state, weight] of Object.entries(this.interrupts)) {
      roll -= weight
      if (roll <= 0) return state
    }
    return 'blink'
  }

  /**
   * Schedule the next animation tick on-demand.
   * Replaces the continuous 60fps rAF loop — only wakes when a frame is due.
   */
  scheduleNext() {
    if (this._scheduledTimer) { clearTimeout(this._scheduledTimer); this._scheduledTimer = null }
    if (this._scheduledRAF) { cancelAnimationFrame(this._scheduledRAF); this._scheduledRAF = null }

    const meta = this.states[this.currentState]
    if (!meta) return

    // Frozen state waits for external returnToIdle(), don't schedule
    if (this.freezing) return

    let delay
    if (this.holdingLastFrame) {
      delay = this.holdLastFrameDuration - (performance.now() - this.holdStartTime)
    } else {
      let frameDuration
      if (!this.fpsOverride && meta.frameDurations && meta.frameDurations[this.currentFrame] !== undefined) {
        frameDuration = meta.frameDurations[this.currentFrame]
      } else {
        frameDuration = 1000 / (this.fpsOverride || meta.fps)
      }
      const elapsed = performance.now() - this.lastFrameTime
      delay = frameDuration - elapsed
    }

    // In idle, also wake for interrupt timer if it fires sooner
    if (this.currentState === 'idle' && this.currentPriority === 0) {
      const interruptDelay = this.nextInterruptTime - performance.now()
      if (interruptDelay >= 0 && interruptDelay < delay) {
        delay = interruptDelay
      }
    }

    this._scheduledTimer = setTimeout(() => {
      this._scheduledTimer = null
      this._scheduledRAF = requestAnimationFrame((ts) => {
        this._scheduledRAF = null
        this.update(ts)
      })
    }, Math.max(0, Math.floor(delay)))
  }

  /**
   * Force transition to a new state with priority.
   * @param {string} stateName
   * @param {object} opts
   *   - priority: number (default 2)
   *   - hold: boolean — keep looping (for drag/petted)
   *   - holdLastFrameDuration: number (ms) — hold last frame before returning to idle
   *   - freezeOnLastFrame: boolean — freeze on last frame, caller must call returnToIdle()
   */
  forceState(stateName, opts = {}) {
    const priority = opts.priority ?? 2
    const hold = opts.hold ?? false

    if (priority < this.currentPriority) return false

    this.currentState = stateName
    this.currentFrame = 0
    this.lastFrameTime = performance.now()
    this.currentPriority = priority
    this.holdLoop = hold
    this.holdLastFrameDuration = opts.holdLastFrameDuration ?? 0
    this.holdingLastFrame = false
    this.holdStartTime = 0
    this.freezeOnLastFrame = opts.freezeOnLastFrame ?? false
    this.freezing = false
    this.fpsOverride = opts.fpsOverride ?? 0

    if (this.onFrameChange) {
      this.onFrameChange(this.currentState, this.currentFrame)
    }
    this.scheduleNext()
    return true
  }

  /**
   * Release hold on a looping state.
   */
  releaseHold() {
    this.holdLoop = false
  }

  /**
   * Immediate reset to idle.
   */
  returnToIdle() {
    this.currentState = 'idle'
    this.currentFrame = 0
    this.currentPriority = 0
    this.holdLoop = false
    this.holdLastFrameDuration = 0
    this.holdingLastFrame = false
    this.freezeOnLastFrame = false
    this.freezing = false
    this.fpsOverride = 0
    this.lastFrameTime = 0
    this.scheduleNextInterrupt()

    if (this.onFrameChange) {
      this.onFrameChange(this.currentState, this.currentFrame)
    }

    if (this.onReturnToIdle) {
      this.onReturnToIdle()
    }
    this.scheduleNext()
  }

  update(timestamp) {
    const meta = this.states[this.currentState]
    if (!meta) return

    // Frozen on last frame — do nothing, wait for caller to unfreeze
    if (this.freezing) return

    // Holding last frame with timer
    if (this.holdingLastFrame) {
      if (timestamp - this.holdStartTime >= this.holdLastFrameDuration) {
        this.returnToIdle()
      } else {
        this.scheduleNext()
      }
      return
    }

    let frameDuration
    if (!this.fpsOverride && meta.frameDurations && meta.frameDurations[this.currentFrame] !== undefined) {
      frameDuration = meta.frameDurations[this.currentFrame]
    } else {
      frameDuration = 1000 / (this.fpsOverride || meta.fps)
    }

    if (timestamp - this.lastFrameTime < frameDuration) {
      this.scheduleNext()
      return
    }

    this.lastFrameTime = timestamp
    this.currentFrame++

    // Frame cycle complete
    if (this.currentFrame >= meta.frames) {
      if (this.currentPriority >= 2) {
        // System behavior or interaction state
        if (meta.loop && this.holdLoop) {
          // Keep looping (drag, petted while held)
          this.currentFrame = 0
        } else if (this.freezeOnLastFrame) {
          // Freeze on last frame — caller controls when to unfreeze
          this.currentFrame = meta.frames - 1
          this.freezing = true
          return
        } else if (this.holdLastFrameDuration > 0) {
          // Hold last frame for a duration then return to idle
          this.currentFrame = meta.frames - 1
          this.holdingLastFrame = true
          this.holdStartTime = timestamp
          if (this.onFrameChange) {
            this.onFrameChange(this.currentState, this.currentFrame)
          }
          this.scheduleNext()
          return
        } else {
          // Return to idle immediately
          this.returnToIdle()
          return
        }
      } else if (this.currentState === 'idle') {
        // Loop idle, but check for interrupt
        this.currentFrame = 0
        if (timestamp >= this.nextInterruptTime) {
          this.currentState = this.pickInterrupt()
          this.currentFrame = 0
          this.currentPriority = 1
          this.lastFrameTime = timestamp
        }
      } else {
        // Non-loop interrupt finished, return to idle
        this.currentState = 'idle'
        this.currentFrame = 0
        this.currentPriority = 0
        this.scheduleNextInterrupt()
      }
    }

    if (this.onFrameChange) {
      this.onFrameChange(this.currentState, this.currentFrame)
    }
    this.scheduleNext()
  }
}
