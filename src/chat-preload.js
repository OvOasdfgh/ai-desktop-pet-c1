const { contextBridge, ipcRenderer } = require('electron')

// Copy button SVG icons (static strings, no npm deps)
const COPY_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="4.5" y="4.5" width="7" height="7" rx="1"/><path d="M2.5 9.5V2.5h7"/></svg>'
const CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,7 6,10 11,4"/></svg>'

contextBridge.exposeInMainWorld('chatAPI', {
  sendMessage: (text, images) => ipcRenderer.send('chat-send-message', text, images),
  closePanel: () => ipcRenderer.send('close-chat-panel'),
  getChatState: () => ipcRenderer.invoke('get-chat-state'),
  onNewMessage: (callback) => ipcRenderer.on('chat-new-message', (event, msg) => callback(msg)),
  onInitChat: (callback) => ipcRenderer.on('init-chat', (event, data) => callback(data)),
  onThemeChanged: (callback) => ipcRenderer.on('set-theme', (event, theme) => callback(theme)),
  onLanguageChanged: (callback) => ipcRenderer.on('set-language', (event, lang) => callback(lang)),
  minimizeWindow: () => ipcRenderer.send('chat-minimize'),
  maximizeWindow: () => ipcRenderer.send('chat-maximize'),
  onMaximizeChanged: (callback) => ipcRenderer.on('chat-maximize-changed', (event, isMaximized) => callback(isMaximized)),

  // AI streaming
  onStreamStart: (callback) => ipcRenderer.on('ai-stream-start', (event, msgId) => callback(msgId)),
  onStreamChunk: (callback) => ipcRenderer.on('ai-stream-chunk', (event, text) => callback(text)),
  onStreamThinking: (callback) => ipcRenderer.on('ai-stream-thinking', (event, text) => callback(text)),
  onStreamEnd: (callback) => ipcRenderer.on('ai-stream-end', () => callback()),
  onStreamError: (callback) => ipcRenderer.on('ai-stream-error', (event, errMsg) => callback(errMsg)),
  onContextUsage: (callback) => ipcRenderer.on('context-usage', (event, ratio) => callback(ratio)),
  stopStreaming: () => ipcRenderer.send('stop-streaming'),
  onStreamingChanged: (cb) => ipcRenderer.on('chat-streaming-changed', (_, v) => cb(v)),

  // Markdown rendering (synchronous IPC to main process where marked+hljs live)
  renderMarkdown: (text) => ipcRenderer.sendSync('render-markdown', text),
  copySvg: COPY_SVG,
  checkSvg: CHECK_SVG,

  // External links
  openExternalUrl: (url) => ipcRenderer.send('open-external-url', url),

  // Vision
  onVisionEnabledChanged: (callback) => ipcRenderer.on('vision-enabled-changed', (event, enabled) => callback(enabled)),
  pickImages: () => ipcRenderer.invoke('pick-images'),

  // Image proxy
  proxyImage: (url) => ipcRenderer.invoke('proxy-image', url),

  // AI images
  onStreamImages: (callback) => ipcRenderer.on('ai-stream-images', (event, images) => callback(images)),

  // Clipboard (for input context menu)
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text),

  // Image viewer
  saveImage: (dataUrl) => ipcRenderer.invoke('save-image', dataUrl),
  copyImage: (dataUrl) => ipcRenderer.invoke('copy-image', dataUrl),

  // Retry
  retryLast: () => ipcRenderer.send('chat-retry-last'),

  // Color scheme
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),
})
