const Store = require('electron-store');

const store = new Store({
  defaults: {
    host: '',
    port: 22,
    username: '',
    privateKeyPath: '~/.ssh/id_rsa',
    password: '',
    remotePath: '/home/user/screenshots',
    history: []
  }
});

function getConfig() {
  return {
    host: store.get('host'),
    port: store.get('port'),
    username: store.get('username'),
    privateKeyPath: store.get('privateKeyPath'),
    password: store.get('password'),
    remotePath: store.get('remotePath')
  };
}

function setConfig(config) {
  for (const [key, value] of Object.entries(config)) {
    store.set(key, value);
  }
}

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

module.exports = { getConfig, setConfig, addHistoryEntry, getHistory, clearHistory };
