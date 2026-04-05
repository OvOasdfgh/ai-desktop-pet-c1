/**
 * InteractionManager — handles mouse interactions with the desktop pet.
 *
 * 5-state FSM: IDLE → PENDING → DRAGGING/PETTING → THROWN → IDLE
 *
 * Design decisions:
 * 1. Single click (any position) = poked
 * 2. Long press 500ms without moving = petted loop
 * 3. Drag >= 10px from mousedown position
 * 4. Thrown: mouseup velocity > 800 px/s → fly + vertical fall + landing
 * 5. Drag disables click-through
 * 6. Pause alwaysOnTop during drag
 * 7. Interactions interrupt any idle state
 * 8. Right-click menu on opaque pixel
 */
class InteractionManager {
  constructor(canvas, renderer, stateMachine, petAPI, systemBehavior) {
    this.canvas = canvas
    this.renderer = renderer
    this.sm = stateMachine
    this.petAPI = petAPI
    this.systemBehavior = systemBehavior || null

    // FSM state
    this.state = 'IDLE' // IDLE, PENDING, DRAGGING, PETTING, THROWN

    // Mouse tracking
    this.startScreenX = 0
    this.startScreenY = 0
    this.startTime = 0
    this.lastScreenX = 0
    this.lastScreenY = 0
    this.lastMoveTime = 0

    // Velocity tracking (EMA)
    this.velocityX = 0
    this.velocityY = 0

    // Petting timer
    this.petTimer = null

    // Thrown physics
    this.thrownRAF = null
    this.thrownLandingTimer = null

    // Bound handlers for add/remove
    this._onDocMouseMove = this._handleDocMouseMove.bind(this)
    this._onDocMouseUp = this._handleDocMouseUp.bind(this)
    this._onPetDocMouseUp = this._handlePetDocMouseUp.bind(this)

    // Canvas event listeners
    canvas.addEventListener('mousemove', (e) => this._handleCanvasMouseMove(e))
    canvas.addEventListener('mousedown', (e) => this._handleMouseDown(e))
    canvas.addEventListener('mouseup', (e) => this._handleMouseUp(e))
    canvas.addEventListener('mouseleave', () => this._handleMouseLeave())
    canvas.addEventListener('contextmenu', (e) => this._handleContextMenu(e))
  }

  // --- Canvas event handlers ---

  _handleCanvasMouseMove(e) {
    if (this.state === 'IDLE') {
      // Hit-test for click-through
      const opaque = this.renderer.isPixelOpaque(e.offsetX, e.offsetY)
      this.petAPI.setIgnoreMouse(!opaque)
      this.canvas.style.cursor = opaque ? 'pointer' : 'default'
    } else if (this.state === 'PENDING') {
      const dx = e.screenX - this.startScreenX
      const dy = e.screenY - this.startScreenY
      const dist = Math.sqrt(dx * dx + dy * dy)
      // Cancel pet timer on small movement (user intends to drag)
      if (dist >= 3 && this.petTimer) {
        clearTimeout(this.petTimer)
        this.petTimer = null
      }
      if (dist >= 10) {
        this._enterDragging(e)
      }
    }
  }

  _handleMouseDown(e) {
    if (e.button !== 0) return // left button only
    if (this.state !== 'IDLE') return

    const opaque = this.renderer.isPixelOpaque(e.offsetX, e.offsetY)
    if (!opaque) return

    // Enter PENDING state
    this.state = 'PENDING'
    this.startScreenX = e.screenX
    this.startScreenY = e.screenY
    this.startTime = performance.now()
    this.lastScreenX = e.screenX
    this.lastScreenY = e.screenY
    this.lastMoveTime = performance.now()
    this.velocityX = 0
    this.velocityY = 0

    // Schedule petting on long press (500ms, any position)
    this.petTimer = setTimeout(() => {
      if (this.state === 'PENDING') {
        this._enterPetting()
      }
    }, 500)
  }

