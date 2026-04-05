const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('confirmApi', {
  onShowImage: (callback) => ipcRenderer.on('show-image', (event, dataUrl) => callback(dataUrl)),
  confirmUpload: (skipFuture) => ipcRenderer.send('confirm-upload', { confirmed: true, skipFuture }),
  cancelUpload: () => ipcRenderer.send('confirm-upload', { confirmed: false })
});
