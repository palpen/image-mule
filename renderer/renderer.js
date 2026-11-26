const dropZone = document.getElementById('drop-zone');
const placeholder = document.getElementById('placeholder');
const preview = document.getElementById('preview');
const clearBtn = document.getElementById('clear-btn');
const sendBtn = document.getElementById('send-btn');
const testBtn = document.getElementById('test-btn');
const status = document.getElementById('status');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');
const serverSelect = document.getElementById('server-select');
const addServerBtn = document.getElementById('add-server-btn');
const deleteServerBtn = document.getElementById('delete-server-btn');

const fields = ['host', 'username', 'port', 'remotePath'];
const editableFields = ['server-name', 'useAgent', ...fields];
let renderedServerId = null;
let pendingSave = Promise.resolve();
let currentImageBuffer = null;
let imageRevision = 0;

// --- Tabs ---
const tabs = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.page');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    pages.forEach(p => p.hidden = true);
    document.getElementById(`page-${target}`).hidden = false;

    if (target === 'history') {
      loadHistory();
    }
  });
});

// --- Collapsible settings ---
settingsToggle.addEventListener('click', () => {
  const isOpen = !settingsPanel.hidden;
  settingsPanel.hidden = isOpen;
  settingsToggle.classList.toggle('open', !isOpen);
});

// --- Server selector ---
async function loadServers() {
  renderSettings(await window.api.getSettings());
}

function renderSettings({ servers, activeServerId, globalShortcut }) {
  const active = servers.find(server => server.id === activeServerId);
  const sameServer = active && renderedServerId === active.id;
  renderedServerId = active?.id ?? null;
  if (!isRecording) shortcutDisplay.textContent = formatShortcut(globalShortcut);
  serverSelect.replaceChildren();
  deleteServerBtn.hidden = servers.length === 0;
  if (servers.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No servers configured';
    serverSelect.appendChild(opt);
  }

  servers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name || s.host || 'Untitled';
    opt.selected = s.id === activeServerId;
    serverSelect.appendChild(opt);
  });

  document.getElementById('privateKeyPath').value = active?.privateKeyPath || '';
  document.getElementById('useAgent').checked = Boolean(active?.useAgent);
  for (const field of ['server-name', ...fields]) {
    const el = document.getElementById(field);
    if (sameServer && el === document.activeElement && el.value !== el.defaultValue) continue;
    const value = active?.[field === 'server-name' ? 'name' : field] ?? '';
    el.value = value;
    el.defaultValue = value;
  }
}

serverSelect.addEventListener('change', async () => {
  const id = serverSelect.value;
  if (id) {
    await window.api.setActiveServer(id);
    await loadServers();
  }
});

// --- Add server ---
addServerBtn.addEventListener('click', async () => {
  await window.api.addServer();
  await loadServers();
  // Open settings so user can configure
  settingsPanel.hidden = false;
  settingsToggle.classList.add('open');
  document.getElementById('server-name').focus();
});

// --- Delete server ---
deleteServerBtn.addEventListener('click', async () => {
  const id = serverSelect.value;
  if (!id) return;
  const name = serverSelect.options[serverSelect.selectedIndex]?.textContent || 'this server';
  if (!confirm(`Delete "${name}"?`)) return;
  await window.api.deleteServer(id);
  await loadServers();
});

// --- Save config on input change ---
function finishEditing() {
  if (editableFields.includes(document.activeElement?.id)) document.activeElement.blur();
  return pendingSave;
}

for (const field of editableFields) {
  const el = document.getElementById(field);
  el.addEventListener('change', () => {
    const id = renderedServerId;
    if (!id) return;
    const key = field === 'server-name' ? 'name' : field;
    let value = el.value;
    if (field === 'port') value = Number(value || 22);
    if (field === 'useAgent') value = el.checked;
    pendingSave = pendingSave.catch(() => {}).then(() => window.api.updateServer(id, { [key]: value }));
    pendingSave.catch(showError);
  });
}

// --- Image handling ---
function showError(error) {
  setStatus(error.message, 'error');
}

document.getElementById('choose-key').addEventListener('click', async () => {
  if (!serverSelect.value) return;
  await window.api.chooseKey(serverSelect.value);
  await loadServers();
});
document.getElementById('open-releases').addEventListener('click', () => window.api.openReleases());

