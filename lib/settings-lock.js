const { app } = require('electron');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const lockfile = require('proper-lockfile');

// electron-store atomically replaces its file. The lock also protects the read
// that precedes each update, including desktop writes to upload history.
async function withSettingsLock(operation) {
  const dir = app.getPath('userData');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const release = await lockfile.lock(dir, {
    lockfilePath: path.join(dir, 'settings.lock'),
    retries: { retries: 70, factor: 1.4, minTimeout: 10, maxTimeout: 200, randomize: true }
  });
  try {
    return await operation();
  } finally {
    await release();
  }
}

module.exports = { withSettingsLock };
