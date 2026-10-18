'use strict';

const ICONS = {
  play: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  stop: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  key: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12.65 10A5.99 5.99 0 0 0 7 6a6 6 0 1 0 5.65 8H17v4h4v-4h2v-4h-5.35ZM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/></svg>',
  edit: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm17.71-10.2a1 1 0 0 0 0-1.41l-2.34-2.35a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82Z"/></svg>',
  trash: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/></svg>',
  winMin: '<svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  winMax: '<svg viewBox="0 0 12 12" fill="none"><rect x="2.4" y="2.4" width="7.2" height="7.2" rx="1.2" stroke="currentColor" stroke-width="1.2"/></svg>',
  winRestore: '<svg viewBox="0 0 12 12" fill="none"><rect x="2.2" y="3.8" width="6" height="6" rx="1.1" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 2.6h4.2A1.3 1.3 0 0 1 10 3.9V8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  winClose: '<svg viewBox="0 0 12 12" fill="none"><path d="M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  unlock: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5a5 5 0 0 0-5 5v2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V10a5 5 0 0 0-5-5Zm3 7H9v-2a3 3 0 1 1 6 0v2Z"/></svg>',
  lock: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5a5 5 0 0 0-5 5v2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V10a5 5 0 0 0-5-5Zm-3 7V10a3 3 0 1 1 6 0v2H9Z"/></svg>'
};

const state = {
  config: null,
  info: null,
  results: {},
  devices: [],
  capture: null,
  editId: null,
  confirmResolver: null,
  saveTimer: null
};

const els = {};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function findSlot(id) {
  return state.config.slots.find((slot) => slot.id === id) || null;
}

function formatDuration(seconds) {
  const total = Number(seconds) || 0;
  if (total < 10) return `${total.toFixed(1)}s`;
  const rounded = Math.round(total);
  const mins = Math.floor(rounded / 60);
  const secs = String(rounded % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function reasonText(reason) {
  if (reason === 'conflict') return 'Sudah dipakai aplikasi lain atau slot lain';
  if (reason === 'needs-modifier') return 'Butuh modifier (Ctrl/Alt/Shift)';
  if (reason === 'empty') return 'Belum diatur';
  return 'Gagal didaftarkan';
}

function toast(message, type = 'ok', duration = 3200) {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  els.toasts.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity 0.25s';
    setTimeout(() => node.remove(), 260);
  }, duration);
}

let modalZTop = 50;

function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modalZTop = Math.min(98, modalZTop + 1);
  modal.style.zIndex = String(modalZTop);
  modal.hidden = false;
}

function closeModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.hidden = true;
  modal.style.zIndex = '';
}

function requestClose(id) {
  if (id === 'modalCapture') {
    closeCapture();
    return;
  }
  if (id === 'modalConfirm') {
    resolveConfirm(false);
  }
  closeModal(id);
}

function askConfirm(message, okLabel) {
  els.confirmMessage.textContent = message;
  els.confirmOk.textContent = okLabel || 'Hapus';
  openModal('modalConfirm');
  return new Promise((resolve) => {
    state.confirmResolver = resolve;
  });
}

function resolveConfirm(value) {
  if (state.confirmResolver) {
    state.confirmResolver(value);
    state.confirmResolver = null;
  }
}

async function persist(options = {}) {
  const { render: doRender = true, announce = false } = options;
  state.config = await window.api.saveConfig(state.config);
  await syncHotkeys();
  if (doRender) render();
  else renderStatus();
  if (announce) {
    const failures = collectFailures();
    if (failures.length) toast(`${failures.length} hotkey gagal: ${failures[0]}`, 'error', 4200);
  }
}

function persistDebounced(options = {}) {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => persist(options), 400);
}

function collectFailures() {
  const failures = [];
  for (const slot of state.config.slots) {
    if (!slot.hotkey) continue;
    const result = state.results[`slot:${slot.id}`];
    if (result && !result.ok) failures.push(`${slot.label} (${reasonText(result.reason)})`);
  }
  const stopResult = state.config.settings.stopAllHotkey ? state.results.stopAll : null;
  if (stopResult && !stopResult.ok) failures.push(`Stop Semua (${reasonText(stopResult.reason)})`);
  const bgmResult = state.config.settings.bgmHotkey ? state.results['bgm:toggle'] : null;
  if (bgmResult && !bgmResult.ok) failures.push(`BGM Putar/Jeda (${reasonText(bgmResult.reason)})`);
  return failures;
}

async function syncHotkeys() {
  const entries = [];
  for (const slot of state.config.slots) {
    if (slot.hotkey) entries.push({ key: `slot:${slot.id}`, accelerator: slot.hotkey });
  }
  if (state.config.settings.stopAllHotkey) {
    entries.push({ key: 'stopAll', accelerator: state.config.settings.stopAllHotkey });
  }
  if (state.config.settings.bgmHotkey) {
    entries.push({ key: 'bgm:toggle', accelerator: state.config.settings.bgmHotkey });
  }
  state.results = (await window.api.syncHotkeys(entries)) || {};
  renderStatus();
}

