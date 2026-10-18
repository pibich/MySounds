'use strict';

const { globalShortcut } = require('electron');

class HotkeyManager {
  constructor(onTrigger) {
    this.onTrigger = onTrigger;
    this.entries = [];
    this.suspended = false;
  }

  sync(entries) {
    this.entries = Array.isArray(entries) ? entries.filter((e) => e && e.key) : [];
    const results = {};
    globalShortcut.unregisterAll();

    const used = new Set();
    for (const entry of this.entries) {
      const accelerator = typeof entry.accelerator === 'string' ? entry.accelerator.trim() : '';
      if (!accelerator) {
        results[entry.key] = { ok: false, reason: 'empty' };
        continue;
      }
      if (used.has(accelerator)) {
        results[entry.key] = { ok: false, reason: 'conflict' };
        continue;
      }
      used.add(accelerator);

      let ok = false;
      try {
        ok = globalShortcut.register(accelerator, () => {
          if (this.suspended) return;
          this.onTrigger(entry.key);
        });
      } catch (_) {
        ok = false;
      }
      results[entry.key] = ok
        ? { ok: true }
        : { ok: false, reason: globalShortcut.isRegistered(accelerator) ? 'conflict' : 'failed' };
    }
    return results;
  }

  setSuspended(value) {
    const next = !!value;
    if (next === this.suspended) return;
    this.suspended = next;
    if (next) {
      this.snapshot = this.entries.map((entry) => ({ ...entry }));
      globalShortcut.unregisterAll();
    } else {
      const entries = this.snapshot || [];
      this.snapshot = null;
      this.sync(entries);
    }
  }

  unregisterAll() {
    this.suspended = false;
    this.snapshot = null;
    globalShortcut.unregisterAll();
  }
}

module.exports = { HotkeyManager };
