const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_PIXELS = 32 * 1024 * 1024;
const MAX_THUMBNAIL_LENGTH = 128 * 1024;

function plainText(value, max) {
  return typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
}

const profileRules = {
  name: value => plainText(value, 100),
  host: value => plainText(value, 255) && /^[a-z\d.:[\]_-]*$/i.test(value),
  port: value => Number.isInteger(value) && value > 0 && value <= 65535,
  username: value => plainText(value, 128),
  remotePath: value => plainText(value, 1024),
  useAgent: value => typeof value === 'boolean'
};

function profileFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid server settings.');
  const fields = {};
  for (const [field, validate] of Object.entries(profileRules)) {
    if (!Object.hasOwn(input, field)) continue;
    if (!validate(input[field])) throw new Error(`Invalid server setting: ${field}.`);
    fields[field] = input[field];
  }
  return fields;
}

function publicProfile(server) {
  if (!server) return null;
  const result = {};
  for (const field of ['id', 'privateKeyPath', ...Object.keys(profileRules)]) result[field] = server[field];
  return result;
}

function validatePng(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 33 || bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('Choose a PNG image of up to 32 MiB.');
  }
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
      buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Invalid PNG header.');
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height || width * height > MAX_PIXELS || Math.max(width, height) > 16384) {
    throw new Error('Image dimensions exceed the supported limits.');
  }
  return buffer;
}

function validThumbnail(value) {
  return typeof value === 'string' && value.length <= MAX_THUMBNAIL_LENGTH &&
    /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function validShortcut(value) {
  return typeof value === 'string' && value.length < 80 &&
    /^(?:(?:CommandOrControl|Control|Option|Alt|Shift)\+){1,4}(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$/.test(value);
}

function clipboardPath(value) {
  if (!plainText(value, 1500) || !value) throw new Error('Invalid clipboard path.');
  // Preserve ordinary paths and quote special characters for a POSIX terminal.
  return /^[\w./-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\\''") + "'";
}

module.exports = { profileFields, publicProfile, validatePng, validThumbnail, validShortcut, clipboardPath };
