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

// Config fields (excluding server-name which is handled separately)
const fields = ['host', 'username', 'port', 'privateKeyPath', 'remotePath'];
let currentImageBuffer = null;
let currentThumbnail = null;

// --- Tabs ---
const tabs = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.page');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    pages.forEach(p => p.style.display = 'none');
    document.getElementById(`page-${target}`).style.display = 'flex';

    if (target === 'history') {
      loadHistory();
    }
  });
});

// --- Collapsible settings ---
settingsToggle.addEventListener('click', () => {
  const isOpen = settingsPanel.style.display !== 'none';
  settingsPanel.style.display = isOpen ? 'none' : 'flex';
  settingsToggle.classList.toggle('open', !isOpen);
});

// --- Server selector ---
async function loadServers() {
  const servers = await window.api.getServers();
  const active = await window.api.getActiveServer();

  serverSelect.innerHTML = '';

  if (servers.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No servers configured';
    serverSelect.appendChild(opt);
    deleteServerBtn.style.display = 'none';
    return;
  }

  servers.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name || s.host || 'Untitled';
    if (active && s.id === active.id) opt.selected = true;
    serverSelect.appendChild(opt);
  });

  deleteServerBtn.style.display = servers.length > 0 ? '' : 'none';
  loadActiveServerConfig();
}

async function loadActiveServerConfig() {
  const server = await window.api.getActiveServer();
  if (!server) return;

  document.getElementById('server-name').value = server.name || '';
  for (const field of fields) {
    const el = document.getElementById(field);
    if (el && server[field] !== undefined) {
      el.value = server[field];
    }
  }
}

serverSelect.addEventListener('change', async () => {
  const id = serverSelect.value;
  if (id) {
    await window.api.setActiveServer(id);
    loadActiveServerConfig();
  }
});

// --- Add server ---
addServerBtn.addEventListener('click', async () => {
  const server = await window.api.addServer({
    name: 'New Server',
    host: '',
    port: 22,
    username: '',
    privateKeyPath: '~/.ssh/id_rsa',
    remotePath: '/home/user/screenshots'
  });
  await loadServers();
  // Open settings so user can configure
  settingsPanel.style.display = 'flex';
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
function getConfigFromFields() {
  const config = { name: document.getElementById('server-name').value };
  for (const field of fields) {
    const el = document.getElementById(field);
    config[field] = field === 'port' ? parseInt(el.value) || 22 : el.value;
  }
  return config;
}

async function saveCurrentServer() {
  const id = serverSelect.value;
  if (!id) return;
  const config = getConfigFromFields();
  await window.api.updateServer(id, config);
  // Update dropdown label
  const opt = serverSelect.querySelector(`option[value="${id}"]`);
  if (opt) opt.textContent = config.name || config.host || 'Untitled';
}

for (const field of ['server-name', ...fields]) {
  document.getElementById(field).addEventListener('change', saveCurrentServer);
}

// --- Image handling ---
function generateThumbnail(dataUrl, maxWidth = 100) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.src = dataUrl;
  });
}

function setImage(blob) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    clearBtn.style.display = 'flex';
    dropZone.classList.add('has-image');
    sendBtn.disabled = false;

    // Generate thumbnail for history
    currentThumbnail = await generateThumbnail(e.target.result);

    // Convert to buffer for upload
    const bufReader = new FileReader();
    bufReader.onload = (ev) => {
      currentImageBuffer = Array.from(new Uint8Array(ev.target.result));
    };
    bufReader.readAsArrayBuffer(blob);
  };
  reader.readAsDataURL(blob);
}

function clearImage() {
  preview.src = '';
  preview.style.display = 'none';
  placeholder.style.display = 'block';
  clearBtn.style.display = 'none';
  dropZone.classList.remove('has-image');
  sendBtn.disabled = true;
  currentImageBuffer = null;
  currentThumbnail = null;
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
function setStatus(message, type) {
  status.className = `status ${type}`;
  status.innerHTML = message;
}

// --- Send ---
sendBtn.addEventListener('click', async () => {
  if (!currentImageBuffer) return;

  // Save config first
  await saveCurrentServer();

  sendBtn.disabled = true;
  sendBtn.textContent = 'Transmitting...';
  sendBtn.classList.add('uploading');
  setStatus('Connecting...', 'info');

  const result = await window.api.uploadScreenshot(currentImageBuffer, currentThumbnail);

  sendBtn.classList.remove('uploading');
  sendBtn.textContent = 'Transmit and Copy File Path';

  if (result.success) {
    setStatus(
      `✓ Transmitted. Path copied.<br><span class="path">${result.remotePath}</span>`,
      'success'
    );
    sendBtn.disabled = false;
  } else {
    setStatus(`✗ ${result.error}`, 'error');
    sendBtn.disabled = false;
  }
});

// --- Cmd+Enter shortcut ---
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && currentImageBuffer && !sendBtn.disabled) {
    sendBtn.click();
  }
});

