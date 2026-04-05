// Mock electron-store before requiring config
const mockData = {};
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: (key, defaultVal) => key in mockData ? mockData[key] : defaultVal,
    set: (key, val) => { mockData[key] = val; },
    has: (key) => key in mockData,
    delete: (key) => { delete mockData[key]; }
  }));
});

let config;

beforeEach(() => {
  // Clear mock data
  Object.keys(mockData).forEach(k => delete mockData[k]);
  // Set defaults
  mockData.servers = [];
  mockData.activeServerId = null;
  mockData.history = [];
  mockData.skipQuickConfirm = false;
  mockData.globalShortcut = 'CommandOrControl+Option+Control+P';
  // Re-require to get fresh module
  jest.resetModules();
  config = require('../lib/config');
});

describe('Server CRUD', () => {
  test('getServers returns empty array by default', () => {
    expect(config.getServers()).toEqual([]);
  });

  test('addServer creates server with generated id', () => {
    const server = config.addServer({ name: 'Test', host: 'example.com', port: 22, username: 'user' });
    expect(server.id).toBeDefined();
    expect(server.name).toBe('Test');
    expect(server.host).toBe('example.com');
    expect(config.getServers()).toHaveLength(1);
  });

  test('addServer sets it as active', () => {
    const server = config.addServer({ name: 'Test', host: 'example.com' });
    expect(config.getActiveServerId()).toBe(server.id);
  });

  test('addServer defaults name to Untitled', () => {
    const server = config.addServer({ host: 'example.com' });
    expect(server.name).toBe('Untitled');
  });

  test('getActiveServer returns active server', () => {
    const s1 = config.addServer({ name: 'S1', host: 'a.com' });
    config.addServer({ name: 'S2', host: 'b.com' });
    config.setActiveServer(s1.id);
    expect(config.getActiveServer().name).toBe('S1');
  });

  test('getActiveServer falls back to first server', () => {
    config.addServer({ name: 'S1', host: 'a.com' });
    mockData.activeServerId = 'nonexistent';
    expect(config.getActiveServer().name).toBe('S1');
  });

  test('getActiveServer returns null when no servers', () => {
    expect(config.getActiveServer()).toBeNull();
  });

  test('updateServer modifies existing server', () => {
    const server = config.addServer({ name: 'Old', host: 'old.com' });
    const updated = config.updateServer(server.id, { name: 'New', host: 'new.com' });
    expect(updated.name).toBe('New');
    expect(updated.host).toBe('new.com');
    expect(updated.id).toBe(server.id);
  });

  test('updateServer returns null for unknown id', () => {
    expect(config.updateServer('fake-id', { name: 'X' })).toBeNull();
  });

  test('deleteServer removes server', () => {
    const s1 = config.addServer({ name: 'S1', host: 'a.com' });
    config.addServer({ name: 'S2', host: 'b.com' });
    config.deleteServer(s1.id);
    expect(config.getServers()).toHaveLength(1);
    expect(config.getServers()[0].name).toBe('S2');
  });

  test('deleteServer switches active to first remaining', () => {
    const s1 = config.addServer({ name: 'S1', host: 'a.com' });
    const s2 = config.addServer({ name: 'S2', host: 'b.com' });
    config.setActiveServer(s2.id);
    config.deleteServer(s2.id);
    expect(config.getActiveServerId()).toBe(s1.id);
  });

  test('deleteServer sets active to null when last server deleted', () => {
    const s1 = config.addServer({ name: 'S1', host: 'a.com' });
    config.deleteServer(s1.id);
    expect(config.getActiveServerId()).toBeNull();
  });
});

describe('getConfig / setConfig (legacy compat)', () => {
  test('getConfig returns active server', () => {
    config.addServer({ name: 'Test', host: 'example.com', username: 'user', remotePath: '/tmp' });
    const c = config.getConfig();
    expect(c.host).toBe('example.com');
  });

  test('getConfig returns defaults when no servers', () => {
    const c = config.getConfig();
    expect(c.host).toBe('');
    expect(c.port).toBe(22);
  });

  test('setConfig updates active server', () => {
    config.addServer({ name: 'Test', host: 'old.com' });
    config.setConfig({ host: 'new.com' });
    expect(config.getActiveServer().host).toBe('new.com');
  });
});

