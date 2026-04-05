const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  uploadScreenshot: (imageBuffer) => ipcRenderer.invoke('upload-screenshot', imageBuffer),
  testConnection: () => ipcRenderer.invoke('test-connection'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text)
});
