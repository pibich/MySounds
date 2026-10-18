'use strict';

const AudioEngine = (function () {
  let ctx = null;
  let master = null;
  let analyser = null;
  let levelData = null;
  let retrigger = true;

  const buffers = new Map();
  const voices = new Map();

  function ensure() {
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: 'interactive' });
      master = ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      levelData = new Uint8Array(analyser.fftSize);
      master.connect(analyser);
      analyser.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function configure(options) {
    if (options && typeof options.retrigger === 'boolean') retrigger = options.retrigger;
  }

  async function setSink(deviceId) {
    ensure();
    if (typeof ctx.setSinkId !== 'function') {
      return { ok: false, reason: 'unsupported', message: 'Electron/build ini tidak mendukung pemilihan device output.' };
    }
    try {
      await ctx.setSinkId(deviceId || 'default');
      if (ctx.state === 'suspended') await ctx.resume();
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: 'failed', message: err.message || String(err) };
    }
  }

  async function load(slot) {
    ensure();
    const current = buffers.get(slot.id);
    if (current && current.status === 'ready') return current;
    buffers.set(slot.id, { status: 'loading' });
    try {
      const response = await fetch(window.api.mediaUrl(slot.file));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(data);
      const entry = { status: 'ready', buffer };
      buffers.set(slot.id, entry);
      return entry;
    } catch (err) {
      const entry = { status: 'error', error: err.message || String(err) };
      buffers.set(slot.id, entry);
      return entry;
    }
  }

  function reload(slot) {
    buffers.delete(slot.id);
    stop(slot.id, 0);
    return load(slot);
  }

  function forget(slotId) {
    buffers.delete(slotId);
    stop(slotId, 0);
  }

  function status(slotId) {
    const entry = buffers.get(slotId);
    return entry ? entry.status : 'idle';
  }

  function duration(slotId) {
    const entry = buffers.get(slotId);
    return entry && entry.status === 'ready' ? entry.buffer.duration : null;
  }

  function play(slot) {
    ensure();
    const entry = buffers.get(slot.id);
    if (!entry || entry.status !== 'ready') {
      load(slot);
      return { ok: false, reason: entry && entry.status === 'error' ? 'error' : 'loading' };
    }

    const existing = voices.get(slot.id);
    if (existing && existing.size) {
      if (slot.loop) {
        stop(slot.id, 0);
        return { ok: true, toggled: 'off' };
      }
      if (retrigger) stop(slot.id, 0.02);
    }

    const source = ctx.createBufferSource();
    source.buffer = entry.buffer;
    source.loop = !!slot.loop;
    const gain = ctx.createGain();
    const targetVolume = Number.isFinite(slot.volume) ? Math.max(0, Math.min(1, slot.volume)) : 1;
    gain.gain.value = targetVolume;
    source.connect(gain);
    gain.connect(master);

    const voice = { source, gain };
    if (!voices.has(slot.id)) voices.set(slot.id, new Set());
    voices.get(slot.id).add(voice);

    source.onended = () => {
      const set = voices.get(slot.id);
      if (set) {
        set.delete(voice);
        if (!set.size) voices.delete(slot.id);
      }
      try {
        gain.disconnect();
      } catch (_) {}
    };

    source.start();
    return { ok: true };
  }

  function stop(slotId, fade = 0.03) {
    const set = voices.get(slotId);
    if (!set || !set.size) return;
    for (const voice of [...set]) {
      try {
        const now = ctx.currentTime;
        const current = voice.gain.gain.value;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(current, now);
        voice.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
        voice.source.stop(now + fade + 0.02);
      } catch (_) {
        try {
          voice.source.stop();
        } catch (__) {}
      }
    }
  }

  function stopAll(fade = 0.04) {
    for (const id of [...voices.keys()]) stop(id, fade);
  }

  function setSlotVolume(slotId, volume) {
    const set = voices.get(slotId);
    if (!set) return;
    const value = Math.max(0, Math.min(1, Number(volume) || 0));
    for (const voice of set) {
      try {
        voice.gain.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
      } catch (_) {
        voice.gain.gain.value = value;
      }
    }
  }

  function isPlaying(slotId) {
    const set = voices.get(slotId);
    return !!(set && set.size);
  }

  function level() {
    if (!analyser) return 0;
    analyser.getByteTimeDomainData(levelData);
    let sum = 0;
    for (let i = 0; i < levelData.length; i += 1) {
      const value = (levelData[i] - 128) / 128;
      sum += value * value;
    }
    return Math.sqrt(sum / levelData.length);
  }

  function beep(frequency = 880, durationSec = 0.35, volume = 0.3) {
    ensure();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(master);
    const start = ctx.currentTime;
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.setValueAtTime(volume, start + durationSec - 0.06);
    gain.gain.linearRampToValueAtTime(0.0001, start + durationSec);
    oscillator.start(start);
    oscillator.stop(start + durationSec + 0.03);
  }

  return {
    ensure,
    configure,
    setSink,
    load,
    reload,
    forget,
    status,
    duration,
    play,
    stop,
    stopAll,
    setSlotVolume,
    isPlaying,
    level,
    beep
  };
})();
