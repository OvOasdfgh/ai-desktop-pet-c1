;(function () {
  // --- Custom Dropdown ---
  function initCustomDropdown(el) {
    const trigger = el.querySelector('.custom-dropdown-trigger')
    const triggerText = el.querySelector('.custom-dropdown-text')
    const panel = el.querySelector('.custom-dropdown-panel')
    const options = el.querySelectorAll('.custom-dropdown-option')
    const changeListeners = []

    Object.defineProperty(el, 'value', {
      get() { return el.dataset.value },
      set(v) {
        el.dataset.value = String(v)
        options.forEach(opt => {
          const match = opt.dataset.value === String(v)
          opt.classList.toggle('selected', match)
          if (match) triggerText.textContent = opt.textContent
        })
      },
    })

    const origAdd = el.addEventListener.bind(el)
    el.addEventListener = function (type, fn, opts) {
      if (type === 'change') changeListeners.push(fn)
      else origAdd(type, fn, opts)
    }

    function open() {
      const rect = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      el.classList.toggle('drop-up', spaceBelow < 200 && rect.top > spaceBelow)
      el.classList.add('open')
    }

    function close() {
      el.classList.remove('open', 'drop-up')
    }

    trigger.addEventListener('click', () => {
      el.classList.contains('open') ? close() : open()
    })

    options.forEach(opt => {
      opt.addEventListener('click', () => {
        const v = opt.dataset.value
        if (v === el.dataset.value) { close(); return }
        el.dataset.value = v
        triggerText.textContent = opt.textContent
        options.forEach(o => o.classList.toggle('selected', o === opt))
        close()
        changeListeners.forEach(fn => fn({ target: el }))
      })
    })

    document.addEventListener('click', (e) => {
      if (!el.contains(e.target)) close()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close()
    })

    // Mark initial selected
    options.forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.value === el.dataset.value)
      if (opt.dataset.value === el.dataset.value) triggerText.textContent = opt.textContent
    })

    return el
  }

  const container = document.querySelector('.settings-container')
  const closeBtn = document.getElementById('closeBtn')
  const apiTypeSelect = initCustomDropdown(document.getElementById('apiType'))
  const apiEndpointInput = document.getElementById('apiEndpoint')
  const apiKeyInput = document.getElementById('apiKey')
  const apiKeyToggle = document.getElementById('apiKeyToggle')
  const modelNameInput = document.getElementById('modelName')
  const imageApiEndpointInput = document.getElementById('imageApiEndpoint')
  const imageApiKeyInput = document.getElementById('imageApiKey')
  const imageApiKeyToggle = document.getElementById('imageApiKeyToggle')
  const imageModelNameInput = document.getElementById('imageModelName')
  const deepThinkingCheck = document.getElementById('deepThinking')
  const visionEnabledCheck = document.getElementById('visionEnabled')
  const memoryEnabledCheck = document.getElementById('memoryEnabled')
  const temperatureRange = document.getElementById('temperatureRange')
  const temperatureValue = document.getElementById('temperatureValue')
  const maxTokensSelect = initCustomDropdown(document.getElementById('maxTokens'))
  const contextWindowSelect = initCustomDropdown(document.getElementById('contextWindow'))
  const customPersonaTextarea = document.getElementById('customPersona')

  let i18n = null
  const debounceTimers = {}

  // --- Init ---
  window.settingsAPI.onInitSettings((data) => {
    applyTheme(data.theme)
    loadI18n(data.lang)
    loadSettings(data.settings)
  })

  // --- Theme ---
  function applyTheme(theme) {
    document.body.dataset.theme = theme
  }
  window.settingsAPI.onThemeChanged((theme) => applyTheme(theme))
  window.settingsAPI.onLanguageChanged((lang) => loadI18n(lang))

  // --- I18n ---
  async function loadI18n(lang) {
    try {
      const res = await fetch(`../../i18n/${lang}.json`)
      const data = await res.json()
      i18n = data.settings || {}
    } catch {
      i18n = {}
    }
    applyI18n()
  }

  function applyI18n() {
    if (!i18n) return
    const setText = (id, key) => {
      const el = document.getElementById(id)
      if (el && i18n[key]) el.textContent = i18n[key]
    }
    setText('settingsTitle', 'title')
    setText('apiConfigTitle', 'apiConfig')
    setText('apiTypeLabel', 'apiType')
    setText('apiTypeOpenAI', 'apiTypeOpenAI')
    setText('apiTypeAnthropic', 'apiTypeAnthropic')
    setText('apiEndpointLabel', 'apiEndpoint')
    setText('apiKeyLabel', 'apiKey')
    setText('modelNameLabel', 'modelName')
    setText('imageApiConfigTitle', 'imageApiConfig')
    setText('imageApiEndpointLabel', 'imageApiEndpoint')
    setText('imageApiKeyLabel', 'imageApiKey')
    setText('imageModelNameLabel', 'imageModelName')
    setText('aiBehaviorTitle', 'aiBehavior')
    setText('deepThinkingLabel', 'deepThinking')
    setText('visionLabel', 'vision')
    setText('memoryLabel', 'memory')
    setText('temperatureLabel', 'temperature')
    setText('maxTokensLabel', 'maxTokens')
    setText('contextWindowLabel', 'contextWindow')
    setText('customPersonaLabel', 'customPersona')

    if (i18n.apiKeyPlaceholder) apiKeyInput.placeholder = i18n.apiKeyPlaceholder
    if (i18n.modelNamePlaceholder) modelNameInput.placeholder = i18n.modelNamePlaceholder
    if (i18n.customPersonaPlaceholder) customPersonaTextarea.placeholder = i18n.customPersonaPlaceholder
    if (i18n.imageModelNamePlaceholder) imageModelNameInput.placeholder = i18n.imageModelNamePlaceholder

    // Sync dropdown trigger text from selected option (for translated options like apiType)
    ;[apiTypeSelect].forEach(dd => {
      const selected = dd.querySelector('.custom-dropdown-option.selected')
      if (selected) dd.querySelector('.custom-dropdown-text').textContent = selected.textContent
    })

    updateEndpointPlaceholder()
  }

  // --- Load settings into form ---
  function loadSettings(settings) {
    if (!settings) return
    apiTypeSelect.value = settings.apiType || 'openai'
    apiEndpointInput.value = settings.apiEndpoint || ''
    apiKeyInput.value = settings.apiKey || ''
    modelNameInput.value = settings.modelName || ''
    deepThinkingCheck.checked = !!settings.deepThinking
    visionEnabledCheck.checked = !!settings.visionEnabled
    memoryEnabledCheck.checked = settings.memoryEnabled !== false
    const temp = settings.temperature ?? 1.0
    temperatureRange.value = temp
    temperatureValue.textContent = parseFloat(temp).toFixed(1)
    maxTokensSelect.value = String(settings.maxTokens || 4096)
    contextWindowSelect.value = String(settings.contextWindowSize || 4096)
    customPersonaTextarea.value = settings.customPersona || ''
    imageApiEndpointInput.value = settings.imageApiEndpoint || ''
    imageApiKeyInput.value = settings.imageApiKey || ''
    imageModelNameInput.value = settings.imageModelName || ''
    updateEndpointPlaceholder()
  }

  // --- Auto-save ---
  function autoSave(key, value, immediate) {
    if (immediate) {
      window.settingsAPI.saveSetting(key, value)
      return
    }
    clearTimeout(debounceTimers[key])
    debounceTimers[key] = setTimeout(() => {
      window.settingsAPI.saveSetting(key, value)
      delete debounceTimers[key]
    }, 300)
  }

  function flushDebounce() {
    for (const key of Object.keys(debounceTimers)) {
      clearTimeout(debounceTimers[key])
      delete debounceTimers[key]
    }
    // Save current values of all debounced fields
    if (apiEndpointInput.value) autoSave('apiEndpoint', apiEndpointInput.value, true)
    if (apiKeyInput.value) autoSave('apiKey', apiKeyInput.value, true)
    if (modelNameInput.value) autoSave('modelName', modelNameInput.value, true)
    if (customPersonaTextarea.value) autoSave('customPersona', customPersonaTextarea.value, true)
    if (imageApiEndpointInput.value) autoSave('imageApiEndpoint', imageApiEndpointInput.value, true)
    if (imageApiKeyInput.value) autoSave('imageApiKey', imageApiKeyInput.value, true)
    if (imageModelNameInput.value) autoSave('imageModelName', imageModelNameInput.value, true)
  }

  // Dropdown / toggle — immediate save
  apiTypeSelect.addEventListener('change', () => {
    autoSave('apiType', apiTypeSelect.value, true)
    updateEndpointPlaceholder()
  })
  contextWindowSelect.addEventListener('change', () => {
    autoSave('contextWindowSize', parseInt(contextWindowSelect.value, 10), true)
  })
  deepThinkingCheck.addEventListener('change', () => {
    autoSave('deepThinking', deepThinkingCheck.checked, true)
  })
  visionEnabledCheck.addEventListener('change', () => {
    autoSave('visionEnabled', visionEnabledCheck.checked, true)
  })
  memoryEnabledCheck.addEventListener('change', () => {
    autoSave('memoryEnabled', memoryEnabledCheck.checked, true)
  })

  // Temperature slider
  temperatureRange.addEventListener('input', () => {
    const val = parseFloat(temperatureRange.value).toFixed(1)
    temperatureValue.textContent = val
    autoSave('temperature', parseFloat(val), true)
  })

  // Click temperature value → inline edit via contenteditable
  temperatureValue.addEventListener('click', () => {
    temperatureValue.contentEditable = 'true'
    temperatureValue.focus()
    const range = document.createRange()
    range.selectNodeContents(temperatureValue)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
  })

  const confirmTempEdit = () => {
    temperatureValue.contentEditable = 'false'
    let val = parseFloat(temperatureValue.textContent)
    if (isNaN(val) || val < 0) val = 0
    if (val > 2) val = 2
    val = Math.round(val * 100) / 100
    temperatureValue.textContent = val % 0.1 === 0 ? val.toFixed(1) : val.toFixed(2)
    temperatureRange.value = Math.min(2, Math.max(0, val))
    autoSave('temperature', val, true)
  }

  temperatureValue.addEventListener('blur', confirmTempEdit)
  temperatureValue.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); temperatureValue.blur() }
    if (e.key === 'Escape') {
      temperatureValue.textContent = parseFloat(temperatureRange.value).toFixed(1)
      temperatureValue.contentEditable = 'false'
    }
  })

  // Max reply length
  maxTokensSelect.addEventListener('change', () => {
    autoSave('maxTokens', parseInt(maxTokensSelect.value, 10), true)
  })

  // Text inputs — debounced save
  apiEndpointInput.addEventListener('input', () => {
    autoSave('apiEndpoint', apiEndpointInput.value, false)
  })
  apiKeyInput.addEventListener('input', () => {
    autoSave('apiKey', apiKeyInput.value, false)
  })
  modelNameInput.addEventListener('input', () => {
    autoSave('modelName', modelNameInput.value, false)
  })
  customPersonaTextarea.addEventListener('input', () => {
    autoSave('customPersona', customPersonaTextarea.value, false)
  })

  // Image API text inputs — debounced save
  imageApiEndpointInput.addEventListener('input', () => {
    autoSave('imageApiEndpoint', imageApiEndpointInput.value, false)
  })
  imageApiKeyInput.addEventListener('input', () => {
    autoSave('imageApiKey', imageApiKeyInput.value, false)
  })
  imageModelNameInput.addEventListener('input', () => {
    autoSave('imageModelName', imageModelNameInput.value, false)
  })

  // --- API endpoint placeholder ---
  function updateEndpointPlaceholder() {
    apiEndpointInput.placeholder = apiTypeSelect.value === 'anthropic'
      ? 'https://api.anthropic.com'
      : 'https://api.example.com/v1'
  }

  // --- API key show/hide ---
  function setupEyeToggle(toggleBtn, input) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = input.type === 'password'
      input.type = isPassword ? 'text' : 'password'
      toggleBtn.querySelector('.eye-open').style.display = isPassword ? 'none' : ''
      toggleBtn.querySelector('.eye-closed').style.display = isPassword ? '' : 'none'
    })
  }
  setupEyeToggle(apiKeyToggle, apiKeyInput)
  setupEyeToggle(imageApiKeyToggle, imageApiKeyInput)

  // --- Close with animation ---
  closeBtn.addEventListener('click', () => {
    flushDebounce()
    container.classList.remove('entering')
    container.classList.add('leaving')
    setTimeout(() => window.settingsAPI.closeSettings(), 150)
  })

  container.addEventListener('animationend', (e) => {
    if (e.animationName === 'settingsOpen') {
      container.classList.remove('entering')
    }
  })

  // Color scheme
  window.settingsAPI.onColorScheme((data) => {
    if (!data || !data.derived) return
    Object.entries(data.derived).forEach(([k, v]) => document.body.style.setProperty(k, v))
  })
})()
