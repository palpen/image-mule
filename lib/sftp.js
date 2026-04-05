const SftpClient = require('ssh2-sftp-client');
const fs = require('fs');
const path = require('path');
const os = require('os');

function getPrivateKey(keyPath) {
  const resolved = keyPath.replace(/^~/, os.homedir());
  return fs.readFileSync(resolved, 'utf8');
}

function buildConnectionConfig(config) {
  const conn = {
    host: config.host,
    port: config.port || 22,
    username: config.username
  };

  if (config.privateKeyPath) {
    conn.privateKey = getPrivateKey(config.privateKeyPath);
  } else if (config.password) {
    conn.password = config.password;
  }

  return conn;
}

async function uploadFile(config, localPath, remotePath) {
  const sftp = new SftpClient();
  const conn = buildConnectionConfig(config);

  try {
    await sftp.connect(conn);

    // Ensure remote directory exists
    const remoteDir = path.posix.dirname(remotePath);
    await sftp.mkdir(remoteDir, true);

    await sftp.put(localPath, remotePath);
  } finally {
    await sftp.end();
  }
}

async function testConnection(config) {
  const sftp = new SftpClient();
  const conn = buildConnectionConfig(config);

  try {
    await sftp.connect(conn);
    // Verify remote directory exists or can be created
    const remotePath = config.remotePath.replace(/\/$/, '');
    await sftp.mkdir(remotePath, true);
    const exists = await sftp.exists(remotePath);
    if (!exists) {
      throw new Error(`Remote path ${remotePath} does not exist and could not be created.`);
    }
  } finally {
    await sftp.end();
  }
}

module.exports = { uploadFile, testConnection };