function renderStatus() {
  const settings = state.config.settings;
  let active = 0;
  let failed = 0;

  for (const slot of state.config.slots) {
    if (!slot.hotkey) continue;
    const result = state.results[`slot:${slot.id}`];
    if (result && result.ok) active += 1;
    else if (result) failed += 1;
    updateBadge(slot);
  }

  if (settings.stopAllHotkey) {
    const result = state.results.stopAll;
    if (result && result.ok) active += 1;
    else if (result) failed += 1;
  }

  if (settings.bgmHotkey) {
    const result = state.results['bgm:toggle'];
    if (result && result.ok) active += 1;
    else if (result) failed += 1;
  }

  els.hotkeyChip.textContent = failed
    ? `${active} aktif • ${failed} gagal`
    : `${active} hotkey aktif`;
  els.hotkeyChip.className = `chip${failed ? ' warn' : active ? ' ok' : ''}`;

  const stopLabel = settings.stopAllHotkey ? HotkeyMap.format(settings.stopAllHotkey).replace(/ \+ /g, '+') : '';
  els.stopAllKbd.textContent = stopLabel;
  els.stopAllKbd.hidden = !stopLabel;
  els.btnStopAll.classList.toggle('no-hotkey', !stopLabel);
  els.btnStopAll.title = stopLabel
    ? `Hentikan semua suara (${HotkeyMap.format(settings.stopAllHotkey)})`
    : 'Hentikan semua suara — hotkey belum diatur (buka Pengaturan)';
  els.stopAllKbd2.textContent = settings.stopAllHotkey
    ? HotkeyMap.format(settings.stopAllHotkey)
    : 'belum diatur';
  els.bgmHotkeyKbd.textContent = settings.bgmHotkey
    ? HotkeyMap.format(settings.bgmHotkey)
    : 'belum diatur';

  els.statusDevice.textContent = `Output: ${settings.outputDeviceLabel}`;
  if (state.info) {
    els.statusPath.textContent = state.info.paths.configDir;
    els.statusVersion.textContent = `v${state.info.version}`;
  }
}

function updateBadge(slot) {
  const card = els.grid.querySelector(`.card[data-id="${slot.id}"]`);
  if (!card) return;
  const badge = card.querySelector('.hotkey-badge');
  if (!badge) return;
  const result = slot.hotkey ? state.results[`slot:${slot.id}`] : null;
  badge.textContent = slot.hotkey ? HotkeyMap.format(slot.hotkey) : 'tanpa hotkey';
  const isError = !!(result && !result.ok);
  badge.className = `hotkey-badge${slot.hotkey ? '' : ' off'}${isError ? ' error' : ''}`;
  badge.title = isError ? reasonText(result.reason) : (slot.hotkey ? `Hotkey: ${HotkeyMap.format(slot.hotkey)} (klik untuk ganti)` : 'Klik untuk atur hotkey');
}

function cardHtml(slot) {
  const pct = Math.round(Math.max(0, Math.min(1, slot.volume)) * 100);
  return `
    <article class="card${slot.loop ? ' loop' : ''}" data-id="${escapeHtml(slot.id)}" draggable="true">
      <div class="card-top">
        <button class="hotkey-badge off" data-act="hotkey" type="button" title="Atur hotkey">tanpa hotkey</button>
        <div class="card-icons">
          <button class="icon-btn" data-act="edit" type="button" title="Edit slot">${ICONS.edit}</button>
          <button class="icon-btn danger" data-act="delete" type="button" title="Hapus slot">${ICONS.trash}</button>
        </div>
      </div>
      <div class="card-body" title="Klik untuk putar suara">
        <div class="card-name" title="${escapeHtml(slot.sourceName)}">${escapeHtml(slot.label)}</div>
        <div class="card-meta" data-meta>—</div>
      </div>
      <div class="card-vol">
        <svg class="ic vol-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        <input class="volume" type="range" min="0" max="1" step="0.01" value="${pct / 100}"
          style="--pct:${pct}%" aria-label="Volume ${escapeHtml(slot.label)}" />
      </div>
      <div class="card-actions">
        <button class="btn small play" data-act="play" type="button">${ICONS.play}Putar</button>
        <button class="btn small ghost btn-hotkey" data-act="hotkey" type="button">${ICONS.key}Hotkey</button>
      </div>
    </article>`;
}

function applySearch(query) {
  const q = (query || '').trim().toLowerCase();
  const cards = els.grid ? els.grid.querySelectorAll('.card') : [];
  let visible = 0;
  for (const card of cards) {
    const slot = findSlot(card.dataset.id);
    if (!slot) continue;
    const match = !q ||
      slot.label.toLowerCase().includes(q) ||
      (slot.sourceName && slot.sourceName.toLowerCase().includes(q)) ||
      (slot.hotkey && slot.hotkey.toLowerCase().includes(q)) ||
      (HotkeyMap.format(slot.hotkey).toLowerCase().includes(q));
    card.hidden = !match;
    if (match) visible++;
  }
  if (els.searchClear) els.searchClear.hidden = !q;
}

function render() {
  const { slots, settings } = state.config;
  els.grid.style.setProperty('--cols', String(settings.columns));
  els.grid.innerHTML = slots.map(cardHtml).join('');
  els.grid.hidden = slots.length === 0;
  els.emptyState.hidden = slots.length > 0;
  renderStatus();
  for (const slot of slots) {
    updateBadge(slot);
    updateMeta(slot.id);
  }
  updatePlayingStates();
  renderBgm();
  if (els.soundSearch && els.soundSearch.value) {
    applySearch(els.soundSearch.value);
  }
}

function updateMeta(id) {
  const card = els.grid.querySelector(`.card[data-id="${id}"]`);
  if (!card) return;
  const meta = card.querySelector('[data-meta]');
  const slot = findSlot(id);
  if (!meta || !slot) return;
  const ext = (slot.file.split('.').pop() || '').toUpperCase();
  const status = AudioEngine.status(id);
  meta.classList.toggle('error', status === 'error');
  if (status === 'loading') {
    meta.textContent = 'memuat…';
  } else if (status === 'error') {
    meta.textContent = 'gagal memuat file';
  } else if (status === 'ready') {
    meta.textContent = `${ext} · ${formatDuration(AudioEngine.duration(id))}`;
  } else {
    meta.textContent = ext;
  }
}

