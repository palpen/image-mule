const dropZone = document.getElementById('drop-zone');
const placeholder = document.getElementById('placeholder');
const preview = document.getElementById('preview');
const clearBtn = document.getElementById('clear-btn');
const sendBtn = document.getElementById('send-btn');
const testBtn = document.getElementById('test-btn');
const status = document.getElementById('status');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');

// Config fields
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

// --- Load saved config ---
async function loadConfig() {
  const config = await window.api.getConfig();
  for (const field of fields) {
    const el = document.getElementById(field);
    if (el && config[field]) {
      el.value = config[field];
    }
  }
}

// --- Save config on input change ---
function getConfigFromFields() {
  const config = {};
  for (const field of fields) {
    const el = document.getElementById(field);
    config[field] = field === 'port' ? parseInt(el.value) || 22 : el.value;
  }
  return config;
}

for (const field of fields) {
  document.getElementById(field).addEventListener('change', async () => {
    await window.api.saveConfig(getConfigFromFields());
  });
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
  await window.api.saveConfig(getConfigFromFields());

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
  await window.api.saveConfig(getConfigFromFields());
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

// --- Init ---
loadConfig();
