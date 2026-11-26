const path = require('node:path');
const { pathToFileURL } = require('node:url');

const mockHandlers = {};
const mockPage = pathToFileURL(path.join(__dirname, '..', 'renderer', 'index.html')).href;
const mockFrame = { url: mockPage };
const mockContents = { mainFrame: mockFrame, send: jest.fn() };
const mockWin = { webContents: mockContents, isDestroyed: () => false, loadFile: jest.fn() };
const mockRegister = jest.fn(() => true);
const mockUnregister = jest.fn();
let mockSettingsListener;
const mockConfig = {
  watchSettings: listener => {
    mockSettingsListener = listener;
    listener({ globalShortcut: 'Control+P' });
    return jest.fn();
  },
  getGlobalShortcut: jest.fn(() => 'Control+P'),
  setGlobalShortcut: jest.fn(),
  getConfig: () => ({ id: 'profile', host: 'example' }),
  getServers: () => [{ id: 'profile', host: 'example', password: 'legacy' }]
};
jest.mock('electron', () => ({
  app: { on: jest.fn(), once: jest.fn(), whenReady: () => Promise.resolve() },
  BrowserWindow: jest.fn(() => mockWin),
  Notification: jest.fn(() => ({ show: jest.fn() })),
  nativeImage: { createFromBuffer: jest.fn() },
  ipcMain: { handle: (name, fn) => { mockHandlers[name] = fn; } },
  globalShortcut: { register: mockRegister, unregister: mockUnregister },
  session: { defaultSession: { setPermissionRequestHandler: jest.fn(), setPermissionCheckHandler: jest.fn() } }
}));
jest.mock('../lib/config', () => mockConfig);
jest.mock('../lib/settings-lock', () => ({ withSettingsLock: async operation => operation() }));
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

test('a refused shortcut keeps the previous registration and setting', async () => {
  const change = mockHandlers['set-global-shortcut'];
  await expect(change(trustedEvent, 'invalid')).rejects.toThrow();
  mockRegister.mockReturnValueOnce(false);
  await expect(change(trustedEvent, 'Alt+Q')).rejects.toThrow('unavailable');
  expect(mockUnregister).not.toHaveBeenCalled();
  expect(mockConfig.setGlobalShortcut).not.toHaveBeenCalled();
  await change(trustedEvent, 'Alt+Q');
  expect(mockUnregister).toHaveBeenCalledWith('Control+P');
  expect(mockConfig.setGlobalShortcut).toHaveBeenCalledWith('Alt+Q');
});

test('a shortcut saved outside the app that cannot register is replaced by the active one', async () => {
  await mockHandlers['set-global-shortcut'](trustedEvent, 'Alt+Q');
  mockConfig.setGlobalShortcut.mockClear();
  mockUnregister.mockClear();
  mockRegister.mockReturnValueOnce(false);
  mockConfig.getGlobalShortcut.mockReturnValueOnce('Alt+Z');
  mockSettingsListener({ globalShortcut: 'Alt+Z' });
  await new Promise(setImmediate);
  expect(mockUnregister).not.toHaveBeenCalled();
  expect(mockConfig.setGlobalShortcut).toHaveBeenCalledWith('Alt+Q');
});

test('an upload is refused when the active profile is not the one the window displayed', async () => {
  const upload = mockHandlers['upload-screenshot'];
  const bytes = new Uint8Array(40);
  expect(await upload(trustedEvent, bytes, 'other')).toEqual({ success: false, error: expect.stringContaining('Server changed') });
  expect(await upload(trustedEvent, bytes, null)).toEqual({ success: false, error: expect.stringContaining('Server changed') });
  expect(await upload(trustedEvent, bytes, 'profile')).toEqual({ success: false, error: 'Invalid PNG header.' });
});
