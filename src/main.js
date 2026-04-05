const { app, BrowserWindow, screen, ipcMain, powerMonitor, globalShortcut, shell, net, dialog, nativeImage, clipboard, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')
const config = require('./config')
const characterManager = require('./character-manager')
const { AIManager } = require('./ai/ai-manager')
const { createProvider } = require('./ai/provider')
const { Marked } = require('marked')
const hljs = require('highlight.js/lib/core')

// Register highlight.js languages
hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'))
hljs.registerLanguage('typescript', require('highlight.js/lib/languages/typescript'))
hljs.registerLanguage('python', require('highlight.js/lib/languages/python'))
hljs.registerLanguage('json', require('highlight.js/lib/languages/json'))
hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'))
hljs.registerLanguage('css', require('highlight.js/lib/languages/css'))
hljs.registerLanguage('bash', require('highlight.js/lib/languages/bash'))
hljs.registerLanguage('java', require('highlight.js/lib/languages/java'))
hljs.registerLanguage('cpp', require('highlight.js/lib/languages/cpp'))
hljs.registerLanguage('sql', require('highlight.js/lib/languages/sql'))
hljs.registerAliases(['js'], { languageName: 'javascript' })
hljs.registerAliases(['ts'], { languageName: 'typescript' })
hljs.registerAliases(['py'], { languageName: 'python' })
hljs.registerAliases(['sh', 'shell', 'zsh'], { languageName: 'bash' })
hljs.registerAliases(['html'], { languageName: 'xml' })
hljs.registerAliases(['c', 'c++', 'cc', 'cxx', 'h', 'hpp'], { languageName: 'cpp' })

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const COPY_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="4.5" y="4.5" width="7" height="7" rx="0"/><path d="M2.5 9.5V2.5h7"/></svg>'

const markedInstance = new Marked({
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : null
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : escapeHtml(text)
      const langLabel = language || 'code'
      return `<div class="code-block"><div class="code-header"><span class="code-lang">${langLabel}</span><button class="code-copy-btn" title="Copy">${COPY_SVG}</button></div><pre><code class="hljs">${highlighted}</code></pre></div>`
    },
    link({ href, text }) {
      return `<a class="md-link" href="${escapeHtml(href)}">${text}</a>`
    },
    image({ href, text }) {
      return `<img class="md-image" src="${escapeHtml(href)}" alt="${escapeHtml(text || '')}">`
    },
    del({ text }) {
      return '~' + text + '~'
    },
  },
  breaks: true,
  gfm: true,
})

// Register sprite:// as a privileged scheme (must be before app.ready)
protocol.registerSchemesAsPrivileged([
  { scheme: 'sprite', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const aiManager = new AIManager()
let isAiStreaming = false

let mainWindow = null
let chatWindow = null
let bubbleWindow = null
let settingsWindow = null
let contextMenuWindow = null
let customizeWindow = null
let memoryWindow = null
let contextMenuProcessName = ''
let chatPanelOpen = false
let chatIsMaximized = false
let chatRestoreBounds = null
let isDragging = false
let alwaysOnTopInterval = null
let activityInterval = null
let currentScale = 4
let currentLang = 'en'
let currentTheme = 'pixel'
let lastCursorX = 0
let lastCursorY = 0
let fgWindowInterval = null
let fgWindowRunning = false
let lastFgProcessName = ''
const selfProcessName = path.basename(process.execPath, '.exe').toLowerCase()
let characterBounds = null
const BUBBLE_MARGIN = 20

// Character system
let activeCharacterId = null       // null = built-in C1
let activeCharacterMeta = null     // character.json contents
let stateOverrides = {}            // { characterKey: { stateName: absolutePath } }  — "" = built-in C1

function getCurrentOverrides() {
  return stateOverrides[activeCharacterId || ''] || {}
}

// --- Memory System ---
function getMemoryBasePath() {
  const saved = config.load()
  const customPath = saved.characterStoragePath
  return customPath ? path.join(customPath, 'memory') : path.join(app.getPath('userData'), 'memory')
}

function ensureMemoryDir() {
  const dir = getMemoryBasePath()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function loadCoreMemory() {
  const filePath = path.join(getMemoryBasePath(), 'core.json')
  if (!fs.existsSync(filePath)) return { version: 1, entries: [] }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) }
  catch { return { version: 1, entries: [] } }
}

function saveCoreMemory(data) {
  const dir = ensureMemoryDir()
  fs.writeFileSync(path.join(dir, 'core.json'), JSON.stringify(data, null, 2))
}

function getLocalDateString() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function appendToChatLog(msg) {
  if (msg.hidden || msg.sender === 'tool') return
  if (msg.streaming) return
  const today = getLocalDateString()
  const chatDir = path.join(ensureMemoryDir(), 'chats')
  if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true })
  const filePath = path.join(chatDir, `${today}.jsonl`)
  const record = { ...msg }
  if (record.images) { record.hasImages = true; delete record.images }
  if (record.imageData) { record.hasImages = true; delete record.imageData }
  delete record.streaming
  fs.appendFileSync(filePath, JSON.stringify(record) + '\n')
}

function loadRecentChatHistory() {
  const chatDir = path.join(getMemoryBasePath(), 'chats')
  if (!fs.existsSync(chatDir)) return []
  const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.jsonl')).sort().reverse()
  if (files.length === 0) return []
  const content = fs.readFileSync(path.join(chatDir, files[0]), 'utf-8')
  return content.trim().split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line) } catch { return null }
  }).filter(Boolean)
}

function searchChatLogs(query, maxDays = 7) {
  const chatDir = path.join(getMemoryBasePath(), 'chats')
  if (!fs.existsSync(chatDir)) return []
  const files = fs.readdirSync(chatDir).filter(f => f.endsWith('.jsonl')).sort().reverse().slice(0, maxDays)
  const results = []
  const lowerQuery = query.toLowerCase()
  for (const file of files) {
    const date = file.replace('.jsonl', '')
    const lines = fs.readFileSync(path.join(chatDir, file), 'utf-8').trim().split('\n')
    for (const line of lines) {
      if (!line) continue
      try {
        const msg = JSON.parse(line)
        if (msg.content && msg.content.toLowerCase().includes(lowerQuery)) {
          results.push({ date, sender: msg.sender, content: msg.content.slice(0, 200) })
          if (results.length >= 5) return results
        }
      } catch { /* skip malformed lines */ }
    }
  }
  return results
}

function searchArchive(query) {
  const archivePath = path.join(getMemoryBasePath(), 'archive.jsonl')
  if (!fs.existsSync(archivePath)) return []
  const results = []
  const lowerQuery = query.toLowerCase()
  const lines = fs.readFileSync(archivePath, 'utf-8').trim().split('\n')
  for (const line of lines) {
    if (!line) continue
    try {
      const entry = JSON.parse(line)
      if (entry.content && entry.content.toLowerCase().includes(lowerQuery)) {
        results.push({ date: entry.date, content: entry.content.slice(0, 200) })
        if (results.length >= 5) return results
      }
    } catch { /* skip */ }
  }
  return results
}

async function summarizeAndArchive(messagesToSummarize) {
  try {
    const conversationText = messagesToSummarize
      .filter(m => m.sender === 'user' || m.sender === 'pet')
      .map(m => `${m.sender === 'user' ? 'User' : 'C1'}: ${m.content}`)
      .join('\n')
    if (!conversationText.trim()) return

    const settings = getSettingsData()
    const provider = createProvider(settings.apiType, settings.apiEndpoint, settings.apiKey)
    const result = await provider.nonStreamChat([
      { role: 'system', content: 'Summarize the following conversation in 2-3 sentences. Focus on key topics, user preferences revealed, important events, and emotional moments. Write in the same language as the conversation.' },
      { role: 'user', content: conversationText }
    ], { model: settings.modelName, maxTokens: 200 })

    const entry = { type: 'summary', date: getLocalDateString(), content: result, createdAt: Date.now() }
    const archivePath = path.join(ensureMemoryDir(), 'archive.jsonl')
    fs.appendFileSync(archivePath, JSON.stringify(entry) + '\n')
  } catch { /* silent */ }
}

// Chat history (persisted to disk, restored on startup)
let chatHistory = []
let chatMessageIdCounter = 0
let lastUsageRatio = 0
let lastArchivedTimestamp = 0

// --- Tool Registry ---
const toolRegistry = new Map() // name → { definition, handler }

function registerTool(name, description, parameters, handler) {
  toolRegistry.set(name, {
    definition: { type: 'function', function: { name, description, parameters } },
    handler,
  })
}

function getToolDefinitions() {
  if (toolRegistry.size === 0) return []
  return [...toolRegistry.values()].map(t => t.definition)
}

// --- Tools support auto-detection cache ---
let toolsSupportCache = {}

function loadToolsSupportCache() {
  const saved = config.load()
  toolsSupportCache = saved.toolsSupport || {}
}

function saveToolsSupport(key, supported) {
  toolsSupportCache[key] = supported
  config.save({ toolsSupport: toolsSupportCache })
}

// --- i18n ---
function loadI18n(lang) {
  try {
    const filePath = path.join(__dirname, 'i18n', `${lang}.json`)
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    const fallback = path.join(__dirname, 'i18n', 'en.json')
    return JSON.parse(fs.readFileSync(fallback, 'utf-8'))
  }
}

// --- Window size helpers ---

function getWindowSize(scale) {
  const fw = activeCharacterMeta?.frameWidth ?? 32
  const fh = activeCharacterMeta?.frameHeight ?? 40
  const padding = 16 // 8px each side
  return {
    width: fw * scale + padding,
    height: fh * scale + padding,
  }
}

function clampToScreen(x, y, width, height) {
  const display = screen.getPrimaryDisplay()
  const workArea = display.workArea
  // Only constrain window CENTER within workArea — allows pet to be half off-screen
  const centerX = x + width / 2
  const centerY = y + height / 2
  const clampedCX = Math.max(workArea.x, Math.min(centerX, workArea.x + workArea.width))
  const clampedCY = Math.max(workArea.y, Math.min(centerY, workArea.y + workArea.height))
  return [clampedCX - width / 2, clampedCY - height / 2]
}


// --- Always-on-top interval management ---
function startAlwaysOnTopInterval() {
  if (alwaysOnTopInterval) return
  alwaysOnTopInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver')
    }
  }, 30000)
}

function stopAlwaysOnTopInterval() {
  if (alwaysOnTopInterval) {
    clearInterval(alwaysOnTopInterval)
    alwaysOnTopInterval = null
  }
}

// --- System activity polling ---
function startActivityPolling() {
  if (activityInterval) return
  activityInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const idleTime = powerMonitor.getSystemIdleTime()
    const cursor = screen.getCursorScreenPoint()
    const cursorMoved = (cursor.x !== lastCursorX || cursor.y !== lastCursorY)
    lastCursorX = cursor.x
    lastCursorY = cursor.y
    mainWindow.webContents.send('system-activity', { idleTime, cursorMoved })
  }, 2000)
}

function stopActivityPolling() {
  if (activityInterval) {
    clearInterval(activityInterval)
    activityInterval = null
  }
}

// --- Foreground window polling (5s, independent) ---

const POWERSHELL_COMMAND = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  using System.Diagnostics;
  public class FGW {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    public static string[] Get() {
      IntPtr h = GetForegroundWindow();
      if (h == IntPtr.Zero) return new string[]{"",""};
      uint pid; GetWindowThreadProcessId(h, out pid);
      try { Process p = Process.GetProcessById((int)pid);
        return new string[]{p.ProcessName, p.MainWindowTitle};
      } catch { return new string[]{"",""}; }
    }
  }
