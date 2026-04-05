const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { uploadFile } = require('./lib/sftp');
const { getConfig, setConfig } = require('./lib/config');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 680,
    minWidth: 420,
    minHeight: 580,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

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

ipcMain.handle('upload-screenshot', async (event, imageBuffer) => {
  const config = getConfig();

  if (!config.host || !config.username || !config.remotePath) {
    return { success: false, error: 'Please configure your server settings first.' };
  }

  // Write buffer to temp file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `screenshot_${timestamp}.png`;
  const tempPath = path.join(os.tmpdir(), filename);

  try {
    const buffer = Buffer.from(imageBuffer);
    fs.writeFileSync(tempPath, buffer);

    const remotePath = config.remotePath.replace(/\/$/, '');
    const remoteFilePath = `${remotePath}/${filename}`;

    await uploadFile(config, tempPath, remoteFilePath);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // Copy remote path to clipboard
    clipboard.writeText(remoteFilePath);

    return { success: true, remotePath: remoteFilePath };
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return { success: false, error: err.message };
  }
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
