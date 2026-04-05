;(function () {
  const $ = (id) => document.getElementById(id)

  let i18n = {}
  let currentTheme = 'pixel'

  // DOM refs
  const container = document.querySelector('.memory-container')
  const closeBtn = $('closeBtn')
  const coreList = $('coreList')
  const coreEmpty = $('coreEmpty')
  const coreCount = $('coreCount')
  const archiveList = $('archiveList')
  const archiveEmpty = $('archiveEmpty')
  const chatLogsList = $('chatLogsList')
  const chatLogsEmpty = $('chatLogsEmpty')
  const storagePath = $('storagePath')
  const openFolderBtn = $('openFolderBtn')
  const clearAllBtn = $('clearAllBtn')
  const changePathBtn = $('changePathBtn')
  const confirmOverlay = $('confirmOverlay')
  const confirmTitle = $('confirmTitle')
  const confirmMessage = $('confirmMessage')
  const confirmOk = $('confirmOk')
  const confirmCancel = $('confirmCancel')

  // --- Close ---
  closeBtn.addEventListener('click', () => {
    container.classList.remove('entering')
    container.classList.add('leaving')
    setTimeout(() => window.memoryAPI.closeMemory(), 150)
  })

  // --- Delete button SVG ---
  function deleteIcon() {
    return '<svg width="10" height="10" viewBox="0 0 10 10"><line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'
  }

  // --- Render Core Memory ---
  function renderCoreMemory(entries) {
    coreList.innerHTML = ''
    coreCount.textContent = `(${entries.length}/30)`
    if (entries.length === 0) {
      coreEmpty.style.display = ''
      return
    }
    coreEmpty.style.display = 'none'

    for (const entry of entries) {
      const el = document.createElement('div')
      el.className = 'memory-entry'
      el.innerHTML = `
        <div class="memory-entry-body">
          <div class="memory-entry-key">${escapeHtml(entry.key)}</div>
          <div class="memory-entry-content" contenteditable="true">${escapeHtml(entry.content)}</div>
        </div>
        <button class="memory-delete-btn" title="Delete">${deleteIcon()}</button>
      `

      // Edit on blur
      const contentEl = el.querySelector('.memory-entry-content')
      let originalContent = entry.content
      contentEl.addEventListener('focus', () => { originalContent = contentEl.textContent })
      contentEl.addEventListener('blur', async () => {
        const newContent = contentEl.textContent.trim()
        if (newContent && newContent !== originalContent) {
          try {
            await window.memoryAPI.editCoreMemory(entry.key, newContent)
          } catch { contentEl.textContent = originalContent }
        } else if (!newContent) {
          contentEl.textContent = originalContent
        }
      })
      contentEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); contentEl.blur() }
        if (e.key === 'Escape') { contentEl.textContent = originalContent; contentEl.blur() }
      })

      // Delete
      el.querySelector('.memory-delete-btn').addEventListener('click', async () => {
        try {
          await window.memoryAPI.deleteCoreMemory(entry.key)
          el.remove()
          const remaining = coreList.children.length
          coreCount.textContent = `(${remaining}/30)`
          if (remaining === 0) coreEmpty.style.display = ''
        } catch {}
      })

      coreList.appendChild(el)
    }
  }

  // --- Render Archive ---
  function renderArchive(entries) {
    archiveList.innerHTML = ''
    if (entries.length === 0) {
      archiveEmpty.style.display = ''
      return
    }
    archiveEmpty.style.display = 'none'

    for (const entry of entries) {
      const el = document.createElement('div')
      el.className = 'memory-entry'
      const preview = entry.content.length > 60 ? entry.content.slice(0, 60) + '...' : entry.content
      el.innerHTML = `
        <div class="memory-entry-body">
          <div class="memory-entry-date">[${escapeHtml(entry.date)}]</div>
          <div class="memory-entry-preview" title="${escapeHtml(entry.content)}">${escapeHtml(preview)}</div>
        </div>
        <button class="memory-delete-btn" title="Delete">${deleteIcon()}</button>
      `

      el.querySelector('.memory-delete-btn').addEventListener('click', async () => {
        try {
          const result = await window.memoryAPI.deleteArchiveEntry(entry.index)
          if (result && result.entries) {
            renderArchive(result.entries)
          } else {
            el.remove()
            if (archiveList.children.length === 0) archiveEmpty.style.display = ''
          }
        } catch {}
      })

      archiveList.appendChild(el)
    }
  }

  // --- Render Chat Logs ---
  function renderChatLogs(files) {
    chatLogsList.innerHTML = ''
    if (files.length === 0) {
      chatLogsEmpty.style.display = ''
      return
    }
    chatLogsEmpty.style.display = 'none'

    for (const file of files) {
      const el = document.createElement('div')
      el.className = 'memory-entry'
      const sizeKB = Math.ceil(file.size / 1024)
      el.innerHTML = `
        <div class="memory-entry-body">
          <span class="memory-entry-filename">${escapeHtml(file.filename)}</span>
        </div>
        <span class="memory-entry-size">${sizeKB} KB</span>
        <button class="memory-delete-btn" title="Delete">${deleteIcon()}</button>
      `

      el.querySelector('.memory-delete-btn').addEventListener('click', async () => {
        try {
          await window.memoryAPI.deleteChatLog(file.filename)
          el.remove()
          if (chatLogsList.children.length === 0) chatLogsEmpty.style.display = ''
        } catch {}
      })

      chatLogsList.appendChild(el)
    }
  }

  // --- Confirm dialog ---
  function showConfirm(title, message, okText, onOk) {
    confirmTitle.textContent = title
    confirmMessage.textContent = message
    confirmOk.textContent = okText
    confirmOverlay.style.display = ''

    const handleOk = async () => {
      confirmOverlay.style.display = 'none'
      confirmOk.removeEventListener('click', handleOk)
      confirmCancel.removeEventListener('click', handleCancel)
      await onOk()
    }
    const handleCancel = () => {
      confirmOverlay.style.display = 'none'
      confirmOk.removeEventListener('click', handleOk)
      confirmCancel.removeEventListener('click', handleCancel)
    }

    confirmOk.addEventListener('click', handleOk)
    confirmCancel.addEventListener('click', handleCancel)
    confirmOverlay.addEventListener('click', (e) => {
      if (e.target === confirmOverlay) handleCancel()
    }, { once: true })
  }

  // --- Footer actions ---
  openFolderBtn.addEventListener('click', () => window.memoryAPI.openMemoryFolder())

  clearAllBtn.addEventListener('click', () => {
    showConfirm(
      i18n.confirmClearTitle || 'Clear all memory data?',
      i18n.confirmClearMessage || 'This will delete all memories, archives, and chat logs. This cannot be undone.',
      i18n.confirmClearOk || 'Clear All',
      async () => {
        try {
          await window.memoryAPI.clearAllMemory()
          renderCoreMemory([])
          renderArchive([])
          renderChatLogs([])
        } catch {}
      }
    )
  })

  changePathBtn.addEventListener('click', async () => {
    const result = await window.memoryAPI.changeMemoryPath()
    if (result && result.success) {
      storagePath.textContent = result.storagePath
      storagePath.title = result.storagePath
    }
  })

  // --- i18n ---
  async function loadI18n(lang) {
    try {
      const res = await fetch(`../../i18n/${lang}.json`)
      const data = await res.json()
      i18n = data.memory || {}
      applyI18n()
    } catch { /* fallback to defaults in HTML */ }
  }

  function applyI18n() {
    if (i18n.title) $('memoryTitle').textContent = i18n.title
    if (i18n.coreMemory) $('coreMemoryLabel').textContent = i18n.coreMemory
    if (i18n.archive) $('archiveLabel').textContent = i18n.archive
    if (i18n.chatLogs) $('chatLogsLabel').textContent = i18n.chatLogs
    if (i18n.noCore) coreEmpty.textContent = i18n.noCore
    if (i18n.noArchive) archiveEmpty.textContent = i18n.noArchive
    if (i18n.noChats) chatLogsEmpty.textContent = i18n.noChats
    if (i18n.openFolder) openFolderBtn.textContent = i18n.openFolder
    if (i18n.clearAll) clearAllBtn.textContent = i18n.clearAll
    if (i18n.changePath) changePathBtn.textContent = i18n.changePath
    if (i18n.storagePath) $('storagePathLabel').textContent = i18n.storagePath
    if (i18n.confirmClearCancel) confirmCancel.textContent = i18n.confirmClearCancel
  }

  // --- Theme ---
  function applyTheme(theme) {
    currentTheme = theme
    document.body.setAttribute('data-theme', theme)
  }

  // --- Color scheme ---
  function applyColorScheme(derived) {
    if (!derived) return
    Object.entries(derived).forEach(([k, v]) => document.body.style.setProperty(k, v))
  }

  // --- Escape ---
  function escapeHtml(str) {
    if (!str) return ''
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // --- Init ---
  window.memoryAPI.onInitMemory((data) => {
    applyTheme(data.theme || 'pixel')
    loadI18n(data.lang || 'en')

    renderCoreMemory(data.coreMemory ? data.coreMemory.entries || [] : [])
    renderArchive(data.archiveEntries || [])
    renderChatLogs(data.chatFiles || [])

    if (data.storagePath) {
      storagePath.textContent = data.storagePath
      storagePath.title = data.storagePath
    }
  })

  window.memoryAPI.onThemeChanged((theme) => applyTheme(theme))
  window.memoryAPI.onLanguageChanged((lang) => loadI18n(lang))
  window.memoryAPI.onColorScheme((d) => applyColorScheme(d.derived))
  window.memoryAPI.onStoragePathChanged((d) => {
    if (d && d.storagePath) {
      storagePath.textContent = d.storagePath
      storagePath.title = d.storagePath
    }
  })
})()
