const PATH_DISPLAY_LIMIT = 58;
const FILENAME_DISPLAY_MINIMUM = 28;

function isMacPlatform() {
  return typeof navigator === 'object' && typeof navigator.platform === 'string' && navigator.platform.includes('Mac');
}

function formatShortcut(accelerator, isMac = isMacPlatform()) {
  if (!accelerator) return '';
  const formatted = accelerator
    .replace(/CommandOrControl/g, isMac ? '⌘' : 'Ctrl')
    .replace(/Control/g, isMac ? '⌃' : 'Ctrl')
    .replace(/Option/g, isMac ? '⌥' : 'Alt')
    .replace(/Alt/g, isMac ? '⌥' : 'Alt')
    .replace(/Shift/g, isMac ? '⇧' : 'Shift');
  return isMac ? formatted.replace(/\+/g, '') : formatted;
}

function keyEventToAccelerator(event) {
  const parts = [];
  if (event.metaKey) parts.push('CommandOrControl');
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Option');
  if (event.shiftKey) parts.push('Shift');

  const code = event.code || '';
  let key = null;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit\d$/.test(code)) key = code.slice(5);
  else if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;

  if (!key) return null;
  parts.push(key);
  if (parts.length < 2) return null;
  return parts.join('+');
}

function formatTimestamp(timestamp, now = new Date()) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

function shortenMiddle(text, limit) {
  if (text.length <= limit) return text;
  if (limit <= 1) return text.slice(0, Math.max(0, limit));
  const tailLength = Math.min(10, Math.floor((limit - 1) / 2));
  return `${text.slice(0, limit - tailLength - 1)}…${text.slice(-tailLength)}`;
}

function shortenStart(text, limit) {
  if (text.length <= limit) return text;
  if (limit <= 1) return limit === 1 ? '…' : '';
  return `…${text.slice(1 - limit)}`;
}

function pathForDisplay(remotePath, limit = PATH_DISPLAY_LIMIT) {
  const filenameStart = remotePath.lastIndexOf('/') + 1;
  const directory = remotePath.slice(0, filenameStart);
  const filename = remotePath.slice(filenameStart);
  const reservedForFilename = Math.min(filename.length, Math.min(FILENAME_DISPLAY_MINIMUM, limit));
  const shownDirectory = shortenStart(directory, limit - reservedForFilename);
  return {
    directory: shownDirectory,
    filename: shortenMiddle(filename, limit - shownDirectory.length),
  };
}

function displayName(server) {
  return server?.name || server?.host || 'Untitled';
}

if (typeof module === 'object') {
  module.exports = {
    formatShortcut,
    keyEventToAccelerator,
    formatTimestamp,
    shortenMiddle,
    shortenStart,
    pathForDisplay,
    displayName,
  };
}
