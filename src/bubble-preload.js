const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bubbleAPI', {
  onShowBubble: (cb) => ipcRenderer.on('show-bubble', (event, data) => cb(data)),
  bubbleClicked: () => ipcRenderer.send('bubble-clicked'),
  bubbleFaded: () => ipcRenderer.send('bubble-faded'),
  bubbleResize: (w, h) => ipcRenderer.send('bubble-resize', w, h),
  setIgnoreMouse: (ignore) => ipcRenderer.send('bubble-ignore-mouse', ignore),

  // Color scheme & theme
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),
  onThemeChanged: (cb) => ipcRenderer.on('set-theme', (_, theme) => cb(theme)),

  // Bubble chat mode
  onSetMode: (cb) => ipcRenderer.on('bubble-set-mode', (_, mode) => cb(mode)),
  onStreamStart: (cb) => ipcRenderer.on('bubble-stream-start', (_, msgId) => cb(msgId)),
  onStreamChunk: (cb) => ipcRenderer.on('bubble-stream-chunk', (_, text) => cb(text)),
  onStreamEnd: (cb) => ipcRenderer.on('bubble-stream-end', () => cb()),
  onStreamError: (cb) => ipcRenderer.on('bubble-stream-error', (_, err) => cb(err)),
  onHasImages: (cb) => ipcRenderer.on('bubble-has-images', () => cb()),
  renderMarkdown: (text) => ipcRenderer.sendSync('render-markdown', text),
  openExternalUrl: (url) => ipcRenderer.send('open-external-url', url),

  // Bubble context menu
  showBubbleMenu: (x, y, text) => ipcRenderer.send('show-bubble-menu', x, y, text),
  onBubblePinChanged: (cb) => ipcRenderer.on('bubble-pin-changed', (_, v) => cb(v)),
})
