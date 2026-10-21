'use strict';

const BgmPlayer = (function () {
  let el = null;

  function ensure() {
    if (!el) el = document.getElementById('bgmAudio');
    return el;
  }

  async function setSink(deviceId) {
    const media = ensure();
    if (!media) return { ok: false, reason: 'no-element', message: 'Elemen audio BGM tidak ditemukan.' };
    if (typeof media.setSinkId !== 'function') {
      return { ok: false, reason: 'unsupported', message: 'Electron/build ini tidak mendukung pemilihan device output.' };
    }
    try {
      await media.setSinkId(deviceId || 'default');
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: 'failed', message: err.message || String(err) };
    }
  }

  function load(track) {
    const media = ensure();
    if (!media) return false;
    if (!track || !track.file) {
      unload();
      return false;
    }
    media.src = window.api.mediaUrl(track.file);
    media.load();
    return true;
  }

  function unload() {
    const media = ensure();
    if (!media) return;
    media.pause();
    media.removeAttribute('src');
    media.load();
  }

  async function play() {
    const media = ensure();
    if (!media || !media.getAttribute('src')) return { ok: false, reason: 'empty' };
    if (media.error) return { ok: false, reason: 'failed', message: 'File audio tidak dapat dimuat atau rusak.' };
    try {
      await media.play();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: 'failed', message: err.message || String(err) };
    }
  }

  function pause() {
    const media = ensure();
    if (media) media.pause();
  }

  async function toggle() {
    const media = ensure();
    if (!media || !media.getAttribute('src')) return { ok: false, reason: 'empty' };
    if (media.paused) return play();
    media.pause();
    return { ok: true, toggled: 'paused' };
  }

  function stop() {
    const media = ensure();
    if (!media) return;
    media.pause();
    try {
      media.currentTime = 0;
    } catch (_) {}
  }

  function seek(seconds) {
    const media = ensure();
    if (!media) return;
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    const value = Math.max(0, Math.min(duration, Number(seconds) || 0));
    try {
      media.currentTime = value;
    } catch (_) {}
  }

  function setVolume(volume) {
    const media = ensure();
    if (media) media.volume = Math.max(0, Math.min(1, Number(volume)));
  }

  function setLoop(loop) {
    const media = ensure();
    if (media) media.loop = !!loop;
  }

  function state() {
    const media = ensure();
    if (!media) return { playing: false, paused: true, currentTime: 0, duration: 0, hasSrc: false };
    return {
      playing: !media.paused && !media.ended && !!media.getAttribute('src'),
      paused: media.paused,
      currentTime: media.currentTime || 0,
      duration: Number.isFinite(media.duration) ? media.duration : 0,
      hasSrc: !!media.getAttribute('src')
    };
  }

  function element() {
    return ensure();
  }

  return {
    ensure,
    element,
    setSink,
    load,
    unload,
    play,
    pause,
    toggle,
    stop,
    seek,
    setVolume,
    setLoop,
    state
  };
})();
