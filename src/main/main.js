'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const store = require('./store');
const { HotkeyManager } = require('./hotkeys');
const { registerMediaScheme, registerMediaProtocol } = require('./media-protocol');

const SMOKE = process.argv.includes('--smoke');
const APP_ICON = path.join(__dirname, '..', 'assets', 'app.png');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

if (SMOKE) {
  app.setPath('userData', path.join(os.tmpdir(), 'mysounds-smoke-profile'));
}

registerMediaScheme();

let mainWindow = null;
let tray = null;
let forceQuit = false;
let configDir = '';
let soundsDir = '';
let config = store.defaultConfig();
let hotkeys = null;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 740,
    minWidth: 700,
    minHeight: 520,
    show: false,
    frame: false,
    backgroundColor: '#0d1117',
    title: 'MySounds',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  if (SMOKE) {
    mainWindow.webContents.on('console-message', (...args) => {
      const first = args[0];
      const level = first && typeof first === 'object' && 'level' in first ? first.level : args[1];
      const message = first && typeof first === 'object' && 'message' in first ? first.message : args[2];
      if (typeof level === 'number' && level >= 2) console.error(`RENDERER[${level}] ${message}`);
    });
    mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
      console.error(`SMOKE_LOAD_FAIL ${code} ${description}`);
    });
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const forwardMaxState = () => sendToRenderer('win:max-state', mainWindow.isMaximized());
  mainWindow.on('maximize', forwardMaxState);
  mainWindow.on('unmaximize', forwardMaxState);

  let hideNotified = false;

  mainWindow.on('close', (event) => {
    if (forceQuit || SMOKE) return;
    event.preventDefault();
    mainWindow.hide();
    if (!hideNotified) {
      hideNotified = true;
      try {
        const { Notification } = require('electron');
        if (Notification.isSupported()) {
          new Notification({
            title: 'MySounds',
            body: 'Masih berjalan di system tray — hotkey tetap aktif. Klik ikon tray untuk membuka kembali.'
          }).show();
        }
      } catch (_) {}
    }
  });
}

function createTray() {
  try {
    const image = nativeImage.createFromPath(APP_ICON);
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }));
    tray.setToolTip('MySounds');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Buka MySounds',
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        {
          label: 'Stop Semua Suara',
          click: () => sendToRenderer('hotkey:trigger', { key: 'stopAll' })
        },
        { type: 'separator' },
        {
          label: 'Keluar',
          click: () => {
            forceQuit = true;
            app.quit();
          }
        }
      ])
    );
    tray.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) mainWindow.hide();
      else mainWindow.show();
    });
  } catch (err) {
    console.error('Tray gagal dibuat:', err.message);
  }
}

