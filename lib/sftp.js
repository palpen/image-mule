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
    const remotePath = config.remotePath.replace(/\/$/, '');
    const type = await sftp.exists(remotePath);
    if (!type) {
      // Try to list the parent to help debug
      const parent = path.posix.dirname(remotePath);
      let hint = '';
      try {
        const listing = await sftp.list(parent);
        const dirs = listing.filter(i => i.type === 'd').map(i => i.name);
        if (dirs.length > 0) {
          hint = ` Contents of ${parent}: ${dirs.join(', ')}`;
        }
      } catch (_) { /* parent may not exist either */ }
      throw new Error(`Remote path ${remotePath} does not exist.${hint}`);
    }
    if (type !== 'd') {
      throw new Error(`Remote path ${remotePath} is not a directory.`);
    }
  } finally {
    await sftp.end();
  }
}

module.exports = { uploadFile, testConnection };