async function setImage(blob) {
  clearImage();
  const revision = imageRevision;
  try {
    if (!blob || blob.size > 32 * 1024 * 1024) throw new Error('Choose an image of up to 32 MiB.');
    const bitmap = await createImageBitmap(blob);
    try {
      if (revision !== imageRevision) return;
      if (bitmap.width * bitmap.height > 32 * 1024 * 1024 || Math.max(bitmap.width, bitmap.height) > 16384) {
        throw new Error('Image dimensions exceed the supported limits.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png || png.size > 32 * 1024 * 1024) throw new Error('PNG exceeds 32 MiB.');
      const bytes = new Uint8Array(await png.arrayBuffer());
      if (revision !== imageRevision) return;
      currentImageBuffer = bytes;
      preview.src = canvas.toDataURL('image/png');
      preview.hidden = false;
      placeholder.hidden = true;
      clearBtn.hidden = false;
      dropZone.classList.add('has-image');
      sendBtn.disabled = false;
    } finally {
      bitmap.close();
    }
  } catch (error) {
    if (revision === imageRevision) showError(error);
  }
}

function clearImage() {
  preview.removeAttribute('src');
  preview.hidden = true;
  placeholder.hidden = false;
  clearBtn.hidden = true;
  dropZone.classList.remove('has-image');
  sendBtn.disabled = true;
  currentImageBuffer = null;
  imageRevision++;
  setStatus('', '');
}

clearBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearImage();
});

// --- Paste ---
document.addEventListener('paste', (e) => {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      setImage(blob);
      return;
    }
  }
});

// --- Drag and drop ---
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    setImage(file);
  }
});

// --- Status ---
function setStatus(message, type, detail) {
  status.className = `status ${type}`;
  status.textContent = message;
  if (detail) {
    const path = document.createElement('span');
    path.className = 'path';
    path.textContent = detail;
    status.append(document.createElement('br'), path);
  }
}

// --- Send ---
sendBtn.addEventListener('click', async () => {
  if (!currentImageBuffer) return;

  const bytes = currentImageBuffer;
  const displayedServerId = renderedServerId;
  sendBtn.disabled = true;
  try {
    await finishEditing();
  } catch (error) {
    sendBtn.disabled = !currentImageBuffer;
    return showError(error);
  }
  sendBtn.textContent = 'Transmitting...';
  sendBtn.classList.add('uploading');
  setStatus('Connecting...', 'info');

  const result = await window.api.uploadScreenshot(bytes, displayedServerId).catch(error => ({ error: error.message }));

  sendBtn.classList.remove('uploading');
  sendBtn.textContent = 'Transmit and Copy File Path';

  if (result.success) {
    setStatus('✓ Transmitted. Path copied.', 'success', result.remotePath);
  } else {
    setStatus(`✗ ${result.error}`, 'error');
  }
  sendBtn.disabled = !currentImageBuffer;
});

// --- Cmd+Enter shortcut ---
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && currentImageBuffer && !sendBtn.disabled) {
    sendBtn.click();
  }
});

// --- Test connection ---
testBtn.addEventListener('click', async () => {
  try { await finishEditing(); } catch (error) { return showError(error); }
  testBtn.textContent = 'Testing...';
  setStatus('Testing...', 'info');

  const result = await window.api.testConnection().catch(error => ({ error: error.message }));

  testBtn.textContent = 'Test Connection';

  if (result.success) {
    setStatus('✓ Connection OK', 'success');
  } else {
    setStatus(`✗ ${result.error}`, 'error');
  }
});

// --- History ---
async function loadHistory() {
  const historyList = document.getElementById('history-list');
  const history = await window.api.getHistory();

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  historyList.replaceChildren();
  if (!history.length) historyList.append(element('div', 'history-empty', 'No transmissions yet.'));
  for (const [i, entry] of history.entries()) {
    const date = new Date(entry.timestamp);
    const time = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
      date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const item = element('div', 'history-item');
    item.dataset.index = i;
    const info = element('div', 'history-info');
    info.append(element('span', 'history-filename', entry.filename), element('span', 'history-meta', `${entry.host} · ${time}`));
    const copy = element('button', 'history-copy', 'Copy Path');
    copy.dataset.path = entry.remotePath;
    const validImage = typeof entry.thumbnail === 'string' && entry.thumbnail.length <= 128 * 1024 &&
      /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(entry.thumbnail);
    if (validImage) {
      const thumbnail = element('img', 'history-thumb');
      thumbnail.src = entry.thumbnail;
      thumbnail.alt = '';
      item.append(thumbnail);
      const expanded = element('div', 'history-preview');
      expanded.dataset.for = i;
      expanded.hidden = true;
      expanded.append(thumbnail.cloneNode());
      historyList.append(item, expanded);
    } else {
      item.append(element('div', 'history-thumb-placeholder', '📋'));
      historyList.append(item);
    }
    item.append(info, copy);
  }

  // Attach copy handlers
  historyList.querySelectorAll('.history-copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pathText = btn.dataset.path;
      try { await window.api.copyHistoryPath(pathText); } catch (error) { return showError(error); }
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    });
  });

  // Attach click-to-expand handlers
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = item.dataset.index;
      const preview = historyList.querySelector(`.history-preview[data-for="${idx}"]`);
      if (!preview) return;
      const isOpen = !preview.hidden;
      // Close all previews
      historyList.querySelectorAll('.history-preview').forEach(p => p.hidden = true);
      historyList.querySelectorAll('.history-item').forEach(i => i.classList.remove('expanded'));
      if (!isOpen) {
        preview.hidden = false;
        item.classList.add('expanded');
      }
    });
  });
}