function registerIpc() {
  ipcMain.handle('config:get', () => ({
    config,
    paths: { configDir, soundsDir },
    version: app.getVersion(),
    platform: process.platform
  }));

  ipcMain.handle('config:save', (event, next) => {
    config = store.sanitizeConfig(next);
    store.saveConfig(configDir, config);
    store.cleanupOrphanSounds(soundsDir, config);
    return config;
  });

  ipcMain.handle('sounds:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Pilih file sound',
      filters: [{ name: 'File audio', extensions: store.ALLOWED_EXT.map((e) => e.slice(1)) }],
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled || !result.filePaths.length) return { slots: [], errors: [] };
    return store.importSoundFiles(soundsDir, result.filePaths);
  });

  ipcMain.handle('bgm:pick', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      title: 'Pilih file BGM',
      filters: [{ name: 'File audio', extensions: store.ALLOWED_EXT.map((e) => e.slice(1)) }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return { bgm: null, errors: [] };
    const imported = store.importSoundFiles(soundsDir, result.filePaths);
    const first = imported.slots[0];
    return {
      bgm: first ? { file: first.file, sourceName: first.sourceName } : null,
      errors: imported.errors
    };
  });

  ipcMain.handle('hotkeys:sync', (event, entries) => hotkeys.sync(entries));
  ipcMain.handle('hotkeys:suspend', (event, value) => hotkeys.setSuspended(value));

  ipcMain.handle('app:showInFolder', (event, relPath) => {
    if (typeof relPath === 'string' && relPath && !relPath.includes('..')) {
      shell.showItemInFolder(path.join(soundsDir, relPath));
    }
  });

  ipcMain.handle('app:openDataDir', () => shell.openPath(configDir));

  ipcMain.on('win:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  });
  ipcMain.on('win:toggle-max', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('win:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });
  ipcMain.handle('win:is-maximized', () =>
    mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false
  );
}

app.whenReady().then(() => {
  configDir = app.getPath('userData');
  if (SMOKE) {
    seedSmokeProfile(configDir);
  }
  soundsDir = path.join(configDir, 'sounds');
  fs.mkdirSync(soundsDir, { recursive: true });
  config = store.loadConfig(configDir);

  registerMediaProtocol(soundsDir);

  session_allowAllPermissions();

  hotkeys = new HotkeyManager((key) => sendToRenderer('hotkey:trigger', { key }));

  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'editMenu' }]));

  createWindow();
  createTray();
  registerIpc();

  if (SMOKE) {
    setTimeout(async () => {
      let failed = false;
      let probe = null;
      try {
        probe = await mainWindow.webContents.executeJavaScript(PROBE_SCRIPT, true);
        console.log('SMOKE_RENDERER ' + JSON.stringify(probe));

        const results = hotkeys.sync([
          { key: 'smoke:numpad', accelerator: 'num1' },
          { key: 'smoke:fkey', accelerator: 'F9' },
          { key: 'smoke:combo', accelerator: 'Ctrl+Alt+Space' }
        ]);
        console.log('SMOKE_HOTKEYS ' + JSON.stringify(results));

        const metaOk = !!(probe.meta && probe.meta.includes('WAV'));
        const slotHotkeyOk = !!(probe.hotkeys && probe.hotkeys['slot:aaaaaaaa-bbbb-4fff-8eee-999999999991'] && probe.hotkeys['slot:aaaaaaaa-bbbb-4fff-8eee-999999999991'].ok);
        const bgmOk = !!(probe.bgm && probe.bgm.hasTab && probe.bgm.file && probe.bgm.sink.ok && probe.bgm.play.ok && probe.bgm.playing);
        failed = !(probe.ready && probe.slots === 6 && metaOk && slotHotkeyOk && probe.play && probe.play.ok && results['smoke:combo'].ok && bgmOk);

        const shot = path.join(os.tmpdir(), 'mysounds-smoke.png');
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(shot, image.toPNG());
        console.log('SMOKE_SHOT ' + shot);

        const grab = async (name, script) => {
          await mainWindow.webContents.executeJavaScript(script, true);
          await new Promise((resolve) => setTimeout(resolve, 250));
          const png = await mainWindow.webContents.capturePage();
          const file = path.join(os.tmpdir(), `mysounds-smoke-${name}.png`);
          fs.writeFileSync(file, png.toPNG());
          console.log(`SMOKE_SHOT_${name.toUpperCase()} ` + file);
        };

        await grab(
          'capture',
          `openCapture({ type: 'slot', id: state.config.slots[0].id });
           document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Numpad5', key: '5', bubbles: true, cancelable: true }));
           true`
        );
        await grab('guide', `closeCapture(); openModal('modalGuide'); true`);
        await grab('settings', `closeModal('modalGuide'); openSettings(); true`);
        await grab('sethotkey', `openCapture({ type: 'stopAll' }); true`);
        await grab('bgm', `closeCapture(); closeModal('modalSettings'); document.querySelector('.tab[data-tab="tabBgm"]').click(); true`);
        await mainWindow.webContents.executeJavaScript(`closeModal('modalEdit'); closeModal('modalSettings'); true`, true);
      } catch (err) {
        console.error('SMOKE_FAIL ' + err.stack);
        failed = true;
      }
      console.log(failed ? 'SMOKE_FAIL' : 'SMOKE_OK');
      try {
        if (hotkeys) hotkeys.unregisterAll();
      } catch (_) {}
      try {
        fs.rmSync(app.getPath('userData'), { recursive: true, force: true });
      } catch (_) {}
      app.exit(failed ? 1 : 0);
    }, 3000);
  }
});

