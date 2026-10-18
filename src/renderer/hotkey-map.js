'use strict';

const HotkeyMap = (function () {
  const CODE_TO_KEY = {
    Space: 'Space',
    Tab: 'Tab',
    Enter: 'Enter',
    NumpadEnter: 'Enter',
    Escape: 'Escape',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    CapsLock: 'Capslock',
    NumLock: 'Numlock',
    ScrollLock: 'Scrolllock',
    PrintScreen: 'PrintScreen',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
    NumpadAdd: 'numadd',
    NumpadSubtract: 'numsub',
    NumpadMultiply: 'nummult',
    NumpadDivide: 'numdiv',
    NumpadDecimal: 'numdec',
    AudioVolumeUp: 'VolumeUp',
    AudioVolumeDown: 'VolumeDown',
    AudioVolumeMute: 'VolumeMute',
    MediaTrackNext: 'MediaNextTrack',
    MediaTrackPrevious: 'MediaPreviousTrack',
    MediaStop: 'MediaStop',
    MediaPlayPause: 'MediaPlayPause'
  };

  const BARE_ALLOWED = /^(num[0-9]|numdec|numadd|numsub|nummult|numdiv|F([1-9]|1[0-9]|2[0-4])|VolumeUp|VolumeDown|VolumeMute|MediaNextTrack|MediaPreviousTrack|MediaStop|MediaPlayPause|PrintScreen)$/;

  const DISPLAY = {
    Super: 'Win',
    Ctrl: 'Ctrl',
    Control: 'Ctrl',
    Shift: 'Shift',
    Alt: 'Alt',
    Space: 'Space',
    Up: 'Up',
    Down: 'Down',
    Left: 'Left',
    Right: 'Right',
    Capslock: 'Caps Lock',
    Numlock: 'Num Lock',
    Scrolllock: 'Scroll Lock',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
    numadd: 'Num +',
    numsub: 'Num -',
    nummult: 'Num *',
    numdiv: 'Num /',
    numdec: 'Num .',
    VolumeUp: 'Volume +',
    VolumeDown: 'Volume -',
    VolumeMute: 'Volume Mute',
    MediaNextTrack: 'Media Next',
    MediaPreviousTrack: 'Media Prev',
    MediaStop: 'Media Stop',
    MediaPlayPause: 'Media Play'
  };

  function keyFromEvent(event) {
    const code = event && event.code;
    if (!code) return null;
    if (Object.prototype.hasOwnProperty.call(CODE_TO_KEY, code)) return CODE_TO_KEY[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}`;
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
    return null;
  }

  function modifiersFromEvent(event) {
    const mods = [];
    if (event.ctrlKey) mods.push('Ctrl');
    if (event.altKey) mods.push('Alt');
    if (event.shiftKey) mods.push('Shift');
    if (event.metaKey) mods.push('Super');
    return mods;
  }

  function eventToAccelerator(event) {
    const key = keyFromEvent(event);
    if (!key) return null;
    return [...modifiersFromEvent(event), key].join('+');
  }

  function validate(accelerator) {
    if (typeof accelerator !== 'string' || !accelerator.trim()) {
      return { ok: false, reason: 'empty', message: 'Hotkey kosong' };
    }
    const parts = accelerator.split('+').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 1) return { ok: false, reason: 'invalid', message: 'Hotkey tidak valid' };

    const key = parts[parts.length - 1];
    const mods = parts.slice(0, -1);
    const validMods = new Set(['Ctrl', 'Alt', 'Shift', 'Super']);
    if (validMods.has(key)) {
      return { ok: false, reason: 'invalid', message: 'Hotkey tidak valid' };
    }
    for (const mod of mods) {
      if (!validMods.has(mod)) return { ok: false, reason: 'invalid', message: 'Hotkey tidak valid' };
    }
    if (mods.length === 0 && !BARE_ALLOWED.test(key)) {
      return {
        ok: false,
        reason: 'needs-modifier',
        message: 'Tombol ini butuh modifier (Ctrl/Alt/Shift) supaya tidak mengganggu mengetik. Pakai Numpad atau F-key untuk hotkey tanpa modifier.'
      };
    }
    return { ok: true };
  }

  function format(accelerator) {
    if (!accelerator) return '';
    return accelerator
      .split('+')
      .map((part) => {
        if (DISPLAY[part]) return DISPLAY[part];
        if (/^num[0-9]$/.test(part)) return `Num ${part.slice(3)}`;
        if (/^F\d+$/.test(part)) return part;
        if (part.length === 1) return part.toUpperCase();
        return part;
      })
      .join(' + ');
  }

  return { CODE_TO_KEY, keyFromEvent, eventToAccelerator, validate, format };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HotkeyMap;
}
