const { profileFields, publicProfile, validKeyPath, validatePng, validShortcut, clipboardPath } = require('../lib/validation');

test('key paths must be local and either absolute or under the home directory', () => {
  expect(validKeyPath('~/.ssh/id_ed25519', 'linux')).toBe(true);
  expect(validKeyPath('/home/ada/key', 'linux')).toBe(true);
  expect(validKeyPath('C:\\Users\\ada\\key', 'win32')).toBe(true);
  for (const value of ['relative/key', '~other/key', '/one\ntwo', '', 42, undefined]) {
    expect(validKeyPath(value, 'linux')).toBe(false);
  }
  for (const value of ['\\\\server\\share\\key', '//server/share/key', '\\\\.\\pipe\\agent', '\\\\?\\C:\\key', 'C:key']) {
    expect(validKeyPath(value, 'win32')).toBe(false);
  }
});

test('rejects invalid profiles and limits the view returned to windows', () => {
  expect(() => profileFields({ port: 65536 })).toThrow();
  expect(() => profileFields({ remotePath: 'a\nb' })).toThrow();
  expect(profileFields({ unknown: true, password: 'legacy' })).toEqual({});
  expect(publicProfile({ host: 'server', password: 'legacy' })).not.toHaveProperty('password');
});

test('rejects oversized PNG dimensions and incorrectly typed input', () => {
  const header = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(header);
  header.writeUInt32BE(16000, 16);
  header.writeUInt32BE(16000, 20);
  expect(() => validatePng(header)).toThrow('dimensions');
  expect(() => validatePng(Array.from(header))).toThrow();
});

test('allows recorder shortcuts and rejects incomplete accelerators', () => {
  expect(validShortcut('CommandOrControl+Option+Control+P')).toBe(true);
  expect(validShortcut('Alt+F25')).toBe(false);
  expect(validShortcut('P')).toBe(false);
});

test('clipboard text preserves ordinary paths and shell-quotes literal special characters', () => {
  expect(clipboardPath('/remote/a.png')).toBe('/remote/a.png');
  expect(clipboardPath("/home/Pat's folder/a.png")).toBe("'/home/Pat'\\''s folder/a.png'");
  expect(() => clipboardPath('/one\ntwo')).toThrow();
});
