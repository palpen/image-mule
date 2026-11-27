const DEFAULT_SHORTCUT = 'CommandOrControl+Option+Control+P';
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_PIXELS = 32 * 1024 * 1024;
const MAX_DIMENSION = 16384;
const MAX_THUMBNAIL_LENGTH = 128 * 1024;
const MAX_SESSION_PREVIEWS = 3;
const SAVE_DEBOUNCE_MS = 500;
const COPIED_FLASH_MS = 1200;
const CONFIRMATION_WINDOW_MS = 3000;
const SAVES_AS_TYPED = 'Changes save as you type.';
const TRANSMITTED = 'Transmitted. Path copied to clipboard.';
const PATH_COPIED = 'Path copied to clipboard.';

const isMac = navigator.platform.includes('Mac');
document.body.classList.toggle('is-mac', isMac);

const byId = id => document.getElementById(id);
const ui = {
  serverList: byId('server-list'),
  serversEmpty: byId('servers-empty'),
  addServer: byId('add-server'),
  historyList: byId('history-list'),
  historyEmpty: byId('history-empty'),
  clearHistory: byId('clear-history'),
  shortcutLabel: byId('shortcut-label'),
  shortcutReset: byId('shortcut-reset'),
  shortcutKeys: byId('shortcut-keys'),
  composeView: byId('view-compose'),
  dropZone: byId('drop-zone'),
  zoneInvitation: byId('zone-invitation'),
  zoneHint: byId('zone-hint'),
  composeImage: byId('compose-image'),
  clearImage: byId('clear-image'),
  transmit: byId('transmit'),
  transmitLabel: byId('transmit-label'),
  transmitKbd: byId('transmit-kbd'),
  composeStatus: byId('compose-status'),
  composeStatusText: byId('compose-status-text'),
  editFailingServer: byId('edit-failing-server'),
  transmissionView: byId('view-transmission'),
  transmissionZone: byId('transmission-zone'),
  transmissionImage: byId('transmission-image'),
  transmissionNoPreview: byId('transmission-no-preview'),
  copyPath: byId('copy-path'),
  copyPathLabel: byId('copy-path-label'),
  transmissionLine: byId('transmission-line'),
  transmissionPath: byId('transmission-path'),
  setupView: byId('view-setup'),
  setupBack: byId('setup-back'),
  copySetupPrompt: byId('copy-setup-prompt'),
  manualSetup: byId('manual-setup'),
  setupStatus: byId('setup-status'),
  serverView: byId('view-server'),
  editorTitle: byId('editor-title'),
  editorDone: byId('editor-done'),
  fieldName: byId('field-name'),
  fieldHost: byId('field-host'),
  fieldPort: byId('field-port'),
  fieldUser: byId('field-user'),
  fieldFolder: byId('field-folder'),
  authOptions: [...document.querySelectorAll('[data-auth]')],
  chooseKey: byId('choose-key'),
  keyPath: byId('key-path'),
  testConnection: byId('test-connection'),
  deleteServer: byId('delete-server'),
  editorStatus: byId('editor-status'),
};

const editorFieldSpecs = [
  { input: ui.fieldName, key: 'name', parse: value => value },
  { input: ui.fieldHost, key: 'host', parse: value => value },
  { input: ui.fieldPort, key: 'port', parse: value => Number(value || 22) },
  { input: ui.fieldUser, key: 'username', parse: value => value },
  { input: ui.fieldFolder, key: 'remotePath', parse: value => value },
];

const state = {
  settings: { servers: [], activeServerId: null, globalShortcut: DEFAULT_SHORTCUT },
  history: [],
  view: { name: 'compose', remotePath: null, serverId: null, announcement: '' },
  image: null,
  transmission: { phase: 'idle', error: '' },
  composeError: '',
  sessionPreviews: new Map(),
  isRecordingShortcut: false,
  confirming: null,
  editorNotice: { tone: 'idle', text: SAVES_AS_TYPED },
  transmissionError: '',
  isTestingConnection: false,
  justCopied: false,
};

