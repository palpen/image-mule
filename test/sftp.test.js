const path = require('path');
const os = require('os');

// Mock ssh2-sftp-client
const mockSftp = {
  connect: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  put: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue('d'),
  list: jest.fn().mockResolvedValue([]),
  end: jest.fn().mockResolvedValue(undefined)
};

jest.mock('ssh2-sftp-client', () => {
  return jest.fn().mockImplementation(() => mockSftp);
});

// Mock fs for private key reading
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock-private-key-content'),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false)
}));

const { uploadFile, testConnection } = require('../lib/sftp');

beforeEach(() => {
  jest.clearAllMocks();
  mockSftp.connect.mockResolvedValue(undefined);
  mockSftp.mkdir.mockResolvedValue(undefined);
  mockSftp.put.mockResolvedValue(undefined);
  mockSftp.exists.mockResolvedValue('d');
  mockSftp.end.mockResolvedValue(undefined);
});

describe('uploadFile', () => {
  const config = {
    host: 'example.com',
    port: 22,
    username: 'user',
    privateKeyPath: '~/.ssh/id_rsa',
    remotePath: '/remote/path'
  };

  test('connects with correct config', async () => {
    await uploadFile(config, '/tmp/test.png', '/remote/path/test.png');
    expect(mockSftp.connect).toHaveBeenCalledWith({
      host: 'example.com',
      port: 22,
      username: 'user',
      privateKey: 'mock-private-key-content'
    });
  });

  test('creates remote directory', async () => {
    await uploadFile(config, '/tmp/test.png', '/remote/path/test.png');
    expect(mockSftp.mkdir).toHaveBeenCalledWith('/remote/path', true);
  });

  test('uploads file to correct remote path', async () => {
    await uploadFile(config, '/tmp/test.png', '/remote/path/test.png');
    expect(mockSftp.put).toHaveBeenCalledWith('/tmp/test.png', '/remote/path/test.png');
  });

  test('closes connection after upload', async () => {
    await uploadFile(config, '/tmp/test.png', '/remote/path/test.png');
    expect(mockSftp.end).toHaveBeenCalled();
  });

  test('closes connection even on error', async () => {
    mockSftp.put.mockRejectedValue(new Error('upload failed'));
    await expect(uploadFile(config, '/tmp/test.png', '/remote/path/test.png'))
      .rejects.toThrow('upload failed');
    expect(mockSftp.end).toHaveBeenCalled();
  });

  test('uses password when no private key', async () => {
    const pwConfig = { host: 'example.com', port: 22, username: 'user', password: 'secret' };
    await uploadFile(pwConfig, '/tmp/test.png', '/remote/path/test.png');
    expect(mockSftp.connect).toHaveBeenCalledWith({
      host: 'example.com',
      port: 22,
      username: 'user',
      password: 'secret'
    });
  });

  test('defaults port to 22', async () => {
    const noPortConfig = { host: 'example.com', username: 'user', privateKeyPath: '~/.ssh/id_rsa' };
    await uploadFile(noPortConfig, '/tmp/test.png', '/remote/path/test.png');
    expect(mockSftp.connect).toHaveBeenCalledWith(
      expect.objectContaining({ port: 22 })
    );
  });

  test('expands ~ in private key path', async () => {
    const fs = require('fs');
    await uploadFile(config, '/tmp/test.png', '/remote/path/test.png');
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join(os.homedir(), '.ssh/id_rsa'),
      'utf8'
    );
  });
});

describe('testConnection', () => {
  const config = {
    host: 'example.com',
    port: 22,
    username: 'user',
    privateKeyPath: '~/.ssh/id_rsa',
    remotePath: '/remote/path'
  };

  test('succeeds when remote path is a directory', async () => {
    mockSftp.exists.mockResolvedValue('d');
    await expect(testConnection(config)).resolves.not.toThrow();
  });

  test('throws when remote path does not exist', async () => {
    mockSftp.exists.mockResolvedValue(false);
    mockSftp.list.mockResolvedValue([]);
    await expect(testConnection(config)).rejects.toThrow('does not exist');
  });

  test('throws when remote path is not a directory', async () => {
    mockSftp.exists.mockResolvedValue('-');
    await expect(testConnection(config)).rejects.toThrow('not a directory');
  });

  test('includes parent directory listing in error hint', async () => {
    mockSftp.exists.mockResolvedValue(false);
    mockSftp.list.mockResolvedValue([
      { name: 'Documents', type: 'd' },
      { name: 'Desktop', type: 'd' },
      { name: 'file.txt', type: '-' }
    ]);
    await expect(testConnection(config)).rejects.toThrow('Documents, Desktop');
  });

  test('closes connection after test', async () => {
    await testConnection(config);
    expect(mockSftp.end).toHaveBeenCalled();
  });

  test('closes connection even on error', async () => {
    mockSftp.exists.mockResolvedValue(false);
    mockSftp.list.mockResolvedValue([]);
    try { await testConnection(config); } catch (_) {}
    expect(mockSftp.end).toHaveBeenCalled();
  });
});