describe('History', () => {
  test('addHistoryEntry prepends entry', () => {
    config.addHistoryEntry({ filename: 'a.png', timestamp: new Date().toISOString() });
    config.addHistoryEntry({ filename: 'b.png', timestamp: new Date().toISOString() });
    const history = config.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].filename).toBe('b.png');
  });

  test('addHistoryEntry caps at 100', () => {
    for (let i = 0; i < 110; i++) {
      config.addHistoryEntry({ filename: `${i}.png`, timestamp: new Date().toISOString() });
    }
    expect(config.getHistory()).toHaveLength(100);
  });

  test('clearHistory with null clears all', () => {
    config.addHistoryEntry({ filename: 'a.png', timestamp: new Date().toISOString() });
    config.addHistoryEntry({ filename: 'b.png', timestamp: new Date().toISOString() });
    config.clearHistory(null);
    expect(config.getHistory()).toHaveLength(0);
  });

  test('clearHistory filters by time range', () => {
    const now = Date.now();
    config.addHistoryEntry({ filename: 'recent.png', timestamp: new Date(now).toISOString() });
    config.addHistoryEntry({ filename: 'old.png', timestamp: new Date(now - 7200000).toISOString() });
    config.clearHistory(3600000); // last hour
    const history = config.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].filename).toBe('recent.png');
  });
});

describe('Settings', () => {
  test('skipQuickConfirm defaults to false', () => {
    expect(config.getSkipQuickConfirm()).toBe(false);
  });

  test('setSkipQuickConfirm persists', () => {
    config.setSkipQuickConfirm(true);
    expect(config.getSkipQuickConfirm()).toBe(true);
  });

  test('setSkipQuickConfirm coerces to boolean', () => {
    config.setSkipQuickConfirm(1);
    expect(config.getSkipQuickConfirm()).toBe(true);
    config.setSkipQuickConfirm(0);
    expect(config.getSkipQuickConfirm()).toBe(false);
  });

  test('globalShortcut defaults to Cmd+Option+Ctrl+P', () => {
    expect(config.getGlobalShortcut()).toBe('CommandOrControl+Option+Control+P');
  });

  test('setGlobalShortcut persists', () => {
    config.setGlobalShortcut('CommandOrControl+Shift+X');
    expect(config.getGlobalShortcut()).toBe('CommandOrControl+Shift+X');
  });
});

describe('Migration', () => {
  test('migrates flat config to servers array', () => {
    // Set up old flat config before requiring module
    Object.keys(mockData).forEach(k => delete mockData[k]);
    mockData.host = 'legacy.com';
    mockData.port = 22;
    mockData.username = 'legacyuser';
    mockData.privateKeyPath = '~/.ssh/id_rsa';
    mockData.password = '';
    mockData.remotePath = '/home/legacy';
    mockData.history = [];
    mockData.servers = [];
    mockData.activeServerId = null;

    jest.resetModules();
    const freshConfig = require('../lib/config');

    const servers = freshConfig.getServers();
    expect(servers).toHaveLength(1);
    expect(servers[0].host).toBe('legacy.com');
    expect(servers[0].name).toBe('Default');
    expect(freshConfig.getActiveServer().host).toBe('legacy.com');
    // Old keys should be cleaned up
    expect(mockData.host).toBeUndefined();
    expect(mockData._migrated).toBe(true);
  });

  test('skips migration if host is empty', () => {
    Object.keys(mockData).forEach(k => delete mockData[k]);
    mockData.host = '';
    mockData.servers = [];
    mockData.activeServerId = null;
    mockData.history = [];

    jest.resetModules();
    const freshConfig = require('../lib/config');

    expect(freshConfig.getServers()).toHaveLength(0);
  });
});
