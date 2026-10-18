import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HotkeyMap = require('../src/renderer/hotkey-map.js');

function ev(code, mods = {}) {
  return {
    code,
    ctrlKey: !!mods.ctrl,
    altKey: !!mods.alt,
    shiftKey: !!mods.shift,
    metaKey: !!mods.meta
  };
}

test('numpad digit menjadi accelerator numX', () => {
  assert.equal(HotkeyMap.eventToAccelerator(ev('Numpad1')), 'num1');
  assert.equal(HotkeyMap.eventToAccelerator(ev('Numpad0')), 'num0');
  assert.equal(HotkeyMap.eventToAccelerator(ev('NumpadEnter')), 'Enter');
});

test('digit utama dan huruf', () => {
  assert.equal(HotkeyMap.eventToAccelerator(ev('Digit1', { ctrl: true })), 'Ctrl+1');
  assert.equal(HotkeyMap.eventToAccelerator(ev('KeyA', { alt: true, shift: true })), 'Alt+Shift+A');
  assert.equal(HotkeyMap.eventToAccelerator(ev('KeyZ', { ctrl: true, meta: true })), 'Ctrl+Super+Z');
});

test('kunci fungsi dan navigasi', () => {
  assert.equal(HotkeyMap.eventToAccelerator(ev('F5')), 'F5');
  assert.equal(HotkeyMap.eventToAccelerator(ev('F12', { ctrl: true, alt: true })), 'Ctrl+Alt+F12');
  assert.equal(HotkeyMap.eventToAccelerator(ev('ArrowUp')), 'Up');
  assert.equal(HotkeyMap.eventToAccelerator(ev('PageDown', { shift: true })), 'Shift+PageDown');
  assert.equal(HotkeyMap.eventToAccelerator(ev('Escape')), 'Escape');
  assert.equal(HotkeyMap.eventToAccelerator(ev('Space', { ctrl: true })), 'Ctrl+Space');
});

test('operator numpad dan media', () => {
  assert.equal(HotkeyMap.eventToAccelerator(ev('NumpadAdd')), 'numadd');
  assert.equal(HotkeyMap.eventToAccelerator(ev('NumpadSubtract')), 'numsub');
  assert.equal(HotkeyMap.eventToAccelerator(ev('NumpadDecimal')), 'numdec');
  assert.equal(HotkeyMap.eventToAccelerator(ev('MediaPlayPause')), 'MediaPlayPause');
  assert.equal(HotkeyMap.eventToAccelerator(ev('AudioVolumeUp')), 'VolumeUp');
});

test('punctuasi memakai kode fisik tombol', () => {
  assert.equal(HotkeyMap.eventToAccelerator(ev('BracketLeft')), '[');
  assert.equal(HotkeyMap.eventToAccelerator(ev('BracketLeft', { ctrl: true, shift: true })), 'Ctrl+Shift+[');
  assert.equal(HotkeyMap.eventToAccelerator(ev('Minus')), '-');
  assert.equal(HotkeyMap.eventToAccelerator(ev('Semicolon', { alt: true })), 'Alt+;');
});

test('hanya modifier atau kode tak dikenal menghasilkan null', () => {
  assert.equal(HotkeyMap.eventToAccelerator(ev('ControlLeft')), null);
  assert.equal(HotkeyMap.eventToAccelerator(ev('ShiftLeft', { shift: true })), null);
  assert.equal(HotkeyMap.eventToAccelerator(ev('IntlBackslash')), null);
  assert.equal(HotkeyMap.eventToAccelerator(ev(undefined)), null);
});

test('validate: numpad dan F-key boleh tanpa modifier', () => {
  assert.equal(HotkeyMap.validate('num1').ok, true);
  assert.equal(HotkeyMap.validate('numdec').ok, true);
  assert.equal(HotkeyMap.validate('F5').ok, true);
  assert.equal(HotkeyMap.validate('MediaPlayPause').ok, true);
  assert.equal(HotkeyMap.validate('Ctrl+Alt+Space').ok, true);
  assert.equal(HotkeyMap.validate('Ctrl+A').ok, true);
  assert.equal(HotkeyMap.validate('Shift+[').ok, true);
});

test('validate: huruf/digit utama tanpa modifier ditolak', () => {
  assert.equal(HotkeyMap.validate('A').ok, false);
  assert.equal(HotkeyMap.validate('A').reason, 'needs-modifier');
  assert.equal(HotkeyMap.validate('1').reason, 'needs-modifier');
  assert.equal(HotkeyMap.validate('Space').reason, 'needs-modifier');
  assert.equal(HotkeyMap.validate('Enter').reason, 'needs-modifier');
  assert.equal(HotkeyMap.validate('').reason, 'empty');
  assert.equal(HotkeyMap.validate('Ctrl+').ok, false);
  assert.equal(HotkeyMap.validate('Foo+Bar').ok, false);
});

test('format tampilan ramah', () => {
  assert.equal(HotkeyMap.format('Ctrl+Alt+Space'), 'Ctrl + Alt + Space');
  assert.equal(HotkeyMap.format('num1'), 'Num 1');
  assert.equal(HotkeyMap.format('Super+F9'), 'Win + F9');
  assert.equal(HotkeyMap.format('numadd'), 'Num +');
  assert.equal(HotkeyMap.format(''), '');
});