function buildSmokeWav(sampleRate, seconds, frequency) {
  const samples = Math.floor(sampleRate * seconds);
  const data = Buffer.alloc(samples);
  for (let i = 0; i < samples; i += 1) {
    data[i] = Math.round(127 + 35 * Math.sin((2 * Math.PI * frequency * i) / sampleRate));
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function seedSmokeProfile(profileDir) {
  fs.rmSync(profileDir, { recursive: true, force: true });
  const soundsDir = path.join(profileDir, 'sounds');
  fs.mkdirSync(soundsDir, { recursive: true });
  fs.writeFileSync(path.join(soundsDir, 'tes.wav'), buildSmokeWav(8000, 3.5, 440));
  const slot = (id, label, hotkey, volume, loop) => ({
    id,
    label,
    file: 'sounds/tes.wav',
    sourceName: 'tes.wav',
    hotkey,
    volume,
    loop
  });
  store.saveConfig(profileDir, {
    version: 1,
    settings: { stopAllHotkey: 'Ctrl+Alt+Space', bgmHotkey: 'Ctrl+F9', columns: 4 },
    slots: [
      slot('aaaaaaaa-bbbb-4fff-8eee-999999999991', 'Hiyaa', 'num1', 1, false),
      slot('aaaaaaaa-bbbb-4fff-8eee-999999999992', 'Drum Roll', 'num2', 0.7, false),
      slot('aaaaaaaa-bbbb-4fff-8eee-999999999993', 'Airhorn Panjang', 'num3', 0.5, true),
      slot('aaaaaaaa-bbbb-4fff-8eee-999999999994', 'Rimshot', 'num4', 0.85, false),
      slot('aaaaaaaa-bbbb-4fff-8eee-999999999995', 'Tawa Studio', 'Ctrl+Shift+T', 0.6, false),
      slot('aaaaaaaa-bbbb-4fff-8eee-999999999996', 'Belum Diset', '', 1, false)
    ],
    bgm: { file: 'sounds/tes.wav', sourceName: 'tes.wav', volume: 0.8, loop: true }
  });
}

const PROBE_SCRIPT = [
  '(async () => {',
  '  const slot = state.config.slots[0];',
  '  const meta = document.querySelector(".card [data-meta]");',
  '  const badge = document.querySelector(".card .hotkey-badge");',
  '  const result = slot ? AudioEngine.play(slot) : { ok: false, reason: "no-slot" };',
  '  if (slot) AudioEngine.stop(slot.id, 0.01);',
  '  const sinkRes = await BgmPlayer.setSink(state.config.settings.bgmDeviceId);',
  '  BgmPlayer.load(state.config.bgm);',
  '  const bgmPlay = await BgmPlayer.play();',
  '  await new Promise((resolve) => setTimeout(resolve, 300));',
  '  const bgmState = BgmPlayer.state();',
  '  BgmPlayer.pause();',
  '  return {',
  '    ready: !!window.__sbReady,',
  '    slots: state.config.slots.length,',
  '    meta: meta ? meta.textContent : null,',
  '    badge: badge ? badge.textContent : null,',
  '    chip: document.getElementById("hotkeyChip").textContent,',
  '    meterWidth: Math.round(document.querySelector(".meter").getBoundingClientRect().width),',
  '    meterFlex: getComputedStyle(document.querySelector(".meter")).flex,',
  '    layout: ["topbar","brand","meter"].reduce((acc, cls) => { const el = document.querySelector("." + cls); acc[cls] = el ? Math.round(el.getBoundingClientRect().width) : null; return acc; }, {}),',
  '    hotkeys: state.results,',
  '    devices: state.devices.length,',
  '    deviceInfo: state.devices.map((d) => d.deviceId + "|" + d.label),',
  '    bgmSelected: document.getElementById("bgmDevice").value,',
  '    candCount: silentCandidates().length,',
  '    play: result,',
  '    bgm: {',
  '      hasTab: !!document.getElementById("tabBgm"),',
  '      hasPlayer: !!(document.getElementById("bgmPlayer") && document.getElementById("bgmEmpty")),',
  '      file: state.config.bgm.file,',
  '      sink: sinkRes,',
  '      play: bgmPlay,',
  '      playing: bgmState.playing,',
  '      duration: bgmState.duration,',
  '      hotkey: state.results["bgm:toggle"] || null',
  '    }',
  '  };',
  '})()'
].join('\n');

function session_allowAllPermissions() {
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);
}


app.on('will-quit', () => {
  if (hotkeys) hotkeys.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