function decodeSlot(slot) {
  updateMeta(slot.id);
  return AudioEngine.load(slot).then((entry) => {
    updateMeta(slot.id);
    return entry;
  });
}

function decodeAll() {
  for (const slot of state.config.slots) decodeSlot(slot);
}

function updatePlayingStates() {
  const cards = els.grid.children;
  for (const card of cards) {
    const id = card.dataset && card.dataset.id;
    if (!id) continue;
    const playing = AudioEngine.isPlaying(id);
    if (card.classList.contains('playing') !== playing) {
      card.classList.toggle('playing', playing);
      const button = card.querySelector('button[data-act="play"]');
      if (button) button.innerHTML = playing ? `${ICONS.stop}Stop` : `${ICONS.play}Putar`;
    }
  }
}

function pulseCard(id) {
  const card = els.grid.querySelector(`.card[data-id="${id}"]`);
  if (!card) return;
  card.classList.remove('pulse');
  void card.offsetWidth;
  card.classList.add('pulse');
  setTimeout(() => card.classList.remove('pulse'), 420);
  card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function handleTrigger(payload) {
  if (!payload || !payload.key) return;
  if (payload.key === 'stopAll') {
    AudioEngine.stopAll();
    updatePlayingStates();
    els.btnStopAll.classList.add('active');
    setTimeout(() => els.btnStopAll.classList.remove('active'), 200);
    return;
  }
  if (payload.key === 'bgm:toggle') {
    BgmPlayer.toggle().then((result) => {
      if (!result.ok) {
        if (result.reason === 'empty') toast('Belum ada lagu BGM.', 'warn');
        else if (result.message) toast(result.message, 'error');
      }
      updateBgmStatus();
    });
    return;
  }
  if (payload.key.startsWith('slot:')) {
    const id = payload.key.slice(5);
    const slot = findSlot(id);
    if (!slot) return;
    const result = AudioEngine.play(slot);
    if (result.reason === 'error') toast(`Gagal memuat "${slot.label}"`, 'error');
    pulseCard(id);
    updatePlayingStates();
  }
}

async function addSounds() {
  const { slots, errors } = await window.api.importSounds();
  if (errors && errors.length) toast(errors[0], 'error');
  if (!slots || !slots.length) return;
  state.config.slots.push(...slots);
  await persist({ announce: true });
  render();
  slots.forEach(decodeSlot);
  toast(`${slots.length} sound ditambahkan.`, 'ok');
  if (slots.length === 1) openCapture({ type: 'slot', id: slots[0].id });
}

async function deleteSlot(id) {
  const slot = findSlot(id);
  if (!slot) return;
  const confirmed = await askConfirm(
    `Hapus slot "${slot.label}"? File audio juga akan dihapus dari library.`,
    'Hapus'
  );
  if (!confirmed) return;
  state.config.slots = state.config.slots.filter((item) => item.id !== id);
  AudioEngine.forget(id);
  await persist();
}

function currentCaptureValue() {
  if (!state.capture) return null;
  if (state.capture.target.type === 'stopAll') return state.config.settings.stopAllHotkey;
  if (state.capture.target.type === 'bgm') return state.config.settings.bgmHotkey;
  const slot = findSlot(state.capture.target.id);
  return slot ? slot.hotkey : null;
}

function openCapture(target) {
  state.capture = { target, pending: null };
  const initial = currentCaptureValue();
  if (target.type === 'stopAll') {
    els.captureTarget.textContent = 'untuk Stop Semua suara';
  } else if (target.type === 'bgm') {
    els.captureTarget.textContent = 'untuk Putar/Jeda BGM';
  } else {
    const slot = findSlot(target.id);
    els.captureTarget.textContent = slot ? `untuk slot "${slot.label}"` : 'untuk slot';
  }
  els.capturePreview.textContent = initial
    ? `sekarang: ${HotkeyMap.format(initial)} — tekan kombinasi baru`
    : 'Tekan kombinasi tombol sekarang…';
  els.capturePreview.classList.toggle('idle', !initial);
  els.captureError.hidden = true;
  els.captureSave.disabled = true;
  els.captureClear.disabled = !initial;
  openModal('modalCapture');
  window.api.suspendHotkeys(true);
  document.addEventListener('keydown', onCaptureKeydown, true);
}

function onCaptureKeydown(event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Escape' && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
    closeCapture();
    return;
  }
  if (event.repeat || event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta') {
    return;
  }
  const accelerator = HotkeyMap.eventToAccelerator(event);
  if (!accelerator) {
    state.capture.pending = null;
    els.capturePreview.textContent = 'Tekan tombol lain (bukan hanya modifier)…';
    els.capturePreview.classList.add('idle');
    els.captureError.hidden = false;
    els.captureError.textContent = 'Belum ada tombol utama yang tertangkap.';
    els.captureSave.disabled = true;
    return;
  }
  const validation = HotkeyMap.validate(accelerator);
  state.capture.pending = accelerator;
  els.capturePreview.textContent = HotkeyMap.format(accelerator);
  els.capturePreview.classList.remove('idle');
  els.captureSave.disabled = !validation.ok;
  els.captureError.hidden = validation.ok;
  if (!validation.ok) els.captureError.textContent = validation.message;
}

