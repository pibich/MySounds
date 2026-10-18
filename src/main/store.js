'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_EXT = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.opus', '.webm', '.mp4'];

const DEFAULT_SETTINGS = Object.freeze({
  outputDeviceId: 'default',
  outputDeviceLabel: 'Device default (Windows)',
  bgmDeviceId: 'default',
  bgmDeviceLabel: 'Device default (Windows)',
  bgmDeviceTouched: false,
  bgmHotkey: 'Ctrl+F9',
  stopAllHotkey: '',
  retrigger: true,
  locked: false,
  columns: 4
});

function defaultConfig() {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, slots: [], bgm: defaultBgm() };
}

function defaultBgm() {
  return { file: '', sourceName: '', volume: 1, loop: false };
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeFileName(name) {
  const cleaned = String(name || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 80);
  return cleaned || 'sound';
}

function sanitizeSlot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const file = typeof raw.file === 'string' ? raw.file.replace(/\\/g, '/') : '';
  if (!file || file.includes('..')) return null;
  const ext = path.posix.extname(file).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return null;
  const id = typeof raw.id === 'string' && /^[a-zA-Z0-9-]{6,64}$/.test(raw.id)
    ? raw.id
    : crypto.randomUUID();
  return {
    id,
    label: String(raw.label || path.posix.basename(file, ext)).slice(0, 80),
    file,
    sourceName: String(raw.sourceName || path.posix.basename(file)).slice(0, 200),
    hotkey: typeof raw.hotkey === 'string' ? raw.hotkey : '',
    volume: clampNumber(raw.volume, 0, 1, 1),
    loop: !!raw.loop
  };
}

function sanitizeBgm(raw) {
  const bgm = defaultBgm();
  if (!raw || typeof raw !== 'object') return bgm;
  const file = typeof raw.file === 'string' ? raw.file.replace(/\\/g, '/') : '';
  if (file && !file.includes('..')) {
    const ext = path.posix.extname(file).toLowerCase();
    if (ALLOWED_EXT.includes(ext)) {
      bgm.file = file;
      bgm.sourceName = String(raw.sourceName || path.posix.basename(file)).slice(0, 200);
    }
  }
  bgm.volume = clampNumber(raw.volume, 0, 1, 1);
  bgm.loop = !!raw.loop;
  return bgm;
}

function sanitizeConfig(raw) {
  const cfg = defaultConfig();
  if (!raw || typeof raw !== 'object') return cfg;
  if (raw.settings && typeof raw.settings === 'object') {
    const s = raw.settings;
    cfg.settings.outputDeviceId = typeof s.outputDeviceId === 'string' && s.outputDeviceId
      ? s.outputDeviceId
      : 'default';
    cfg.settings.outputDeviceLabel = typeof s.outputDeviceLabel === 'string' && s.outputDeviceLabel
      ? s.outputDeviceLabel
      : DEFAULT_SETTINGS.outputDeviceLabel;
    cfg.settings.bgmDeviceId = typeof s.bgmDeviceId === 'string' && s.bgmDeviceId
      ? s.bgmDeviceId
      : 'default';
    cfg.settings.bgmDeviceLabel = typeof s.bgmDeviceLabel === 'string' && s.bgmDeviceLabel
      ? s.bgmDeviceLabel
      : DEFAULT_SETTINGS.bgmDeviceLabel;
    cfg.settings.bgmDeviceTouched = typeof s.bgmDeviceTouched === 'boolean' ? s.bgmDeviceTouched : false;
    cfg.settings.bgmHotkey = typeof s.bgmHotkey === 'string' ? s.bgmHotkey : DEFAULT_SETTINGS.bgmHotkey;
    cfg.settings.stopAllHotkey = typeof s.stopAllHotkey === 'string' ? s.stopAllHotkey : DEFAULT_SETTINGS.stopAllHotkey;
    cfg.settings.retrigger = typeof s.retrigger === 'boolean' ? s.retrigger : true;
    cfg.settings.locked = typeof s.locked === 'boolean' ? s.locked : false;
    cfg.settings.columns = Math.round(clampNumber(s.columns, 2, 8, 4));
  }
  if (Array.isArray(raw.slots)) {
    const seen = new Set();
    for (const rawSlot of raw.slots) {
      const slot = sanitizeSlot(rawSlot);
      if (!slot) continue;
      if (seen.has(slot.id)) continue;
      seen.add(slot.id);
      cfg.slots.push(slot);
    }
  }
  cfg.bgm = sanitizeBgm(raw.bgm);
  return cfg;
}

function configPath(configDir) {
  return path.join(configDir, 'config.json');
}

function loadConfig(configDir) {
  const file = configPath(configDir);
  try {
    const text = fs.readFileSync(file, 'utf8');
    return sanitizeConfig(JSON.parse(text));
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      try {
        fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`);
      } catch (_) {}
    }
    return defaultConfig();
  }
}

function saveConfig(configDir, config) {
  fs.mkdirSync(configDir, { recursive: true });
  const file = configPath(configDir);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(sanitizeConfig(config), null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return file;
}

function importSoundFiles(soundsDir, filePaths) {
  fs.mkdirSync(soundsDir, { recursive: true });
  const slots = [];
  const errors = [];
  for (const src of filePaths) {
    const ext = path.extname(src).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      errors.push(`${path.basename(src)}: format tidak didukung`);
      continue;
    }
    try {
      const base = sanitizeFileName(path.basename(src, ext));
      let name = `${base}${ext}`;
      let counter = 1;
      while (fs.existsSync(path.join(soundsDir, name))) {
        name = `${base}-${counter++}${ext}`;
      }
      fs.copyFileSync(src, path.join(soundsDir, name));
      slots.push({
        id: crypto.randomUUID(),
        label: path.basename(src, ext).slice(0, 80),
        file: `sounds/${name}`,
        sourceName: path.basename(src),
        hotkey: '',
        volume: 1,
        loop: false
      });
    } catch (err) {
      errors.push(`${path.basename(src)}: ${err.message}`);
    }
  }
  return { slots, errors };
}

function cleanupOrphanSounds(soundsDir, config) {
  let entries;
  try {
    entries = fs.readdirSync(soundsDir);
  } catch (_) {
    return [];
  }
  const used = new Set();
  for (const slot of config.slots || []) {
    used.add(path.posix.basename(slot.file));
  }
  if (config.bgm && config.bgm.file) {
    used.add(path.posix.basename(config.bgm.file));
  }
  const removed = [];
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    if (used.has(name)) continue;
    const target = path.join(soundsDir, name);
    try {
      if (fs.statSync(target).isFile()) {
        fs.unlinkSync(target);
        removed.push(name);
      }
    } catch (_) {}
  }
  return removed;
}

function migrateLegacyData(newDir, oldDir) {
  try {
    if (path.resolve(newDir) === path.resolve(oldDir)) return false;
    if (fs.existsSync(configPath(newDir))) return false;
    if (!fs.existsSync(configPath(oldDir))) return false;
    fs.mkdirSync(newDir, { recursive: true });
    for (const entry of fs.readdirSync(oldDir)) {
      const dst = path.join(newDir, entry);
      if (fs.existsSync(dst)) continue;
      fs.cpSync(path.join(oldDir, entry), dst, { recursive: true });
    }
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  ALLOWED_EXT,
  DEFAULT_SETTINGS,
  defaultConfig,
  defaultBgm,
  sanitizeConfig,
  sanitizeSlot,
  sanitizeBgm,
  sanitizeFileName,
  loadConfig,
  saveConfig,
  configPath,
  importSoundFiles,
  cleanupOrphanSounds,
  migrateLegacyData
};