// --- Clear history ---
const clearHistoryBtn = document.getElementById('clear-history-btn');
const clearDropdown = document.getElementById('clear-dropdown');

clearHistoryBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearDropdown.hidden = !clearDropdown.hidden;
});

document.addEventListener('click', () => {
  clearDropdown.hidden = true;
});

const RANGES = { hour: 3600000, day: 86400000, month: 2592000000, all: null };

document.querySelectorAll('.clear-option').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const range = btn.dataset.range;
    await window.api.clearHistory(RANGES[range]);
    clearDropdown.hidden = true;
    loadHistory();
  });
});

// --- Global shortcut display & editor ---
const shortcutDisplay = document.getElementById('shortcut-display');
let isRecording = false;

// Convert Electron accelerator to readable format
function formatShortcut(accelerator) {
  if (!accelerator) return '';
  const isMac = navigator.platform.includes('Mac');
  return accelerator
    .replace(/CommandOrControl/g, isMac ? '⌘' : 'Ctrl')
    .replace(/Control/g, isMac ? '⌃' : 'Ctrl')
    .replace(/Option/g, isMac ? '⌥' : 'Alt')
    .replace(/Alt/g, isMac ? '⌥' : 'Alt')
    .replace(/Shift/g, isMac ? '⇧' : 'Shift')
    .replace(/\+/g, '');
}

// Convert keydown event to Electron accelerator string
function keyEventToAccelerator(e) {
  const parts = [];
  if (e.metaKey) parts.push('CommandOrControl');
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Option');
  if (e.shiftKey) parts.push('Shift');

  // Use e.code to get the physical key (e.key returns garbled chars with Option held)
  const code = e.code;
  let key = null;
  if (/^Key[A-Z]$/.test(code)) {
    key = code.slice(3); // KeyP → P
  } else if (/^Digit\d$/.test(code)) {
    key = code.slice(5); // Digit1 → 1
  } else if (/^F\d+$/.test(code)) {
    key = code; // F1, F12
  }

  if (!key) return null; // modifier-only press or unsupported key
  parts.push(key);

  if (parts.length < 2) return null; // need at least one modifier + key
  return parts.join('+');
}

const DEFAULT_SHORTCUT = 'CommandOrControl+Option+Control+P';

async function loadShortcut() {
  const shortcut = await window.api.getGlobalShortcut();
  shortcutDisplay.textContent = formatShortcut(shortcut);
}

shortcutDisplay.addEventListener('click', () => {
  if (isRecording) return;
  isRecording = true;
  shortcutDisplay.textContent = 'Press shortcut...';
  shortcutDisplay.classList.add('recording');

  const handler = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      // Cancel recording
      isRecording = false;
      shortcutDisplay.classList.remove('recording');
      document.removeEventListener('keydown', handler, true);
      loadShortcut();
      return;
    }

    const accelerator = keyEventToAccelerator(e);
    if (!accelerator) return; // still pressing modifiers

    isRecording = false;
    shortcutDisplay.classList.remove('recording');
    document.removeEventListener('keydown', handler, true);

    await window.api.setGlobalShortcut(accelerator).catch(showError);
    await loadShortcut();
  };

  document.addEventListener('keydown', handler, true);
});

// --- Reset shortcut ---
const resetShortcutBtn = document.getElementById('reset-shortcut');
resetShortcutBtn.addEventListener('click', async () => {
  await window.api.setGlobalShortcut(DEFAULT_SHORTCUT).catch(showError);
  await loadShortcut();
});

// --- Init ---
window.api.onSettingsChanged(renderSettings);
loadServers();