async function closeCapture() {
  document.removeEventListener('keydown', onCaptureKeydown, true);
  state.capture = null;
  closeModal('modalCapture');
  await window.api.suspendHotkeys(false);
}

async function saveCapture() {
  if (!state.capture || !state.capture.pending) return;
  const accelerator = state.capture.pending;
  const target = state.capture.target;
  if (target.type === 'stopAll') state.config.settings.stopAllHotkey = accelerator;
  else if (target.type === 'bgm') state.config.settings.bgmHotkey = accelerator;
  else {
    const slot = findSlot(target.id);
    if (slot) slot.hotkey = accelerator;
  }
  await closeCapture();
  await persist({ announce: true });
}

async function clearCapture() {
  if (!state.capture) return;
  const target = state.capture.target;
  if (target.type === 'stopAll') state.config.settings.stopAllHotkey = '';
  else if (target.type === 'bgm') state.config.settings.bgmHotkey = '';
  else {
    const slot = findSlot(target.id);
    if (slot) slot.hotkey = '';
  }
  await closeCapture();
  await persist({ announce: true });
}

function openEdit(id) {
  const slot = findSlot(id);
  if (!slot) return;
  state.editId = id;
  els.editLabel.value = slot.label;
  els.editLoop.checked = !!slot.loop;
  els.editFile.textContent = slot.file;
  openModal('modalEdit');
}

async function saveEdit() {
  const slot = findSlot(state.editId);
  if (!slot) return;
  const label = els.editLabel.value.trim();
  if (label) slot.label = label.slice(0, 80);
  slot.loop = els.editLoop.checked;
  closeModal('modalEdit');
  await persist();
}

async function replaceFile() {
  const slot = findSlot(state.editId);
  if (!slot) return;
  const { slots, errors } = await window.api.importSounds();
  if (errors && errors.length) toast(errors[0], 'error');
  if (!slots || !slots.length) return;
  const first = slots.shift();
  slot.file = first.file;
  slot.sourceName = first.sourceName;
  if (slots.length) state.config.slots.push(...slots);
  AudioEngine.reload(slot);
  closeModal('modalEdit');
  await persist();
  render();
  decodeSlot(slot);
  toast('File slot diganti.', 'ok');
}

function showCurrentFile() {
  const slot = findSlot(state.editId);
  if (slot) window.api.showInFolder(slot.file);
}

async function loadDevices() {
  let devices = [];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'audiooutput');
  } catch (_) {
    devices = [];
  }
  if (!devices.length) devices = [{ deviceId: 'default', label: 'Device default (Windows)' }];
  state.devices = devices;

  const current = state.config.settings.outputDeviceId;
  if (!devices.some((device) => device.deviceId === current)) {
    state.config.settings.outputDeviceId = 'default';
    state.config.settings.outputDeviceLabel = 'Device default (Windows)';
  }
  const currentBgm = state.config.settings.bgmDeviceId;
  if (!devices.some((device) => device.deviceId === currentBgm)) {
    state.config.settings.bgmDeviceId = 'default';
    state.config.settings.bgmDeviceLabel = 'Device default (Windows)';
    applyBgmSink(false);
  }
  renderDeviceOptions();
  updateBgmWarn();
  await autoPickSilentDevice();
}

function renderDeviceOptions() {
  const optionsHtml = state.devices
    .map((device) => `<option value="${escapeHtml(device.deviceId)}">${escapeHtml(device.label || device.deviceId)}</option>`)
    .join('');
  els.setDevice.innerHTML = optionsHtml;
  els.setDevice.value = state.config.settings.outputDeviceId;
  els.bgmDevice.innerHTML = optionsHtml;
  els.bgmDevice.value = state.config.settings.bgmDeviceId;
}

async function applyOutputDevice(notify) {
  const settings = state.config.settings;
  AudioEngine.configure({ retrigger: settings.retrigger });
  const result = await AudioEngine.setSink(settings.outputDeviceId);
  if (!result.ok && notify) toast(result.message || 'Gagal memilih device output.', 'error');
  renderStatus();
  return result;
}

async function onDeviceChange() {
  const deviceId = els.setDevice.value;
  const device = state.devices.find((item) => item.deviceId === deviceId);
  state.config.settings.outputDeviceId = deviceId;
  state.config.settings.outputDeviceLabel = (device && device.label) || deviceId;
  const result = await applyOutputDevice(true);
  if (result.ok) toast(`Output: ${state.config.settings.outputDeviceLabel}`, 'ok', 2200);
  await persist({ render: false });
}

function testTone() {
  AudioEngine.ensure();
  AudioEngine.beep(660, 0.3, 0.3);
  setTimeout(() => AudioEngine.beep(880, 0.35, 0.3), 200);
}

let bgmSeekDragging = false;

function renderBgm() {
  const bgm = state.config.bgm;
  const hasTrack = !!bgm.file;
  els.bgmEmpty.hidden = hasTrack;
  els.bgmPlayer.hidden = !hasTrack;
  if (!hasTrack) return;
  els.bgmTitle.textContent = bgm.sourceName || bgm.file;
  els.bgmTitle.title = bgm.file;
  els.bgmMeta.textContent = bgm.file;
  els.bgmVolume.value = String(bgm.volume);
  els.bgmVolume.style.setProperty('--pct', `${Math.round(bgm.volume * 100)}%`);
  els.bgmLoop.classList.toggle('toggled', !!bgm.loop);
  BgmPlayer.setVolume(bgm.volume);
  BgmPlayer.setLoop(bgm.loop);
  updateBgmStatus();
  updateBgmWarn();
}

