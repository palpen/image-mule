const SftpClient = require('ssh2-sftp-client');
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('node:util');

function buildConnectionConfig(config, observed) {
  const conn = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    retries: 0,
    hostVerifier(key) {
      const digest = crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
      observed.fingerprint = `SHA256:${digest}`;
      return observed.fingerprint === config.hostFingerprint;
    }
  };
  if (config.useAgent) {
    conn.agent = process.env.SSH_AUTH_SOCK || (process.platform === 'win32' && '\\\\.\\pipe\\openssh-ssh-agent');
    if (!conn.agent) throw new Error('SSH agent unavailable. Start your agent or choose a key file.');
  } else {
    let file = config.privateKeyPath;
    if (!file) throw new Error('Choose an SSH key or enable the SSH agent.');
    if (file.startsWith('~/')) file = path.join(os.homedir(), file.slice(2));
    if (!path.isAbsolute(file)) throw new Error('Choose an absolute SSH key path.');
    conn.privateKey = fs.readFileSync(file, 'utf8');
  }
  return conn;
}

async function withConnection(config, operation) {
  const observed = {};
  const conn = buildConnectionConfig(config, observed);
  const sftp = new SftpClient();
  try {
    try {
      await sftp.connect(conn);
    } catch (error) {
      if (observed.fingerprint && observed.fingerprint !== config.hostFingerprint) {
        const changed = Boolean(config.hostFingerprint);
        const refused = new Error(changed
          ? `SSH host key changed for ${config.host}:${conn.port}. Connection refused. Verify the new fingerprint with the administrator before creating a new profile. Presented: ${observed.fingerprint}`
          : 'SSH host key has not been approved.');
        refused.code = changed ? 'HOST_KEY_CHANGED' : 'HOST_KEY_UNKNOWN';
        refused.fingerprint = observed.fingerprint;
        throw refused;
      }
      throw error;
    }
    return await operation(sftp);
  } finally {
    await sftp.end();
  }
}

async function ensureDirectory(sftp, directory) {
  const type = await sftp.exists(directory);
  if (type === 'd') return;
  if (type) throw new Error(`Remote path ${directory} is not a directory.`);
  const parent = path.posix.dirname(directory);
  if (parent === directory) throw new Error('Remote base directory is unavailable.');
  await ensureDirectory(sftp, parent);
  // The wrapper omits mkdir attributes. Specify the mode in the creation request.
  try {
    await promisify(sftp.sftp.mkdir).call(sftp.sftp, directory, { mode: 0o700 });
  } catch (error) {
    if (await sftp.exists(directory) !== 'd') throw error;
  }
}

async function uploadFile(config, buffer, remotePath) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError('Expected screenshot bytes.');
  return withConnection(config, async sftp => {
    await ensureDirectory(sftp, path.posix.dirname(remotePath));
    await sftp.put(buffer, remotePath, { writeStreamOptions: { flags: 'wx', mode: 0o600 } });
  });
}

async function testConnection(config) {
  return withConnection(config, async sftp => {
    const type = await sftp.exists(path.posix.normalize(config.remotePath));
    if (!type) throw new Error('Remote folder does not exist. Transmit will create it.');
    if (type !== 'd') throw new Error('Remote path is not a directory.');
  });
}

module.exports = { uploadFile, testConnection };
