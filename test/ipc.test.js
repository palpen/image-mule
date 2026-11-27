const path = require('node:path');
const { pathToFileURL } = require('node:url');

const mockHandlers = {};
const mockPage = pathToFileURL(path.join(__dirname, '..', 'renderer', 'index.html')).href;
const mockFrame = { url: mockPage };
const mockContents = { mainFrame: mockFrame, send: jest.fn() };
const mockWin = { webContents: mockContents, isDestroyed: () => false, loadFile: jest.fn() };
const mockRegister = jest.fn(() => true);
const mockUnregister = jest.fn();
const mockUploadFile = jest.fn(async () => {});
const mockTestConnection = jest.fn(async () => {});
const mockClipboardWriteText = jest.fn();
const mockOpenExternal = jest.fn();
const mockSetApplicationMenu = jest.fn();
const mockBuildFromTemplate = jest.fn(template => template);
const mockCreateFromBuffer = jest.fn();
let mockSettingsListener;

const primaryServer = {
  id: 'profile',
  name: 'Staging GPU',
  host: 'example',
  username: 'deploy',
  remotePath: '/home/deploy/screenshots',
  port: 22,
  password: 'legacy'
};
const secondaryServer = {
  id: 'other-profile',
  name: 'Dev Box',
  host: 'dev.example',
  username: 'dev',
  remotePath: '/home/dev/mule',
  port: 22
};

const mockConfig = {
  watchSettings: listener => {
    mockSettingsListener = listener;
    listener({ globalShortcut: 'Control+P' });
    return jest.fn();
  },
  getGlobalShortcut: jest.fn(() => 'Control+P'),
  setGlobalShortcut: jest.fn(),
  getConfig: () => primaryServer,
  getServers: () => [primaryServer, secondaryServer],
  addHistoryEntry: jest.fn(),
  clearHistory: jest.fn()
};

jest.mock('electron', () => ({
  app: { name: 'Image Mule', on: jest.fn(), once: jest.fn(), whenReady: () => Promise.resolve() },
  BrowserWindow: jest.fn(() => mockWin),
  Notification: jest.fn(() => ({ show: jest.fn() })),
  nativeImage: { createFromBuffer: mockCreateFromBuffer },
  ipcMain: { handle: (name, fn) => { mockHandlers[name] = fn; } },
  globalShortcut: { register: mockRegister, unregister: mockUnregister },
  clipboard: { writeText: mockClipboardWriteText },
  shell: { openExternal: mockOpenExternal },
  Menu: { buildFromTemplate: mockBuildFromTemplate, setApplicationMenu: mockSetApplicationMenu },
  session: { defaultSession: { setPermissionRequestHandler: jest.fn(), setPermissionCheckHandler: jest.fn() } }
}));
jest.mock('../lib/config', () => mockConfig);
jest.mock('../lib/sftp', () => ({ uploadFile: mockUploadFile, testConnection: mockTestConnection }));
jest.mock('../lib/settings-lock', () => ({ withSettingsLock: async operation => operation() }));

beforeAll(async () => {
  require('../main');
  await Promise.resolve();
});

const trustedEvent = { sender: mockContents, senderFrame: mockFrame };

function validPngBytes() {
  const buffer = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(200, 16);
  buffer.writeUInt32BE(100, 20);
  return new Uint8Array(buffer);
}

test('every main-window channel rejects other windows and child frames', () => {
  expect(mockHandlers['open-releases']).toBeUndefined();
  for (const handler of Object.values(mockHandlers)) {
    expect(() => handler({ sender: {}, senderFrame: mockFrame })).toThrow('sender');
    expect(() => handler({ sender: mockContents, senderFrame: { url: mockPage } })).toThrow('sender');
  }
  expect(mockHandlers['get-servers'](trustedEvent)[0]).not.toHaveProperty('password');
});

test('application menu includes Check for Updates', () => {
  expect(mockSetApplicationMenu).toHaveBeenCalledTimes(1);
  const template = mockBuildFromTemplate.mock.calls[0][0];
  const items = template.flatMap(entry => entry.submenu || []);
  const updates = items.find(item => item.label === 'Check for Updates…');
  expect(updates).toBeDefined();
  updates.click();
  expect(mockOpenExternal).toHaveBeenCalledWith('https://github.com/palpen/image-mule/releases/latest');
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

test('test-connection validates and tests the requested profile by id', async () => {
  mockTestConnection.mockClear();
  expect(await mockHandlers['test-connection'](trustedEvent, 'missing')).toEqual({
    success: false,
    error: 'Unknown server profile.'
  });
  expect(await mockHandlers['test-connection'](trustedEvent, 'other-profile')).toEqual({ success: true });
  expect(mockTestConnection).toHaveBeenCalledWith(secondaryServer);
});

test('a successful upload stores serverName and notifies history-changed', async () => {
  const bytes = validPngBytes();
  const pngBuffer = Buffer.from(bytes);
  mockContents.send.mockClear();
  mockConfig.addHistoryEntry.mockClear();
  mockCreateFromBuffer.mockReturnValueOnce({
    isEmpty: () => false,
    toPNG: () => pngBuffer,
    getSize: () => ({ width: 200, height: 100 }),
    resize: () => ({ toDataURL: () => 'data:image/png;base64,YWJj' })
  });

  const result = await mockHandlers['upload-screenshot'](trustedEvent, bytes, 'profile');
  expect(result.success).toBe(true);
  expect(mockConfig.addHistoryEntry).toHaveBeenCalledWith(expect.objectContaining({
    host: 'example',
    serverName: 'Staging GPU',
    remotePath: result.remotePath
  }));
  expect(mockContents.send).toHaveBeenCalledWith('history-changed');
});

test('clear-history notifies history-changed', async () => {
  mockContents.send.mockClear();
  mockConfig.clearHistory.mockClear();
  await mockHandlers['clear-history'](trustedEvent, null);
  expect(mockConfig.clearHistory).toHaveBeenCalledWith(null);
  expect(mockContents.send).toHaveBeenCalledWith('history-changed');
});