"@
$r = [FGW]::Get(); $r[0] + "|" + $r[1]
`.trim()

function pollForegroundWindow() {
  if (fgWindowRunning || !mainWindow || mainWindow.isDestroyed()) return
  fgWindowRunning = true
  execFile('powershell', ['-NoProfile', '-Command', POWERSHELL_COMMAND], {
    timeout: 2000, windowsHide: true
  }, (error, stdout) => {
    fgWindowRunning = false
    if (error || !mainWindow || mainWindow.isDestroyed()) return
    const output = (stdout || '').trim()
    const sepIndex = output.lastIndexOf('|')
    if (sepIndex === -1) return
    const processName = output.substring(0, sepIndex)
    lastFgProcessName = processName.toLowerCase()
    mainWindow.webContents.send('foreground-window', {
      processName,
      windowTitle: output.substring(sepIndex + 1)
    })
  })
}

function startForegroundWindowPolling() {
  pollForegroundWindow()
  fgWindowInterval = setInterval(pollForegroundWindow, 5000)
}

function stopForegroundWindowPolling() {
  if (fgWindowInterval) {
    clearInterval(fgWindowInterval)
    fgWindowInterval = null
  }
}

// --- Tag app to category ---
function tagAppToCategory(processName, category) {
  const categories = config.loadAppCategories()
  // Remove from all categories first
  for (const cat of Object.values(categories.categories)) {
    if (cat.processes) {
      const idx = cat.processes.indexOf(processName)
      if (idx !== -1) cat.processes.splice(idx, 1)
    }
  }
  // Add to new category (if not 'remove')
  if (category && categories.categories[category]) {
    if (!categories.categories[category].processes) {
      categories.categories[category].processes = []
    }
    categories.categories[category].processes.push(processName)
  }
  config.saveAppCategories(categories)
  // Notify renderer to reload categories
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-categories-updated')
  }
}

// --- Color Scheme System ---

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()
}

function lerpColor(hex1, hex2, t) {
  const c1 = hexToRgb(hex1), c2 = hexToRgb(hex2)
  const r = Math.round(c1.r + (c2.r - c1.r) * t)
  const g = Math.round(c1.g + (c2.g - c1.g) * t)
  const b = Math.round(c1.b + (c2.b - c1.b) * t)
  return rgbToHex(r, g, b)
}

function rgbaString(hex, alpha) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function rgbString(hex) {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${r}, ${g}, ${b})`
}

function deriveAllColors(scheme, theme, opacity) {
  const isPixel = theme === 'pixel'
  const op = (opacity || 88) / 100
  const GRAY = '#B4B4B4'
  const WHITE = '#FFFFFF'
  const BLACK = '#000000'

  const textSecondary = lerpColor(scheme.petBubbleText, GRAY, 0.4)
  const textTime = lerpColor(scheme.petBubbleText, GRAY, 0.55)
  const inputBg = lerpColor(scheme.panelBg, WHITE, 0.3)
  const hoverBg = lerpColor(scheme.accent, WHITE, 0.7)
  const groupBg = lerpColor(scheme.panelBg, BLACK, 0.05)
  const sendBg = lerpColor(scheme.accent, WHITE, 0.15)
  const closeHover = lerpColor(scheme.accent, WHITE, 0.6)
  const toggleBg = lerpColor(scheme.border, GRAY, 0.3)
  const borderLight = lerpColor(scheme.border, WHITE, 0.3)
  const separator = lerpColor(scheme.border, WHITE, 0.3)

  const d = {}

  // Text
  d['--text-primary'] = rgbString(scheme.petBubbleText)
  d['--text-secondary'] = rgbString(textSecondary)
  d['--text-time'] = rgbString(textTime)

  // Backgrounds (opacity applies to panel bg for both themes)
  d['--bg-panel'] = op < 1 ? rgbaString(scheme.panelBg, op) : rgbString(scheme.panelBg)
  d['--bg-header'] = isPixel
    ? (op < 1 ? rgbaString(scheme.headerBg, Math.min(op + 0.05, 1)) : rgbString(scheme.headerBg))
    : rgbaString(scheme.headerBg, 0.6)
  d['--bg-user-bubble'] = isPixel ? rgbString(scheme.userBubble) : rgbaString(scheme.userBubble, 0.9)
  d['--bg-pet-bubble'] = isPixel ? rgbString(scheme.petBubble) : rgbaString(scheme.petBubble, 0.9)
  d['--bg-bubble'] = isPixel ? rgbString(scheme.petBubble) : rgbaString(scheme.petBubble, 0.9)
  d['--bg-menu'] = isPixel ? rgbString(scheme.petBubble) : rgbaString(scheme.petBubble, 0.95)
  d['--bg-input'] = isPixel ? rgbString(inputBg) : rgbaString(inputBg, 0.8)
  d['--bg-hover'] = isPixel ? rgbString(hoverBg) : rgbaString(hoverBg, 0.4)
  d['--group-bg'] = isPixel ? rgbString(groupBg) : rgbaString(groupBg, 0.5)

  // Accent
  d['--accent'] = rgbString(scheme.accent)
  d['--send-bg'] = isPixel ? rgbString(sendBg) : rgbaString(sendBg, 0.9)
  d['--send-hover'] = isPixel ? rgbString(scheme.accent) : rgbaString(scheme.accent, 0.9)
  d['--close-hover'] = isPixel ? rgbString(closeHover) : rgbaString(closeHover, 0.6)
  d['--toggle-bg-active'] = isPixel ? rgbString(scheme.accent) : rgbaString(scheme.accent, 0.9)
  d['--toggle-bg'] = isPixel ? rgbString(toggleBg) : rgbaString(toggleBg, 0.5)

  // Borders
  d['--border'] = isPixel ? `2px solid ${rgbString(scheme.border)}` : `1px solid ${rgbaString(scheme.border, 0.3)}`
  d['--border-light'] = isPixel ? `1px solid ${rgbString(borderLight)}` : `1px solid ${rgbaString(scheme.border, 0.15)}`
  d['--separator'] = isPixel ? rgbString(separator) : rgbaString(separator, 0.3)

  // Scrollbar
  d['--scrollbar-thumb'] = isPixel ? rgbString(scheme.border) : rgbaString(scheme.border, 0.4)

  // Bubble text colors (independent)
  d['--c-user-bubble-text'] = rgbString(scheme.userBubbleText)
  d['--c-pet-bubble-text'] = rgbString(scheme.petBubbleText)

  return d
}

function getStorageSize() {
  let total = 0
  const dirs = [characterManager.getCharactersDir(), characterManager.getOverridesDir()]
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    try {
      const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, entry.name)
          if (entry.isDirectory()) walk(p)
          else total += fs.statSync(p).size
        }
      }
      walk(dir)
    } catch {}
  }
  return total
}

function broadcastToAll(channel, data) {
  ;[mainWindow, chatWindow, bubbleWindow, settingsWindow, customizeWindow, memoryWindow, contextMenuWindow]
    .forEach(w => { if (w && !w.isDestroyed()) w.webContents.send(channel, data) })
}

const DEFAULT_COLOR_SCHEME = { accent: '#FFB4B4', userBubble: '#FFDADA', petBubble: '#FFF8F0', panelBg: '#FFFAF5', headerBg: '#FFF5EE', border: '#C8B4AA', userBubbleText: '#503C32', petBubbleText: '#503C32' }

function applyColorSchemeToAll() {
  const cfg = config.load()
  const scheme = cfg.colorScheme || DEFAULT_COLOR_SCHEME
  const derived = deriveAllColors(scheme, currentTheme, cfg.panelOpacity)
  broadcastToAll('apply-color-scheme', { derived })
}

// --- Theme ---
function setTheme(theme) {
  currentTheme = theme
  config.save({ theme })
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('set-theme', theme)
  }
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('set-theme', theme)
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('set-theme', theme)
  }
  if (customizeWindow && !customizeWindow.isDestroyed()) {
    customizeWindow.webContents.send('set-theme', theme)
  }
  if (memoryWindow && !memoryWindow.isDestroyed()) {
    memoryWindow.webContents.send('set-theme', theme)
  }
  // Re-derive color scheme (depends on theme)
  applyColorSchemeToAll()
}

// --- Chat panel ---
function getChatPanelPosition() {
  const [petX, petY] = mainWindow.getPosition()
  const petSize = getWindowSize(currentScale)
  const display = screen.getDisplayNearestPoint({ x: petX, y: petY })
  const wa = display.workArea
  const panelW = 280, panelH = 400, gap = 8, edge = 8

  // Pet center relative to workArea (0..1)
  const petCenterX = petX + petSize.width / 2
  const relX = (petCenterX - wa.x) / wa.width

  // Horizontal: pet in right half → panel on left; otherwise right
  let x
  if (relX > 0.5) {
    x = petX - panelW - gap
  } else {
    x = petX + petSize.width + gap
  }

  // Vertical: top-align with pet; if bottom overflows → bottom-align upward
  let y
  if (petY + panelH <= wa.y + wa.height - edge) {
    y = petY
  } else {
    y = wa.y + wa.height - panelH - edge
  }

  // Clamp 100% within workArea with minimum edge
  x = Math.max(wa.x + edge, Math.min(x, wa.x + wa.width - panelW - edge))
  y = Math.max(wa.y + edge, Math.min(y, wa.y + wa.height - panelH - edge))

  return { x: Math.round(x), y: Math.round(y) }
}

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.focus()
    return
  }

  const pos = getChatPanelPosition()

  chatWindow = new BrowserWindow({
    width: 280,
    height: 400,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    minWidth: 240,
    minHeight: 300,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'chat-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  chatWindow.setAlwaysOnTop(true, 'screen-saver')

  chatWindow.loadFile(path.join(__dirname, 'renderer', 'chat', 'chat.html'))

  const win = chatWindow
  win.webContents.on('did-finish-load', () => {
    // Add guide message to chatHistory if empty and API not configured
    // Push directly without IPC broadcast to avoid duplication with init-chat
    if (chatHistory.length === 0 && !aiManager.isConfigured(getSettingsData())) {
      const i18nData = loadI18n(currentLang)
      const guideText = i18nData.system?.noApiGuide || 'Right-click the pet → Settings to configure API~'
      chatHistory.push({
        id: ++chatMessageIdCounter,
        type: 'text',
        sender: 'system',
        content: guideText,
        timestamp: Date.now(),
      })
    }
    const i18nForChat = loadI18n(currentLang)
    win.webContents.send('init-chat', {
      messages: chatHistory,
      theme: currentTheme,
      lang: currentLang,
      apiConfigured: aiManager.isConfigured(getSettingsData()),
      usageRatio: lastUsageRatio,
      thinkLabel: i18nForChat.system?.thinkingSummary || 'Thinking process',
      visionEnabled: getSettingsData().visionEnabled,
      isStreaming: isAiStreaming,
    })
    // Apply saved color scheme
    const cfg = config.load()
    win.webContents.send('apply-color-scheme', { derived: deriveAllColors(cfg.colorScheme || DEFAULT_COLOR_SCHEME, currentTheme, cfg.panelOpacity) })
  })

  win.on('closed', () => {
    if (chatWindow === win) {
      chatWindow = null
      chatPanelOpen = false
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat-panel-closed')
      }
    }
  })

  chatIsMaximized = false
  chatRestoreBounds = null
  chatWindow.on('resize', () => {
    if (!chatIsMaximized || !chatWindow || chatWindow.isDestroyed()) return
    const bounds = chatWindow.getBounds()
    const workArea = screen.getDisplayMatching(bounds).workArea
    if (Math.abs(bounds.width - workArea.width) > 10 || Math.abs(bounds.height - workArea.height) > 10) {
      chatIsMaximized = false
      chatWindow.webContents.send('chat-maximize-changed', false)
    }
  })

  chatWindow.on('restore', () => {
    chatWindow.setAlwaysOnTop(true, 'screen-saver')
    chatPanelOpen = true
    closeBubbleWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat-panel-opened')
    }
  })

  chatWindow.on('blur', () => {
    if (chatWindow && !chatWindow.isDestroyed() && !chatIsMaximized) {
      chatWindow.setAlwaysOnTop(false)
    }
  })

  chatWindow.on('focus', () => {
    if (chatWindow && !chatWindow.isDestroyed() && !chatIsMaximized) {
      chatWindow.setAlwaysOnTop(true, 'screen-saver')
    }
  })

  chatPanelOpen = true
  closeBubbleWindow()

  // Notify pet window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat-panel-opened')
  }
}

function closeChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.close()
  }
}

function toggleChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    if (chatWindow.isMinimized()) {
      chatWindow.restore()
    } else {
      closeChatWindow()
    }
  } else {
    createChatWindow()
  }
}

// --- Settings window ---

function getSettingsPanelPosition() {
  const [petX, petY] = mainWindow.getPosition()
  const petSize = getWindowSize(currentScale)
  const display = screen.getDisplayNearestPoint({ x: petX, y: petY })
  const wa = display.workArea
  const panelW = 360, panelH = 500, gap = 8, edge = 8

  const petCenterX = petX + petSize.width / 2
  const relX = (petCenterX - wa.x) / wa.width

  let x
  if (relX > 0.5) {
    x = petX - panelW - gap
  } else {
    x = petX + petSize.width + gap
  }

  let y
  if (petY + panelH <= wa.y + wa.height - edge) {
    y = petY
  } else {
    y = wa.y + wa.height - panelH - edge
  }

  x = Math.max(wa.x + edge, Math.min(x, wa.x + wa.width - panelW - edge))
  y = Math.max(wa.y + edge, Math.min(y, wa.y + wa.height - panelH - edge))

  return { x: Math.round(x), y: Math.round(y) }
}

function getSettingsData() {
  const saved = config.load()
  return {
    apiType: saved.apiType || 'openai',
    apiEndpoint: saved.apiEndpoint || '',
    apiKey: saved.apiKeyEncrypted ? config.decryptApiKey(saved.apiKeyEncrypted) : '',
    modelName: saved.modelName || '',
    contextWindowSize: saved.contextWindowSize || 4096,
    deepThinking: saved.deepThinking || false,
    temperature: saved.temperature ?? 1.0,
    maxTokens: saved.maxTokens || 4096,
    customPersona: saved.customPersona || '',
    visionEnabled: saved.visionEnabled || false,
    imageApiEndpoint: saved.imageApiEndpoint || '',
    imageApiKey: saved.imageApiKeyEncrypted ? config.decryptApiKey(saved.imageApiKeyEncrypted) : '',
    imageModelName: saved.imageModelName || '',
    memoryEnabled: saved.memoryEnabled !== false,
  }
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  const pos = getSettingsPanelPosition()

  settingsWindow = new BrowserWindow({
    width: 360,
    height: 500,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  settingsWindow.setAlwaysOnTop(true, 'screen-saver')
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings', 'settings.html'))

  settingsWindow.webContents.on('did-finish-load', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('init-settings', {
        settings: getSettingsData(),
        theme: currentTheme,
        lang: currentLang,
      })
      const cfg = config.load()
      settingsWindow.webContents.send('apply-color-scheme', { derived: deriveAllColors(cfg.colorScheme || DEFAULT_COLOR_SCHEME, currentTheme, cfg.panelOpacity) })
    }
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function closeSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close()
  }
}

// --- Customize window ---

function getCustomizePanelPosition() {
  const [petX, petY] = mainWindow.getPosition()
  const petSize = getWindowSize(currentScale)
  const display = screen.getDisplayNearestPoint({ x: petX, y: petY })
  const wa = display.workArea
  const panelW = 400, panelH = 560, gap = 8, edge = 8

  const petCenterX = petX + petSize.width / 2
  const relX = (petCenterX - wa.x) / wa.width

  let x
  if (relX > 0.5) {
    x = petX - panelW - gap
  } else {
    x = petX + petSize.width + gap
  }

  let y
  if (petY + panelH <= wa.y + wa.height - edge) {
    y = petY
  } else {
    y = wa.y + wa.height - panelH - edge
  }

  x = Math.max(wa.x + edge, Math.min(x, wa.x + wa.width - panelW - edge))
  y = Math.max(wa.y + edge, Math.min(y, wa.y + wa.height - panelH - edge))

  return { x: Math.round(x), y: Math.round(y) }
}

function createCustomizeWindow() {
  if (customizeWindow && !customizeWindow.isDestroyed()) {
    customizeWindow.focus()
    return
  }

  const pos = getCustomizePanelPosition()

  customizeWindow = new BrowserWindow({
    width: 400,
    height: 560,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'customize-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  customizeWindow.setAlwaysOnTop(true, 'screen-saver')
  customizeWindow.loadFile(path.join(__dirname, 'renderer', 'customize', 'customize.html'))

  customizeWindow.webContents.on('did-finish-load', () => {
    if (customizeWindow && !customizeWindow.isDestroyed()) {
      const cfg = config.load()
      let statesData = {}
      try {
        statesData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'output', 'states.json'), 'utf-8'))
      } catch {}
      customizeWindow.webContents.send('init-customize', {
        theme: currentTheme,
        lang: currentLang,
        colorScheme: cfg.colorScheme || null,
        panelOpacity: cfg.panelOpacity ?? 88,
        activeCharacterId,
        characterList: characterManager.listCharacters(),
        statesData,
        stateOverrides: getCurrentOverrides(),
        resolvedStateMap: characterManager.buildResolvedStateMap(activeCharacterId, getCurrentOverrides()),
        storagePath: characterManager.getStorageBase(),
        storageSize: getStorageSize(),
      })
      customizeWindow.webContents.send('apply-color-scheme', { derived: deriveAllColors(cfg.colorScheme || DEFAULT_COLOR_SCHEME, currentTheme, cfg.panelOpacity) })
    }
  })

  customizeWindow.on('closed', () => {
    customizeWindow = null
  })
}

function closeCustomizeWindow() {
  if (customizeWindow && !customizeWindow.isDestroyed()) {
    customizeWindow.close()
  }
}

// --- Memory management window ---

function loadArchiveEntries() {
  const archivePath = path.join(getMemoryBasePath(), 'archive.jsonl')
  if (!fs.existsSync(archivePath)) return []
  const lines = fs.readFileSync(archivePath, 'utf-8').trim().split('\n').filter(Boolean)
  const entries = []
  for (let i = 0; i < lines.length; i++) {
    try {
      const entry = JSON.parse(lines[i])
      entries.push({ date: entry.date, content: entry.content, index: i })
    } catch { /* skip */ }
  }
  return entries
}

function listChatFiles() {
  const chatDir = path.join(getMemoryBasePath(), 'chats')
  if (!fs.existsSync(chatDir)) return []
  return fs.readdirSync(chatDir)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse()
    .map(filename => {
      const size = fs.statSync(path.join(chatDir, filename)).size
      return { filename, size }
    })
}

function getMemoryPanelPosition() {
  const [petX, petY] = mainWindow.getPosition()
  const petSize = getWindowSize(currentScale)
  const display = screen.getDisplayNearestPoint({ x: petX, y: petY })
  const wa = display.workArea
  const panelW = 400, panelH = 560, gap = 8, edge = 8

  const petCenterX = petX + petSize.width / 2
  const relX = (petCenterX - wa.x) / wa.width

  let x
  if (relX > 0.5) {
    x = petX - panelW - gap
  } else {
    x = petX + petSize.width + gap
  }

  let y
  if (petY + panelH <= wa.y + wa.height - edge) {
    y = petY
  } else {
    y = wa.y + wa.height - panelH - edge
  }

  x = Math.max(wa.x + edge, Math.min(x, wa.x + wa.width - panelW - edge))
  y = Math.max(wa.y + edge, Math.min(y, wa.y + wa.height - panelH - edge))

  return { x: Math.round(x), y: Math.round(y) }
}

