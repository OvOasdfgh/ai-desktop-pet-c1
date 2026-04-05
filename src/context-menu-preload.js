const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('menuAPI', {
  onInit: (callback) => ipcRenderer.on('init-context-menu', (event, data) => callback(data)),
  resize: (w, h) => ipcRenderer.send('context-menu-resize', w, h),
  action: (id) => ipcRenderer.send('context-menu-action', id),
  close: () => ipcRenderer.send('context-menu-close'),

  // Color scheme
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),
})
