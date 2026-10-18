import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const store = require('../src/main/store.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'soundboard-test-'));
}

test('loadConfig memberi config default bila file belum ada', () => {
  const dir = tmpDir();
  const config = store.loadConfig(dir);
  assert.equal(config.version, 1);
  assert.deepEqual(config.slots, []);
  assert.equal(config.settings.columns, 4);
  assert.equal(config.settings.outputDeviceId, 'default');
});

test('save dan load roundtrip', () => {
  const dir = tmpDir();
  const config = store.defaultConfig();
  config.slots.push({
    id: '11111111-2222-3333-4444-555555555555',
    label: 'Hiyaa',
    file: 'sounds/hiyaa.wav',
    sourceName: 'hiyaa.wav',
    hotkey: 'num1',
    volume: 0.75,
    loop: true
  });
  store.saveConfig(dir, config);

  const loaded = store.loadConfig(dir);
  assert.equal(loaded.slots.length, 1);
  assert.equal(loaded.slots[0].label, 'Hiyaa');
  assert.equal(loaded.slots[0].hotkey, 'num1');
  assert.equal(loaded.slots[0].volume, 0.75);
  assert.equal(loaded.slots[0].loop, true);
});

test('sanitizeConfig membuang slot tak valid dan menormalkan nilai', () => {
  const config = store.sanitizeConfig({
    settings: { columns: 99, retrigger: 'yes', stopAllHotkey: 'Ctrl+Alt+X', outputDeviceId: 'abc' },
    slots: [
      { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', label: 'ok', file: 'sounds/ok.wav', volume: 5 },
      { id: 'x', label: 'path traversal', file: 'sounds/../../etc/passwd' },
      { id: 'y', label: 'script', file: 'sounds/evil.js' },
      { label: 'tanpa id', file: 'sounds/valid.mp3' },
      null,
      'bukan objek'
    ]
  });

  assert.equal(config.settings.columns, 8);
  assert.equal(config.settings.retrigger, true);
  assert.equal(config.settings.stopAllHotkey, 'Ctrl+Alt+X');
  assert.equal(config.slots.length, 2);
  assert.equal(config.slots[0].volume, 1);
  assert.match(config.slots[1].id, /^[a-zA-Z0-9-]{6,64}$/);
  assert.equal(config.slots[1].file, 'sounds/valid.mp3');
});

test('config korup dibackup dan diganti default', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'config.json'), '{ ini bukan json');
  const config = store.loadConfig(dir);
  assert.deepEqual(config.slots, []);
  const backups = fs.readdirSync(dir).filter((name) => name.startsWith('config.json.corrupt-'));
  assert.equal(backups.length, 1);
});

test('importSoundFiles menyalin file dan unik nama', () => {
  const dir = tmpDir();
  const soundsDir = path.join(dir, 'sounds');
  const sourceDir = path.join(dir, 'src');
  fs.mkdirSync(sourceDir, { recursive: true });
  const source = path.join(sourceDir, 'Hiyaa Sound.wav');
  fs.writeFileSync(source, Buffer.from('RIFFfake'));

  const first = store.importSoundFiles(soundsDir, [source]);
  assert.equal(first.errors.length, 0);
  assert.equal(first.slots.length, 1);
  assert.equal(first.slots[0].file, 'sounds/Hiyaa-Sound.wav');
  assert.equal(first.slots[0].hotkey, '');
  assert.ok(fs.existsSync(path.join(soundsDir, 'Hiyaa-Sound.wav')));

  const second = store.importSoundFiles(soundsDir, [source]);
  assert.equal(second.slots[0].file, 'sounds/Hiyaa-Sound-1.wav');

  const bad = store.importSoundFiles(soundsDir, [path.join(sourceDir, 'nope.txt')]);
  assert.equal(bad.slots.length, 0);
  assert.equal(bad.errors.length, 1);
});