function createMemoryWindow() {
  if (memoryWindow && !memoryWindow.isDestroyed()) {
    memoryWindow.focus()
    return
  }

  const pos = getMemoryPanelPosition()

  memoryWindow = new BrowserWindow({
    width: 400,
    height: 560,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'memory-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  memoryWindow.setAlwaysOnTop(true, 'screen-saver')
  memoryWindow.loadFile(path.join(__dirname, 'renderer', 'memory', 'memory.html'))

  memoryWindow.webContents.on('did-finish-load', () => {
    if (memoryWindow && !memoryWindow.isDestroyed()) {
      const cfg = config.load()
      memoryWindow.webContents.send('init-memory', {
        theme: currentTheme,
        lang: currentLang,
        coreMemory: loadCoreMemory(),
        archiveEntries: loadArchiveEntries(),
        chatFiles: listChatFiles(),
        storagePath: getMemoryBasePath(),
      })
      memoryWindow.webContents.send('apply-color-scheme', { derived: deriveAllColors(cfg.colorScheme || DEFAULT_COLOR_SCHEME, currentTheme, cfg.panelOpacity) })
    }
  })

  memoryWindow.on('closed', () => {
    memoryWindow = null
  })
}

// --- Notification bubble window ---

function getBubblePosition(contentW, contentH) {
  const [petX, petY] = mainWindow.getPosition()
  const display = screen.getDisplayNearestPoint({ x: petX, y: petY })
  const wa = display.workArea
  const padding = 8
  const petSize = getWindowSize(currentScale)
  const gapAbove = 40
  const gapBelow = 20
  const hm = BUBBLE_MARGIN / 2

  // Horizontal: center content on character center of mass
  let x
  if (characterBounds) {
    x = petX + padding + characterBounds.centerX * currentScale - contentW / 2
  } else {
    x = petX + petSize.width / 2 - contentW / 2
  }

  // Vertical: position content edge at gap distance from character
  let y
  if (characterBounds) {
    const charTop = petY + padding + characterBounds.top * currentScale
    const charBottom = petY + padding + characterBounds.bottom * currentScale
    y = charTop - contentH - gapAbove
    if (y - hm < wa.y) {
      y = charBottom + gapBelow
    }
  } else {
    y = petY - contentH - gapAbove
    if (y - hm < wa.y) {
      y = petY + petSize.height + gapBelow
    }
  }

  // Clamp: ensure window (content ± halfMargin) stays in workArea
  x = Math.max(wa.x + hm, Math.min(x, wa.x + wa.width - contentW - hm))

  return { x: Math.round(x), y: Math.round(y) }
}

function showBubble(text) {
  // Close existing bubble
  closeBubbleWindow()

  if (!mainWindow || mainWindow.isDestroyed()) return

  bubbleWindow = new BrowserWindow({
    width: 250,
    height: 80,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'bubble-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  bubbleWindow.setAlwaysOnTop(true, 'screen-saver')
  bubbleWindow.setIgnoreMouseEvents(true, { forward: true })

  bubbleWindow.loadFile(path.join(__dirname, 'renderer', 'bubble', 'bubble.html'))

  bubbleWindow.webContents.on('did-finish-load', () => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      const cfg = config.load()
      bubbleWindow.webContents.send('apply-color-scheme', { derived: deriveAllColors(cfg.colorScheme || DEFAULT_COLOR_SCHEME, currentTheme, cfg.panelOpacity) })
      bubbleWindow.webContents.send('show-bubble', { text, theme: currentTheme })
    }
  })

  bubbleWindow.on('closed', () => {
    bubbleWindow = null
  })
}

function closeBubbleWindow() {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.close()
    bubbleWindow = null
  }
}


// --- Context menu ---
function closeContextMenu() {
  if (contextMenuWindow && !contextMenuWindow.isDestroyed()) {
    contextMenuWindow.close()
    contextMenuWindow = null
  }
}

function showHtmlContextMenu(cursorX, cursorY) {
  closeContextMenu()

  const i18n = loadI18n(currentLang)
  const t = i18n.menu

  const rawProcess = lastFgProcessName === selfProcessName ? '' : lastFgProcessName
  const processName = rawProcess || contextMenuProcessName
  contextMenuProcessName = processName
  let currentCat = null
  if (processName) {
    const categories = config.loadAppCategories()
    for (const [catName, catConfig] of Object.entries(categories.categories)) {
      if (catConfig.processes && catConfig.processes.includes(processName)) {
        currentCat = catName
        break
      }
    }
  }

  const catEntries = [
    { key: 'coding', label: t.catCoding },
    { key: 'browsing', label: t.catBrowsing },
    { key: 'gaming', label: t.catGaming },
    { key: 'communication', label: t.catCommunication },
    { key: 'media', label: t.catMedia },
  ]

  const tagSubmenu = processName
    ? [
        ...catEntries.map(({ key, label }) => ({
          id: `tag-${key}`, label, type: 'checkbox', checked: currentCat === key,
        })),
        { type: 'separator' },
        { id: 'tag-remove', label: t.catRemove, type: 'normal', enabled: currentCat !== null },
      ]
    : [{ id: 'tag-none', label: t.tagNoProcess, type: 'normal', enabled: false }]

  const tagLabel = processName ? `${t.tagApp} (${processName})` : t.tagApp

  const items = [
    { id: 'chat', label: t.chat, type: 'normal' },
    { id: 'settings', label: t.settings, type: 'normal' },
    { id: 'customize', label: t.customize, type: 'normal' },
    { id: 'memory', label: t.memory, type: 'normal' },
    { type: 'separator' },
    { id: 'tagApp', label: tagLabel, type: 'submenu', submenu: tagSubmenu },
    { id: 'theme', label: t.theme, type: 'submenu', submenu: [
      { id: 'theme-pixel', label: t.themePixel, type: 'radio', checked: currentTheme === 'pixel' },
      { id: 'theme-clean', label: t.themeClean, type: 'radio', checked: currentTheme === 'clean' },
    ]},
    { id: 'displaySize', label: t.displaySize, type: 'submenu', submenu: [
      { id: 'scale-4', label: t.x4, type: 'radio', checked: currentScale === 4 },
      { id: 'scale-6', label: t.x6, type: 'radio', checked: currentScale === 6 },
      { id: 'scale-8', label: t.x8, type: 'radio', checked: currentScale === 8 },
    ]},
    { id: 'language', label: t.language, type: 'submenu', submenu: [
      { id: 'lang-en', label: t.langEn, type: 'radio', checked: currentLang === 'en' },
      { id: 'lang-zh', label: t.langZh, type: 'radio', checked: currentLang === 'zh-CN' },
    ]},
    { type: 'separator' },
    { id: 'exit', label: t.exit, type: 'normal' },
  ]

  contextMenuWindow = new BrowserWindow({
    width: 200,
    height: 100,
    x: cursorX,
    y: cursorY,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'context-menu-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  contextMenuWindow.setAlwaysOnTop(true, 'screen-saver')
  contextMenuWindow.loadFile(path.join(__dirname, 'renderer', 'context-menu', 'context-menu.html'))

  contextMenuWindow.webContents.on('did-finish-load', () => {
    if (contextMenuWindow && !contextMenuWindow.isDestroyed()) {
      contextMenuWindow.webContents.send('init-context-menu', { items, theme: currentTheme })
      const cfg = config.load()
      contextMenuWindow.webContents.send('apply-color-scheme', { derived: deriveAllColors(cfg.colorScheme || DEFAULT_COLOR_SCHEME, currentTheme, cfg.panelOpacity) })
    }
  })

  contextMenuWindow.on('closed', () => { contextMenuWindow = null })
}

function handleMenuAction(id) {
  const processName = contextMenuProcessName
  if (id === 'chat') toggleChatWindow()
  else if (id === 'settings') createSettingsWindow()
  else if (id === 'customize') createCustomizeWindow()
  else if (id === 'memory') createMemoryWindow()
  else if (id === 'theme-pixel') setTheme('pixel')
  else if (id === 'theme-clean') setTheme('clean')
  else if (id === 'scale-4') setScale(4)
  else if (id === 'scale-6') setScale(6)
  else if (id === 'scale-8') setScale(8)
  else if (id === 'lang-en') setLanguage('en')
  else if (id === 'lang-zh') setLanguage('zh-CN')
  else if (id === 'tag-remove') tagAppToCategory(processName, null)
  else if (id.startsWith('tag-')) tagAppToCategory(processName, id.slice(4))
  else if (id === 'exit') app.quit()
}

function setScale(scale) {
  const oldSize = getWindowSize(currentScale)
  const [oldX, oldY] = mainWindow.getPosition()

  // Calculate old center point
  const centerX = oldX + oldSize.width / 2
  const centerY = oldY + oldSize.height / 2

  currentScale = scale
  const newSize = getWindowSize(scale)

  // Position new window so center stays the same
  const newX = Math.round(centerX - newSize.width / 2)
  const newY = Math.round(centerY - newSize.height / 2)

  mainWindow.setSize(newSize.width, newSize.height)

  // Clamp to screen after resize
  const [cx, cy] = clampToScreen(newX, newY, newSize.width, newSize.height)
  mainWindow.setPosition(cx, cy)

  config.save({ displayScale: scale, windowX: cx, windowY: cy })
  mainWindow.webContents.send('display-scale-changed', scale)
}

function setLanguage(lang) {
  currentLang = lang
  config.save({ language: lang })
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('set-language', lang)
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('set-language', lang)
  }
  if (customizeWindow && !customizeWindow.isDestroyed()) {
    customizeWindow.webContents.send('set-language', lang)
  }
  if (memoryWindow && !memoryWindow.isDestroyed()) {
    memoryWindow.webContents.send('set-language', lang)
  }
}

// --- Window creation ---
function createWindow() {
  const saved = config.load()
  currentScale = saved.displayScale ?? 4
  currentLang = saved.language ?? 'en'
  currentTheme = saved.theme ?? 'pixel'
  loadToolsSupportCache()

  const size = getWindowSize(currentScale)
  const display = screen.getPrimaryDisplay()
  const workArea = display.workArea

  // Default position: bottom-right with 20px margin
  const defaultX = workArea.x + workArea.width - size.width - 20
  const defaultY = workArea.y + workArea.height - size.height - 20

  const [x, y] = clampToScreen(
    saved.windowX ?? defaultX,
    saved.windowY ?? defaultY,
    size.width, size.height
  )

  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Click-through on transparent areas, forward mouse events to renderer
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // Send initial config after renderer is ready
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('display-scale-changed', currentScale)
    const cfg = config.load()
    mainWindow.webContents.send('apply-color-scheme', { derived: deriveAllColors(cfg.colorScheme || DEFAULT_COLOR_SCHEME, currentTheme, cfg.panelOpacity) })
  })

  // Periodically re-assert alwaysOnTop
  startAlwaysOnTopInterval()

  // Start system activity polling
  startActivityPolling()

  // Start foreground window polling (independent 5s cycle)
  startForegroundWindowPolling()

  // Save position on move (debounced to avoid excessive disk I/O during drag)
  let moveSaveTimer = null
  mainWindow.on('moved', () => {
    if (!mainWindow.isDestroyed()) {
      if (moveSaveTimer) clearTimeout(moveSaveTimer)
      moveSaveTimer = setTimeout(() => {
        moveSaveTimer = null
        if (!mainWindow.isDestroyed()) {
          const [wx, wy] = mainWindow.getPosition()
          config.save({ windowX: wx, windowY: wy })
        }
      }, 300)
    }
  })

  // Save position and clean up on close
  mainWindow.on('close', () => {
    stopActivityPolling()
    stopForegroundWindowPolling()
    if (!mainWindow.isDestroyed()) {
      const [wx, wy] = mainWindow.getPosition()
      config.save({ windowX: wx, windowY: wy })
    }
  })

  // Global shortcut: Ctrl+Shift+P toggles chat panel
  globalShortcut.register('Ctrl+Shift+P', () => toggleChatWindow())
}

// --- IPC Handlers ---

// Toggle mouse events based on renderer hit-test
ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  }
})

// Delta-based window movement for drag (clamped to screen)
ipcMain.on('move-window', (event, dx, dy) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [wx, wy] = mainWindow.getPosition()
    const size = getWindowSize(currentScale)
    const [cx, cy] = clampToScreen(wx + dx, wy + dy, size.width, size.height)
    mainWindow.setPosition(cx, cy)
  }
})

// Clamp window to screen and save position
ipcMain.on('clamp-and-save', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [wx, wy] = mainWindow.getPosition()
    const size = getWindowSize(currentScale)
    const [cx, cy] = clampToScreen(wx, wy, size.width, size.height)
    if (cx !== wx || cy !== wy) {
      mainWindow.setPosition(cx, cy)
    }
    config.save({ windowX: cx, windowY: cy })
  }
})

// Dragging state: pause alwaysOnTop + disable click-through
ipcMain.on('set-dragging', (event, dragging) => {
  isDragging = dragging
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (dragging) {
      stopAlwaysOnTopInterval()
      mainWindow.setIgnoreMouseEvents(false)
      closeBubbleWindow()
    } else {
      startAlwaysOnTopInterval()
      mainWindow.setIgnoreMouseEvents(true, { forward: true })
    }
  }
})

// Snap pet feet to workArea bottom (for thrown landing)
// Compensates for empty sprite rows below feet + window padding
// Sprite: feet at canvas row 27, canvas height 40 → 12 empty rows below
// Visual bottom offset = emptyRows(12) * scale + windowPadding(8)
ipcMain.on('snap-to-ground', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [wx, wy] = mainWindow.getPosition()
    const size = getWindowSize(currentScale)
    const display = screen.getPrimaryDisplay()
    const workArea = display.workArea
    const bp = activeCharacterMeta?.bottomPadding ?? 12
    const bottomCompensation = bp * currentScale + 8
    const maxY = workArea.y + workArea.height - size.height + bottomCompensation
    if (wy > maxY) {
      mainWindow.setPosition(wx, maxY)
      config.save({ windowX: wx, windowY: maxY })
    }
  }
})

// Context menu
ipcMain.on('show-context-menu', (event, x, y) => {
  showHtmlContextMenu(x, y)
})

ipcMain.on('context-menu-resize', (event, w, h) => {
  if (!contextMenuWindow || contextMenuWindow.isDestroyed()) return
  const [curX, curY] = contextMenuWindow.getPosition()
  const display = screen.getDisplayNearestPoint({ x: curX, y: curY })
  const wa = display.workArea
  const x = Math.min(curX, wa.x + wa.width - w)
  const y = Math.min(curY, wa.y + wa.height - h)
  contextMenuWindow.setBounds({ x, y, width: w, height: h })
  contextMenuWindow.show()
  contextMenuWindow.focus()
})

ipcMain.on('context-menu-action', (event, id) => {
  closeContextMenu()
  handleMenuAction(id)
})

ipcMain.on('context-menu-close', () => {
  closeContextMenu()
})

