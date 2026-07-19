// Generate simple solid-color PNG icons for the extension.
// No external deps — hand-rolled PNG encoder (RGBA).
// Run: node extension/build-icons.js
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "icons");
mkdirSync(outDir, { recursive: true });

const BG = [255, 255, 255, 0]; // transparent outside the square
const FILL = [79, 70, 229, 255]; // indigo-600
const RING = [199, 210, 254, 255]; // indigo-200

function inSquare(x, y, size, pad) {
  return x >= pad && y >= pad && x < size - pad && y < size - pad;
}

function makeRgba(size) {
  const pad = Math.round(size * 0.12);
  const ring = Math.max(1, Math.round(size * 0.06));
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inSquare(x, y, size, pad)) {
        for (let k = 0; k < 4; k++) buf[i + k] = BG[k];
      } else if (
        x < pad + ring ||
        y < pad + ring ||
        x >= size - pad - ring ||
        y >= size - pad - ring
      ) {
        for (let k = 0; k < 4; k++) buf[i + k] = RING[k];
      } else {
        for (let k = 0; k < 4; k++) buf[i + k] = FILL[k];
      }
    }
  }
  return buf;
}

function pngFromRgba(rgba, width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

for (const size of [16, 48, 128]) {
  const rgba = makeRgba(size);
  const png = pngFromRgba(rgba, size, size);
  writeFileSync(join(outDir, `icon${size}.png`), png);
  console.log(`wrote icons/icon${size}.png (${png.length} bytes)`);
}