;(function () {
  const container = document.querySelector('.customize-container')
  const closeBtn = document.getElementById('closeBtn')
  const customizeTitle = document.getElementById('customizeTitle')

  let i18n = null
  let currentTheme = 'pixel'

  // --- Presets ---
  const PRESETS = {
    default:  { accent: '#FFB4B4', userBubble: '#FFDADA', petBubble: '#FFF8F0', panelBg: '#FFFAF5', headerBg: '#FFF5EE', border: '#C8B4AA', userBubbleText: '#503C32', petBubbleText: '#503C32' },
    lavender: { accent: '#C4A8FF', userBubble: '#E0D0FF', petBubble: '#F5F0FF', panelBg: '#FAF8FF', headerBg: '#F0EAFF', border: '#C8B8E0', userBubbleText: '#403050', petBubbleText: '#403050' },
    mint:     { accent: '#8DD9B8', userBubble: '#C8F0DC', petBubble: '#F0FFF5', panelBg: '#F5FFF8', headerBg: '#E8FFF0', border: '#A0D0B8', userBubbleText: '#2D4A3A', petBubbleText: '#2D4A3A' },
    sky:      { accent: '#8DBCE8', userBubble: '#C8DEF5', petBubble: '#F0F5FF', panelBg: '#F5F8FF', headerBg: '#E8F0FF', border: '#A0B8D0', userBubbleText: '#2D3A4A', petBubbleText: '#2D3A4A' },
    amber:    { accent: '#E8C08D', userBubble: '#F5DEC0', petBubble: '#FFF8F0', panelBg: '#FFFBF5', headerBg: '#FFF5E8', border: '#D0B898', userBubbleText: '#4A3A2D', petBubbleText: '#4A3A2D' },
    dark:     { accent: '#FF9E9E', userBubble: '#3D2828', petBubble: '#2A2520', panelBg: '#1E1A18', headerBg: '#252020', border: '#453535', userBubbleText: '#F0E8E0', petBubbleText: '#E8DDD5' },
  }

  const COLOR_KEYS = ['accent', 'userBubble', 'petBubble', 'panelBg', 'headerBg', 'border', 'userBubbleText', 'petBubbleText']
  const COLOR_INPUT_MAP = {
    accent: 'colorAccent',
    userBubble: 'colorUserBubble',
    petBubble: 'colorPetBubble',
    panelBg: 'colorPanelBg',
    headerBg: 'colorHeaderBg',
    border: 'colorBorder',
    userBubbleText: 'colorUserBubbleText',
    petBubbleText: 'colorPetBubbleText',
  }

  // --- DOM refs ---
  const colorInputs = {}
  const colorHexLabels = {}
  COLOR_KEYS.forEach(key => {
    const inputId = COLOR_INPUT_MAP[key]
    colorInputs[key] = document.getElementById(inputId)
    colorHexLabels[key] = document.querySelector(`.color-hex[data-for="${inputId}"]`)
  })

  const presetBtns = document.querySelectorAll('.preset-btn')
  const colorToggle = document.getElementById('colorToggle')
  const colorBody = document.getElementById('colorBody')
  const toggleArrow = colorToggle?.querySelector('.toggle-arrow')
  const opacitySlider = document.getElementById('opacitySlider')
  const opacityValue = document.getElementById('opacityValue')

  // --- Debounce ---
  let saveTimer = null
  function debounceSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const scheme = readScheme()
      window.customizeAPI.saveColorScheme(scheme)
    }, 50)
  }

  // --- Read scheme from inputs ---
  function readScheme() {
    const scheme = {}
    COLOR_KEYS.forEach(key => {
      scheme[key] = colorInputs[key].value.toUpperCase()
    })
    return scheme
  }

  // --- Fill inputs from scheme ---
  function fillInputs(scheme) {
    COLOR_KEYS.forEach(key => {
      const val = scheme[key] || '#000000'
      colorInputs[key].value = val
      colorHexLabels[key].textContent = val.toUpperCase()
    })
  }

  // --- Check which preset is active ---
  function checkActivePreset() {
    const current = readScheme()
    presetBtns.forEach(btn => {
      const name = btn.dataset.preset
      const preset = PRESETS[name]
      const match = COLOR_KEYS.every(k => current[k].toUpperCase() === preset[k].toUpperCase())
      btn.classList.toggle('active', match)
    })
  }

  // --- Apply preset ---
  function applyPreset(name) {
    const preset = PRESETS[name]
    if (!preset) return
    fillInputs(preset)
    checkActivePreset()
    debounceSave()
  }

  // --- Preset click ---
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset)
    })
  })

  // --- Color input change ---
  COLOR_KEYS.forEach(key => {
    colorInputs[key].addEventListener('input', () => {
      colorHexLabels[key].textContent = colorInputs[key].value.toUpperCase()
      checkActivePreset()
      debounceSave()
    })
  })

  // --- Custom colors toggle ---
  colorToggle.addEventListener('click', () => {
    const isOpen = colorBody.style.display !== 'none'
    colorBody.style.display = isOpen ? 'none' : 'block'
    toggleArrow.classList.toggle('open', !isOpen)
  })

  // --- Opacity ---
  opacitySlider.addEventListener('input', () => {
    opacityValue.textContent = opacitySlider.value + '%'
    window.customizeAPI.saveOpacity(parseInt(opacitySlider.value))
  })

  // --- Color scheme apply (self) ---
  function applyColorScheme(data) {
    if (!data || !data.derived) return
    Object.entries(data.derived).forEach(([k, v]) => document.body.style.setProperty(k, v))
  }

  window.customizeAPI.onColorScheme(applyColorScheme)

  // --- Close with animation ---
  closeBtn.addEventListener('click', () => {
    container.classList.replace('entering', 'leaving')
    container.addEventListener('animationend', () => {
      window.customizeAPI.closeCustomize()
    }, { once: true })
  })

  // --- Character System ---
  const charDropdown = document.getElementById('characterDropdown')
  const charDropdownTrigger = charDropdown.querySelector('.custom-dropdown-trigger')
  const charDropdownText = charDropdown.querySelector('.custom-dropdown-text')
  const charDropdownPanel = charDropdown.querySelector('.custom-dropdown-panel')
  const importCharBtn = document.getElementById('importCharBtn')
  const exportCharBtn = document.getElementById('exportCharBtn')
  const deleteCharBtn = document.getElementById('deleteCharBtn')
  const characterInfo = document.getElementById('characterInfo')
  const characterStatus = document.getElementById('characterStatus')
  let currentCharacterId = null

  // Dropdown open/close with dynamic positioning
  function positionDropdownPanel() {
    const triggerRect = charDropdownTrigger.getBoundingClientRect()
    const panelHeight = charDropdownPanel.scrollHeight
    const viewH = window.innerHeight
    const spaceBelow = viewH - triggerRect.bottom - 4
    const spaceAbove = triggerRect.top - 4

    charDropdownPanel.style.left = triggerRect.left + 'px'
    charDropdownPanel.style.width = triggerRect.width + 'px'

    if (spaceBelow >= panelHeight || spaceBelow >= spaceAbove) {
      // Drop down
      charDropdownPanel.style.top = triggerRect.bottom + 2 + 'px'
      charDropdownPanel.style.bottom = ''
      charDropdownPanel.style.maxHeight = Math.min(160, spaceBelow) + 'px'
    } else {
      // Drop up
      charDropdownPanel.style.top = ''
      charDropdownPanel.style.bottom = (viewH - triggerRect.top + 2) + 'px'
      charDropdownPanel.style.maxHeight = Math.min(160, spaceAbove) + 'px'
    }
  }

  charDropdownTrigger.addEventListener('click', () => {
    const willOpen = !charDropdown.classList.contains('open')
    charDropdown.classList.toggle('open')
    if (willOpen) positionDropdownPanel()
  })
  document.addEventListener('click', (e) => {
    if (!charDropdown.contains(e.target)) {
      charDropdown.classList.remove('open')
    }
  })

  function populateCharacterList(characters, activeId) {
    charDropdownPanel.innerHTML = ''
    // Default option
    const defaultOpt = document.createElement('div')
    defaultOpt.className = 'custom-dropdown-option' + (!activeId ? ' selected' : '')
    defaultOpt.dataset.value = ''
    defaultOpt.textContent = 'C1 (Default)'
    defaultOpt.addEventListener('click', () => selectCharacter('', 'C1 (Default)'))
    charDropdownPanel.appendChild(defaultOpt)
    // Custom characters
    for (const char of characters) {
      const opt = document.createElement('div')
      opt.className = 'custom-dropdown-option' + (char.id === activeId ? ' selected' : '')
      opt.dataset.value = char.id
      opt.textContent = char.name || char.id
      opt.addEventListener('click', () => selectCharacter(char.id, char.name || char.id))
      charDropdownPanel.appendChild(opt)
    }
    charDropdown.dataset.value = activeId || ''
    charDropdownText.textContent = activeId
      ? (characters.find(c => c.id === activeId)?.name || activeId)
      : 'C1 (Default)'
    currentCharacterId = activeId || null
    updateCharacterInfo(activeId, characters)
    updateCharacterButtons()
  }

  async function selectCharacter(id, label) {
    charDropdown.classList.remove('open')
    charDropdownText.textContent = label
    charDropdown.dataset.value = id
    // Update selected state
    charDropdownPanel.querySelectorAll('.custom-dropdown-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.value === id)
    })
    const result = await window.customizeAPI.switchCharacter(id || null)
    if (result && result.error) {
      showCharacterStatus(i18n?.customize?.charNotFound || 'Character not found', 'error')
      return
    }
    currentCharacterId = id || null
    const list = await window.customizeAPI.getCharacterList()
    updateCharacterInfo(id || null, list)
    updateCharacterButtons()
    // Refresh state table with new character's data
    if (result && result.resolvedStateMap) {
      resolvedStateMap = result.resolvedStateMap
      currentStateOverrides = result.stateOverrides || {}
      renderStateGroups()
    }
  }

  function updateCharacterInfo(charId, characters) {
    if (!charId) {
      characterInfo.style.display = 'none'
      return
    }
    const char = characters.find(c => c.id === charId)
    if (!char) {
      characterInfo.style.display = 'none'
      return
    }
    characterInfo.style.display = 'block'
    document.getElementById('charNameValue').textContent = char.name || charId
    document.getElementById('charSizeValue').textContent = `${char.frameWidth || 32}×${char.frameHeight || 40}`
    document.getElementById('charStatesValue').textContent = (char.states || []).length + ''
  }

  function updateCharacterButtons() {
    const hasCustom = !!currentCharacterId
    exportCharBtn.disabled = !hasCustom
    deleteCharBtn.disabled = !hasCustom
    exportCharBtn.style.opacity = hasCustom ? '1' : '0.4'
    deleteCharBtn.style.opacity = hasCustom ? '1' : '0.4'
  }

  function showCharacterStatus(msg, type) {
    characterStatus.textContent = msg
    characterStatus.className = 'character-status ' + type
    characterStatus.style.display = 'block'
    setTimeout(() => { characterStatus.style.display = 'none' }, 3000)
  }

  const stateStatus = document.getElementById('stateStatus')
  let stateStatusTimer = null
  function showStateStatus(msg, type) {
    clearTimeout(stateStatusTimer)
    stateStatus.textContent = msg
    stateStatus.className = 'state-status ' + type
    stateStatus.style.display = 'block'
    stateStatusTimer = setTimeout(() => { stateStatus.style.display = 'none' }, 3000)
  }

  importCharBtn.addEventListener('click', async () => {
    const result = await window.customizeAPI.importCharacter()
    if (result.canceled) return
    if (!result.valid) {
      const errMsg = result.error === 'missing_idle'
        ? (i18n?.customize?.charMissingIdle || 'Invalid pack: missing idle state')
        : (i18n?.customize?.charImportError || 'Import failed')
      showCharacterStatus(errMsg, 'error')
      return
    }
    showCharacterStatus(i18n?.customize?.charImported || 'Character imported!', 'success')
    // Refresh list
    const list = await window.customizeAPI.getCharacterList()
    populateCharacterList(list, currentCharacterId)
  })

  exportCharBtn.addEventListener('click', async () => {
    if (!currentCharacterId) return
    const result = await window.customizeAPI.exportCharacter(currentCharacterId)
    if (result.canceled) return
    if (result.success) {
      showCharacterStatus(i18n?.customize?.charExported || 'Character exported!', 'success')
    }
  })

  deleteCharBtn.addEventListener('click', async () => {
    if (!currentCharacterId) return
    const result = await window.customizeAPI.deleteCharacter(currentCharacterId)
    if (result.success) {
      if (result.switchedToDefault) {
        currentCharacterId = null
      }
      showCharacterStatus(i18n?.customize?.charDeleted || 'Character deleted', 'success')
      const list = await window.customizeAPI.getCharacterList()
      populateCharacterList(list, currentCharacterId)
      // Refresh state table for the now-active character
      if (result.resolvedStateMap) {
        resolvedStateMap = result.resolvedStateMap
        currentStateOverrides = result.stateOverrides || {}
        renderStateGroups()
      }
    }
  })

  // --- Animation States ---
  const STATE_NAME_I18N_MAP = {
    idle: 'stateIdle', blink: 'stateBlink', idle_look: 'stateIdleLook', idle_stretch: 'stateIdleStretch',
    reading: 'stateReading', thinking: 'stateThinking', speaking: 'stateSpeaking', confused: 'stateConfused', error: 'stateError',
    recall: 'stateRecall', learn: 'stateLearn', forget: 'stateForget',
    want_to_talk: 'stateWantToTalk', notify: 'stateNotify', check_in: 'stateCheckIn',
    typing: 'stateTyping', drag: 'stateDrag', thrown: 'stateThrown', poked: 'statePoked', petted: 'statePetted',
    happy: 'stateHappy', excited: 'stateExcited', sad: 'stateSad', surprised: 'stateSurprised', love: 'stateLove', comfort: 'stateComfort',
    sleepy: 'stateSleepy', sleeping: 'stateSleeping', wakeup: 'stateWakeup', greeting: 'stateGreeting', curious: 'stateCurious', bored: 'stateBored',
    walk: 'stateWalk', jump: 'stateJump', fall: 'stateFall',
    listening: 'stateListening', voice_reply: 'stateVoiceReply', viewing: 'stateViewing', show_image: 'stateShowImage',
  }

  const GROUP_I18N_MAP = {
    basic: 'groupBasic', conversation: 'groupConversation', memory: 'groupMemory',
    proactive: 'groupProactive', user_interaction: 'groupUserInteraction', emotions: 'groupEmotions',
    environment: 'groupEnvironment', movement: 'groupMovement', multimedia: 'groupMultimedia',
  }

  const GROUP_ORDER = ['basic', 'conversation', 'memory', 'proactive', 'user_interaction', 'emotions', 'environment', 'movement', 'multimedia']

  let statesData = {}
  let resolvedStateMap = {}
  let currentStateOverrides = {}

  // StatePreview class
  class StatePreview {
    constructor(canvas) {
      this.canvas = canvas
      this.ctx = canvas.getContext('2d')
      this.stateName = null
      this.frameCount = 0
      this.fps = 4
      this.sheet = null
      this.currentFrame = 0
      this.timer = null
      this.fw = 32
      this.fh = 40
    }

    async load(stateName, frameCount, fps) {
      this.stop()
      this.stateName = stateName
      this.frameCount = frameCount
      this.fps = fps || 4
      this.currentFrame = 0

      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          this.sheet = img
          this.fw = img.naturalWidth / frameCount
          this.fh = img.naturalHeight
          this.drawFrame(0)
          resolve()
        }
        img.onerror = () => resolve()
        img.src = `sprite:///${stateName}_sheet.png?v=${Date.now()}`
      })
    }

    play() {
      this.stop()
      if (!this.sheet || this.frameCount <= 1) return
      this.timer = setInterval(() => {
        this.currentFrame = (this.currentFrame + 1) % this.frameCount
        this.drawFrame(this.currentFrame)
      }, 1000 / this.fps)
    }

    stop() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    }

    drawFrame(idx) {
      if (!this.sheet) return
      const cw = this.canvas.width
      const ch = this.canvas.height
      this.ctx.clearRect(0, 0, cw, ch)
      this.ctx.imageSmoothingEnabled = false
      const sx = idx * this.fw
      // Scale to fit canvas while maintaining aspect ratio
      const scale = Math.min(cw / this.fw, ch / this.fh)
      const dw = this.fw * scale
      const dh = this.fh * scale
      const dx = (cw - dw) / 2
      const dy = (ch - dh) / 2
      this.ctx.drawImage(this.sheet, sx, 0, this.fw, this.fh, dx, dy, dw, dh)
    }
  }

  const previewCanvas = document.getElementById('statePreviewCanvas')
  const previewStateName = document.getElementById('previewStateName')
  const previewStateFrames = document.getElementById('previewStateFrames')
  const previewHint = document.getElementById('previewHint')
  const previewInfo = document.getElementById('previewInfo')
  const stateGroupsContainer = document.getElementById('stateGroupsContainer')
  const statePreview = new StatePreview(previewCanvas)
  let activeStateRow = null

  function getStateName(stateName) {
    const key = STATE_NAME_I18N_MAP[stateName]
    return (i18n?.customize?.[key]) || stateName
  }

  function getGroupName(groupId) {
    const key = GROUP_I18N_MAP[groupId]
    return (i18n?.customize?.[key]) || groupId
  }

  function getSourceLabel(stateInfo) {
    if (!stateInfo) return ''
    const t = i18n?.customize
    switch (stateInfo.source) {
      case 'override': return t?.sourceOverride || 'Custom'
      case 'character': return t?.sourceCharacter || 'Character'
      case 'fallback': {
        const label = t?.sourceFallback || 'Fallback → {0}'
        return label.replace('{0}', getStateName(stateInfo.fallbackTo))
      }
      default: return t?.sourceBuiltin || 'Built-in'
    }
  }

  function renderStateGroups() {
    // Remember which groups are open
    const openGroups = new Set()
    stateGroupsContainer.querySelectorAll('.state-group-body.open').forEach(el => {
      if (el.dataset.groupId) openGroups.add(el.dataset.groupId)
    })

    stateGroupsContainer.innerHTML = ''
    const groups = {}
    for (const [name, data] of Object.entries(statesData)) {
      const g = data.group || 'basic'
      if (!groups[g]) groups[g] = []
      groups[g].push({ name, ...data })
    }

    for (const groupId of GROUP_ORDER) {
      const states = groups[groupId]
      if (!states || states.length === 0) continue

      const groupEl = document.createElement('div')
      groupEl.className = 'state-group'

      const header = document.createElement('button')
      header.className = 'state-group-header'
      const arrow = document.createElement('span')
      arrow.className = 'state-group-arrow'
      arrow.textContent = '\u25B6'
      const gName = document.createElement('span')
      gName.className = 'state-group-name'
      gName.textContent = getGroupName(groupId)
      gName.dataset.groupId = groupId
      const gCount = document.createElement('span')
      gCount.className = 'state-group-count'
      gCount.textContent = `(${states.length})`
      header.append(arrow, gName, gCount)
      groupEl.appendChild(header)

      const body = document.createElement('div')
      body.className = 'state-group-body'
      body.dataset.groupId = groupId
      // Restore open state
      if (openGroups.has(groupId)) {
        body.classList.add('open')
        arrow.classList.add('open')
      }

      for (const state of states) {
        const row = document.createElement('div')
        row.className = 'state-row'
        row.dataset.state = state.name

        // Thumbnail
        const thumb = document.createElement('canvas')
        thumb.className = 'state-thumb'
        thumb.width = 24
        thumb.height = 30
        loadThumbnail(thumb, state.name, state.frames)

        // Name
        const nameSpan = document.createElement('span')
        nameSpan.className = 'state-name'
        nameSpan.textContent = getStateName(state.name)
        nameSpan.dataset.stateName = state.name

        // Frames
        const framesSpan = document.createElement('span')
        framesSpan.className = 'state-frames'
        framesSpan.textContent = `${state.frames}${i18n?.customize?.stateFrames || 'f'}`

        // Source
        const sourceSpan = document.createElement('span')
        sourceSpan.className = 'state-source'
        const stateInfo = resolvedStateMap[state.name]
        if (stateInfo) {
          sourceSpan.textContent = getSourceLabel(stateInfo)
          if (stateInfo.source === 'override') sourceSpan.classList.add('override')
          if (stateInfo.source === 'fallback') sourceSpan.classList.add('fallback')
        }
        sourceSpan.dataset.stateName = state.name

        // Actions (disabled for built-in C1)
        const actions = document.createElement('div')
        actions.className = 'state-actions'
        const isDefault = !currentCharacterId
        const replaceBtn = document.createElement('button')
        replaceBtn.className = 'state-action-btn'
        replaceBtn.textContent = i18n?.customize?.stateReplace || 'Replace'
        replaceBtn.disabled = isDefault
        if (isDefault) replaceBtn.style.opacity = '0.3'
        replaceBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          if (!isDefault) replaceState(state.name)
        })
        actions.appendChild(replaceBtn)

        if (currentStateOverrides[state.name]) {
          const resetBtn = document.createElement('button')
          resetBtn.className = 'state-action-btn reset'
          resetBtn.textContent = i18n?.customize?.stateReset || 'Reset'
          resetBtn.disabled = isDefault
          if (isDefault) resetBtn.style.opacity = '0.3'
          resetBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            if (!isDefault) resetState(state.name)
          })
          actions.appendChild(resetBtn)
        }

        row.append(thumb, nameSpan, framesSpan, sourceSpan, actions)

        // Click to preview
        row.addEventListener('click', () => selectStateForPreview(state.name, state.frames, state.fps))

        body.appendChild(row)
      }

      groupEl.appendChild(body)
      stateGroupsContainer.appendChild(groupEl)

      // Toggle
      header.addEventListener('click', () => {
        const isOpen = body.classList.contains('open')
        body.classList.toggle('open', !isOpen)
        arrow.classList.toggle('open', !isOpen)
      })
    }
  }

  function loadThumbnail(canvas, stateName, frameCount) {
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false
      const fw = img.naturalWidth / frameCount
      const fh = img.naturalHeight
      const scale = Math.min(24 / fw, 30 / fh)
      const dw = fw * scale
      const dh = fh * scale
      const dx = (24 - dw) / 2
      const dy = (30 - dh) / 2
      ctx.drawImage(img, 0, 0, fw, fh, dx, dy, dw, dh)
    }
    img.src = `sprite:///${stateName}_sheet.png?v=${Date.now()}`
  }

  async function selectStateForPreview(stateName, frames, fps) {
    // Highlight row
    if (activeStateRow) activeStateRow.classList.remove('active')
    const row = stateGroupsContainer.querySelector(`.state-row[data-state="${stateName}"]`)
    if (row) {
      row.classList.add('active')
      activeStateRow = row
    }

    // Show canvas + info, hide hint
    previewHint.style.display = 'none'
    previewCanvas.style.display = ''
    previewInfo.style.display = ''

    previewStateName.textContent = getStateName(stateName)
    const t = i18n?.customize
    previewStateFrames.textContent = `${frames} ${t?.stateFrames || 'frames'} · ${fps || 4} fps`

    await statePreview.load(stateName, frames, fps)
    statePreview.play()
  }

  async function replaceState(stateName) {
    const result = await window.customizeAPI.replaceState(stateName)
    if (!result || result.canceled) return
    if (result.error === 'frame_count_mismatch') {
      const t = i18n?.customize
      const msg = (t?.stateFrameCountMismatch || 'Need {0} frames, got {1}')
        .replace('{0}', result.expected).replace('{1}', result.got)
      showStateStatus(msg, 'error')
      return
    }
    if (result.error === 'size_mismatch') {
      const t = i18n?.customize
      const msg = (t?.stateSizeMismatch || 'Frame size mismatch: expected {0}×{1}')
        .replace('{0}', result.expectedW).replace('{1}', result.expectedH)
      showStateStatus(msg, 'error')
      return
    }
    if (result.error === 'no_frames') {
      showStateStatus(i18n?.customize?.stateNoFrames || 'No valid frames found', 'error')
      return
    }
    if (result.success) {
      showStateStatus(i18n?.customize?.stateReplaced || 'State replaced!', 'success')
    }
  }

  function resetState(stateName) {
    window.customizeAPI.resetState(stateName)
    showStateStatus(i18n?.customize?.stateResetDone || 'State reset', 'success')
  }

  // Listen for override changes (from main process after replace/reset)
  window.customizeAPI.onStateOverrideChanged(async (data) => {
    // Refresh override data and re-render
    const overrides = await window.customizeAPI.getStateOverrides()
    currentStateOverrides = overrides || {}
    // Update resolvedStateMap with accurate source from main
    if (data.resolvedEntry) {
      resolvedStateMap[data.stateName] = data.resolvedEntry
    }
    renderStateGroups()
    // If previewing this state, reload preview
    if (statePreview.stateName === data.stateName) {
      const sd = statesData[data.stateName]
      if (sd) {
        await statePreview.load(data.stateName, sd.frames, sd.fps)
        statePreview.play()
      }
    }
  })

  // --- Shared init data apply (used by onInitCustomize and reset) ---
  function applyInitData(data) {
    // Color
    const scheme = data.colorScheme || PRESETS.default
    fillInputs(scheme)
    checkActivePreset()

    // Opacity
    const op = data.panelOpacity ?? 88
    opacitySlider.value = op
    opacityValue.textContent = op + '%'

    // Character
    populateCharacterList(data.characterList || [], data.activeCharacterId || null)

    // Animation states
    statesData = data.statesData || {}
    resolvedStateMap = data.resolvedStateMap || {}
    currentStateOverrides = data.stateOverrides || {}
    renderStateGroups()

    // Reset preview to hint state
    previewHint.style.display = ''
    previewCanvas.style.display = 'none'
    previewInfo.style.display = 'none'
    statePreview.stop()
    if (activeStateRow) { activeStateRow.classList.remove('active'); activeStateRow = null }

    // Storage
    updateStorageDisplay(data.storagePath, data.storageSize)
  }

  // --- Init ---
  window.customizeAPI.onInitCustomize((data) => {
    currentTheme = data.theme
    applyTheme(data.theme)
    loadI18n(data.lang)
    applyInitData(data)
  })

  // --- Storage path sync (when changed from another window) ---
  window.customizeAPI.onStoragePathChanged((data) => {
    if (data && data.storagePath != null) {
      updateStorageDisplay(data.storagePath, data.storageSize)
    }
  })

  // --- Theme ---
  function applyTheme(theme) {
    currentTheme = theme
    document.body.dataset.theme = theme
  }
  window.customizeAPI.onThemeChanged((theme) => applyTheme(theme))

  // --- Language ---
  window.customizeAPI.onLanguageChanged((lang) => loadI18n(lang))

  async function loadI18n(lang) {
    try {
      const res = await fetch(`../../i18n/${lang}.json`)
      i18n = await res.json()
      applyI18n()
    } catch (e) {
      console.error('Failed to load i18n:', e)
    }
  }

  function applyI18n() {
    if (!i18n || !i18n.customize) return
    const t = i18n.customize
    customizeTitle.textContent = t.title || 'Customize'

    // Color scheme section
    const el = (id) => document.getElementById(id)
    el('colorSchemeTitle').textContent = t.colorScheme || 'Color Scheme'
    el('presetsLabel').textContent = t.presets || 'Presets'
    el('presetDefault').textContent = t.presetDefault || 'Sweet Pink'
    el('presetLavender').textContent = t.presetLavender || 'Lavender'
    el('presetMint').textContent = t.presetMint || 'Mint'
    el('presetSky').textContent = t.presetSky || 'Sky'
    el('presetAmber').textContent = t.presetAmber || 'Amber'
    el('presetDark').textContent = t.presetDark || 'Dark Night'
    el('customColorsLabel').textContent = t.customColors || 'Custom Colors'
    el('labelAccent').textContent = t.colorAccent || 'Accent'
    el('labelUserBubble').textContent = t.colorUserBubble || 'User Bubble'
    el('labelPetBubble').textContent = t.colorPetBubble || 'Pet Bubble'
    el('labelPanelBg').textContent = t.colorPanelBg || 'Panel Background'
    el('labelHeaderBg').textContent = t.colorHeaderBg || 'Header Background'
    el('labelBorder').textContent = t.colorBorder || 'Border'
    el('labelUserBubbleText').textContent = t.colorUserBubbleText || 'User Text'
    el('labelPetBubbleText').textContent = t.colorPetBubbleText || 'Pet Text'
    el('opacityLabel').textContent = t.opacity || 'Panel Opacity'

    // Character section
    el('characterTitle').textContent = t.character || 'Character'
    el('currentCharLabel').textContent = t.currentChar || 'Current'
    el('importCharLabel').textContent = t.importChar || 'Import'
    el('exportCharLabel').textContent = t.exportChar || 'Export'
    el('deleteCharLabel').textContent = t.deleteChar || 'Delete'
    el('charNameLabel').textContent = t.charName || 'Name'
    el('charSizeLabel').textContent = t.charSize || 'Frame Size'
    el('charStatesLabel').textContent = t.charStates || 'States'

    // Animation states section
    el('animStatesTitle').textContent = t.animStates || 'Animation States'
    el('previewHint').textContent = t.previewHint || 'Click a state below to preview'

    // Storage section
    el('storageTitle').textContent = t.storage || 'Storage'
    el('browseStorageLabel').textContent = t.browseStorage || 'Browse'

    // Reset
    el('resetAllBtn').textContent = t.resetAll || 'Reset All Settings'

    // Re-render state groups to update i18n labels
    if (Object.keys(statesData).length > 0) {
      renderStateGroups()
    }
  }

  // --- Storage Management ---
  const storagePathEl = document.getElementById('storagePath')
  const storageSizeEl = document.getElementById('storageSize')
  const browseStorageBtn = document.getElementById('browseStorageBtn')

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  function updateStorageDisplay(storagePath, storageSize) {
    if (storagePath) {
      storagePathEl.textContent = storagePath
      storagePathEl.title = storagePath
    }
    const t = i18n?.customize
    const sizeText = (t?.storageSize || 'Used: {0}').replace('{0}', formatSize(storageSize || 0))
    storageSizeEl.textContent = sizeText
  }

  browseStorageBtn.addEventListener('click', async () => {
    browseStorageBtn.disabled = true
    const t = i18n?.customize
    browseStorageBtn.querySelector('span').textContent = t?.migrating || 'Migrating...'
    try {
      const result = await window.customizeAPI.changeStoragePath()
      if (result.canceled) return
      if (result.error === 'not_writable') {
        showCharacterStatus(t?.migrationError || 'Migration failed', 'error')
        return
      }
      if (result.success) {
        updateStorageDisplay(result.storagePath, result.storageSize)
        showCharacterStatus(t?.migrationSuccess || 'Storage moved!', 'success')
      }
    } catch {} finally {
      browseStorageBtn.disabled = false
      browseStorageBtn.querySelector('span').textContent = t?.browseStorage || 'Browse'
    }
  })

  // --- Reset All Settings ---
  const resetAllBtn = document.getElementById('resetAllBtn')
  const confirmOverlay = document.getElementById('confirmOverlay')
  const confirmTitle = document.getElementById('confirmTitle')
  const confirmMessage = document.getElementById('confirmMessage')
  const confirmCancel = document.getElementById('confirmCancel')
  const confirmOk = document.getElementById('confirmOk')
  let confirmCallback = null

  function showConfirm(title, message, okLabel, cancelLabel, cb) {
    confirmTitle.textContent = title
    confirmMessage.textContent = message
    confirmOk.textContent = okLabel
    confirmCancel.textContent = cancelLabel
    confirmCallback = cb
    confirmOverlay.style.display = ''
  }

  function hideConfirm() {
    confirmOverlay.style.display = 'none'
    confirmCallback = null
  }

  confirmCancel.addEventListener('click', hideConfirm)
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) hideConfirm()
  })
  confirmOk.addEventListener('click', () => {
    const cb = confirmCallback
    hideConfirm()
    if (cb) cb()
  })

  resetAllBtn.addEventListener('click', () => {
    const t = i18n?.customize
    showConfirm(
      t?.resetConfirmTitle || 'Reset all customization?',
      t?.resetConfirmMessage || 'Color scheme, opacity, state overrides, and active character will be reset to defaults. Imported character packs will NOT be deleted.',
      t?.resetConfirmOk || 'Reset',
      t?.resetConfirmCancel || 'Cancel',
      async () => {
        const data = await window.customizeAPI.resetAllSettings()
        applyInitData(data)
        showCharacterStatus(t?.resetSuccess || 'All settings reset!', 'success')
      }
    )
  })
})()