// Move window with boundary clamping (for thrown physics)
// Returns { hit, hitBottom, hitSideOrTop } so thrown can distinguish landing vs wall
// Uses center-point clamp for left/right/top, but feet-level clamp for bottom
// so the pet lands with feet at workArea bottom (not half-buried)
ipcMain.handle('move-window-clamped', (event, dx, dy) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { hit: false, hitBottom: false, hitSideOrTop: false }
  const [wx, wy] = mainWindow.getPosition()
  const newX = wx + dx
  const newY = wy + dy
  const size = getWindowSize(currentScale)

  // Use general clamp for left/right/top (center-point)
  const [cx, cy0] = clampToScreen(newX, newY, size.width, size.height)

  // Override bottom: clamp so feet touch workArea bottom, not window bottom
  // Feet are 12 empty sprite rows + 8px padding above window bottom edge
  const display = screen.getPrimaryDisplay()
  const workArea = display.workArea
  const bp = activeCharacterMeta?.bottomPadding ?? 12
  const bottomCompensation = bp * currentScale + 8
  const feetMaxY = workArea.y + workArea.height - size.height + bottomCompensation
  const cy = Math.min(cy0, feetMaxY)

  const hitLeft = cx > newX
  const hitRight = cx < newX
  const hitTop = cy > newY
  const hitBottom = cy < newY
  const hit = cx !== newX || cy !== newY
  mainWindow.setPosition(cx, cy)
  if (hit) {
    config.save({ windowX: cx, windowY: cy })
  }
  return { hit, hitBottom, hitSideOrTop: hitLeft || hitRight || hitTop }
})

// Get config (async invoke)
ipcMain.handle('get-config', () => {
  const saved = config.load()
  return { displayScale: currentScale, language: currentLang, theme: currentTheme, lastGreetingDate: saved.lastGreetingDate || '' }
})

// Save greeting date
ipcMain.on('save-greeting-date', (event, date) => {
  config.save({ lastGreetingDate: date })
})

// Get app categories config
ipcMain.handle('get-app-categories', () => config.loadAppCategories())

// --- Chat panel IPC ---
ipcMain.on('toggle-chat-panel', () => toggleChatWindow())
ipcMain.on('close-chat-panel', () => closeChatWindow())

ipcMain.on('chat-minimize', () => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.setSkipTaskbar(false)
    chatWindow.minimize()
    chatPanelOpen = false
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chat-panel-closed')
    }
  }
})

ipcMain.on('chat-maximize', () => {
  if (!chatWindow || chatWindow.isDestroyed()) return
  if (chatIsMaximized) {
    if (chatRestoreBounds) chatWindow.setBounds(chatRestoreBounds)
    chatIsMaximized = false
    chatWindow.setAlwaysOnTop(true, 'screen-saver')
    chatWindow.webContents.send('chat-maximize-changed', false)
  } else {
    chatRestoreBounds = chatWindow.getBounds()
    const display = screen.getDisplayMatching(chatRestoreBounds)
    chatWindow.setBounds(display.workArea)
    chatIsMaximized = true
    chatWindow.setAlwaysOnTop(false)
    chatWindow.webContents.send('chat-maximize-changed', true)
  }
})

ipcMain.handle('get-chat-state', () => ({
  messages: chatHistory,
  theme: currentTheme,
  lang: currentLang,
  apiConfigured: aiManager.isConfigured(getSettingsData()),
  usageRatio: lastUsageRatio,
  isStreaming: isAiStreaming,
}))


ipcMain.on('chat-send-message', (event, text, images) => {
  const msg = {
    id: ++chatMessageIdCounter,
    type: 'text',
    sender: 'user',
    content: text,
    timestamp: Date.now(),
  }
  if (images && images.length > 0) {
    msg.images = images
  }
  chatHistory.push(msg)
  appendToChatLog(msg)
  // Send to chat panel
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('chat-new-message', msg)
  }
  // Trigger AI response
  handleAiResponse()
})

let userStoppedStreaming = false
let isProactiveMessagePending = false
ipcMain.on('stop-streaming', () => {
  userStoppedStreaming = true
  aiManager.abort()
})

ipcMain.on('chat-retry-last', () => {
  if (isAiStreaming) return
  const lastUser = [...chatHistory].reverse().find(m => m.sender === 'user')
  if (!lastUser) return
  handleAiResponse()
})

// Render markdown synchronously (called via sendSync from renderer)
ipcMain.on('render-markdown', (event, text) => {
  try {
    event.returnValue = markedInstance.parse(text)
  } catch {
    event.returnValue = text
  }
})

// Open external URL in system browser (only http/https)
ipcMain.on('open-external-url', (event, url) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      shell.openExternal(url)
    }
  } catch {}
})

