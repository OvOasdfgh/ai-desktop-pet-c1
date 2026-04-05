const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('customizeAPI', {
  closeCustomize: () => ipcRenderer.send('close-customize'),
  onInitCustomize: (cb) => ipcRenderer.on('init-customize', (_, data) => cb(data)),
  onThemeChanged: (cb) => ipcRenderer.on('set-theme', (_, theme) => cb(theme)),
  onLanguageChanged: (cb) => ipcRenderer.on('set-language', (_, lang) => cb(lang)),

  // Color scheme
  saveColorScheme: (scheme) => ipcRenderer.send('save-color-scheme', scheme),
  saveOpacity: (val) => ipcRenderer.send('save-panel-opacity', val),
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),

  // Animation states
  getStatesData: () => ipcRenderer.invoke('get-states-data'),
  getStateOverrides: () => ipcRenderer.invoke('get-state-overrides'),
  replaceState: (stateName) => ipcRenderer.invoke('replace-state-sheet', stateName),
  resetState: (stateName) => ipcRenderer.send('reset-state-sheet', stateName),
  onStateOverrideChanged: (cb) => ipcRenderer.on('state-override-changed', (_, d) => cb(d)),

  // Storage + Reset
  resetAllSettings: () => ipcRenderer.invoke('reset-all-customize'),
  changeStoragePath: () => ipcRenderer.invoke('change-storage-path'),
  onStoragePathChanged: (cb) => ipcRenderer.on('storage-path-changed', (_, d) => cb(d)),

  // Character system
  getCharacterList: () => ipcRenderer.invoke('get-character-list'),
  importCharacter: () => ipcRenderer.invoke('import-character'),
  switchCharacter: (id) => ipcRenderer.invoke('switch-character', id),
  deleteCharacter: (id) => ipcRenderer.invoke('delete-character', id),
  exportCharacter: (id) => ipcRenderer.invoke('export-character', id),
})
