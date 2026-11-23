const path = require('node:path');
const { pathToFileURL } = require('node:url');

const mockHandlers = {};
const mockPage = pathToFileURL(path.join(__dirname, '..', 'renderer', 'index.html')).href;
const mockFrame = { url: mockPage };
const mockContents = { mainFrame: mockFrame };
const mockWin = { webContents: mockContents, isDestroyed: () => false, loadFile: jest.fn() };
const mockRegister = jest.fn(() => true);
const mockUnregister = jest.fn();
const mockConfig = {
  migrateIfNeeded: jest.fn(),
  getGlobalShortcut: () => 'Control+P',
  setGlobalShortcut: jest.fn(),
  getServers: () => [{ id: 'profile', host: 'example', password: 'legacy' }]
};
jest.mock('electron', () => ({
  app: { on: jest.fn(), whenReady: () => Promise.resolve() },
  BrowserWindow: jest.fn(() => mockWin),
  ipcMain: { handle: (name, fn) => { mockHandlers[name] = fn; } },
  globalShortcut: { register: mockRegister, unregister: mockUnregister },
  session: { defaultSession: { setPermissionRequestHandler: jest.fn(), setPermissionCheckHandler: jest.fn() } }
}));
jest.mock('../lib/config', () => mockConfig);
beforeAll(async () => {
  require('../main');
  await Promise.resolve();
});
const trustedEvent = { sender: mockContents, senderFrame: mockFrame };

test('every main-window channel rejects other windows and child frames', () => {
  for (const handler of Object.values(mockHandlers)) {
    expect(() => handler({ sender: {}, senderFrame: mockFrame })).toThrow('sender');
    expect(() => handler({ sender: mockContents, senderFrame: { url: mockPage } })).toThrow('sender');
  }
  expect(mockHandlers['get-servers'](trustedEvent)[0]).not.toHaveProperty('password');
});

test('a refused shortcut keeps the previous registration and setting', () => {
  const change = mockHandlers['set-global-shortcut'];
  expect(() => change(trustedEvent, 'invalid')).toThrow();
  mockRegister.mockReturnValueOnce(false);
  expect(() => change(trustedEvent, 'Alt+Q')).toThrow('unavailable');
  expect(mockUnregister).not.toHaveBeenCalled();
  expect(mockConfig.setGlobalShortcut).not.toHaveBeenCalled();
  change(trustedEvent, 'Alt+Q');
  expect(mockUnregister).toHaveBeenCalledWith('Control+P');
  expect(mockConfig.setGlobalShortcut).toHaveBeenCalledWith('Alt+Q');
});