function updateBgmStatus() {
  const bgm = state.config.bgm;
  if (!bgm.file || els.bgmPlayer.hidden) return;
  const media = BgmPlayer.element();
  const st = BgmPlayer.state();
  const playing = st.playing;
  els.bgmPlay.innerHTML = playing ? `${ICONS.stop}Jeda` : `${ICONS.play}Putar`;
  if (media && media.error) {
    els.bgmStatusChip.textContent = 'gagal memuat';
    els.bgmStatusChip.className = 'chip warn';
  } else {
    els.bgmStatusChip.textContent = playing ? 'memutar' : 'dijeda';
    els.bgmStatusChip.className = `chip${playing ? ' ok' : ''}`;
  }
  els.bgmDur.textContent = formatTime(st.duration);
  const dur = st.duration || 0;
  const pos = st.currentTime || 0;
  if (!bgmSeekDragging) {
    const pct = dur ? Math.round((pos / dur) * 1000) : 0;
    els.bgmSeek.value = String(pct);
    els.bgmSeek.style.setProperty('--pct', `${pct / 10}%`);
    els.bgmCur.textContent = formatTime(pos);
  }
}

function normalizeDeviceId(id) {
  return !id || id === 'default' || id === 'communications' ? 'default' : id;
}

const SILENT_HINTS = [
  { re: /cable|vb-?audio|virtual|steam streaming|remote audio|wave extensible/i, tag: 'virtual' },
  { re: /display audio|hdmi|\bmonitor\b/i, tag: 'hdmi' }
];

function classifyLabel(label) {
  for (const hint of SILENT_HINTS) {
    if (hint.re.test(label || '')) return hint.tag;
  }
  return null;
}

function silentCandidates() {
  const outputId = state.config.settings.outputDeviceId;
  return state.devices
    .filter((device) => {
      if (normalizeDeviceId(device.deviceId) === 'default') return false;
      if (device.deviceId === outputId) return false;
      return !!classifyLabel(device.label || '');
    })
    .map((device) => ({ device, tag: classifyLabel(device.label || '') }));
}

async function autoPickSilentDevice() {
  const settings = state.config.settings;
  if (settings.bgmDeviceId !== 'default' || settings.bgmDeviceTouched) return false;
  const candidates = silentCandidates();
  const pick = candidates.find((item) => item.tag === 'virtual') || candidates.find((item) => item.tag === 'hdmi');
  if (!pick) return false;
  settings.bgmDeviceId = pick.device.deviceId;
  settings.bgmDeviceLabel = pick.device.label || pick.device.deviceId;
  settings.bgmDeviceTouched = true;
  await applyBgmSink(false);
  renderDeviceOptions();
  updateBgmWarn();
  await persist({ render: false });
  toast(
    `Device BGM otomatis dipilih: ${settings.bgmDeviceLabel}. Tekan "Tes Device" untuk memastikan tidak terdengar.`,
    'ok',
    6000
  );
  return true;
}

function updateBgmWarn() {
  const settings = state.config.settings;
  const sameDevice =
    normalizeDeviceId(settings.bgmDeviceId) === normalizeDeviceId(settings.outputDeviceId);
  const tag = classifyLabel(settings.bgmDeviceLabel);
  const candButtons = silentCandidates()
    .filter((item) => item.device.deviceId !== settings.bgmDeviceId)
    .map(
      (item) =>
        `<button type="button" class="btn small cand" data-device="${escapeHtml(item.device.deviceId)}">` +
        `${escapeHtml(item.device.label || item.device.deviceId)} (${item.tag === 'virtual' ? 'virtual' : 'HDMI'})</button>`
    )
    .join('');
  const candRow = candButtons ? `Kandidat device sunyi terdeteksi: <div class="cand-row">${candButtons}</div>` : '';

  els.bgmWarn.hidden = false;
  if (sameDevice) {
    els.bgmWarn.className = 'bgm-warn';
    els.bgmWarn.innerHTML =
      (normalizeDeviceId(settings.bgmDeviceId) === 'default'
        ? 'BGM masih keluar di device default — terdengar di speaker kamu. '
        : 'Device BGM sama dengan device Soundboard. ') +
      (candRow || 'Pilih device lain yang tidak kamu dengar.');
  } else if (tag) {
    els.bgmWarn.className = 'bgm-warn ok';
    els.bgmWarn.textContent =
      `BGM keluar di "${settings.bgmDeviceLabel}" (${tag === 'virtual' ? 'device virtual' : 'HDMI/display'}) — ` +
      'tidak terdengar di device default kamu. Tekan "Tes Device" untuk memastikan.';
  } else {
    els.bgmWarn.className = 'bgm-warn';
    els.bgmWarn.innerHTML =
      `BGM keluar di "${escapeHtml(settings.bgmDeviceLabel)}" — pastikan device ini tidak terdengar di kamu. ` +
      candRow;
  }
}

async function applyBgmSink(notify) {
  const result = await BgmPlayer.setSink(state.config.settings.bgmDeviceId);
  if (!result.ok && notify) toast(result.message || 'Gagal memilih device output BGM.', 'error');
  updateBgmWarn();
  return result;
}

async function setBgmDevice(deviceId, label, options = {}) {
  const { notify = true, touched = true } = options;
  const settings = state.config.settings;
  settings.bgmDeviceId = deviceId;
  settings.bgmDeviceLabel = label || deviceId;
  if (touched) settings.bgmDeviceTouched = true;
  const result = await applyBgmSink(notify);
  if (result.ok && notify) toast(`Output BGM: ${settings.bgmDeviceLabel}`, 'ok', 2200);
  await persist({ render: false });
  return result;
}

