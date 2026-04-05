const dropZone = document.getElementById('drop-zone');
const placeholder = document.getElementById('placeholder');
const preview = document.getElementById('preview');
const clearBtn = document.getElementById('clear-btn');
const sendBtn = document.getElementById('send-btn');
const testBtn = document.getElementById('test-btn');
const status = document.getElementById('status');

// Config fields
const fields = ['host', 'username', 'port', 'privateKeyPath', 'remotePath'];
let currentImageBuffer = null;

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
function setImage(blob) {
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    clearBtn.style.display = 'flex';
    dropZone.classList.add('has-image');
    sendBtn.disabled = false;

    // Convert to buffer for upload
    const arrayBuffer = e.target.result;
    // We need the raw bytes, read again as ArrayBuffer
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
  sendBtn.textContent = 'Uploading...';
  sendBtn.classList.add('uploading');
  setStatus('Connecting to server...', 'info');

  const result = await window.api.uploadScreenshot(currentImageBuffer);

  sendBtn.classList.remove('uploading');
  sendBtn.textContent = 'Send to Server';

  if (result.success) {
    setStatus(
      `✓ Copied to clipboard<br><span class="path">${result.remotePath}</span>`,
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
  setStatus('Testing connection...', 'info');

  const result = await window.api.testConnection();

  testBtn.textContent = 'Test Connection';

  if (result.success) {
    setStatus('✓ Connection successful', 'success');
  } else {
    setStatus(`✗ ${result.error}`, 'error');
  }
});

// --- Init ---
loadConfig();
