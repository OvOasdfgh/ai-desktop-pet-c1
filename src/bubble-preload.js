const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bubbleAPI', {
  onShowBubble: (cb) => ipcRenderer.on('show-bubble', (event, data) => cb(data)),
  onHideBubble: (cb) => ipcRenderer.on('hide-bubble', () => cb()),
  bubbleClicked: () => ipcRenderer.send('bubble-clicked'),
  bubbleFaded: () => ipcRenderer.send('bubble-faded'),
  bubbleResize: (w, h) => ipcRenderer.send('bubble-resize', w, h),
  setIgnoreMouse: (ignore) => ipcRenderer.send('bubble-ignore-mouse', ignore),

  // Color scheme
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),
})