async function onBgmDeviceChange() {
  const deviceId = els.bgmDevice.value;
  const device = state.devices.find((item) => item.deviceId === deviceId);
  await setBgmDevice(deviceId, (device && device.label) || deviceId);
}

async function testBgmDevice() {
  const settings = state.config.settings;
  if (typeof AudioContext !== 'function' || !('setSinkId' in AudioContext.prototype)) {
    toast('Build ini tidak mendukung pemilihan device.', 'error');
    return;
  }
  let ctx;
  try {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.setSinkId(settings.bgmDeviceId || 'default');
    if (ctx.state === 'suspended') await ctx.resume();
    const beepAt = (freq, at) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.linearRampToValueAtTime(0.22, at + 0.01);
      gain.gain.setValueAtTime(0.22, at + 0.26);
      gain.gain.linearRampToValueAtTime(0.0001, at + 0.32);
      osc.start(at);
      osc.stop(at + 0.34);
    };
    beepAt(660, ctx.currentTime);
    beepAt(880, ctx.currentTime + 0.4);
    setTimeout(() => {
      try {
        ctx.close();
      } catch (_) {}
    }, 1200);
    toast(
      `Beep dikirim ke "${settings.bgmDeviceLabel}" — kalau TIDAK terdengar, device ini cocok untuk BGM.`,
      'ok',
      5000
    );
  } catch (err) {
    if (ctx) {
      try {
        ctx.close();
      } catch (_) {}
    }
    toast(`Tes gagal: ${(err && err.message) || err}`, 'error');
  }
}

async function pickBgm() {
  const { bgm, errors } = await window.api.pickBgm();
  if (errors && errors.length) toast(errors[0], 'error');
  if (!bgm) return;
  state.config.bgm.file = bgm.file;
  state.config.bgm.sourceName = bgm.sourceName;
  await persist({ render: false });
  renderBgm();
  BgmPlayer.load(state.config.bgm);
  BgmPlayer.setVolume(state.config.bgm.volume);
  BgmPlayer.setLoop(state.config.bgm.loop);
  await applyBgmSink(false);
  toast('Lagu BGM dimuat.', 'ok');
}

async function removeBgm() {
  const confirmed = await askConfirm(
    'Hapus lagu BGM ini? File audio juga akan dihapus dari library.',
    'Hapus'
  );
  if (!confirmed) return;
  BgmPlayer.unload();
  state.config.bgm = { file: '', sourceName: '', volume: 1, loop: false };
  await persist({ render: false });
  renderBgm();
}

function openSettings() {
  els.setRetrigger.checked = !!state.config.settings.retrigger;
  els.setCols.value = String(state.config.settings.columns);
  els.colsVal.textContent = String(state.config.settings.columns);
  els.dataPath.textContent = state.info.paths.configDir;
  renderDeviceOptions();
  openModal('modalSettings');
  loadDevices();
}

function switchTab(tab) {
  const root = tab.closest('[data-tabgroup]');
  if (!root) return;
  root.querySelectorAll('.tab').forEach((item) => {
    item.classList.toggle('active', item === tab);
  });
  root.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.hidden = panel.id !== tab.dataset.tab;
  });
  if (els.searchBox) {
    els.searchBox.hidden = tab.dataset.tab !== 'tabBoard';
  }
}

function setMaximized(max) {
  els.winMax.innerHTML = max ? ICONS.winRestore : ICONS.winMax;
  els.winMax.title = max ? 'Restore' : 'Maximize';
  els.winMax.classList.toggle('toggled', !!max);
}

function renderLock() {
  const locked = !!(state.config && state.config.settings.locked);
  document.body.classList.toggle('locked', locked);
  els.btnLock.classList.toggle('toggled', locked);
  els.btnLock.innerHTML = locked ? ICONS.lock : ICONS.unlock;
  els.btnLock.title = locked ? 'Posisi kartu terkunci — klik untuk buka' : 'Kunci posisi kartu';
}

async function toggleLock() {
  const settings = state.config.settings;
  settings.locked = !settings.locked;
  renderLock();
  await persist({ render: false });
  toast(settings.locked ? 'Posisi kartu terkunci.' : 'Posisi kartu bisa digeser lagi.', 'ok', 2200);
}