let imageRevision = 0;
let pendingSave = Promise.resolve();
let pendingEdits = { serverId: null, fields: {}, timer: null };
let confirmationTimer = null;
let copiedTimer = null;
let syncedEditorServerId = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function errorMessage(error) {
  const raw = error?.message || String(error || 'Unexpected error.');
  return raw.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

function isValidThumbnail(value) {
  return typeof value === 'string' && value.length <= MAX_THUMBNAIL_LENGTH &&
    /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function targetServer() {
  return state.settings.servers.find(server => server.id === state.settings.activeServerId) || null;
}

function editedServer() {
  if (state.view.name !== 'server') return null;
  return state.settings.servers.find(server => server.id === state.view.serverId) || null;
}

function shownEntry() {
  if (state.view.name !== 'transmission') return null;
  return state.history.find(entry => entry.remotePath === state.view.remotePath) || null;
}

function isInFlight() {
  return state.transmission.phase === 'sending';
}

function isIncomplete(server) {
  return !server.host || !server.username || !server.remotePath;
}

function entryServerLabel(entry) {
  return entry.serverName || entry.host || 'Untitled';
}

function setTone(node, tone) {
  node.classList.toggle('is-success', tone === 'success');
  node.classList.toggle('is-error', tone === 'error');
}

function showError(error) {
  const text = errorMessage(error);
  if (state.view.name === 'setup') {
    ui.setupStatus.textContent = text;
    setTone(ui.setupStatus, 'error');
  } else if (state.view.name === 'server') {
    state.editorNotice = { tone: 'error', text };
    renderServerEditor();
  } else if (state.view.name === 'transmission') {
    state.view.announcement = '';
    state.transmissionError = text;
    renderTransmission();
  } else {
    state.composeError = text;
    renderCompose();
  }
}

function rememberSessionPreview(remotePath, previewUrl) {
  state.sessionPreviews.delete(remotePath);
  state.sessionPreviews.set(remotePath, previewUrl);
  while (state.sessionPreviews.size > MAX_SESSION_PREVIEWS) {
    const oldest = state.sessionPreviews.keys().next().value;
    state.sessionPreviews.delete(oldest);
  }
}

function cancelConfirmation() {
  if (confirmationTimer) {
    clearTimeout(confirmationTimer);
    confirmationTimer = null;
  }
  state.confirming = null;
}

function requestConfirmation(name, action) {
  if (state.confirming === name) {
    cancelConfirmation();
    action();
    return;
  }
  cancelConfirmation();
  state.confirming = name;
  render();
  confirmationTimer = setTimeout(() => {
    confirmationTimer = null;
    if (state.confirming !== name) return;
    state.confirming = null;
    render();
  }, CONFIRMATION_WINDOW_MS);
}

function syncEditorFields(server, force = false) {
  const sameServer = !force && syncedEditorServerId === server.id;
  syncedEditorServerId = server.id;
  for (const { input, key } of editorFieldSpecs) {
    const nextValue = String(server[key] ?? (key === 'port' ? 22 : ''));
    const hasPendingEdit = pendingEdits.serverId === server.id && Object.hasOwn(pendingEdits.fields, key);
    const isFocusedAndDirty = sameServer && input === document.activeElement && input.value !== input.defaultValue;
    if (hasPendingEdit || isFocusedAndDirty) continue;
    input.value = nextValue;
    input.defaultValue = nextValue;
  }
}

function renderServers() {
  const servers = state.settings.servers;
  const busy = isInFlight();
  ui.addServer.disabled = busy;
  ui.serversEmpty.hidden = servers.length > 0;
  ui.serverList.hidden = servers.length === 0;
  ui.serverList.replaceChildren(...servers.map(server => {
    const isTarget = server.id === state.settings.activeServerId;
    const row = element('li', 'server-row');
    row.classList.toggle('is-target', isTarget);
    row.classList.toggle('is-shown', state.view.name === 'server' && state.view.serverId === server.id);

    const pick = element('button', 'server-pick');
    pick.type = 'button';
    pick.disabled = busy;
    pick.setAttribute('aria-pressed', String(isTarget));
    pick.append(element('span', 'server-dot'), element('span', 'server-name', displayName(server)));
    pick.addEventListener('click', () => pickServer(server.id));

    const edit = element('button', 'server-edit', 'Edit');
    edit.type = 'button';
    edit.setAttribute('aria-label', `Edit ${displayName(server)}`);
    edit.addEventListener('click', () => showServerEditor(server.id));

    row.append(pick, edit);
    return row;
  }));
}

function renderHistory() {
  ui.historyList.replaceChildren(...state.history.map(entry => {
    const item = element('li', 'history-item');
    const row = element('button', 'history-row');
    row.type = 'button';
    row.classList.toggle('is-shown', state.view.name === 'transmission' && state.view.remotePath === entry.remotePath);

    const time = formatTimestamp(entry.timestamp);
    const label = entryServerLabel(entry);
    const thumbSrc = isValidThumbnail(entry.thumbnail)
      ? entry.thumbnail
      : state.sessionPreviews.get(entry.remotePath) || null;
    let thumbnail;
    if (thumbSrc) {
      thumbnail = element('img', 'history-thumbnail');
      thumbnail.src = thumbSrc;
      thumbnail.alt = '';
      thumbnail.decoding = 'sync';
    } else {
      thumbnail = element('span', 'history-thumbnail history-thumbnail-empty');
      thumbnail.setAttribute('aria-hidden', 'true');
    }

    const summary = element('span', 'history-summary');
    summary.append(element('span', 'history-time', time), element('span', 'history-server', label));
    row.setAttribute('aria-label', `${time}, ${label}`);
    row.append(thumbnail, summary);
    row.addEventListener('click', () => showTransmission(entry.remotePath));
    item.append(row);
    return item;
  }));

  const isEmpty = state.history.length === 0;
  const isConfirming = state.confirming === 'clear-history';
  ui.historyList.hidden = isEmpty;
  ui.historyEmpty.hidden = !isEmpty;
  ui.clearHistory.hidden = isEmpty;
  ui.clearHistory.textContent = isConfirming ? 'Clear all?' : 'Clear';
  ui.clearHistory.classList.toggle('is-confirming', isConfirming);
}

function renderShortcut() {
  const shortcut = state.settings.globalShortcut || DEFAULT_SHORTCUT;
  const offersReset = state.isRecordingShortcut && shortcut !== DEFAULT_SHORTCUT;
  ui.shortcutKeys.textContent = state.isRecordingShortcut ? 'Press keys…' : formatShortcut(shortcut, isMac);
  ui.shortcutKeys.classList.toggle('is-recording', state.isRecordingShortcut);
  ui.shortcutReset.hidden = !offersReset;
  ui.shortcutLabel.hidden = offersReset;
}

function composeStatus(server) {
  if (state.transmission.phase === 'sending' && server) {
    return { tone: 'idle', text: `Transmitting to ${displayName(server)}…` };
  }
  if (state.transmission.phase === 'failed') {
    return { tone: 'error', text: state.transmission.error };
  }
  if (state.composeError) {
    return { tone: 'error', text: state.composeError };
  }
  if (!server) {
    return { tone: 'idle', text: 'Add a server to transmit.' };
  }
  if (isIncomplete(server)) {
    return { tone: 'idle', text: 'Server settings incomplete.' };
  }
  return { tone: 'idle', text: `${server.username}@${server.host}:${server.remotePath}` };
}

function renderCompose() {
  const server = targetServer();
  const source = state.image?.previewUrl || null;
  const hasImage = Boolean(source);
  const busy = isInFlight();
  const status = composeStatus(server);

  ui.dropZone.classList.toggle('is-filled', hasImage);
  ui.zoneInvitation.hidden = hasImage;
  ui.composeImage.hidden = !hasImage;
  if (hasImage) {
    if (ui.composeImage.getAttribute('src') !== source) ui.composeImage.src = source;
  } else {
    ui.composeImage.removeAttribute('src');
  }
  ui.clearImage.hidden = !hasImage || busy;

  ui.transmit.disabled = busy || (Boolean(server) && !hasImage);
  ui.transmitKbd.hidden = !server;
  ui.transmit.classList.toggle('is-busy', busy);
  ui.transmitLabel.textContent = busy
    ? `Transmitting to ${displayName(server)}…`
    : server ? `Transmit to ${displayName(server)}` : 'Add server';

  ui.composeStatusText.textContent = status.text;
  setTone(ui.composeStatus, status.tone);
  const showEditAction = state.transmission.phase === 'failed' && Boolean(server);
  ui.editFailingServer.hidden = !showEditAction;
  if (showEditAction) ui.editFailingServer.textContent = `Edit ${displayName(server)}`;
}

function renderTransmission() {
  const entry = shownEntry();
  if (!entry) return;

  const sessionUrl = state.sessionPreviews.get(entry.remotePath) || null;
  const storedThumb = isValidThumbnail(entry.thumbnail) ? entry.thumbnail : null;
  const imageUrl = sessionUrl || storedThumb;
  const isThumbnailOnly = !sessionUrl;

  ui.transmissionZone.classList.toggle('is-thumbnail', isThumbnailOnly);
  if (imageUrl) {
    ui.transmissionImage.hidden = false;
    ui.transmissionNoPreview.hidden = true;
    if (ui.transmissionImage.getAttribute('src') !== imageUrl) ui.transmissionImage.src = imageUrl;
  } else {
    ui.transmissionImage.hidden = true;
    ui.transmissionImage.removeAttribute('src');
    ui.transmissionNoPreview.hidden = false;
  }

  if (state.transmissionError) {
    ui.transmissionLine.textContent = state.transmissionError;
    setTone(ui.transmissionLine, 'error');
  } else if (state.view.announcement) {
    ui.transmissionLine.textContent = state.view.announcement;
    setTone(ui.transmissionLine, 'success');
  } else {
    ui.transmissionLine.textContent = `${entryServerLabel(entry)} · ${formatTimestamp(entry.timestamp)}`;
    setTone(ui.transmissionLine, 'idle');
  }

  const shownPath = pathForDisplay(entry.remotePath);
  ui.transmissionPath.replaceChildren(
    element('span', 'path-directory', shownPath.directory),
    element('span', 'path-filename', shownPath.filename),
  );
  ui.transmissionPath.title = entry.remotePath;
  ui.copyPath.classList.toggle('is-done', state.justCopied);
  ui.copyPathLabel.textContent = state.justCopied ? 'Copied' : 'Copy path';
}

function renderServerEditor() {
  const server = editedServer();
  if (!server) {
    syncedEditorServerId = null;
    return;
  }
  syncEditorFields(server);
  const isConfirming = state.confirming === 'delete-server';
  const authMode = server.useAgent ? 'agent' : 'key';
  ui.editorTitle.textContent = displayName(server);
  ui.authOptions.forEach(option => option.setAttribute('aria-checked', String(option.dataset.auth === authMode)));
  ui.chooseKey.hidden = authMode !== 'key';
  ui.keyPath.textContent = server.privateKeyPath || '';
  ui.testConnection.disabled = state.isTestingConnection;
  ui.deleteServer.hidden = false;
  ui.deleteServer.textContent = isConfirming ? 'Confirm delete' : 'Delete server';
  ui.deleteServer.classList.toggle('is-confirming', isConfirming);
  ui.editorStatus.textContent = state.editorNotice.text;
  setTone(ui.editorStatus, state.editorNotice.tone);
}

function renderPane() {
  if (state.view.name === 'transmission' && !shownEntry()) {
    state.view = { name: 'compose', remotePath: null, serverId: null, announcement: '' };
  }
  if (state.view.name === 'server' && !editedServer()) {
    state.view = { name: 'compose', remotePath: null, serverId: null, announcement: '' };
  }
  ui.composeView.hidden = state.view.name !== 'compose';
  ui.transmissionView.hidden = state.view.name !== 'transmission';
  ui.setupView.hidden = state.view.name !== 'setup';
  ui.serverView.hidden = state.view.name !== 'server';
  renderCompose();
  renderTransmission();
  renderServerEditor();
}

function render() {
  renderPane();
  renderServers();
  renderHistory();
  renderShortcut();
}

function applySettings(settings) {
  if (!settings) return;
  const previousTarget = targetServer();
  const targetChanged = settings.activeServerId !== state.settings.activeServerId;
  state.settings = settings;
  if (targetChanged && !isInFlight()) {
    state.transmission = { phase: 'idle', error: '' };
  }
  const target = targetServer();
  if (state.view.name === 'setup' && state.view.promptCopied && target && !isIncomplete(target) &&
      (targetChanged || Object.keys(target).some(key => target[key] !== previousTarget?.[key]))) {
    closeToCompose();
    (ui.transmit.disabled ? ui.dropZone : ui.transmit).focus();
    return;
  }
  render();
}

async function refreshSettings() {
  applySettings(await window.api.getSettings());
}

async function refreshHistory() {
  try {
    state.history = await window.api.getHistory();
    render();
  } catch (error) {
    showError(error);
  }
}

function discardPendingEdits() {
  if (pendingEdits.timer) {
    clearTimeout(pendingEdits.timer);
    pendingEdits.timer = null;
  }
  pendingEdits.serverId = null;
  pendingEdits.fields = {};
}

function flushPendingEdits() {
  if (pendingEdits.timer) {
    clearTimeout(pendingEdits.timer);
    pendingEdits.timer = null;
  }
  const serverId = pendingEdits.serverId;
  const fields = pendingEdits.fields;
  pendingEdits.serverId = null;
  pendingEdits.fields = {};
  if (!serverId || Object.keys(fields).length === 0) return pendingSave;

  const saveAttempt = pendingSave.catch(() => {}).then(async () => {
    await window.api.updateServer(serverId, fields);
    const updated = await window.api.getSettings();
    const savedServer = updated.servers.find(server => server.id === serverId);
    if (savedServer && syncedEditorServerId === serverId) {
      for (const { input, key } of editorFieldSpecs) {
        if (!Object.hasOwn(fields, key)) continue;
        const savedText = String(savedServer[key] ?? (key === 'port' ? 22 : ''));
        if (input.value === savedText) input.defaultValue = savedText;
      }
    }
    if (state.view.name === 'server' && state.view.serverId === serverId && state.editorNotice.tone === 'error') {
      state.editorNotice = { tone: 'idle', text: SAVES_AS_TYPED };
    }
    applySettings(updated);
  });

  pendingSave = saveAttempt;
  saveAttempt.catch(error => {
    if (state.view.name === 'server' && state.view.serverId === serverId) {
      state.editorNotice = { tone: 'error', text: errorMessage(error) };
      renderServerEditor();
    } else {
      showError(error);
    }
  });
  return saveAttempt;
}

function scheduleFieldSave(key, value) {
  const server = editedServer();
  if (!server) return;
  if (pendingEdits.serverId && pendingEdits.serverId !== server.id) {
    flushPendingEdits().catch(() => {});
  }
  pendingEdits.serverId = server.id;
  pendingEdits.fields[key] = value;
  if (pendingEdits.timer) clearTimeout(pendingEdits.timer);
  pendingEdits.timer = setTimeout(() => {
    flushPendingEdits().catch(() => {});
  }, SAVE_DEBOUNCE_MS);
}

async function closeToCompose() {
  if (state.view.name === 'server') {
    try {
      await flushPendingEdits();
    } catch {
      return;
    }
  }
  if (state.view.name === 'compose') return;
  const wasSetup = state.view.name === 'setup';
  state.view = { name: 'compose', remotePath: null, serverId: null, announcement: '' };
  state.transmissionError = '';
  cancelConfirmation();
  render();
  if (wasSetup) ui.addServer.focus();
}

async function pickServer(serverId) {
  if (isInFlight()) return;
  try {
    await flushPendingEdits();
    await window.api.setActiveServer(serverId);
    state.transmission = { phase: 'idle', error: '' };
    state.composeError = '';
    state.transmissionError = '';
    state.view = { name: 'compose', remotePath: null, serverId: null, announcement: '' };
    cancelConfirmation();
    await refreshSettings();
  } catch (error) {
    showError(error);
  }
}

async function showServerEditor(serverId, { focusName = false } = {}) {
  if (state.view.name === 'server' && state.view.serverId !== serverId) {
    await flushPendingEdits().catch(() => {});
  }
  const server = state.settings.servers.find(candidate => candidate.id === serverId);
  if (!server) return;
  state.view = { name: 'server', remotePath: null, serverId, announcement: '' };
  cancelConfirmation();
  state.isTestingConnection = false;
  state.editorNotice = { tone: 'idle', text: SAVES_AS_TYPED };
  syncEditorFields(server, true);
  render();
  if (focusName) {
    ui.fieldName.focus();
    ui.fieldName.select();
  }
}

async function showSetup() {
  if (isInFlight()) return;
  try {
    await flushPendingEdits();
    if (state.view.name !== 'setup') {
      state.view = { name: 'setup', promptCopied: false };
      ui.copySetupPrompt.textContent = 'Copy setup prompt';
      ui.setupStatus.textContent = '';
      cancelConfirmation();
      render();
    }
    ui.copySetupPrompt.focus();
  } catch (error) {
    showError(error);
  }
}

async function copySetupPrompt() {
  const view = state.view;
  try {
    await window.api.copySetupPrompt();
    if (view !== state.view) return;
    view.promptCopied = true;
    ui.copySetupPrompt.textContent = 'Copy again';
    ui.setupStatus.textContent = 'Prompt copied. Paste it into your local coding agent.';
    setTone(ui.setupStatus, 'success');
  } catch (error) {
    if (view === state.view) showError(error);
  }
}

async function addServerManually() {
  if (ui.manualSetup.disabled) return;
  ui.manualSetup.disabled = true;
  try {
    const created = await window.api.addServer();
    state.transmission = { phase: 'idle', error: '' };
    state.composeError = '';
    await refreshSettings();
    await showServerEditor(created.id, { focusName: true });
  } catch (error) {
    showError(error);
  } finally {
    ui.manualSetup.disabled = false;
  }
}

async function deleteEditedServer() {
  const server = editedServer();
  if (!server) return;
  discardPendingEdits();
  try {
    await pendingSave.catch(() => {});
    await window.api.deleteServer(server.id);
    state.transmission = { phase: 'idle', error: '' };
    state.composeError = '';
    state.view = { name: 'compose', remotePath: null, serverId: null, announcement: '' };
    await refreshSettings();
  } catch (error) {
    showError(error);
  }
}

async function testEditedServer() {
  const server = editedServer();
  if (!server || state.isTestingConnection) return;
  try {
    await flushPendingEdits();
  } catch {
    return;
  }
  const testedId = server.id;
  state.isTestingConnection = true;
  state.editorNotice = { tone: 'idle', text: 'Testing…' };
  renderServerEditor();

  const result = await window.api.testConnection(testedId)
    .catch(error => ({ success: false, error: errorMessage(error) }));

  state.isTestingConnection = false;
  if (state.view.name === 'server' && state.view.serverId === testedId) {
    state.editorNotice = result.success
      ? { tone: 'success', text: 'Connection OK.' }
      : { tone: 'error', text: result.error };
    renderServerEditor();
  }
}

async function setAuthMode(useAgent) {
  const server = editedServer();
  if (!server) return;
  try {
    await flushPendingEdits();
    await window.api.updateServer(server.id, { useAgent });
    await refreshSettings();
  } catch (error) {
    showError(error);
  }
}

async function chooseKeyFile() {
  const server = editedServer();
  if (!server) return;
  try {
    await flushPendingEdits();
    await window.api.chooseKey(server.id);
    await refreshSettings();
  } catch (error) {
    showError(error);
  }
}

async function clearHistory() {
  try {
    await window.api.clearHistory(null);
    state.sessionPreviews.clear();
    await refreshHistory();
  } catch (error) {
    showError(error);
  }
}

function showTransmission(remotePath, announcement = '') {
  state.view = { name: 'transmission', remotePath, serverId: null, announcement };
  state.transmissionError = '';
  cancelConfirmation();
  state.justCopied = false;
  if (copiedTimer) {
    clearTimeout(copiedTimer);
    copiedTimer = null;
  }
  render();
  const shownRow = ui.historyList.querySelector('.is-shown');
  if (shownRow) shownRow.scrollIntoView({ block: 'nearest' });
}

function stepThroughHistory(offset) {
  if (state.history.length === 0) return;
  const shown = shownEntry();
  const current = shown ? state.history.indexOf(shown) : -1;
  if (current === -1 && offset < 0) return;
  const next = Math.min(Math.max(current + offset, 0), state.history.length - 1);
  showTransmission(state.history[next].remotePath);
}

async function copyShownPath() {
  const entry = shownEntry();
  if (!entry) return;
  try {
    await window.api.copyHistoryPath(entry.remotePath);
    state.transmissionError = '';
    state.view.announcement = PATH_COPIED;
    state.justCopied = true;
    renderTransmission();
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedTimer = null;
      state.justCopied = false;
      renderTransmission();
    }, COPIED_FLASH_MS);
  } catch (error) {
    showError(error);
  }
}