  _handleMouseUp(e) {
    if (e.button !== 0) return

    if (this.state === 'PENDING') {
      // Clear pet timer
      if (this.petTimer) {
        clearTimeout(this.petTimer)
        this.petTimer = null
      }

      // If pet is in want_to_talk, clicking opens chat panel instead of poked
      if (this.sm.currentState === 'want_to_talk') {
        if (this.systemBehavior) this.systemBehavior.onPetInteraction()
        this.petAPI.toggleChatPanel()
        this.state = 'IDLE'
        return
      }

      // Single click (any position) = poked (slow playback so animation is visible)
      if (this.systemBehavior) this.systemBehavior.onPetInteraction()
      this.sm.forceState('poked', { priority: 3, holdLastFrameDuration: 800, fpsOverride: 2 })
      this.state = 'IDLE'
    } else if (this.state === 'PETTING') {
      document.removeEventListener('mouseup', this._onPetDocMouseUp)
      this.sm.releaseHold()
      this.state = 'IDLE'
    }
  }

  _handleMouseLeave() {
    if (this.state === 'IDLE') {
      this.petAPI.setIgnoreMouse(true)
      this.canvas.style.cursor = 'default'
    }
  }

  _handleContextMenu(e) {
    e.preventDefault()
    if (this.state !== 'IDLE') return

    const opaque = this.renderer.isPixelOpaque(e.offsetX, e.offsetY)
    if (!opaque) return

    this.petAPI.showContextMenu(e.screenX, e.screenY)
  }

  // --- State transitions ---

  _enterDragging(e) {
    // Clear pet timer
    if (this.petTimer) {
      clearTimeout(this.petTimer)
      this.petTimer = null
    }

    this.state = 'DRAGGING'
    if (this.systemBehavior) this.systemBehavior.onPetInteraction()
    this.petAPI.setDragging(true)
    this.sm.forceState('drag', { priority: 3, hold: true })

    // Attach document-level listeners to avoid losing mouse during fast drag
    document.addEventListener('mousemove', this._onDocMouseMove)
    document.addEventListener('mouseup', this._onDocMouseUp)

    // Initialize velocity tracking
    this.lastScreenX = e.screenX
    this.lastScreenY = e.screenY
    this.lastMoveTime = performance.now()
    this.velocityX = 0
    this.velocityY = 0
  }

  _enterPetting() {
    this.state = 'PETTING'
    if (this.systemBehavior) this.systemBehavior.onPetInteraction()
    this.sm.forceState('petted', { priority: 3, hold: true })
    // Document-level mouseup to catch mouse release outside canvas
    document.addEventListener('mouseup', this._onPetDocMouseUp)
  }

  _handlePetDocMouseUp(e) {
    if (e.button !== 0) return
    if (this.state !== 'PETTING') return
    document.removeEventListener('mouseup', this._onPetDocMouseUp)
    this.sm.releaseHold()
    this.state = 'IDLE'
  }

  _enterThrown() {
    this.state = 'THROWN'

    // Cap velocity to 1500 px/s
    const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY)
    if (speed > 1500) {
      const scale = 1500 / speed
      this.velocityX *= scale
      this.velocityY *= scale
    }

    // Freeze state machine — we control animation manually during thrown
    this.sm.forceState('thrown', { priority: 3, freezeOnLastFrame: true })

