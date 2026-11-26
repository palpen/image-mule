const crypto = require('node:crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');

const mockSftp = {
  connect: jest.fn(), put: jest.fn(), exists: jest.fn(), end: jest.fn(),
  sftp: { mkdir: jest.fn() }
};
jest.mock('ssh2-sftp-client', () => jest.fn(() => mockSftp));
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => 'private key'),
  statSync: jest.fn(() => ({ isFile: () => true, size: 1024 }))
}));
const { uploadFile, testConnection } = require('../lib/sftp');
const key = Buffer.from('host-key-test-fixture');
const profile = {
  host: 'server', username: 'user', privateKeyPath: '~/.ssh/id_rsa', remotePath: '/folder',
  hostFingerprint: 'SHA256:' + crypto.createHash('sha256').update(key).digest('base64url').replaceAll('-', '+').replaceAll('_', '/')
};
const buffer = Buffer.from('sample');
beforeEach(() => {
  jest.clearAllMocks();
  mockSftp.connect.mockImplementation(async conn => {
    if (!conn.hostVerifier(key)) throw new Error('host denied');
  });
  mockSftp.exists.mockResolvedValue('d');
  mockSftp.put.mockResolvedValue(undefined);
});

test.each([[undefined, 'HOST_KEY_UNKNOWN'], ['other', 'HOST_KEY_CHANGED']])('refuses unapproved key %s before upload', async (hostFingerprint, code) => {
  await expect(uploadFile({ ...profile, hostFingerprint }, buffer, '/folder/a.png'))
    .rejects.toMatchObject({ code, fingerprint: profile.hostFingerprint });
  expect(mockSftp.put).not.toHaveBeenCalled();
  expect(mockSftp.end).toHaveBeenCalled();
});

test('uploads bytes exclusively with owner access, leaving existing directory permissions alone', async () => {
  await uploadFile(profile, buffer, '/folder/a.png');
  expect(mockSftp.connect).toHaveBeenCalledWith({
    host: 'server', port: 22, username: 'user', retries: 0, hostVerifier: expect.any(Function), privateKey: 'private key'
  });
  expect(fs.readFileSync).toHaveBeenCalledWith(path.join(os.homedir(), '.ssh/id_rsa'), 'utf8');
  expect(mockSftp.put).toHaveBeenCalledWith(buffer, '/folder/a.png', { writeStreamOptions: { flags: 'wx', mode: 0o600 } });
  expect(mockSftp.sftp.mkdir).not.toHaveBeenCalled();
  expect(mockSftp.end).toHaveBeenCalled();
});

test('creates missing directories with owner-only mode', async () => {
  mockSftp.exists.mockResolvedValueOnce(false);
  mockSftp.sftp.mkdir.mockImplementation((_dir, _attrs, cb) => cb());
  await uploadFile(profile, buffer, '/folder/a.png');
  expect(mockSftp.sftp.mkdir).toHaveBeenCalledWith('/folder', { mode: 0o700 }, expect.any(Function));
});

test('ends connection on upload error', async () => {
  mockSftp.put.mockRejectedValueOnce(new Error('upload failed'));
  await expect(uploadFile(profile, buffer, '/folder/a.png')).rejects.toThrow('upload failed');
  expect(mockSftp.end).toHaveBeenCalled();
});

test('agent authentication never reads a key file', async () => {
  const original = process.env.SSH_AUTH_SOCK;
  process.env.SSH_AUTH_SOCK = '/agent';
  try {
    await testConnection({ ...profile, useAgent: true });
    expect(mockSftp.connect).toHaveBeenCalledWith(expect.objectContaining({ agent: '/agent' }));
    expect(fs.readFileSync).not.toHaveBeenCalled();
  } finally {
    if (original === undefined) delete process.env.SSH_AUTH_SOCK;
    else process.env.SSH_AUTH_SOCK = original;
  }
});

test('rejects ambiguous relative private key paths', async () => {
  await expect(testConnection({ ...profile, privateKeyPath: '~another/key' })).rejects.toThrow('absolute');
  expect(fs.readFileSync).not.toHaveBeenCalled();
});

test.each([
  ['a device or directory', { isFile: () => false, size: 0 }],
  ['an oversized file', { isFile: () => true, size: 64 * 1024 + 1 }]
])('refuses to read %s as a private key', async (_kind, stats) => {
  fs.statSync.mockReturnValueOnce(stats);
  await expect(testConnection(profile)).rejects.toThrow('regular SSH key file');
  expect(fs.readFileSync).not.toHaveBeenCalled();
});

test.each([[false, 'does not exist'], ['-', 'not a directory']])('explains unavailable remote directory %s', async (type, message) => {
  mockSftp.exists.mockResolvedValue(type);
  await expect(testConnection(profile)).rejects.toThrow(message);
  expect(mockSftp.end).toHaveBeenCalled();
});
