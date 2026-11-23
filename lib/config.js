const Store = require('electron-store');
const crypto = require('crypto');
const fs = require('fs');
const { safeStorage } = require('electron');
const { profileFields, validThumbnail } = require('./validation');

const store = new Store({
  configFileMode: 0o600,
  defaults: {
    servers: [],
    activeServerId: null,
    history: [],
    skipQuickConfirm: false,
    globalShortcut: 'CommandOrControl+Option+Control+P'
  }
});

// Run once Electron is ready, so the OS credential store can be consulted.
function canSeal() {
  return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' ||
    ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(safeStorage.getSelectedStorageBackend()));
}

function storedHistoryEntry(entry) {
  const { thumbnail, ...stored } = entry;
  if (validThumbnail(thumbnail)) {
    try {
      if (canSeal()) stored.sealedThumbnail = safeStorage.encryptString(thumbnail).toString('base64');
    } catch {
      // A locked or inaccessible keychain still permits metadata-only history.
    }
  }
  return stored;
}

function migrateIfNeeded() {
  if (process.platform !== 'win32' && fs.existsSync(store.path)) fs.chmodSync(store.path, 0o600);
  const data = store.store;
  if (data._securityMigration === 1) return;
  if (data.host && !data._migrated && !data.servers?.length) {
    const id = crypto.randomUUID();
    data.servers = [{
      id, name: 'Default', host: data.host, username: data.username || '',
      port: data.port || 22, privateKeyPath: data.privateKeyPath ?? '~/.ssh/id_rsa',
      remotePath: data.remotePath || '/home/user/screenshots'
    }];
    data.activeServerId = id;
  }
  for (const key of ['host', 'port', 'username', 'privateKeyPath', 'password', 'remotePath']) delete data[key];
  for (const server of data.servers || []) {
    delete server.password;
    // Earlier versions allowed arbitrary profile fields and never approved host pins.
    delete server.hostFingerprint;
    delete server.useAgent;
  }
  data.history = (data.history || []).map(storedHistoryEntry);
  data._migrated = true;
  data._securityMigration = 1;
  store.store = data;
}

// --- Server CRUD ---
function getServers() {
  return store.get('servers') || [];
}

function getActiveServerId() {
  return store.get('activeServerId');
}

function getActiveServer() {
  const servers = getServers();
  const activeId = getActiveServerId();
  return servers.find(s => s.id === activeId) || servers[0] || null;
}

function setActiveServer(id) {
  store.set('activeServerId', id);
}

function addServer(server) {
  const id = crypto.randomUUID();
  const entry = { host: '', port: 22, username: '', privateKeyPath: '~/.ssh/id_rsa',
    remotePath: '/home/user/screenshots', ...profileFields(server), name: server.name || 'Untitled', id };
  const servers = getServers();
  servers.push(entry);
  store.set('servers', servers);
  store.set('activeServerId', id);
  return entry;
}

function updateServer(id, config) {
  const servers = getServers();
  const idx = servers.findIndex(s => s.id === id);
  if (idx === -1) return null;
  const fields = profileFields(config);
  const previous = servers[idx];
  servers[idx] = { ...previous, ...fields };
  if (servers[idx].host !== previous.host || servers[idx].port !== previous.port) {
    delete servers[idx].hostFingerprint;
  }
  store.set('servers', servers);
  return servers[idx];
}

// Only privileged UI decisions can write a key path or host pin.
function setKeyFile(id, file) {
  const servers = getServers();
  const server = servers.find(item => item.id === id);
  if (!server) throw new Error('Server profile no longer exists.');
  server.privateKeyPath = file;
  server.useAgent = false;
  store.set('servers', servers);
}

function approveHost(profile, fingerprint) {
  const servers = getServers();
  const server = servers.find(item => item.id === profile.id);
  if (!server || server.host !== profile.host || server.port !== profile.port ||
      (server.hostFingerprint && server.hostFingerprint !== fingerprint)) {
    throw new Error('Server settings changed during approval. Try again.');
  }
  server.hostFingerprint = fingerprint;
  store.set('servers', servers);
}

function deleteServer(id) {
  let servers = getServers();
  servers = servers.filter(s => s.id !== id);
  store.set('servers', servers);
  // If we deleted the active server, switch to first remaining
  if (getActiveServerId() === id) {
    store.set('activeServerId', servers.length > 0 ? servers[0].id : null);
  }
}

// --- Legacy compat (used by upload-screenshot) ---
function getConfig() {
  return getActiveServer() || {
    host: '', port: 22, username: '',
    privateKeyPath: '~/.ssh/id_rsa',
    remotePath: '/home/user/screenshots'
  };
}

function setConfig(config) {
  const active = getActiveServer();
  if (active) {
    updateServer(active.id, config);
  }
}

// --- History ---
function addHistoryEntry(entry) {
  const history = store.get('history') || [];
  history.unshift(storedHistoryEntry(entry));
  store.set('history', history.slice(0, 100));
}

function getHistory() {
  return (store.get('history') || []).map(({ sealedThumbnail, filename, remotePath, host, timestamp }) => {
    let thumbnail = null;
    if (sealedThumbnail && canSeal()) {
      try {
        const value = safeStorage.decryptString(Buffer.from(sealedThumbnail, 'base64'));
        if (validThumbnail(value)) thumbnail = value;
      } catch { /* Metadata is still available after an OS key change. */ }
    }
    return { filename, remotePath, host, timestamp, thumbnail };
  });
}

function clearHistory(olderThanMs) {
  if (olderThanMs === null) {
    store.set('history', []);
    return;
  }
  const cutoff = Date.now() - olderThanMs;
  const history = store.get('history') || [];
  store.set('history', history.filter(e => new Date(e.timestamp).getTime() > cutoff));
}

function getSkipQuickConfirm() {
  return store.get('skipQuickConfirm', false);
}

function setSkipQuickConfirm(val) {
  store.set('skipQuickConfirm', !!val);
}

function getGlobalShortcut() {
  return store.get('globalShortcut', 'CommandOrControl+Option+Control+P');
}

function setGlobalShortcut(shortcut) {
  store.set('globalShortcut', shortcut);
}

module.exports = {
  migrateIfNeeded, setKeyFile, approveHost, getConfig, setConfig,
  getServers, getActiveServer, getActiveServerId, setActiveServer,
  addServer, updateServer, deleteServer,
  addHistoryEntry, getHistory, clearHistory,
  getSkipQuickConfirm, setSkipQuickConfirm,
  getGlobalShortcut, setGlobalShortcut
};
