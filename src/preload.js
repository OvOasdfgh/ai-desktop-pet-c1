const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('petAPI', {
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', dx, dy),
  clampAndSave: () => ipcRenderer.send('clamp-and-save'),
  showContextMenu: (x, y) => ipcRenderer.send('show-context-menu', x, y),
  setDragging: (isDragging) => ipcRenderer.send('set-dragging', isDragging),
  getConfig: () => ipcRenderer.invoke('get-config'),
  moveWindowClamped: (dx, dy) => ipcRenderer.invoke('move-window-clamped', dx, dy),
  snapToGround: () => ipcRenderer.send('snap-to-ground'),
  onScaleChanged: (callback) => ipcRenderer.on('display-scale-changed', (event, scale) => callback(scale)),
  onSystemActivity: (callback) => ipcRenderer.on('system-activity', (event, data) => callback(data)),
  saveGreetingDate: (date) => ipcRenderer.send('save-greeting-date', date),
  onForegroundWindow: (callback) => ipcRenderer.on('foreground-window', (event, data) => callback(data)),
  getAppCategories: () => ipcRenderer.invoke('get-app-categories'),
  onAppCategoriesUpdated: (callback) => ipcRenderer.on('app-categories-updated', () => callback()),

  // Chat panel
  toggleChatPanel: () => ipcRenderer.send('toggle-chat-panel'),
  onChatPanelOpened: (callback) => ipcRenderer.on('chat-panel-opened', () => callback()),
  onChatPanelClosed: (callback) => ipcRenderer.on('chat-panel-closed', () => callback()),

  // AI animation
  onAiAnimationState: (callback) => ipcRenderer.on('ai-animation-state', (event, state) => callback(state)),

  // Theme
  onThemeChanged: (callback) => ipcRenderer.on('set-theme', (event, theme) => callback(theme)),

  // Proactive messages
  wantToTalk: () => ipcRenderer.send('pet-want-to-talk'),

  // Character bounds
  sendCharacterBounds: (bounds) => ipcRenderer.send('character-bounds', bounds),

  // Color scheme
  onColorScheme: (cb) => ipcRenderer.on('apply-color-scheme', (_, d) => cb(d)),

  // Character system
  onCharacterChanged: (cb) => ipcRenderer.on('character-changed', (_, d) => cb(d)),

  // State overrides
  onStateOverrideChanged: (cb) => ipcRenderer.on('state-override-changed', (_, d) => cb(d)),

  // Thrown lifecycle
  petThrown: () => ipcRenderer.send('pet-thrown'),
  thrownLanded: () => ipcRenderer.send('thrown-landed'),

})
