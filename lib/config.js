const Store = require('electron-store');
const crypto = require('crypto');

const store = new Store({
  defaults: {
    servers: [],
    activeServerId: null,
    history: []
  }
});

// --- Migration from flat config ---
function migrateIfNeeded() {
  // If old flat config keys exist, migrate to servers array
  if (store.has('host') && !store.has('_migrated')) {
    const id = crypto.randomUUID();
    const server = {
      id,
      name: 'Default',
      host: store.get('host', ''),
      port: store.get('port', 22),
      username: store.get('username', ''),
      privateKeyPath: store.get('privateKeyPath', '~/.ssh/id_rsa'),
      password: store.get('password', ''),
      remotePath: store.get('remotePath', '/home/user/screenshots')
    };

    // Only migrate if there's actually a configured server
    if (server.host) {
      store.set('servers', [server]);
      store.set('activeServerId', id);
    }

    // Clean up old keys
    store.delete('host');
    store.delete('port');
    store.delete('username');
    store.delete('privateKeyPath');
    store.delete('password');
    store.delete('remotePath');
    store.set('_migrated', true);
  }
}

migrateIfNeeded();

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
  const entry = { id, name: server.name || 'Untitled', ...server, id };
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
  servers[idx] = { ...servers[idx], ...config, id };
  store.set('servers', servers);
  return servers[idx];
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
    privateKeyPath: '~/.ssh/id_rsa', password: '',
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
  history.unshift(entry);
  store.set('history', history.slice(0, 100));
}

function getHistory() {
  return store.get('history') || [];
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

module.exports = {
  getConfig, setConfig,
  getServers, getActiveServer, getActiveServerId, setActiveServer,
  addServer, updateServer, deleteServer,
  addHistoryEntry, getHistory, clearHistory
};