function bindEvents() {
  els.btnAdd.addEventListener('click', addSounds);
  els.btnAddEmpty.addEventListener('click', addSounds);
  els.btnGuide.addEventListener('click', () => openModal('modalGuide'));
  els.btnGuideEmpty.addEventListener('click', () => openModal('modalGuide'));
  els.btnSettings.addEventListener('click', openSettings);
  els.btnStopAll.addEventListener('click', () => {
    if (!state.config.settings.stopAllHotkey) {
      openCapture({ type: 'stopAll' });
      return;
    }
    AudioEngine.stopAll();
    updatePlayingStates();
  });

  els.winMin.addEventListener('click', () => window.api.win.minimize());
  els.winMax.addEventListener('click', () => window.api.win.toggleMaximize());
  els.winClose.addEventListener('click', () => window.api.win.close());
  window.api.win.onMaxState(setMaximized);
  els.btnLock.addEventListener('click', toggleLock);

  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) requestClose(backdrop.id);
    });
    backdrop.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => requestClose(backdrop.id));
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || state.capture) return;
    const open = [...document.querySelectorAll('.modal-backdrop')].filter((modal) => !modal.hidden);
    if (open.length) requestClose(open[open.length - 1].id);
  });

  els.captureSave.addEventListener('click', saveCapture);
  els.captureClear.addEventListener('click', clearCapture);
  els.captureCancel.addEventListener('click', () => requestClose('modalCapture'));

  els.editSave.addEventListener('click', saveEdit);
  els.btnReplaceFile.addEventListener('click', replaceFile);
  els.btnShowFile.addEventListener('click', showCurrentFile);

  els.confirmOk.addEventListener('click', () => {
    resolveConfirm(true);
    closeModal('modalConfirm');
  });

  els.setDevice.addEventListener('change', onDeviceChange);
  els.btnTestTone.addEventListener('click', testTone);
  els.btnGuideTest1.addEventListener('click', testTone);
  els.btnOpenData.addEventListener('click', () => window.api.openDataDir());

  els.btnSetStopAll.addEventListener('click', () => openCapture({ type: 'stopAll' }));
  els.btnClearStopAll.addEventListener('click', async () => {
    state.config.settings.stopAllHotkey = '';
    await persist({ announce: true });
  });

  els.btnSetBgmHotkey.addEventListener('click', () => openCapture({ type: 'bgm' }));
  els.btnClearBgmHotkey.addEventListener('click', async () => {
    state.config.settings.bgmHotkey = '';
    await persist({ announce: true });
  });

  els.btnBgmPick.addEventListener('click', pickBgm);
  els.btnBgmPick2.addEventListener('click', pickBgm);
  els.btnBgmRemove.addEventListener('click', removeBgm);
  els.btnBgmGuide.addEventListener('click', () => openModal('modalGuide'));
  els.btnBgmGuide2.addEventListener('click', () => openModal('modalGuide'));
  els.bgmDevice.addEventListener('change', onBgmDeviceChange);
  els.btnBgmTest.addEventListener('click', testBgmDevice);
  els.bgmWarn.addEventListener('click', (event) => {
    const btn = event.target.closest('.cand');
    if (!btn) return;
    const device = state.devices.find((item) => item.deviceId === btn.dataset.device);
    setBgmDevice(btn.dataset.device, (device && device.label) || btn.dataset.device);
  });

  els.bgmPlay.addEventListener('click', async () => {
    const result = await BgmPlayer.toggle();
    if (!result.ok) {
      if (result.reason === 'empty') toast('Belum ada lagu BGM.', 'warn');
      else if (result.message) toast(result.message, 'error');
    }
    updateBgmStatus();
  });
  els.bgmStop.addEventListener('click', () => {
    BgmPlayer.stop();
    updateBgmStatus();
  });
  els.bgmLoop.addEventListener('click', async () => {
    state.config.bgm.loop = !state.config.bgm.loop;
    BgmPlayer.setLoop(state.config.bgm.loop);
    els.bgmLoop.classList.toggle('toggled', state.config.bgm.loop);
    await persist({ render: false });
  });
  els.bgmSeek.addEventListener('input', (event) => {
    bgmSeekDragging = true;
    const st = BgmPlayer.state();
    const pct = Number(event.target.value);
    const pos = (pct / 1000) * (st.duration || 0);
    event.target.style.setProperty('--pct', `${pct / 10}%`);
    els.bgmCur.textContent = formatTime(pos);
  });
  els.bgmSeek.addEventListener('change', (event) => {
    const st = BgmPlayer.state();
    const pos = (Number(event.target.value) / 1000) * (st.duration || 0);
    bgmSeekDragging = false;
    BgmPlayer.seek(pos);
    updateBgmStatus();
  });
  els.bgmVolume.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    state.config.bgm.volume = value;
    event.target.style.setProperty('--pct', `${Math.round(value * 100)}%`);
    BgmPlayer.setVolume(value);
    persistDebounced({ render: false });
  });

  const bgmMedia = BgmPlayer.element();
  if (bgmMedia) {
    bgmMedia.addEventListener('timeupdate', updateBgmStatus);
    bgmMedia.addEventListener('loadedmetadata', updateBgmStatus);
    bgmMedia.addEventListener('play', updateBgmStatus);
    bgmMedia.addEventListener('pause', updateBgmStatus);
    bgmMedia.addEventListener('ended', updateBgmStatus);
    bgmMedia.addEventListener('error', () => {
      if (state.config.bgm && state.config.bgm.file) toast('Gagal memuat file BGM.', 'error');
      updateBgmStatus();
    });
  }

  els.setRetrigger.addEventListener('change', async () => {
    state.config.settings.retrigger = els.setRetrigger.checked;
    AudioEngine.configure({ retrigger: state.config.settings.retrigger });
    await persist({ render: false });
  });

  els.setCols.addEventListener('input', () => {
    const columns = Number(els.setCols.value);
    state.config.settings.columns = columns;
    els.colsVal.textContent = String(columns);
    els.grid.style.setProperty('--cols', String(columns));
    persistDebounced({ render: false });
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab));
  });

  els.grid.addEventListener('click', (event) => {
    const card = event.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    if (event.target.closest('.card-body')) {
      const slot = findSlot(id);
      if (!slot) return;
      AudioEngine.play(slot);
      updatePlayingStates();
      return;
    }
    const action = event.target.closest('[data-act]');
    if (!action) return;
    if (action.dataset.act === 'play') {
      const slot = findSlot(id);
      if (!slot) return;
      AudioEngine.play(slot);
      updatePlayingStates();
    } else if (action.dataset.act === 'hotkey') {
      openCapture({ type: 'slot', id });
    } else if (action.dataset.act === 'edit') {
      openEdit(id);
    } else if (action.dataset.act === 'delete') {
      deleteSlot(id);
    }
  });

  els.grid.addEventListener('input', (event) => {
    if (!event.target.classList.contains('volume')) return;
    const card = event.target.closest('.card');
    const slot = card ? findSlot(card.dataset.id) : null;
    if (!slot) return;
    const value = Number(event.target.value);
    slot.volume = value;
    event.target.style.setProperty('--pct', `${Math.round(value * 100)}%`);
    AudioEngine.setSlotVolume(slot.id, value);
    persistDebounced({ render: false, announce: true });
  });

  let dragId = null;

  els.grid.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.card');
    if (!card || state.config.settings.locked || event.target.closest('input, button, select, a')) {
      event.preventDefault();
      return;
    }
    dragId = card.dataset.id;
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
  });

  els.grid.addEventListener('dragover', (event) => {
    if (!dragId || state.config.settings.locked) return;
    event.preventDefault();
    const card = event.target.closest('.card');
    els.grid.querySelectorAll('.card').forEach((item) => item.classList.remove('drag-over'));
    if (card && card.dataset.id !== dragId) card.classList.add('drag-over');
  });

  els.grid.addEventListener('drop', (event) => {
    event.preventDefault();
    if (state.config.settings.locked) return;
    const card = event.target.closest('.card');
    els.grid.querySelectorAll('.card').forEach((item) => item.classList.remove('drag-over'));
    if (!card || !dragId || card.dataset.id === dragId) return;
    const from = state.config.slots.findIndex((slot) => slot.id === dragId);
    const to = state.config.slots.findIndex((slot) => slot.id === card.dataset.id);
    if (from < 0 || to < 0) return;
    const [moved] = state.config.slots.splice(from, 1);
    state.config.slots.splice(to, 0, moved);
    persist({ announce: false });
  });

  els.grid.addEventListener('dragend', () => {
    dragId = null;
    els.grid.querySelectorAll('.card').forEach((item) => {
      item.classList.remove('drag-over', 'dragging');
    });
  });

  if (els.soundSearch) {
    els.soundSearch.addEventListener('input', () => {
      applySearch(els.soundSearch.value);
    });
  }

  if (els.searchClear) {
    els.searchClear.addEventListener('click', () => {
      els.soundSearch.value = '';
      applySearch('');
      els.soundSearch.focus();
    });
  }

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      const openModal = document.querySelector('.modal-backdrop:not([hidden])');
      if (!openModal && els.soundSearch) {
        event.preventDefault();
        els.soundSearch.focus();
        els.soundSearch.select();
      }
    }
  });
}

