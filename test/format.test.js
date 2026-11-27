const {
  formatShortcut,
  keyEventToAccelerator,
  formatTimestamp,
  shortenMiddle,
  shortenStart,
  pathForDisplay,
  displayName,
} = require('../renderer/format');

describe('pathForDisplay', () => {
  test('leaves short paths untouched', () => {
    const shown = pathForDisplay('/home/dev/mule/shot.png');
    expect(shown).toEqual({ directory: '/home/dev/mule/', filename: 'shot.png' });
  });

  test('middle-truncates long filenames while keeping total within limit', () => {
    const remotePath = '/home/deploy/screenshots/image_2026-11-26T14-38-12_12345678-1234-1234-1234-1234567890ab.png';
    const shown = pathForDisplay(remotePath);
    expect(shown.directory).toBe('/home/deploy/screenshots/');
    expect(shown.filename).toContain('…');
    expect(shown.filename.endsWith('567890ab.png'.slice(-10))).toBe(true);
    expect(shown.directory.length + shown.filename.length).toBeLessThanOrEqual(58);
  });

  test('start-truncates long directories while reserving room for the filename', () => {
    const remotePath = '/very/long/nested/directory/structure/on/remote/server/screenshots/image_2026-11-26T14-38-12_abcdef123456.png';
    const shown = pathForDisplay(remotePath);
    expect(shown.directory.startsWith('…')).toBe(true);
    expect(shown.filename.length).toBeGreaterThanOrEqual(28);
    expect(shown.directory.length + shown.filename.length).toBeLessThanOrEqual(58);
  });

  test('never exceeds a custom limit', () => {
    const remotePath = '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/very_long_filename_with_uuid_1234567890abcdef.png';
    const shown = pathForDisplay(remotePath, 40);
    expect(shown.directory.length + shown.filename.length).toBeLessThanOrEqual(40);
  });
});

describe('shortenMiddle and shortenStart', () => {
  test('returns short strings unchanged', () => {
    expect(shortenMiddle('short.png', 20)).toBe('short.png');
    expect(shortenStart('/short/', 20)).toBe('/short/');
  });
});

describe('formatShortcut', () => {
  test('formats macOS glyphs without plus separators', () => {
    expect(formatShortcut('CommandOrControl+Option+Control+P', true)).toBe('⌘⌥⌃P');
    expect(formatShortcut('CommandOrControl+Shift+X', true)).toBe('⌘⇧X');
  });

  test('formats non-macOS modifiers with plus separators', () => {
    expect(formatShortcut('CommandOrControl+Alt+Shift+P', false)).toBe('Ctrl+Alt+Shift+P');
    expect(formatShortcut('', false)).toBe('');
  });
});

describe('keyEventToAccelerator', () => {
  test('maps letter, digit and function keys with modifiers', () => {
    expect(keyEventToAccelerator({ metaKey: true, altKey: true, code: 'KeyP' })).toBe('CommandOrControl+Option+P');
    expect(keyEventToAccelerator({ ctrlKey: true, shiftKey: true, code: 'Digit5' })).toBe('Control+Shift+5');
    expect(keyEventToAccelerator({ ctrlKey: true, code: 'F12' })).toBe('Control+F12');
  });

  test('rejects modifier-only, unmodified, and unsupported keys', () => {
    expect(keyEventToAccelerator({ metaKey: true, code: 'MetaLeft' })).toBeNull();
    expect(keyEventToAccelerator({ code: 'KeyP' })).toBeNull();
    expect(keyEventToAccelerator({ metaKey: true, code: 'Space' })).toBeNull();
  });
});

describe('formatTimestamp', () => {
  test('shows only time for timestamps on the same day', () => {
    const now = new Date(2026, 10, 26, 16, 0, 0);
    const sameDay = new Date(2026, 10, 26, 14, 38, 0).toISOString();
    expect(formatTimestamp(sameDay, now)).toBe('14:38');
  });

  test('includes date and time for timestamps on another day', () => {
    const now = new Date(2026, 10, 26, 16, 0, 0);
    const earlier = new Date(2026, 10, 24, 9, 5, 0).toISOString();
    const formatted = formatTimestamp(earlier, now);
    expect(formatted).toContain('09:05');
    expect(formatted).toContain(',');
  });
});

describe('displayName', () => {
  test('prefers name, falls back to host, then Untitled', () => {
    expect(displayName({ name: 'Staging', host: 'gpu-01' })).toBe('Staging');
    expect(displayName({ name: '', host: 'gpu-01' })).toBe('gpu-01');
    expect(displayName({ name: '', host: '' })).toBe('Untitled');
    expect(displayName(null)).toBe('Untitled');
  });
});
