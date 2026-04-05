const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { uploadFile } = require('./lib/sftp');
const {
  getConfig, setConfig,
  getServers, getActiveServer, setActiveServer,
  addServer, updateServer, deleteServer,
  addHistoryEntry, getHistory, clearHistory,
  getSkipQuickConfirm, setSkipQuickConfirm,
  getGlobalShortcut, setGlobalShortcut
} = require('./lib/config');

let mainWindow;
let confirmWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 520,
    minWidth: 420,
    minHeight: 460,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#111110',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// --- Shared upload logic ---
async function performUpload(imageBuffer, thumbnail) {
  const config = getConfig();

  if (!config.host || !config.username || !config.remotePath) {
    return { success: false, error: 'Please configure your server settings first.' };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `screenshot_${timestamp}.png`;
  const tempPath = path.join(os.tmpdir(), filename);

  try {
    const buffer = Buffer.from(imageBuffer);
    fs.writeFileSync(tempPath, buffer);

    const remotePath = config.remotePath.replace(/\/$/, '');
    const remoteFilePath = `${remotePath}/${filename}`;

    await uploadFile(config, tempPath, remoteFilePath);

    fs.unlinkSync(tempPath);
    clipboard.writeText(remoteFilePath);

    addHistoryEntry({
      filename,
      remotePath: remoteFilePath,
      host: config.host,
      timestamp: new Date().toISOString(),
      thumbnail: thumbnail || null
    });

    return { success: true, remotePath: remoteFilePath };
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return { success: false, error: err.message };
  }
}

// --- Global shortcut: quick transmit from clipboard ---
function handleQuickTransmit() {
  const img = clipboard.readImage();
  if (img.isEmpty()) {
    new Notification({ title: 'Image Mule', body: 'No image in clipboard.' }).show();
    return;
  }

  const pngBuffer = img.toPNG();
  const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

  // Generate thumbnail using nativeImage resize
  const thumb = img.resize({ width: 100 });
  const thumbDataUrl = `data:image/png;base64,${thumb.toPNG().toString('base64')}`;

  if (getSkipQuickConfirm()) {
    // Upload directly without confirmation
    performUpload(Array.from(pngBuffer), thumbDataUrl).then(result => {
      if (result.success) {
        new Notification({ title: 'Image Mule', body: `Transmitted. Path copied.` }).show();
      } else {
        new Notification({ title: 'Image Mule', body: `Upload failed: ${result.error}` }).show();
      }
    });
    return;
  }

  // Show confirmation window
  if (confirmWindow && !confirmWindow.isDestroyed()) {
    confirmWindow.focus();
    return;
  }

  confirmWindow = new BrowserWindow({
    width: 400,
    height: 380,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#111110',
    webPreferences: {
      preload: path.join(__dirname, 'preload-confirm.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  confirmWindow.loadFile(path.join(__dirname, 'renderer', 'confirm.html'));

  confirmWindow.webContents.once('did-finish-load', () => {
    confirmWindow.webContents.send('show-image', dataUrl);
  });

  // One-time listener for this confirmation
  const handler = (event, response) => {
    if (!response.confirmed) {
      if (confirmWindow && !confirmWindow.isDestroyed()) confirmWindow.close();
      confirmWindow = null;
      return;
    }

    if (response.skipFuture) {
      setSkipQuickConfirm(true);
    }

    performUpload(Array.from(pngBuffer), thumbDataUrl).then(result => {
      if (confirmWindow && !confirmWindow.isDestroyed()) confirmWindow.close();
      confirmWindow = null;
      if (result.success) {
        new Notification({ title: 'Image Mule', body: `Transmitted. Path copied.` }).show();
      } else {
        new Notification({ title: 'Image Mule', body: `Upload failed: ${result.error}` }).show();
      }
    });
  };

  ipcMain.once('confirm-upload', handler);

  confirmWindow.on('closed', () => {
    ipcMain.removeListener('confirm-upload', handler);
    confirmWindow = null;
  });
}

function registerQuickTransmitShortcut() {
  globalShortcut.unregisterAll();
  const shortcut = getGlobalShortcut();
  try {
    globalShortcut.register(shortcut, handleQuickTransmit);
  } catch (err) {
    console.error(`Failed to register shortcut "${shortcut}":`, err.message);
  }
}

app.whenReady().then(() => {
  createWindow();
  registerQuickTransmitShortcut();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- IPC Handlers ---

ipcMain.handle('get-config', () => {
  return getConfig();
});

ipcMain.handle('save-config', (event, config) => {
  setConfig(config);
  return { success: true };
});

ipcMain.handle('upload-screenshot', async (event, imageBuffer, thumbnail) => {
  return performUpload(imageBuffer, thumbnail);
});

ipcMain.handle('get-history', () => {
  return getHistory();
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return { success: true };
});

// --- Server management ---
ipcMain.handle('get-servers', () => getServers());

ipcMain.handle('get-active-server', () => getActiveServer());

ipcMain.handle('set-active-server', (event, id) => {
  setActiveServer(id);
  return { success: true };
});

ipcMain.handle('add-server', (event, server) => {
  return addServer(server);
});

ipcMain.handle('update-server', (event, id, config) => {
  return updateServer(id, config);
});

ipcMain.handle('delete-server', (event, id) => {
  deleteServer(id);
  return { success: true };
});

ipcMain.handle('clear-history', (event, olderThanMs) => {
  clearHistory(olderThanMs);
  return { success: true };
});

ipcMain.handle('test-connection', async () => {
  const config = getConfig();
  try {
    const { testConnection } = require('./lib/sftp');
    await testConnection(config);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// --- Quick confirm setting ---
ipcMain.handle('get-skip-quick-confirm', () => getSkipQuickConfirm());

ipcMain.handle('set-skip-quick-confirm', (event, val) => {
  setSkipQuickConfirm(val);
  return { success: true };
});

// --- Global shortcut setting ---
ipcMain.handle('get-global-shortcut', () => getGlobalShortcut());

ipcMain.handle('set-global-shortcut', (event, shortcut) => {
  setGlobalShortcut(shortcut);
  registerQuickTransmitShortcut();
  return { success: true };
});
