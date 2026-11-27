const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  uploadScreenshot: (bytes, profileId) => ipcRenderer.invoke('upload-screenshot', bytes, profileId),
  testConnection: id => ipcRenderer.invoke('test-connection', id),
  getHistory: () => ipcRenderer.invoke('get-history'),
  copyHistoryPath: path => ipcRenderer.invoke('copy-history-path', path),
  clearHistory: age => ipcRenderer.invoke('clear-history', age),
  getServers: () => ipcRenderer.invoke('get-servers'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getActiveServer: () => ipcRenderer.invoke('get-active-server'),
  setActiveServer: id => ipcRenderer.invoke('set-active-server', id),
  addServer: () => ipcRenderer.invoke('add-server'),
  copySetupPrompt: () => ipcRenderer.invoke('copy-setup-prompt'),
  updateServer: (id, config) => ipcRenderer.invoke('update-server', id, config),
  chooseKey: id => ipcRenderer.invoke('choose-key', id),
  deleteServer: id => ipcRenderer.invoke('delete-server', id),
  getGlobalShortcut: () => ipcRenderer.invoke('get-global-shortcut'),
  setGlobalShortcut: shortcut => ipcRenderer.invoke('set-global-shortcut', shortcut),
  onSettingsChanged: listener => ipcRenderer.on('settings-changed', (_event, settings) => listener(settings)),
  onHistoryChanged: listener => ipcRenderer.on('history-changed', () => listener())
});
