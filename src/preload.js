'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  importSounds: () => ipcRenderer.invoke('sounds:import'),
  pickBgm: () => ipcRenderer.invoke('bgm:pick'),
  setBgmOverlay: (status, description) =>
    ipcRenderer.invoke('bgm:set-overlay', { status, description }),
  getBgmOverlay: () => ipcRenderer.invoke('bgm:get-overlay'),
  syncHotkeys: (entries) => ipcRenderer.invoke('hotkeys:sync', entries),
  suspendHotkeys: (value) => ipcRenderer.invoke('hotkeys:suspend', value),
  showInFolder: (relPath) => ipcRenderer.invoke('app:showInFolder', relPath),
  openDataDir: () => ipcRenderer.invoke('app:openDataDir'),
  mediaUrl: (relPath) =>
    'media://sound/' +
    String(relPath)
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/'),
  onTrigger: (callback) => {
    ipcRenderer.on('hotkey:trigger', (_event, payload) => callback(payload));
  },
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggle-max'),
    close: () => ipcRenderer.send('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
    onMaxState: (callback) => {
      ipcRenderer.on('win:max-state', (_event, value) => callback(!!value));
    }
  }
});
