const Store = require('electron-store');

const store = new Store({
  defaults: {
    host: '',
    port: 22,
    username: '',
    privateKeyPath: '~/.ssh/id_rsa',
    password: '',
    remotePath: '/home/user/screenshots'
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

module.exports = { getConfig, setConfig };
