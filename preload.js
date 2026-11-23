const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  uploadScreenshot: bytes => ipcRenderer.invoke('upload-screenshot', bytes),
  testConnection: () => ipcRenderer.invoke('test-connection'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  copyHistoryPath: path => ipcRenderer.invoke('copy-history-path', path),
  clearHistory: age => ipcRenderer.invoke('clear-history', age),
  getServers: () => ipcRenderer.invoke('get-servers'),
  getActiveServer: () => ipcRenderer.invoke('get-active-server'),
  setActiveServer: id => ipcRenderer.invoke('set-active-server', id),
  addServer: () => ipcRenderer.invoke('add-server'),
  updateServer: (id, config) => ipcRenderer.invoke('update-server', id, config),
  chooseKey: id => ipcRenderer.invoke('choose-key', id),
  deleteServer: id => ipcRenderer.invoke('delete-server', id),
  getGlobalShortcut: () => ipcRenderer.invoke('get-global-shortcut'),
  setGlobalShortcut: shortcut => ipcRenderer.invoke('set-global-shortcut', shortcut),
  openReleases: () => ipcRenderer.invoke('open-releases')
});