    // Start physics immediately (no delay)
    this._startThrownPhysics()
  }

  _startThrownPhysics() {
    const FRICTION = 0.90
    const GRAVITY = 600        // px/s², fall acceleration
    const MAX_FALL_SPEED = 800 // px/s, terminal velocity
    const H_STOP = 20          // px/s, horizontal velocity considered zero
    const FRAME_TOGGLE_MS = 200 // F0/F1 panic frame toggle interval
    const LANDING_HOLD_MS = 400 // F2 landing frame display time

    let vx = this.velocityX
    let vy = this.velocityY
    let phase = 'flying' // 'flying' | 'falling'
    let lastTime = performance.now()
    let frameToggleAccum = 0
    let currentFrame = 0

    // Draw initial panic frame
    this.renderer.drawFrame('thrown', 0)

    const step = async () => {
      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.05) // cap dt to avoid huge jumps
      lastTime = now

      // Toggle F0/F1 panic animation
      frameToggleAccum += dt * 1000
      if (frameToggleAccum >= FRAME_TOGGLE_MS) {
        currentFrame = currentFrame === 0 ? 1 : 0
        this.renderer.drawFrame('thrown', currentFrame)
        frameToggleAccum -= FRAME_TOGGLE_MS
      }

      if (phase === 'flying') {
        // Apply friction
        vx *= FRICTION
        vy *= FRICTION

        // Apply light gravity for arc
        vy += GRAVITY * dt

        const dx = Math.round(vx * dt)
        const dy = Math.round(vy * dt)

        let result = { hit: false, hitBottom: false, hitSideOrTop: false }
        if (dx !== 0 || dy !== 0) {
          result = await this.petAPI.moveWindowClamped(dx, dy)
        }

        if (result.hitBottom) {
          // Hit bottom → land
          this._land(LANDING_HOLD_MS)
          return
        } else if (result.hitSideOrTop || Math.abs(vx) < H_STOP) {
          // Hit side/top or horizontal velocity gone → vertical fall
          phase = 'falling'
          vx = 0
          vy = Math.max(vy, 0) // only fall downward
        }
      }

      if (phase === 'falling') {
        // Pure vertical fall with gravity
        vy += GRAVITY * dt
        if (vy > MAX_FALL_SPEED) vy = MAX_FALL_SPEED

        const dy = Math.round(vy * dt)

        let result = { hit: false, hitBottom: false, hitSideOrTop: false }
        if (dy !== 0) {
          result = await this.petAPI.moveWindowClamped(0, dy)
        }

        if (result.hitBottom) {
          this._land(LANDING_HOLD_MS)
          return
        }
      }

      this.thrownRAF = requestAnimationFrame(step)
    }

    this.thrownRAF = requestAnimationFrame(step)
  }

  _land(holdMs) {
    this.thrownRAF = null
    // Show F2 landing cushion frame
    this.renderer.drawFrame('thrown', 2)
    // Ensure pet lands fully on screen (feet on ground, not half buried)
    this.petAPI.snapToGround()
    this.petAPI.clampAndSave()

    this.thrownLandingTimer = setTimeout(() => {
      this.thrownLandingTimer = null
      this.sm.returnToIdle()
      this.state = 'IDLE'
    }, holdMs)
  }

  // --- Document-level handlers (drag) ---

  _handleDocMouseMove(e) {
    if (this.state !== 'DRAGGING') return

    const now = performance.now()
    const dx = e.screenX - this.lastScreenX
    const dy = e.screenY - this.lastScreenY
    const dt = (now - this.lastMoveTime) / 1000

    // Move window (clamped to screen in main process)
    if (dx !== 0 || dy !== 0) {
      this.petAPI.moveWindow(dx, dy)
    }

    // Update velocity with EMA (alpha = 0.3)
    if (dt > 0) {
      const instantVX = dx / dt
      const instantVY = dy / dt
      this.velocityX = this.velocityX * 0.7 + instantVX * 0.3
      this.velocityY = this.velocityY * 0.7 + instantVY * 0.3
    }

    this.lastScreenX = e.screenX
    this.lastScreenY = e.screenY
    this.lastMoveTime = now
  }

  _handleDocMouseUp(e) {
    if (e.button !== 0) return
    if (this.state !== 'DRAGGING') return

    // Remove document listeners
    document.removeEventListener('mousemove', this._onDocMouseMove)
    document.removeEventListener('mouseup', this._onDocMouseUp)

    this.sm.releaseHold()
    this.petAPI.setDragging(false)

    // Check velocity for thrown
    const speed = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY)

    if (speed > 800) {
      this._enterThrown()
    } else {
      this.petAPI.clampAndSave()
      this.sm.returnToIdle()
      this.state = 'IDLE'
    }
  }
}