function playScanLine() {
  ui.dropZone.classList.remove('is-scanning');
  void ui.dropZone.offsetWidth;
  ui.dropZone.classList.add('is-scanning');
}

function clearComposeImage() {
  if (isInFlight()) return;
  state.image = null;
  imageRevision += 1;
  state.transmission = { phase: 'idle', error: '' };
  state.composeError = '';
  render();
}

async function setImage(blob) {
  if (isInFlight()) return;
  clearComposeImage();
  const revision = imageRevision;
  try {
    if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('Choose an image of up to 32 MiB.');
    const bitmap = await createImageBitmap(blob);
    try {
      if (revision !== imageRevision) return;
      if (bitmap.width * bitmap.height > MAX_PIXELS || Math.max(bitmap.width, bitmap.height) > MAX_DIMENSION) {
        throw new Error('Image dimensions exceed the supported limits.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png || png.size > MAX_IMAGE_BYTES) throw new Error('PNG exceeds 32 MiB.');
      const bytes = new Uint8Array(await png.arrayBuffer());
      if (revision !== imageRevision) return;
      const previewUrl = canvas.toDataURL('image/png');
      state.image = { bytes, previewUrl };
      state.transmission = { phase: 'idle', error: '' };
      state.composeError = '';
      state.view = { name: 'compose', remotePath: null, serverId: null, announcement: '' };
      cancelConfirmation();
      render();
      playScanLine();
    } finally {
      bitmap.close();
    }
  } catch (error) {
    if (revision === imageRevision) {
      state.view = { name: 'compose', remotePath: null, serverId: null, announcement: '' };
      state.composeError = errorMessage(error);
      render();
    }
  }
}

async function transmit() {
  const server = targetServer();
  if (state.view.name !== 'compose' || !state.image || !server || isInFlight()) return;
  const { bytes, previewUrl } = state.image;
  const displayedServerId = server.id;

  state.transmission = { phase: 'sending', error: '' };
  state.composeError = '';
  render();

  try {
    await flushPendingEdits();
  } catch (error) {
    state.transmission = { phase: 'idle', error: '' };
    state.composeError = errorMessage(error);
    render();
    return;
  }

  const result = await window.api.uploadScreenshot(bytes, displayedServerId)
    .catch(error => ({ success: false, error: errorMessage(error) }));

  if (result.success) {
    rememberSessionPreview(result.remotePath, previewUrl);
    state.image = null;
    imageRevision += 1;
    state.transmission = { phase: 'idle', error: '' };
    await refreshHistory();
    showTransmission(result.remotePath, TRANSMITTED);
  } else {
    state.transmission = { phase: 'failed', error: result.error };
    render();
  }
}

async function saveShortcut(accelerator) {
  state.isRecordingShortcut = false;
  renderShortcut();
  try {
    await window.api.setGlobalShortcut(accelerator);
    await refreshSettings();
  } catch (error) {
    showError(error);
    renderShortcut();
  }
}

function captureShortcut(event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Escape') {
    state.isRecordingShortcut = false;
    renderShortcut();
    return;
  }
  const accelerator = keyEventToAccelerator(event);
  if (!accelerator) return;
  saveShortcut(accelerator);
}

function handleKeydown(event) {
  if (state.isRecordingShortcut) {
    captureShortcut(event);
    return;
  }
  const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  const onOtherButton = event.target instanceof HTMLButtonElement && !event.target.classList.contains('history-row');
  const command = event.metaKey || event.ctrlKey;
  const key = (event.key || '').toLowerCase();

  if (command && key === 'enter') {
    event.preventDefault();
    transmit();
    return;
  }
  if (key === 'escape') {
    event.preventDefault();
    closeToCompose();
    return;
  }
  if (isTyping) return;
  if (command && key === 'e') {
    const server = targetServer();
    if (!server) return;
    event.preventDefault();
    showServerEditor(server.id);
    return;
  }
  if (command && /^[1-9]$/.test(key)) {
    const server = state.settings.servers[Number(key) - 1];
    if (!server) return;
    event.preventDefault();
    pickServer(server.id);
    return;
  }
  if (command || event.altKey) return;
  if (key === 'arrowdown' || key === 'arrowup') {
    event.preventDefault();
    stepThroughHistory(key === 'arrowdown' ? 1 : -1);
    return;
  }
  if (key === 'enter' && state.view.name === 'transmission' && !onOtherButton) {
    event.preventDefault();
    copyShownPath();
    return;
  }
  if ((key === 'backspace' || key === 'delete') && state.view.name === 'compose' && state.image) {
    event.preventDefault();
    clearComposeImage();
  }
}

function handlePaste(event) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const items = event.clipboardData?.items;
  if (!items) return;
  const imageItem = [...items].find(item => item.type.startsWith('image/'));
  if (!imageItem) return;
  event.preventDefault();
  setImage(imageItem.getAsFile());
}

