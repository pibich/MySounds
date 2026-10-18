# MySounds

Aplikasi desktop soundboard dan background music (BGM) player offline untuk Windows yang dirancang khusus untuk streamer dan kreator konten (OBS Studio / Discord / Gaming).

---

## 🎯 Fungsi Utama

- **Soundboard SFX**:
  - Slot suara tak terbatas dengan dukungan format WAV, MP3, OGG, FLAC, M4A/AAC.
  - Pengaturan volume, opsi loop, dan mode retrigger per-slot.
  - Grid fleksibel (2 hingga 8 kolom) dengan kartu yang dapat digeser (drag-and-drop) dan fitur Lock Mode.
  - Fitur **Instant Search** (`Ctrl+F`) untuk mencari suara atau hotkey dengan cepat.
- **Dedicated BGM Player**:
  - Pemutar background music independen (play/pause, seek, volume, loop).
  - **Dual Output Routing**: Output audio BGM dapat diarahkan ke perangkat audio terpisah (misalnya VB-CABLE atau HDMI monitor) agar tidak terdengar di headphone streamer namun tetap tertangkap oleh OBS.
  - Tombol uji coba perangkat (*Tes Device*) untuk memastikan isolasi audio aman.
- **Global Hotkeys**:
  - Mendukung tombol Numpad (Num 0–9, operator), tombol fungsi (F1–F24), dan kombinasi modifier (`Ctrl`, `Alt`, `Shift`).
  - Hotkey global untuk memicu slot, menghentikan semua suara (*Stop All*), serta memutar/menjeda BGM (`Ctrl+F9` default).
  - Hotkey tetap aktif di latar belakang (background) meskipun aplikasi diminimize ke System Tray.
- **Integrasi OBS Studio**:
  - Kompatibel penuh dengan fitur OBS 28+ *Application Audio Capture*, memungkinkan seluruh audio aplikasi ditangkap secara rapi tanpa perlu menangkap Desktop Audio (musik pribadi seperti Spotify tidak bocor ke stream).
  - Dialog panduan konfigurasi OBS bawaan.
- **100% Offline & Portabel**:
  - File suara otomatis disalin ke direktori data lokal (`%APPDATA%\MySounds\sounds\`).
  - Tidak memerlukan koneksi internet untuk beroperasi.

---

## 🛠️ Tech Stack

- **Runtime & Desktop Framework**: [Electron 33](https://www.electronjs.org/) & [Node.js](https://nodejs.org/)
- **Audio Engine**:
  - **Web Audio API** (`AudioContext`, `GainNode`, `AnalyserNode`, `setSinkId`): Pemrosesan SFX soundboard dengan latensi ultra-rendah dan visualisasi audio level meter.
  - **HTMLMediaElement** (`<audio>`, `setSinkId`): Pemutaran BGM streaming dengan kapabilitas buffer dan seeking.
- **Frontend / Renderer**:
  - Vanilla JavaScript (ES6+), HTML5, CSS3 (Modern Dark Theme, Responsive CSS Grid, CSS Variables).
  - Context Isolation & Preload IPC Bridge yang aman.
- **Packaging & Build Tooling**:
  - [electron-builder](https://www.electron.build/) (Target: NSIS Installer x64 & Portable Executable).
  - Native Node Test Runner (`node --test`).

---

## 🚀 Menjalankan Project

### Prasyarat
- Node.js (v18+ direkomendasikan)
- npm

### Menjalankan Development
```bash
# Instal dependensi
npm install

# Jalankan aplikasi Electron
npm start
```

### Testing & Quality Checks
```bash
# Jalankan unit tests
npm test

# Jalankan smoke test end-to-end
npm run smoke
```

### Build Distribution
```bash
# Generate icon & asset grafis
npm run assets

# Build installer dan portable executable (.exe) ke folder dist/
npm run dist
```

---

## 📂 Struktur Project

```text
MySounds/
├── build/                # Aset build & generator ikon aplikasi
├── src/
│   ├── assets/           # Ikon aplikasi (app.png)
│   ├── main/             # Electron Main Process (lifecycle, window, tray, store, hotkeys, media protocol)
│   │   ├── hotkeys.js
│   │   ├── main.js
│   │   ├── media-protocol.js
│   │   └── store.js
│   ├── preload.js        # Context bridge aman antara Main dan Renderer
│   └── renderer/         # Electron Renderer Process (UI, AudioEngine, BgmPlayer, HotkeyMap)
│       ├── app.js
│       ├── audio.js
│       ├── bgm.js
│       ├── hotkey-map.js
│       ├── index.html
│       └── styles.css
├── test/                 # Unit tests (hotkey-map, store)
├── package.json          # Manifest dependensi & konfigurasi builder
├── PRD.md                # Product Requirements Document
└── README.md             # Dokumentasi ringkas project
```

---

## 📄 Lisensi
[MIT](LICENSE)
