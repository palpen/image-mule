const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, nativeImage, Notification, dialog, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { uploadFile, testConnection } = require('./lib/sftp');
const config = require('./lib/config');
const { withSettingsLock } = require('./lib/settings-lock');
const { profileFields, publicProfile, validatePng, validShortcut, clipboardPath } = require('./lib/validation');

let mainWindow;
let confirmWindow;
let registeredShortcut;

function pagePath(name) {
  return path.join(__dirname, 'renderer', name);
}

function fromWindow(event, win, page) {
  const frame = event.senderFrame;
  return win && !win.isDestroyed() && event.sender === win.webContents &&
    frame && frame === win.webContents.mainFrame && frame.url === pathToFileURL(pagePath(page)).href;
}

function requireProfile(id) {
  if (typeof id !== 'string' || id.length > 100 || !config.getServers().some(server => server.id === id)) {
    throw new Error('Unknown server profile.');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520, height: 520, minWidth: 420, minHeight: 460,
    titleBarStyle: 'hiddenInset', backgroundColor: '#111110',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile(pagePath('index.html'));
}

async function withTrustedHost(profile, operation) {
  profileFields(profile);
  if (!profile.id || !profile.host || !profile.username || !profile.remotePath) {
    throw new Error('Please configure your server settings first.');
  }
  try {
    return await operation(profile);
  } catch (error) {
    if (error.code !== 'HOST_KEY_UNKNOWN' || profile.hostFingerprint) throw error;
    const { response } = await dialog.showMessageBox({
      type: 'warning', buttons: ['Cancel', 'Trust this host'], defaultId: 0, cancelId: 0,
      message: `Trust the SSH host key for ${profile.host}:${profile.port || 22}?`,
      detail: `Compare this SHA-256 fingerprint with one supplied by your server administrator.\n\n${error.fingerprint}`
    });
    if (response !== 1) throw new Error('SSH host approval cancelled.');
    await withSettingsLock(() => config.approveHost(profile, error.fingerprint));
    return operation({ ...profile, hostFingerprint: error.fingerprint });
  }
}

async function performUpload(profile, buffer, image) {
  try {
    validatePng(buffer);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `image_${timestamp}_${randomUUID()}.png`;
    const remotePath = path.posix.join(profile.remotePath, filename);
    const text = clipboardPath(remotePath);
    await withTrustedHost(profile, trusted => uploadFile(trusted, buffer, remotePath));
    clipboard.writeText(text);
    const size = image.getSize();
    const thumbnail = image.resize(size.width >= size.height ? { width: 100 } : { height: 100 }).toDataURL();
    await withSettingsLock(() => config.addHistoryEntry({ filename, remotePath, host: profile.host, timestamp: new Date().toISOString(), thumbnail }));
    return { success: true, remotePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function notify(body) {
  new Notification({ title: 'Image Mule', body }).show();
}

function profileLabel(profile) {
  return profile.name || profile.host || 'Untitled';
}

function destinationLine(profile) {
  return profile.host ? `To ${profileLabel(profile)} · ${profile.host}` : 'No server configured';
}

function displayedDestination(profileId) {
  const profile = config.getConfig();
  if ((profile.id ?? null) !== profileId) throw new Error('Server changed. Check the destination and transmit again.');
  return profile;
}

function handleQuickTransmit() {
  if (confirmWindow && !confirmWindow.isDestroyed()) return confirmWindow.focus();
  try {
    const image = clipboard.readImage();
    if (image.isEmpty()) return notify('No image in clipboard.');
    const buffer = validatePng(image.toPNG());
    const profile = config.getConfig();
    const send = () => performUpload(profile, buffer, image).then(result =>
      notify(result.success ? `Transmitted to ${profileLabel(profile)}. Path copied.` : result.error));
    if (config.getSkipQuickConfirm()) return send();

    const win = new BrowserWindow({
      width: 400, height: 380, resizable: false, alwaysOnTop: true, frame: false, backgroundColor: '#111110',
      webPreferences: { preload: path.join(__dirname, 'preload-confirm.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    confirmWindow = win;
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('show-image', `data:image/png;base64,${buffer.toString('base64')}`, destinationLine(profile));
    });
    async function confirm(event, response) {
      if (!fromWindow(event, win, 'confirm.html') || typeof response?.confirmed !== 'boolean' ||
          (response.confirmed && typeof response.skipFuture !== 'boolean')) return;
      ipcMain.removeListener('confirm-upload', confirm);
      win.close();
      if (response.confirmed) {
        if (response.skipFuture) {
          try { await withSettingsLock(() => config.setSkipQuickConfirm(true)); }
          catch (error) { return notify(error.message); }
        }
        send();
      }
    }
    ipcMain.on('confirm-upload', confirm);
    win.on('closed', () => {
      ipcMain.removeListener('confirm-upload', confirm);
      confirmWindow = null;
    });
    win.loadFile(pagePath('confirm.html'));
  } catch (error) {
    notify(error.message);
  }
}

function registerShortcut(value) {
  if (!validShortcut(value)) throw new Error('Choose a shortcut with a modifier and a letter, number or function key.');
  if (registeredShortcut === value) return;
  if (!globalShortcut.register(value, handleQuickTransmit)) throw new Error('That shortcut is unavailable.');
  if (registeredShortcut) globalShortcut.unregister(registeredShortcut);
  registeredShortcut = value;
}

function restoreRegisteredShortcut(refused) {
  return withSettingsLock(() => {
    if (config.getGlobalShortcut() === refused) config.setGlobalShortcut(registeredShortcut);
  });
}

function applySavedShortcut(saved) {
  try {
    registerShortcut(saved);
  } catch (error) {
    if (!registeredShortcut) return notify(error.message);
    notify(`${error.message} The previous shortcut stays active.`);
    restoreRegisteredShortcut(saved).catch(restoreError => notify(restoreError.message));
  }
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', event => event.preventDefault());
  contents.on('will-frame-navigate', event => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  createWindow();
  let previousShortcut;
  const stopWatching = config.watchSettings(settings => {
    if (settings.globalShortcut !== previousShortcut) {
      previousShortcut = settings.globalShortcut;
      applySavedShortcut(previousShortcut);
    }
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('settings-changed', settings);
  });
  app.once('will-quit', stopWatching);
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (app.isReady() && BrowserWindow.getAllWindows().length === 0) createWindow(); });

function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!fromWindow(event, mainWindow, 'index.html')) throw new Error('Unexpected IPC sender.');
    return handler(...args);
  });
}

function handleWrite(channel, handler) {
  handle(channel, (...args) => withSettingsLock(() => handler(...args)));
}

handle('upload-screenshot', async (bytes, profileId) => {
  try {
    const profile = displayedDestination(profileId);
    const image = nativeImage.createFromBuffer(validatePng(bytes));
    if (image.isEmpty()) throw new Error('Cannot decode that image.');
    return performUpload(profile, image.toPNG(), image);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

handle('test-connection', async () => {
  try {
    await withTrustedHost(config.getConfig(), testConnection);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

handle('get-history', config.getHistory);
handle('copy-history-path', remotePath => {
  if (!config.getHistory().some(entry => entry.remotePath === remotePath)) throw new Error('Unknown history entry.');
  clipboard.writeText(clipboardPath(remotePath));
});
handle('get-servers', () => config.getServers().map(publicProfile));
handle('get-settings', config.getSettings);
handle('get-active-server', () => publicProfile(config.getActiveServer()));
handleWrite('set-active-server', id => { requireProfile(id); config.setActiveServer(id); });
handleWrite('add-server', () => publicProfile(config.addServer({ name: 'New Server' })));
handleWrite('update-server', (id, fields) => { requireProfile(id); config.updateServer(id, fields); });
handleWrite('delete-server', id => { requireProfile(id); config.deleteServer(id); });
handle('choose-key', async id => {
  requireProfile(id);
  const choice = await dialog.showOpenDialog(mainWindow, { title: 'Choose SSH private key', properties: ['openFile', 'showHiddenFiles'] });
  if (!choice.canceled) await withSettingsLock(() => config.setKeyFile(id, choice.filePaths[0]));
});
handleWrite('clear-history', age => {
  if (![null, 3600000, 86400000, 2592000000].includes(age)) throw new Error('Unknown history range.');
  config.clearHistory(age);
});
handle('get-global-shortcut', config.getGlobalShortcut);
handleWrite('set-global-shortcut', value => {
  registerShortcut(value);
  config.setGlobalShortcut(value);
});
handle('open-releases', () => shell.openExternal('https://github.com/palpen/image-mule/releases/latest'));
