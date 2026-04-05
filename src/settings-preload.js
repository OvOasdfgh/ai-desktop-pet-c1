const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('settingsAPI', {
  closeSettings: () => ipcRenderer.send('close-settings'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSetting: (key, value) => ipcRenderer.send('save-settings', key, value),
  onInitSettings: (cb) => ipcRenderer.on('init-settings', (_, data) => cb(data)),
  onThemeChanged: (cb) => ipcRenderer.on('set-theme', (_, theme) => cb(theme)),
  onLanguageChanged: (cb) => ipcRenderer.on('set-language', (_, lang) => cb(lang)),

  // Color scheme
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),
})