function cacheElements() {
  [
    'grid', 'emptyState', 'toasts', 'hotkeyChip', 'stopAllKbd', 'stopAllKbd2', 'statusDevice',
    'statusPath', 'statusVersion', 'meterFill', 'btnAdd', 'btnAddEmpty', 'btnGuide', 'btnGuideEmpty',
    'btnSettings', 'btnStopAll', 'btnLock', 'btnTestTone', 'btnGuideTest1', 'btnOpenData',
    'btnSetStopAll', 'btnClearStopAll', 'setDevice', 'setRetrigger', 'setCols', 'colsVal',
    'dataPath', 'deviceHint', 'captureTarget', 'capturePreview', 'captureError', 'captureSave',
    'captureClear', 'captureCancel', 'editLabel', 'editLoop', 'editFile', 'editSave',
    'btnReplaceFile', 'btnShowFile', 'confirmMessage', 'confirmOk',
    'bgmEmpty', 'bgmPlayer', 'bgmTitle', 'bgmMeta', 'bgmPlay', 'bgmStop', 'bgmLoop',
    'bgmStatusChip', 'bgmCur', 'bgmDur', 'bgmSeek', 'bgmVolume', 'bgmDevice', 'bgmWarn',
    'bgmHotkeyKbd', 'btnBgmPick', 'btnBgmPick2', 'btnBgmRemove', 'btnBgmGuide', 'btnBgmGuide2',
    'btnBgmTest',
    'winMin', 'winMax', 'winClose',
    'btnSetBgmHotkey', 'btnClearBgmHotkey',
    'soundSearch', 'searchClear', 'searchBox'
  ].forEach((id) => {
    els[id] = $(id);
  });
}

function startLoop() {
  let smooth = 0;
  const tick = () => {
    const level = Math.min(1, AudioEngine.level());
    smooth = level > smooth ? level : smooth * 0.88 + level * 0.12;
    const percent = Math.min(100, Math.round(Math.pow(smooth, 0.6) * 230));
    els.meterFill.style.width = `${percent}%`;
    updatePlayingStates();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function init() {
  cacheElements();
  const data = await window.api.getConfig();
  state.config = data.config;
  state.info = data;
  AudioEngine.configure({ retrigger: state.config.settings.retrigger });

  bindEvents();
  els.winMin.innerHTML = ICONS.winMin;
  els.winClose.innerHTML = ICONS.winClose;
  setMaximized(await window.api.win.isMaximized());
  renderLock();
  render();
  decodeAll();
  await applyOutputDevice(false);
  await applyBgmSink(false);
  if (state.config.bgm.file) BgmPlayer.load(state.config.bgm);
  await syncHotkeys();
  loadDevices();
  window.api.onTrigger(handleTrigger);
  startLoop();

  if (!state.config.slots.length) {
    setTimeout(() => toast('Klik "Tambah Sound" untuk memulai.', 'ok', 4000), 400);
  }

  window.__sbReady = true;
}

document.addEventListener('DOMContentLoaded', init);