// --- Test connection ---
testBtn.addEventListener('click', async () => {
  await saveCurrentServer();
  testBtn.textContent = 'Testing...';
  setStatus('Testing...', 'info');

  const result = await window.api.testConnection();

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

  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No transmissions yet.</div>';
    return;
  }

  historyList.innerHTML = history.map((entry, i) => {
    const date = new Date(entry.timestamp);
    const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const thumbHtml = entry.thumbnail
      ? `<img class="history-thumb" src="${entry.thumbnail}" alt="" />`
      : `<div class="history-thumb-placeholder">📋</div>`;

    return `
      <div class="history-item" data-index="${i}">
        ${thumbHtml}
        <div class="history-info">
          <span class="history-filename">${entry.filename}</span>
          <span class="history-meta">${entry.host} · ${timeStr}</span>
        </div>
        <button class="history-copy" data-path="${entry.remotePath}" title="Copy path">
          Copy Path
        </button>
      </div>
      ${entry.thumbnail ? `<div class="history-preview" data-for="${i}" style="display:none;">
        <img src="${entry.thumbnail}" alt="Preview" />
      </div>` : ''}
    `;
  }).join('');

  // Attach copy handlers
  historyList.querySelectorAll('.history-copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pathText = btn.dataset.path;
      await window.api.copyToClipboard(pathText);
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
      const isOpen = preview.style.display !== 'none';
      // Close all previews
      historyList.querySelectorAll('.history-preview').forEach(p => p.style.display = 'none');
      historyList.querySelectorAll('.history-item').forEach(i => i.classList.remove('expanded'));
      if (!isOpen) {
        preview.style.display = 'block';
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
  clearDropdown.style.display = clearDropdown.style.display === 'none' ? 'block' : 'none';
});

document.addEventListener('click', () => {
  clearDropdown.style.display = 'none';
});

const RANGES = { hour: 3600000, day: 86400000, month: 2592000000, all: null };

document.querySelectorAll('.clear-option').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const range = btn.dataset.range;
    await window.api.clearHistory(RANGES[range]);
    clearDropdown.style.display = 'none';
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

    await window.api.setGlobalShortcut(accelerator);
    shortcutDisplay.textContent = formatShortcut(accelerator);
  };

  document.addEventListener('keydown', handler, true);
});

// --- Reset shortcut ---
const resetShortcutBtn = document.getElementById('reset-shortcut');
resetShortcutBtn.addEventListener('click', async () => {
  await window.api.setGlobalShortcut(DEFAULT_SHORTCUT);
  shortcutDisplay.textContent = formatShortcut(DEFAULT_SHORTCUT);
});

// --- Auto-update ---
const updateBar = document.getElementById('update-bar');
const updateMessage = document.getElementById('update-message');
const updateAction = document.getElementById('update-action');
const checkUpdateBtn = document.getElementById('check-update-btn');
const appVersionSpan = document.getElementById('app-version');

let updateState = 'idle'; // idle, checking, available, downloading, downloaded, error

async function initVersion() {
  const version = await window.api.getAppVersion();
  appVersionSpan.textContent = version;
}

checkUpdateBtn.addEventListener('click', async () => {
  if (updateState === 'checking' || updateState === 'downloading') return;
  updateState = 'checking';
  updateBar.style.display = 'flex';
  updateMessage.textContent = 'Checking for updates...';
  updateAction.style.display = 'none';
  await window.api.checkForUpdate();
});

window.api.onUpdateStatus((status, info) => {
  updateBar.style.display = 'flex';

  switch (status) {
    case 'available':
      updateState = 'available';
      updateMessage.textContent = `v${info.version} available`;
      updateAction.textContent = 'Download';
      updateAction.style.display = '';
      updateAction.onclick = async () => {
        updateState = 'downloading';
        updateAction.style.display = 'none';
        updateMessage.textContent = 'Downloading... 0%';
        await window.api.downloadUpdate();
      };
      break;

    case 'not-available':
      updateState = 'idle';
      updateMessage.textContent = 'You\'re on the latest version';
      updateAction.style.display = 'none';
      setTimeout(() => { updateBar.style.display = 'none'; }, 3000);
      break;

    case 'downloading':
      updateState = 'downloading';
      updateMessage.textContent = `Downloading... ${info.percent}%`;
      updateAction.style.display = 'none';
      break;

    case 'downloaded':
      updateState = 'downloaded';
      updateMessage.textContent = 'Update ready';
      updateAction.textContent = 'Restart';
      updateAction.style.display = '';
      updateAction.onclick = () => {
        window.api.installUpdate();
      };
      break;

    case 'error':
      updateState = 'error';
      updateMessage.textContent = `Update failed: ${info.message}`;
      updateAction.textContent = 'Retry';
      updateAction.style.display = '';
      updateAction.onclick = () => checkUpdateBtn.click();
      setTimeout(() => {
        if (updateState === 'error') updateBar.style.display = 'none';
      }, 5000);
      break;
  }
});

// --- Init ---
loadServers();
loadShortcut();
initVersion();