test('sanitizeConfig menormalkan bagian bgm dan pengaturan BGM', () => {
  const config = store.sanitizeConfig({
    settings: { bgmDeviceId: 'cable-1', bgmDeviceLabel: 'CABLE Input', bgmHotkey: 'Ctrl+F10', bgmDeviceTouched: true },
    bgm: { file: 'sounds\\lagu.mp3', sourceName: 'lagu.mp3', volume: 3, loop: 'ya' }
  });
  assert.equal(config.settings.bgmDeviceId, 'cable-1');
  assert.equal(config.settings.bgmDeviceLabel, 'CABLE Input');
  assert.equal(config.settings.bgmHotkey, 'Ctrl+F10');
  assert.equal(config.settings.bgmDeviceTouched, true);
  assert.equal(config.bgm.file, 'sounds/lagu.mp3');
  assert.equal(config.bgm.sourceName, 'lagu.mp3');
  assert.equal(config.bgm.volume, 1);
  assert.equal(config.bgm.loop, true);

  const invalid = store.sanitizeConfig({ bgm: { file: 'sounds/../../etc/passwd', volume: -2 } });
  assert.equal(invalid.bgm.file, '');
  assert.equal(invalid.bgm.volume, 0);
  assert.equal(invalid.bgm.loop, false);
  assert.equal(invalid.settings.bgmDeviceTouched, false);

  const wrongTouched = store.sanitizeConfig({ settings: { bgmDeviceTouched: 'yes' } });
  assert.equal(wrongTouched.settings.bgmDeviceTouched, false);

  const locked = store.sanitizeConfig({ settings: { locked: true } });
  assert.equal(locked.settings.locked, true);
  assert.equal(store.sanitizeConfig({ settings: { locked: 'yes' } }).settings.locked, false);

  const wrongExt = store.sanitizeConfig({ bgm: { file: 'sounds/evil.js' } });
  assert.equal(wrongExt.bgm.file, '');
  assert.equal(wrongExt.bgm.sourceName, '');
});

test('cleanupOrphanSounds mempertahankan file bgm', () => {
  const dir = tmpDir();
  const soundsDir = path.join(dir, 'sounds');
  fs.mkdirSync(soundsDir, { recursive: true });
  fs.writeFileSync(path.join(soundsDir, 'bgm.mp3'), 'a');
  fs.writeFileSync(path.join(soundsDir, 'orphan.wav'), 'b');

  const config = store.defaultConfig();
  config.bgm.file = 'sounds/bgm.mp3';

  const removed = store.cleanupOrphanSounds(soundsDir, config);
  assert.deepEqual(removed, ['orphan.wav']);
  assert.ok(fs.existsSync(path.join(soundsDir, 'bgm.mp3')));
});

test('migrateLegacyData menyalin data lama bila config baru belum ada', () => {
  const root = tmpDir();
  const oldDir = path.join(root, 'legacy-data');
  const newDir = path.join(root, 'MySounds');
  fs.mkdirSync(path.join(oldDir, 'sounds'), { recursive: true });
  fs.writeFileSync(path.join(oldDir, 'config.json'), JSON.stringify(store.defaultConfig()));
  fs.writeFileSync(path.join(oldDir, 'sounds', 'hiyaa.wav'), 'RIFF');

  assert.equal(store.migrateLegacyData(newDir, oldDir), true);
  assert.ok(fs.existsSync(path.join(newDir, 'config.json')));
  assert.ok(fs.existsSync(path.join(newDir, 'sounds', 'hiyaa.wav')));

  assert.equal(store.migrateLegacyData(newDir, oldDir), false);
  assert.equal(
    store.migrateLegacyData(path.join(root, 'other-new'), path.join(root, 'missing-old')),
    false
  );
});

test('cleanupOrphanSounds hanya menghapus file tak terpakai', () => {
  const dir = tmpDir();
  const soundsDir = path.join(dir, 'sounds');
  fs.mkdirSync(soundsDir, { recursive: true });
  fs.writeFileSync(path.join(soundsDir, 'keep.wav'), 'a');
  fs.writeFileSync(path.join(soundsDir, 'orphan.mp3'), 'b');

  const config = store.defaultConfig();
  config.slots.push({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    label: 'keep',
    file: 'sounds/keep.wav',
    sourceName: 'keep.wav',
    hotkey: '',
    volume: 1,
    loop: false
  });

  const removed = store.cleanupOrphanSounds(soundsDir, config);
  assert.deepEqual(removed, ['orphan.mp3']);
  assert.ok(fs.existsSync(path.join(soundsDir, 'keep.wav')));
  assert.ok(!fs.existsSync(path.join(soundsDir, 'orphan.mp3')));
});
