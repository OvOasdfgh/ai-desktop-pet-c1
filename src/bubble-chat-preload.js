const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bubbleChatAPI', {
  // Init
  onInit: (cb) => ipcRenderer.on('bci-init', (_, data) => cb(data)),
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),
  onThemeChanged: (cb) => ipcRenderer.on('set-theme', (_, t) => cb(t)),
  onLanguageChanged: (cb) => ipcRenderer.on('set-language', (_, d) => cb(d)),

  // Input
  sendMessage: (text) => ipcRenderer.send('bubble-chat-send', text),
  inputResize: (w, h) => ipcRenderer.send('bci-resize', w, h),
  stopStreaming: () => ipcRenderer.send('stop-streaming'),
  onStreamingChanged: (cb) => ipcRenderer.on('bci-streaming-changed', (_, v) => cb(v)),
  onScaleChanged: (cb) => ipcRenderer.on('bci-scale-changed', (_, s) => cb(s)),
})