// Proxy image download to avoid renderer leaking IP
ipcMain.handle('proxy-image', async (event, url) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    const resp = await net.fetch(url)
    if (!resp.ok) return null
    const contentType = resp.headers.get('content-type') || 'image/png'
    const buf = Buffer.from(await resp.arrayBuffer())
    return `data:${contentType};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
})

// Pick images via native file dialog
ipcMain.handle('pick-images', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    properties: ['openFile', 'multiSelections'],
  })
  if (result.canceled || !result.filePaths.length) return []
  const images = []
  for (const fp of result.filePaths) {
    try {
      const buf = fs.readFileSync(fp)
      const ext = path.extname(fp).toLowerCase().slice(1)
      const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
      const mime = mimeMap[ext] || 'image/jpeg'
      images.push(`data:${mime};base64,${buf.toString('base64')}`)
    } catch { /* skip unreadable files */ }
  }
  return images
})

// --- Built-in Tools ---

// Reminders (in-memory, clears on restart)
const reminders = new Map() // id → { timer, message, triggerAt }
let reminderIdCounter = 0
const MAX_REMINDERS = 10

async function triggerReminder(id) {
  const reminder = reminders.get(id)
  if (!reminder) return
  reminders.delete(id)

  // Animation: notify → voice_reply → idle + bubble
  sendAnimationState('notify')
  await delay((4 / 3) * 1000 + 200) // 4 frames @ 3fps + buffer
  sendAnimationState('voice_reply')
  await delay((6 / 5) * 1000 + 200) // 6 frames @ 5fps + buffer
  sendAnimationState('idle')

  // Push to chat history
  const petMsg = {
    id: ++chatMessageIdCounter,
    type: 'text',
    sender: 'pet',
    content: `⏰ ${reminder.message}`,
    timestamp: Date.now(),
  }
  chatHistory.push(petMsg)
  appendToChatLog(petMsg)
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('chat-new-message', petMsg)
  }
  // Show bubble unconditionally
  const preview = reminder.message.length > 30 ? reminder.message.slice(0, 30) + '...' : reminder.message
  showBubble(`⏰ ${preview}`)
}

registerTool('get_current_time', 'Get the current date and time', {
  type: 'object', properties: {}, required: [],
}, async () => ({
  iso: new Date().toISOString(),
  local: new Date().toLocaleString(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
}))

registerTool('set_reminder', 'Set a reminder that will notify the user after a delay', {
  type: 'object',
  properties: {
    message: { type: 'string', description: 'The reminder message to show' },
    delay_seconds: { type: 'number', description: 'Delay in seconds before the reminder triggers (1-86400)' },
  },
  required: ['message', 'delay_seconds'],
}, async ({ message, delay_seconds }) => {
  if (reminders.size >= MAX_REMINDERS) {
    return { error: 'Maximum 10 active reminders reached' }
  }
  const delaySec = Math.min(Math.max(1, delay_seconds), 86400)
  const id = ++reminderIdCounter
  const triggerAt = Date.now() + delaySec * 1000
  const timer = setTimeout(() => triggerReminder(id), delaySec * 1000)
  reminders.set(id, { timer, message, triggerAt })
  return { reminder_id: id, message, trigger_at: new Date(triggerAt).toISOString() }
})

registerTool('cancel_reminder', 'Cancel an active reminder', {
  type: 'object',
  properties: {
    reminder_id: { type: 'number', description: 'The reminder ID to cancel' },
    keyword: { type: 'string', description: 'Cancel the reminder whose message matches this keyword' },
  },
  required: [],
}, async ({ reminder_id, keyword }) => {
  if (reminder_id != null) {
    const r = reminders.get(reminder_id)
    if (r) {
      clearTimeout(r.timer)
      reminders.delete(reminder_id)
      return { cancelled: true, reminder_id }
    }
    return { error: `Reminder ${reminder_id} not found` }
  }
  if (keyword) {
    const kw = keyword.toLowerCase()
    for (const [id, r] of reminders) {
      if (r.message.toLowerCase().includes(kw)) {
        clearTimeout(r.timer)
        reminders.delete(id)
        return { cancelled: true, reminder_id: id, message: r.message }
      }
    }
    return { error: `No reminder matching "${keyword}"` }
  }
  return { error: 'Provide reminder_id or keyword' }
})

// --- Image generation tool ---
function registerImageTool() {
  const saved = config.load()
  const hasImageApi = saved.imageApiEndpoint && saved.imageApiKeyEncrypted && saved.imageModelName
  if (hasImageApi) {
    registerTool('generate_image', 'Generate an image based on a text description. Returns a base64-encoded image.', {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Detailed description of the image to generate' },
        size: { type: 'string', description: 'Image size, e.g. "1024x1024"', default: '1024x1024' },
      },
      required: ['prompt'],
    }, async (args) => {
      return await generateImage(args.prompt, args.size || '1024x1024')
    })
  } else {
    toolRegistry.delete('generate_image')
  }
}

async function generateImage(prompt, size) {
  const saved = config.load()
  const endpoint = saved.imageApiEndpoint
  const apiKey = config.decryptApiKey(saved.imageApiKeyEncrypted)
  const model = saved.imageModelName

  if (!endpoint || !apiKey || !model) {
    return { error: 'Image API not configured' }
  }

  const url = endpoint.replace(/\/+$/, '') + '/images/generations'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, prompt, n: 1, size, response_format: 'b64_json' }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      return { error: `Image API error ${response.status}: ${errText.slice(0, 200)}` }
    }

    const data = await response.json()
    const b64 = data.data && data.data[0] && data.data[0].b64_json
    if (!b64) return { error: 'No image data in response' }

    return { image_base64: b64 }
  } catch (err) {
    return { error: err.message || 'Image generation failed' }
  } finally {
    clearTimeout(timeout)
  }
}

registerImageTool()

// --- Memory & Emotion tools ---
let pendingEmotion = null

function registerMemoryTools() {
  const settings = getSettingsData()
  if (settings.memoryEnabled) {
    registerTool('update_memory', 'Save or update a memory about the user. Use when you learn something important (name, preferences, habits, events).', {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Short identifier (e.g. user_name, favorite_food). Use existing key to update.' },
        content: { type: 'string', description: 'What to remember, in natural language.' },
      },
      required: ['key', 'content'],
    }, (args) => {
      const core = loadCoreMemory()
      const existing = core.entries.findIndex(e => e.key === args.key)
      const now = Date.now()
      if (existing >= 0) {
        core.entries[existing].content = args.content
        core.entries[existing].updatedAt = now
      } else {
        if (core.entries.length >= 30) {
          return { error: 'Memory full (30/30). Delete an old memory first.', count: core.entries.length, limit: 30 }
        }
        core.entries.push({ key: args.key, content: args.content, createdAt: now, updatedAt: now })
      }
      saveCoreMemory(core)
      return { success: true, count: core.entries.length, limit: 30 }
    })

    registerTool('delete_memory', 'Delete a memory that is no longer relevant or accurate.', {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The key of the memory to delete.' },
      },
      required: ['key'],
    }, (args) => {
      const core = loadCoreMemory()
      const idx = core.entries.findIndex(e => e.key === args.key)
      if (idx < 0) return { error: `Memory key "${args.key}" not found`, count: core.entries.length }
      core.entries.splice(idx, 1)
      saveCoreMemory(core)
      return { success: true, deleted_key: args.key, count: core.entries.length }
    })

    registerTool('search_memory', 'Search past conversations and archived memories. Use when the user references something from a previous conversation.', {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search for.' },
      },
      required: ['query'],
    }, (args) => {
      const archiveResults = searchArchive(args.query)
      const chatResults = searchChatLogs(args.query)
      return { archive_results: archiveResults, chat_results: chatResults }
    })
  } else {
    toolRegistry.delete('update_memory')
    toolRegistry.delete('delete_memory')
    toolRegistry.delete('search_memory')
  }

  // express_emotion always registered (not controlled by memoryEnabled)
  registerTool('express_emotion', 'Express an emotion through animation. Use when your response has a strong emotional tone.', {
    type: 'object',
    properties: {
      emotion: { type: 'string', enum: ['happy', 'excited', 'sad', 'surprised', 'love', 'comfort'], description: 'The emotion to express.' },
    },
    required: ['emotion'],
  }, (args) => {
    pendingEmotion = args.emotion
    return { success: true }
  })
}

registerMemoryTools()

async function handleAiResponse() {
  const settings = getSettingsData()
  pendingEmotion = null

  // Archive trigger: new session detected (>30min gap between previous and current message)
  if (settings.memoryEnabled && chatHistory.length >= 2) {
    const prevMsg = chatHistory[chatHistory.length - 2]
    const currMsg = chatHistory[chatHistory.length - 1]
    if (prevMsg.timestamp && currMsg.timestamp && currMsg.timestamp - prevMsg.timestamp > 30 * 60 * 1000 && lastArchivedTimestamp !== prevMsg.timestamp) {
      lastArchivedTimestamp = prevMsg.timestamp
      const oldMessages = chatHistory.slice(0, -1)
      summarizeAndArchive(oldMessages).catch(() => {})
    }
  }

  // Build memory context for AI
  const memoryContext = settings.memoryEnabled ? {
    core: loadCoreMemory().entries.map(e => `- ${e.content}`).join('\n') || null
  } : null

  // Cancel any pending proactive message
  isProactiveMessagePending = false

  // Check if API is configured
  if (!aiManager.isConfigured(settings)) {
    sendAnimationState('confused-once')
    return
  }

  if (isAiStreaming) return
  isAiStreaming = true
  userStoppedStreaming = false

  // --- Tools support auto-detection ---
  const cacheKey = `${settings.apiEndpoint}|${settings.modelName}`
  const toolsKnownUnsupported = toolsSupportCache[cacheKey] === false
  const toolDefs = toolsKnownUnsupported ? [] : getToolDefinitions()
  let toolsTriedThisRequest = toolDefs.length > 0

  // 0. Viewing animation if user sent images
  const lastUserMsg = chatHistory.filter(m => m.sender === 'user').pop()
  if (lastUserMsg && lastUserMsg.images && lastUserMsg.images.length > 0) {
    sendAnimationState('viewing')
    await delay((3 / 3) * 1000 + 200) // 3 frames @ 3fps + buffer
  }

  // 1. Reading animation (~1.3s)
  sendAnimationState('reading')
  const readingDuration = (4 / 3) * 1000 + 200 // 4 frames @ 3fps + 200ms buffer
  await delay(readingDuration)

  // 2. Thinking animation (hold loop)
  sendAnimationState('thinking')

  // 3. Confused timer (6s normal, 15s deep thinking)
  const confusedTimeout = settings.deepThinking ? 15000 : 6000
  let confusedTimer = setTimeout(() => {
    sendAnimationState('confused')
  }, confusedTimeout)

  // Inner function: consume a stream, return results
  async function consumeStream(settingsWithTools) {
    let firstText = false
    let error = false
    let errorStatusCode = null
    let errorContent = ''
    const pendingToolCalls = []

    const stream = aiManager.streamResponse(chatHistory, settingsWithTools, currentLang, memoryContext)

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'context':
          lastUsageRatio = chunk.usageRatio
          if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.webContents.send('context-usage', chunk.usageRatio)
          }
          break

        case 'thinking':
          currentPetMsg.thinkingContent += chunk.content
          if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.webContents.send('ai-stream-thinking', chunk.content)
          }
          break

        case 'text':
          if (!firstText) {
            firstText = true
            clearTimeout(confusedTimer)
            sendAnimationState('speaking')
          }
          currentPetMsg.content += chunk.content
          if (chatWindow && !chatWindow.isDestroyed()) {
            chatWindow.webContents.send('ai-stream-chunk', chunk.content)
          }
          break

        case 'tool_call':
          pendingToolCalls.push({ id: chunk.id, name: chunk.name, arguments: chunk.arguments })
          break

        case 'error':
          error = true
          errorStatusCode = chunk.statusCode || null
          errorContent = chunk.content
          clearTimeout(confusedTimer)
          break

        case 'done':
          clearTimeout(confusedTimer)
          break
      }

      if (chunk.type === 'done' || chunk.type === 'error') break
    }

    return { firstText, error, errorStatusCode, errorContent, pendingToolCalls }
  }

  // 4. Stream AI response — pre-push pet message for panel rebuild support
  let currentPetMsg = {
    id: ++chatMessageIdCounter,
    type: 'text',
    sender: 'pet',
    content: '',
    thinkingContent: '',
    timestamp: Date.now(),
    streaming: true,
  }
  chatHistory.push(currentPetMsg)

  // Notify chat panel that streaming started
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('ai-stream-start', currentPetMsg.id)
  }

  let hasError = false

  try {
    const settingsWithTools = { ...settings, _tools: toolDefs }
    let result = await consumeStream(settingsWithTools)

    // Auto-detection: if 400/422 with tools, retry without
    if (result.error && toolsTriedThisRequest && result.errorStatusCode &&
        [400, 422].includes(result.errorStatusCode)) {
      saveToolsSupport(cacheKey, false)
      // Clean up first streaming bubble before retry
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('ai-stream-end')
      }
      // Remove the empty placeholder
      const idx = chatHistory.indexOf(currentPetMsg)
      if (idx !== -1) chatHistory.splice(idx, 1)
      // Create fresh placeholder and retry without tools
      currentPetMsg = {
        id: ++chatMessageIdCounter,
        type: 'text',
        sender: 'pet',
        content: '',
        thinkingContent: '',
        timestamp: Date.now(),
        streaming: true,
      }
      chatHistory.push(currentPetMsg)
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('ai-stream-start', currentPetMsg.id)
      }
      // Reset confused timer
      confusedTimer = setTimeout(() => { sendAnimationState('confused') }, confusedTimeout)
      sendAnimationState('thinking')
      toolsTriedThisRequest = false
      result = await consumeStream({ ...settings, _tools: [] })
    }

    if (result.error) {
      hasError = true
      sendAnimationState('error')
      addSystemMessage(result.errorContent, true)
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('ai-stream-error', result.errorContent)
      }
    }

    // Tool execution loop
    let toolRound = 0
    const MAX_TOOL_ROUNDS = 5
    while (!hasError && !userStoppedStreaming && result.pendingToolCalls.length > 0 && toolRound < MAX_TOOL_ROUNDS) {
      // If only terminal tools (no new AI round needed), execute and break
      const onlyTerminal = result.pendingToolCalls.every(tc => tc.name === 'express_emotion')
      if (onlyTerminal) {
        for (const tc of result.pendingToolCalls) {
          const tool = toolRegistry.get(tc.name)
          if (tool) try { await tool.handler(tc.arguments) } catch {}
        }
        break
      }
      toolRound++

      // Mark current petMsg as tool-call carrier (hidden from UI)
      currentPetMsg.toolCalls = result.pendingToolCalls
      currentPetMsg.hidden = true
      currentPetMsg.streaming = false
      currentPetMsg.timestamp = Date.now()
      if (!currentPetMsg.thinkingContent) delete currentPetMsg.thinkingContent

      // Execute each tool
      const memoryAnimMap = { update_memory: 'learn', delete_memory: 'forget', search_memory: 'recall' }
      for (const tc of result.pendingToolCalls) {
        // Play memory animation before executing memory tools
        if (memoryAnimMap[tc.name]) {
          sendAnimationState(memoryAnimMap[tc.name])
          await delay(Math.ceil((4 / 3) * 1000) + 200)
        }

        const tool = toolRegistry.get(tc.name)
        let toolResultObj
        if (tool) {
          try { toolResultObj = await tool.handler(tc.arguments) }
          catch (err) { toolResultObj = { error: err.message } }
        } else {
          toolResultObj = { error: `Unknown tool: ${tc.name}` }
        }
        // Accumulate generated images into currentPetMsg
        if (toolResultObj && toolResultObj.image_base64) {
          if (!currentPetMsg.images) currentPetMsg.images = []
          currentPetMsg.images.push({ base64: toolResultObj.image_base64, mimeType: 'image/png' })
        }
        const toolResult = (toolResultObj && toolResultObj.image_base64)
          ? JSON.stringify({ success: true, message: 'Image generated successfully' })
          : JSON.stringify(toolResultObj)
        // Push tool result to chatHistory (hidden from UI)
        chatHistory.push({
          id: ++chatMessageIdCounter,
          type: 'text',
          sender: 'tool',
          toolCallId: tc.id,
          toolName: tc.name,
          content: toolResult,
          timestamp: Date.now(),
          hidden: true,
        })
      }

      // Create new petMsg for next round, preserving thinking content and images from previous round
      const prevThinking = currentPetMsg.thinkingContent || ''
      const prevImages = currentPetMsg.images || null
      currentPetMsg = {
        id: ++chatMessageIdCounter,
        type: 'text',
        sender: 'pet',
        content: '',
        thinkingContent: prevThinking,
        timestamp: Date.now(),
        streaming: true,
      }
      if (prevImages) currentPetMsg.images = prevImages
      chatHistory.push(currentPetMsg)

      // Keep thinking animation, reset confused timer
      sendAnimationState('thinking')
      confusedTimer = setTimeout(() => { sendAnimationState('confused') }, confusedTimeout)

      // Second round stream
      result = await consumeStream({ ...settings, _tools: toolDefs })

      if (result.error) {
        hasError = true
        sendAnimationState('error')
        addSystemMessage(result.errorContent, true)
        if (chatWindow && !chatWindow.isDestroyed()) {
          chatWindow.webContents.send('ai-stream-error', result.errorContent)
        }
      }
    }

    // Mark tools as supported if we successfully used them
    if (toolsTriedThisRequest && !hasError && toolsSupportCache[cacheKey] === undefined) {
      saveToolsSupport(cacheKey, true)
    }

    clearTimeout(confusedTimer)
  } catch (err) {
    clearTimeout(confusedTimer)
    if (!userStoppedStreaming) {
      hasError = true
      sendAnimationState('error')
      const errMsg = err.message || 'Unexpected error'
      addSystemMessage(errMsg, true)
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('ai-stream-error', errMsg)
      }
    }
  }

  // Finalize pet message
  currentPetMsg.streaming = false
  currentPetMsg.timestamp = Date.now()

  const hasImages = currentPetMsg.images && currentPetMsg.images.length > 0
  const hasContent = currentPetMsg.content || hasImages

  if (!hasError && hasContent) {
    if (!currentPetMsg.thinkingContent) delete currentPetMsg.thinkingContent

    // Send images to chat panel
    if (hasImages && chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('ai-stream-images', currentPetMsg.images)
    }

    // Show bubble if chat panel is closed
    if (!chatPanelOpen) {
      let preview = currentPetMsg.content
      const hadMarkdownImages = preview && /!\[.*?\]\(.*?\)/.test(preview)
      if (preview) preview = preview.replace(/!\[.*?\]\(.*?\)/g, '').trim()
      if (!preview && (hasImages || hadMarkdownImages)) {
        const i18nData = loadI18n(currentLang)
        preview = i18nData.system?.imageLabel || '[Image]'
      }
      if (preview) {
        preview = preview.length > 30 ? preview.slice(0, 30) + '...' : preview
        showBubble(preview)
      }
    }
  } else if (!hasError && !hasContent && !userStoppedStreaming) {
    // Stream ended with no content — connection lost
    const idx = chatHistory.indexOf(currentPetMsg)
    if (idx !== -1) chatHistory.splice(idx, 1)

    const i18n = loadI18n(currentLang)
    const lostText = i18n.system?.connectionLost || 'Connection lost'
    addSystemMessage(lostText, true)
    sendAnimationState('error')
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('ai-stream-error', lostText)
    }
  } else {
    // Error or user stopped with no content — remove empty placeholder
    if (!currentPetMsg.content && !currentPetMsg.thinkingContent) {
      const idx = chatHistory.indexOf(currentPetMsg)
      if (idx !== -1) chatHistory.splice(idx, 1)
    } else {
      if (!currentPetMsg.thinkingContent) delete currentPetMsg.thinkingContent
    }
  }

  // Return to idle (or play emotion animation first)
  if (!hasError) {
    if (pendingEmotion) {
      sendAnimationState(pendingEmotion)
      pendingEmotion = null
    } else {
      sendAnimationState('idle')
    }
  }

  // Notify chat panel that streaming ended
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('ai-stream-end')
  }

  // Persist finalized AI message to chat log
  if (currentPetMsg && !currentPetMsg.hidden && currentPetMsg.content) {
    appendToChatLog(currentPetMsg)
  }

  isAiStreaming = false
}

function sendAnimationState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ai-animation-state', state)
  }
}

function addSystemMessage(content, retryable = false) {
  const msg = {
    id: ++chatMessageIdCounter,
    type: 'text',
    sender: 'system',
    content,
    timestamp: Date.now(),
  }
  if (retryable) msg.retryable = true
  chatHistory.push(msg)
  appendToChatLog(msg)
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('chat-new-message', msg)
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --- Proactive Messages ---

ipcMain.on('pet-want-to-talk', () => {
  generateProactiveMessage()
})

async function generateProactiveMessage() {
  if (isProactiveMessagePending || isAiStreaming) {
    sendAnimationState('idle')
    return
  }
  isProactiveMessagePending = true

  try {
    const settings = getSettingsData()
    const i18n = loadI18n(currentLang)
    let text = null

    // Plan B: API call if configured + recent chat within 30 min
    const hasApi = aiManager.isConfigured(settings)
    const lastMsg = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null
    const hasRecentChat = lastMsg && (Date.now() - lastMsg.timestamp < 30 * 60 * 1000)

    if (hasApi && hasRecentChat) {
      try { text = await callProactiveApi(settings) } catch { /* fall through to Plan A */ }
    }

    if (!isProactiveMessagePending) return // User sent a message, abort

    // Plan A: local presets
    if (!text) text = pickProactivePreset(i18n)
    if (!text) { sendAnimationState('idle'); return }

    if (!isProactiveMessagePending) return

    // Animation: voice_reply (releases want_to_talk hold → plays once) → idle
    sendAnimationState('voice_reply')
    await delay((6 / 5) * 1000 + 200)
    sendAnimationState('idle')

    // Push to chat history and show
    const petMsg = {
      id: ++chatMessageIdCounter,
      type: 'text',
      sender: 'pet',
      content: text,
      timestamp: Date.now(),
    }
    chatHistory.push(petMsg)
    appendToChatLog(petMsg)
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('chat-new-message', petMsg)
    }
    // Show bubble unconditionally
    const preview = text.length > 30 ? text.slice(0, 30) + '...' : text
    showBubble(preview)
  } finally {
    isProactiveMessagePending = false
  }
}

async function callProactiveApi(settings) {
  const provider = createProvider(settings.apiType, settings.apiEndpoint, settings.apiKey)
  const recent = chatHistory.filter(m => m.sender === 'user' || m.sender === 'pet').slice(-5)
  if (!recent.length) return null

  const persona = aiManager.buildSystemPrompt(settings, currentLang)
  const proactiveHint = currentLang === 'zh-CN'
    ? '\n\n主人一段时间没理你了。用一句话主动开口，要求：不要概括之前的对话，而是基于之前的话题提出一个引导性的问题、温暖的关心或好奇的追问；让主人看到后想点开聊天继续对话；简短自然，1句话，不超过20字；完全保持你的人设语气。'
    : "\n\nYour owner hasn't talked to you for a while. Say ONE short sentence to re-engage them: don't summarize previous conversation, instead ask a follow-up question, show caring, or express curiosity based on recent topics; make them want to click and chat; keep it under 15 words; stay fully in character."

  const messages = [
    { role: 'system', content: persona + proactiveHint },
    ...recent.map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content })),
  ]

  let text = ''
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 10000)
  try {
    for await (const chunk of provider.streamChat(messages, {
      model: settings.modelName, maxTokens: 80, temperature: 1.0, signal: ctrl.signal,
    })) {
      if (chunk.type === 'text') text += chunk.content
      if (chunk.type === 'done' || chunk.type === 'error') break
    }
  } finally { clearTimeout(timeout) }
  return text.trim() || null
}

function pickProactivePreset(i18n) {
  const p = i18n?.proactive
  if (!p) return null
  const h = new Date().getHours()
  const timeKey = h >= 6 && h < 12 ? 'morning' : h < 18 ? 'afternoon' : h < 22 ? 'evening' : 'night'
  const all = [...(p[timeKey] || []), ...(p.bored || []), ...(p.care || []), ...(p.curious || [])]
  return all.length ? all[Math.floor(Math.random() * all.length)] : null
}

// --- Bubble IPC ---
ipcMain.on('bubble-clicked', () => {
  closeBubbleWindow()
  if (chatWindow && !chatWindow.isDestroyed()) {
    if (chatWindow.isMinimized()) chatWindow.restore()
    chatWindow.show()
    chatWindow.focus()
  } else {
    createChatWindow()
  }
})

ipcMain.on('bubble-faded', () => {
  closeBubbleWindow()
})

ipcMain.on('bubble-resize', (event, w, h) => {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return
  if (!mainWindow || mainWindow.isDestroyed()) return
  const hm = BUBBLE_MARGIN / 2
  const pos = getBubblePosition(w, h)
  bubbleWindow.setBounds({ x: pos.x - hm, y: pos.y - hm, width: w + BUBBLE_MARGIN, height: h + BUBBLE_MARGIN })
  bubbleWindow.showInactive()
})

ipcMain.on('bubble-ignore-mouse', (event, ignore) => {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.setIgnoreMouseEvents(ignore, { forward: true })
  }
})

ipcMain.on('character-bounds', (event, bounds) => {
  characterBounds = bounds
})

// --- Settings IPC ---
ipcMain.on('close-settings', () => closeSettingsWindow())
ipcMain.on('close-customize', () => closeCustomizeWindow())
ipcMain.on('close-memory', () => {
  if (memoryWindow && !memoryWindow.isDestroyed()) memoryWindow.close()
})

// --- Memory Management IPC ---
ipcMain.handle('delete-core-memory', (_, key) => {
  const core = loadCoreMemory()
  core.entries = core.entries.filter(e => e.key !== key)
  saveCoreMemory(core)
  return { entries: core.entries }
})

ipcMain.handle('edit-core-memory', (_, key, content) => {
  const core = loadCoreMemory()
  const entry = core.entries.find(e => e.key === key)
  if (entry) {
    entry.content = content
    entry.updatedAt = Date.now()
    saveCoreMemory(core)
    return { success: true }
  }
  return { error: 'not_found' }
})

ipcMain.handle('delete-archive-entry', (_, index) => {
  const archivePath = path.join(getMemoryBasePath(), 'archive.jsonl')
  if (!fs.existsSync(archivePath)) return { entries: [] }
  const lines = fs.readFileSync(archivePath, 'utf-8').trim().split('\n').filter(Boolean)
  lines.splice(index, 1)
  fs.writeFileSync(archivePath, lines.length > 0 ? lines.join('\n') + '\n' : '')
  return { entries: loadArchiveEntries() }
})

ipcMain.handle('delete-chat-log', (_, filename) => {
  const filePath = path.join(getMemoryBasePath(), 'chats', filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  return { files: listChatFiles() }
})

ipcMain.handle('clear-all-memory', () => {
  const base = getMemoryBasePath()
  const corePath = path.join(base, 'core.json')
  const archivePath = path.join(base, 'archive.jsonl')
  const chatDir = path.join(base, 'chats')
  if (fs.existsSync(corePath)) fs.unlinkSync(corePath)
  if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath)
  if (fs.existsSync(chatDir)) fs.rmSync(chatDir, { recursive: true, force: true })
  return { success: true }
})

ipcMain.on('open-memory-folder', () => {
  const base = getMemoryBasePath()
  ensureMemoryDir()
  require('electron').shell.openPath(base)
})

ipcMain.handle('change-memory-path', async () => {
  return await migrateStoragePath()
})

// --- Color Scheme IPC ---
ipcMain.on('save-color-scheme', (_, scheme) => {
  config.save({ colorScheme: scheme })
  applyColorSchemeToAll()
})

ipcMain.on('save-panel-opacity', (_, val) => {
  config.save({ panelOpacity: val })
  applyColorSchemeToAll()
})

// --- Character System IPC ---
ipcMain.handle('get-character-list', () => {
  return characterManager.listCharacters()
})

ipcMain.handle('import-character', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Import Character Pack',
  })
  if (result.canceled || !result.filePaths.length) return { canceled: true }
  const importResult = characterManager.importPack(result.filePaths[0])
  return importResult
})

ipcMain.handle('switch-character', async (_, id) => {
  if (id === null) {
    // Switch back to built-in C1
    activeCharacterId = null
    activeCharacterMeta = null
    config.save({ activeCharacterId: null })
  } else {
    const meta = characterManager.getMeta(id)
    if (!meta) return { error: 'not_found' }
    activeCharacterId = id
    activeCharacterMeta = meta
    config.save({ activeCharacterId: id })
  }

  // Broadcast character change to main renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    const size = getWindowSize(currentScale)
    mainWindow.setSize(size.width, size.height)
    mainWindow.webContents.send('character-changed', {
      meta: activeCharacterMeta,
      characterId: activeCharacterId,
    })
  }

  return {
    success: true,
    meta: activeCharacterMeta,
    resolvedStateMap: characterManager.buildResolvedStateMap(activeCharacterId, getCurrentOverrides()),
    stateOverrides: getCurrentOverrides(),
  }
})

ipcMain.handle('delete-character', async (_, id) => {
  const wasCurrent = (id === activeCharacterId)
  characterManager.deletePack(id)

  // Clean up orphan stateOverrides for the deleted character
  const charKey = id || ''
  if (stateOverrides[charKey]) {
    // Delete override files on disk
    for (const filePath of Object.values(stateOverrides[charKey])) {
      try { fs.unlinkSync(filePath) } catch {}
    }
    delete stateOverrides[charKey]
    config.save({ stateOverrides })
  }

  if (wasCurrent) {
    activeCharacterId = null
    activeCharacterMeta = null
    config.save({ activeCharacterId: null })

    if (mainWindow && !mainWindow.isDestroyed()) {
      const size = getWindowSize(currentScale)
      mainWindow.setSize(size.width, size.height)
      mainWindow.webContents.send('character-changed', {
        meta: null,
        characterId: null,
      })
    }
  }

  return {
    success: true,
    switchedToDefault: wasCurrent,
    resolvedStateMap: characterManager.buildResolvedStateMap(activeCharacterId, getCurrentOverrides()),
    stateOverrides: getCurrentOverrides(),
  }
})

ipcMain.handle('export-character', async (_, id) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Export Character Pack',
  })
  if (result.canceled || !result.filePaths.length) return { canceled: true }
  const ok = characterManager.exportPack(id, result.filePaths[0])
  return { success: ok }
})

// --- Animation State Overrides IPC ---
ipcMain.handle('get-states-data', () => {
  const statesPath = path.join(__dirname, '..', 'output', 'states.json')
  try {
    return JSON.parse(fs.readFileSync(statesPath, 'utf-8'))
  } catch {
    return {}
  }
})

ipcMain.handle('get-state-overrides', () => {
  return getCurrentOverrides()
})

ipcMain.handle('replace-state-sheet', async (_, stateName) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    title: 'Select frame images',
    filters: [{ name: 'Images', extensions: ['png'] }],
  })
  if (result.canceled || !result.filePaths.length) return { canceled: true }

  const framePaths = result.filePaths.sort()

  // Validate frame count matches states.json
  let statesJson = {}
  try {
    statesJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'output', 'states.json'), 'utf-8'))
  } catch {}
  const expectedFrames = statesJson[stateName]?.frames
  if (expectedFrames && framePaths.length !== expectedFrames) {
    return { error: 'frame_count_mismatch', expected: expectedFrames, got: framePaths.length }
  }

  // Validate frame sizes match current character
  const fw = activeCharacterMeta?.frameWidth ?? 32
  const fh = activeCharacterMeta?.frameHeight ?? 40
  for (const fp of framePaths) {
    const img = nativeImage.createFromPath(fp)
    if (img.isEmpty()) continue
    const size = img.getSize()
    if (size.width !== fw || size.height !== fh) {
      return { error: 'size_mismatch', expectedW: fw, expectedH: fh }
    }
  }

  // Stitch frames into sheet
  const overridesDir = characterManager.getOverridesDir()
  if (!fs.existsSync(overridesDir)) {
    fs.mkdirSync(overridesDir, { recursive: true })
  }
  const charKey = activeCharacterId || 'c1'
  const outPath = path.join(overridesDir, `${charKey}_${stateName}_sheet.png`)
  const stitchResult = characterManager.stitchFrames(framePaths, outPath)
  if (!stitchResult) {
    return { error: 'no_frames' }
  }

  // Save override (per-character)
  const key = activeCharacterId || ''
  if (!stateOverrides[key]) stateOverrides[key] = {}
  stateOverrides[key][stateName] = outPath
  config.save({ stateOverrides })

  // Broadcast to main renderer and customize window
  const resolvedEntry = characterManager.buildResolvedStateMap(activeCharacterId, getCurrentOverrides())[stateName]
  const changeData = { stateName, resolvedEntry }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state-override-changed', changeData)
  }
  if (customizeWindow && !customizeWindow.isDestroyed()) {
    customizeWindow.webContents.send('state-override-changed', changeData)
  }

  return { success: true, frameCount: framePaths.length }
})

ipcMain.on('reset-state-sheet', (_, stateName) => {
  // Remove override file (per-character)
  const key = activeCharacterId || ''
  const charOverrides = stateOverrides[key]
  if (charOverrides && charOverrides[stateName]) {
    try { fs.unlinkSync(charOverrides[stateName]) } catch {}
    delete charOverrides[stateName]
    if (Object.keys(charOverrides).length === 0) delete stateOverrides[key]
  }
  config.save({ stateOverrides })

  // Broadcast
  const resolvedEntry = characterManager.buildResolvedStateMap(activeCharacterId, getCurrentOverrides())[stateName]
  const changeData = { stateName, resolvedEntry }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state-override-changed', changeData)
  }
  if (customizeWindow && !customizeWindow.isDestroyed()) {
    customizeWindow.webContents.send('state-override-changed', changeData)
  }
})

// --- Reset All Customization ---
ipcMain.handle('reset-all-customize', () => {
  // 1. Reset color scheme + opacity
  const defaultOpacity = 100
  config.save({ colorScheme: null, panelOpacity: defaultOpacity })

  // 2. Clear all state overrides + delete override files
  for (const charKey of Object.keys(stateOverrides)) {
    for (const filePath of Object.values(stateOverrides[charKey])) {
      try { fs.unlinkSync(filePath) } catch {}
    }
  }
  stateOverrides = {}
  config.save({ stateOverrides: {} })

  // 3. Switch to C1
  activeCharacterId = null
  activeCharacterMeta = null
  config.save({ activeCharacterId: null })

  // 4. Broadcast color scheme reset
  applyColorSchemeToAll()

  // 5. Notify renderer of character change
  if (mainWindow && !mainWindow.isDestroyed()) {
    const size = getWindowSize(currentScale)
    mainWindow.setSize(size.width, size.height)
    mainWindow.webContents.send('character-changed', { meta: null, characterId: null })
  }

  // 6. Return fresh data for customize panel to re-init
  let statesData = {}
  try {
    statesData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'output', 'states.json'), 'utf-8'))
  } catch {}
  return {
    colorScheme: null,
    panelOpacity: defaultOpacity,
    activeCharacterId: null,
    characterList: characterManager.listCharacters(),
    statesData,
    stateOverrides: {},
    resolvedStateMap: characterManager.buildResolvedStateMap(null, {}),
    storagePath: characterManager.getStorageBase(),
    storageSize: getStorageSize(),
  }
})

// --- Storage Path Management ---
async function migrateStoragePath() {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Storage Location',
  })
  if (result.canceled || !result.filePaths.length) return { canceled: true }

  const selectedDir = result.filePaths[0]
  const newBase = path.join(selectedDir, 'c1-pet')
  const oldBase = characterManager.getStorageBase()

  if (path.resolve(newBase) === path.resolve(oldBase)) return { canceled: true }

  // Verify writable
  const testFile = path.join(selectedDir, '.c1-write-test')
  try {
    fs.writeFileSync(testFile, 'test')
    fs.unlinkSync(testFile)
  } catch {
    return { error: 'not_writable' }
  }

  if (!fs.existsSync(newBase)) fs.mkdirSync(newBase, { recursive: true })

  // Migrate all subdirectories
  for (const subdir of ['characters', 'state-overrides', 'memory']) {
    const oldDir = path.join(oldBase, subdir)
    const newDir = path.join(newBase, subdir)
    if (fs.existsSync(oldDir)) {
      fs.cpSync(oldDir, newDir, { recursive: true })
      fs.rmSync(oldDir, { recursive: true, force: true })
    }
  }

  // Clean up old c1-pet folder if empty
  try {
    const remaining = fs.readdirSync(oldBase)
    if (remaining.length === 0) fs.rmdirSync(oldBase)
  } catch { /* ignore */ }

  // Update stateOverrides paths
  const resolvedOld = path.resolve(oldBase)
  const resolvedNew = path.resolve(newBase)
  for (const charKey of Object.keys(stateOverrides)) {
    for (const [stateName, oldPath] of Object.entries(stateOverrides[charKey])) {
      if (path.resolve(oldPath).startsWith(resolvedOld)) {
        stateOverrides[charKey][stateName] = path.join(resolvedNew, 'state-overrides', path.basename(oldPath))
      }
    }
  }
  config.save({ stateOverrides, characterStoragePath: newBase })
  characterManager.setStoragePath(newBase)

  // Notify all open windows about the path change
  const migrationResult = {
    success: true,
    storagePath: newBase,
    storageSize: getStorageSize(),
  }
  if (customizeWindow && !customizeWindow.isDestroyed()) {
    customizeWindow.webContents.send('storage-path-changed', migrationResult)
  }
  if (memoryWindow && !memoryWindow.isDestroyed()) {
    memoryWindow.webContents.send('storage-path-changed', { storagePath: getMemoryBasePath() })
  }

  return migrationResult
}

ipcMain.handle('change-storage-path', async () => {
  return await migrateStoragePath()
})

ipcMain.handle('get-settings', () => getSettingsData())

ipcMain.on('save-settings', (event, key, value) => {
  if (key === 'apiKey') {
    config.save({ apiKeyEncrypted: config.encryptApiKey(value) })
  } else if (key === 'imageApiKey') {
    config.save({ imageApiKeyEncrypted: config.encryptApiKey(value) })
  } else {
    config.save({ [key]: value })
  }
  if (key === 'visionEnabled' && chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('vision-enabled-changed', value)
  }
  if (key === 'imageApiEndpoint' || key === 'imageApiKey' || key === 'imageModelName') {
    registerImageTool()
  }
  if (key === 'memoryEnabled') {
    registerMemoryTools()
  }
})

// --- Clipboard (for chat input context menu) ---
ipcMain.handle('read-clipboard', () => clipboard.readText())
ipcMain.handle('write-clipboard', (event, text) => { clipboard.writeText(text) })

// --- Image viewer ---
ipcMain.handle('save-image', async (event, dataUrl) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const { filePath } = await dialog.showSaveDialog(win, {
    defaultPath: `image-${Date.now()}.png`,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'webp'] }],
  })
  if (!filePath) return
  const base64 = dataUrl.startsWith('data:') ? dataUrl.split(',')[1] : dataUrl
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
})

ipcMain.handle('copy-image', (event, dataUrl) => {
  const base64 = dataUrl.startsWith('data:') ? dataUrl.split(',')[1] : dataUrl
  const buffer = Buffer.from(base64, 'base64')
  const img = nativeImage.createFromBuffer(buffer)
  clipboard.writeImage(img)
})

// --- App lifecycle ---
app.whenReady().then(() => {
  // Register sprite:// protocol for character system
  // Chromium parses standard scheme URLs like HTTP, so sprite:///idle_sheet.png
  // becomes hostname="idle_sheet.png" pathname="/". Extract from raw URL instead.
  protocol.handle('sprite', (request) => {
    const fileName = request.url.replace(/^sprite:\/\/\/?/, '').replace(/\?.*$/, '').replace(/\/+$/, '')
    const filePath = characterManager.resolveSheetPath(activeCharacterId, fileName, getCurrentOverrides())
    try {
      const buf = fs.readFileSync(filePath)
      return new Response(buf, { headers: { 'Content-Type': 'image/png' } })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  // Load saved storage path (must be before character loading)
  const cfg = config.load()
  if (cfg.characterStoragePath) {
    characterManager.setStoragePath(cfg.characterStoragePath)
  }

  // Load saved character
  if (cfg.activeCharacterId) {
    const meta = characterManager.getMeta(cfg.activeCharacterId)
    if (meta) {
      activeCharacterId = cfg.activeCharacterId
      activeCharacterMeta = meta
    }
  }
  if (cfg.stateOverrides) {
    // Backward compatibility: migrate flat { stateName: path } to nested { "": { stateName: path } }
    const keys = Object.keys(cfg.stateOverrides)
    if (keys.length > 0 && typeof cfg.stateOverrides[keys[0]] === 'string') {
      // Old flat format — wrap under "" (built-in C1)
      stateOverrides = { '': cfg.stateOverrides }
      config.save({ stateOverrides })
    } else {
      stateOverrides = cfg.stateOverrides
    }
  }

  // Restore chat history from disk (Tier 2)
  const restored = loadRecentChatHistory()
  if (restored.length > 0) {
    chatHistory = restored
    chatMessageIdCounter = Math.max(chatMessageIdCounter, ...restored.map(m => m.id || 0))
  }

  createWindow()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
