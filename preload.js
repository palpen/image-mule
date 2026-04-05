const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  uploadScreenshot: (imageBuffer, thumbnail) => ipcRenderer.invoke('upload-screenshot', imageBuffer, thumbnail),
  testConnection: () => ipcRenderer.invoke('test-connection'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  clearHistory: (olderThanMs) => ipcRenderer.invoke('clear-history', olderThanMs),
  // Server management
  getServers: () => ipcRenderer.invoke('get-servers'),
  getActiveServer: () => ipcRenderer.invoke('get-active-server'),
  setActiveServer: (id) => ipcRenderer.invoke('set-active-server', id),
  addServer: (server) => ipcRenderer.invoke('add-server', server),
  updateServer: (id, config) => ipcRenderer.invoke('update-server', id, config),
  deleteServer: (id) => ipcRenderer.invoke('delete-server', id),
  // Quick transmit settings
  getSkipQuickConfirm: () => ipcRenderer.invoke('get-skip-quick-confirm'),
  setSkipQuickConfirm: (val) => ipcRenderer.invoke('set-skip-quick-confirm', val)
});