function handleDrop(event) {
  event.preventDefault();
  ui.dropZone.classList.remove('is-drag-over');
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) setImage(file);
}

for (const { input, key, parse } of editorFieldSpecs) {
  input.addEventListener('input', () => {
    scheduleFieldSave(key, parse(input.value));
  });
  input.addEventListener('blur', () => {
    flushPendingEdits().catch(() => {});
  });
}

ui.authOptions.forEach(option => option.addEventListener('click', () => {
  setAuthMode(option.dataset.auth === 'agent');
}));

ui.addServer.addEventListener('click', showSetup);
ui.copySetupPrompt.addEventListener('click', copySetupPrompt);
ui.manualSetup.addEventListener('click', addServerManually);
ui.setupBack.addEventListener('click', closeToCompose);
ui.clearHistory.addEventListener('click', () => requestConfirmation('clear-history', clearHistory));
ui.shortcutKeys.addEventListener('click', () => {
  state.isRecordingShortcut = !state.isRecordingShortcut;
  renderShortcut();
});
ui.shortcutReset.addEventListener('click', () => saveShortcut(DEFAULT_SHORTCUT));

ui.dropZone.addEventListener('dragover', event => {
  event.preventDefault();
  ui.dropZone.classList.add('is-drag-over');
});
ui.dropZone.addEventListener('dragleave', () => ui.dropZone.classList.remove('is-drag-over'));
ui.dropZone.addEventListener('drop', handleDrop);
ui.dropZone.addEventListener('animationend', () => ui.dropZone.classList.remove('is-scanning'));
ui.clearImage.addEventListener('click', event => {
  event.stopPropagation();
  clearComposeImage();
});

ui.transmit.addEventListener('click', () => targetServer() ? transmit() : showSetup());
ui.editFailingServer.addEventListener('click', () => {
  const server = targetServer();
  if (server) showServerEditor(server.id);
});
ui.copyPath.addEventListener('click', copyShownPath);

ui.serverView.addEventListener('submit', event => event.preventDefault());
ui.editorDone.addEventListener('click', closeToCompose);
ui.chooseKey.addEventListener('click', chooseKeyFile);
ui.testConnection.addEventListener('click', testEditedServer);
ui.deleteServer.addEventListener('click', () => requestConfirmation('delete-server', deleteEditedServer));

document.addEventListener('keydown', handleKeydown, true);
document.addEventListener('paste', handlePaste);
window.addEventListener('focus', refreshHistory);

ui.zoneHint.textContent = isMac ? 'Cmd+V or drag & drop' : 'Ctrl+V or drag & drop';
ui.transmitKbd.textContent = isMac ? '⌘↵' : 'Ctrl+↵';

window.api.onSettingsChanged(applySettings);
window.api.onHistoryChanged(refreshHistory);

Promise.all([refreshSettings(), refreshHistory()]).catch(showError);
