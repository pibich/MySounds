'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function coverage(distance) {
  return clamp01(0.5 - distance);
}

function roundedBoxCoverage(x, y, half, radius) {
  const qx = Math.abs(x) - (half - radius);
  const qy = Math.abs(y) - (half - radius);
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const d = Math.hypot(outsideX, outsideY) + Math.min(Math.max(qx, qy), 0) - radius;
  return coverage(d);
}

function circleCoverage(x, y, radius) {
  return coverage(Math.hypot(x, y) - radius);
}

function triangleCoverage(px, py, vertices) {
  let sign = 0;
  let minDist = Infinity;
  for (let i = 0; i < 3; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % 3];
    const cross = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    const edge = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dist = Math.abs(cross) / edge;
    if (dist < minDist) minDist = dist;
    const s = cross >= 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return 0;
  }
  return coverage(-minDist);
}

function blend(pixels, index, r, g, b, a) {
  if (a <= 0) return;
  const dr = pixels[index];
  const dg = pixels[index + 1];
  const db = pixels[index + 2];
  const da = pixels[index + 3] / 255;
  const sa = a;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;
  const outR = r * sa + dr * da * (1 - sa);
  const outG = g * sa + dg * da * (1 - sa);
  const outB = b * sa + db * da * (1 - sa);
  pixels[index] = Math.round(outR / outA);
  pixels[index + 1] = Math.round(outG / outA);
  pixels[index + 2] = Math.round(outB / outA);
  pixels[index + 3] = Math.round(outA * 255);
}

function lerpColor(from, to, t) {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t)
  ];
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = size >= 64 ? 4 : 2;
  const step = 1 / samples;
  const half = size * 0.44;
  const radius = size * 0.2;
  const circleRadius = size * 0.31;
  const triangle = [
    [size * 0.115, 0],
    [-size * 0.085, -size * 0.16],
    [-size * 0.085, size * 0.16]
  ];

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let boxA = 0;
      let circleA = 0;
      let triA = 0;
      let boxR = 0;
      let boxG = 0;
      let boxB = 0;
      let cirR = 0;
      let cirG = 0;
      let cirB = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;
          const cx = x - size / 2;
          const cy = y - size / 2;

          const box = roundedBoxCoverage(cx, cy, half, radius);
          if (box > 0) {
            const bg = lerpColor([27, 35, 48], [13, 17, 23], y / size);
            boxA += box;
            boxR += bg[0] * box;
            boxG += bg[1] * box;
            boxB += bg[2] * box;
          }

          const circle = circleCoverage(cx, cy, circleRadius);
          if (circle > 0) {
            const grad = lerpColor([91, 140, 255], [34, 193, 166], clamp01((x + y) / (2 * size)));
            circleA += circle;
            cirR += grad[0] * circle;
            cirG += grad[1] * circle;
            cirB += grad[2] * circle;
          }

          const tri = triangleCoverage(cx, cy, triangle);
          if (tri > 0) triA += tri;
        }
      }

      const total = samples * samples;
      const base = (py * size + px) * 4;
      const boxAlpha = boxA / total;
      const circleAlpha = circleA / total;
      const triAlpha = triA / total;

      if (boxAlpha > 0) {
        blend(pixels, base, boxR / boxA, boxG / boxA, boxB / boxA, boxAlpha);
      }
      if (circleAlpha > 0) {
        blend(pixels, base, cirR / circleA, cirG / circleA, cirB / circleA, circleAlpha);
      }
      if (triAlpha > 0) {
        blend(pixels, base, 255, 255, 255, triAlpha);
      }
    }
  }
  return pixels;
}

function renderBadge(size, colorType) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 4;
  const step = 1 / samples;
  const cx0 = size / 2;
  const cy0 = size / 2;
  const outerRadius = size * 0.44;
  const innerRadius = size * 0.35;

  const palettes = {
    green: {
      from: [74, 222, 128],
      to: [22, 163, 74],
      border: [11, 18, 26]
    },
    yellow: {
      from: [253, 224, 71],
      to: [217, 119, 6],
      border: [11, 18, 26]
    }
  };
  const theme = palettes[colorType];

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let outerA = 0;
      let innerA = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;
          const dist = Math.hypot(x - cx0, y - cy0);

          const covOut = coverage(dist - outerRadius);
          if (covOut > 0) outerA += covOut;

          const covIn = coverage(dist - innerRadius);
          if (covIn > 0) innerA += covIn;
        }
      }

      const total = samples * samples;
      const aOut = outerA / total;
      const aIn = innerA / total;
      const base = (py * size + px) * 4;

      if (aOut > 0) {
        blend(pixels, base, theme.border[0], theme.border[1], theme.border[2], aOut);
      }
      if (aIn > 0) {
        const t = clamp01(py / size);
        const col = lerpColor(theme.from, theme.to, t);
        blend(pixels, base, col[0], col[1], col[2], aIn);
      }
    }
  }
  return pixels;
}

function pngToIco(pngList) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngList.length, 4);

  const entries = [];
  let offset = 6 + pngList.length * 16;
  for (const entry of pngList) {
    const dirEntry = Buffer.alloc(16);
    dirEntry[0] = entry.size >= 256 ? 0 : entry.size;
    dirEntry[1] = entry.size >= 256 ? 0 : entry.size;
    dirEntry[2] = 0;
    dirEntry[3] = 0;
    dirEntry.writeUInt16LE(1, 4);
    dirEntry.writeUInt16LE(32, 6);
    dirEntry.writeUInt32LE(entry.data.length, 8);
    dirEntry.writeUInt32LE(offset, 12);
    offset += entry.data.length;
    entries.push(dirEntry);
  }
  return Buffer.concat([header, ...entries, ...pngList.map((entry) => entry.data)]);
}

function main() {
  const buildDir = path.join(ROOT, 'build');
  const assetsDir = path.join(ROOT, 'src', 'assets');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  const sizes = [16, 32, 48, 64, 256];
  const pngList = sizes.map((size) => ({ size, data: encodePng(size, renderIcon(size)) }));

  const iconPath = path.join(buildDir, 'icon.ico');
  fs.writeFileSync(iconPath, pngToIco(pngList));

  const appPng = pngList.find((entry) => entry.size === 256).data;
  fs.writeFileSync(path.join(assetsDir, 'app.png'), appPng);

  const badgeSizes = [16, 24, 32];
  for (const color of ['green', 'yellow']) {
    const badgePngs = badgeSizes.map((size) => ({ size, data: encodePng(size, renderBadge(size, color)) }));
    const icoPath = path.join(assetsDir, `badge-${color}.ico`);
    fs.writeFileSync(icoPath, pngToIco(badgePngs));
    const pngPath = path.join(assetsDir, `badge-${color}.png`);
    fs.writeFileSync(pngPath, badgePngs.find((e) => e.size === 32).data);
    console.log(`OK ${icoPath}`);
    console.log(`OK ${pngPath}`);
  }

  console.log(`OK ${iconPath}`);
  console.log(`OK ${path.join(assetsDir, 'app.png')}`);
}

main();
