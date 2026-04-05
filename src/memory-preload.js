const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('memoryAPI', {
  closeMemory: () => ipcRenderer.send('close-memory'),
  onInitMemory: (cb) => ipcRenderer.on('init-memory', (_, data) => cb(data)),
  onThemeChanged: (cb) => ipcRenderer.on('set-theme', (_, theme) => cb(theme)),
  onLanguageChanged: (cb) => ipcRenderer.on('set-language', (_, lang) => cb(lang)),
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),

  deleteCoreMemory: (key) => ipcRenderer.invoke('delete-core-memory', key),
  editCoreMemory: (key, content) => ipcRenderer.invoke('edit-core-memory', key, content),
  deleteArchiveEntry: (index) => ipcRenderer.invoke('delete-archive-entry', index),
  deleteChatLog: (filename) => ipcRenderer.invoke('delete-chat-log', filename),
  clearAllMemory: () => ipcRenderer.invoke('clear-all-memory'),
  openMemoryFolder: () => ipcRenderer.send('open-memory-folder'),
  changeMemoryPath: () => ipcRenderer.invoke('change-memory-path'),
  onStoragePathChanged: (cb) => ipcRenderer.on('storage-path-changed', (_, d) => cb(d)),
})
