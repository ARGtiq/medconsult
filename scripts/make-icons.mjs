import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEAL = [13, 107, 92, 255];
const CREAM = [244, 241, 234, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, t, data, crc]);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const r = Math.round(size * 0.18);
  const letterW = Math.round(size * 0.12);
  const letterH = Math.round(size * 0.46);
  const letterY = Math.round(size * 0.27);
  const mLeft = Math.round(size * 0.22);
  const mPeak = Math.round(size * 0.42);
  const cLeft = Math.round(size * 0.56);
  const cRight = Math.round(size * 0.78);

  function setPx(x, y, rgba) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = rgba[0];
    pixels[i + 1] = rgba[1];
    pixels[i + 2] = rgba[2];
    pixels[i + 3] = rgba[3];
  }

  function inRoundRect(x, y) {
    const ix = Math.min(x, size - 1 - x);
    const iy = Math.min(y, size - 1 - y);
    if (ix >= r || iy >= r) return true;
    const dx = r - ix;
    const dy = r - iy;
    return dx * dx + dy * dy <= r * r;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPx(x, y, inRoundRect(x, y) ? TEAL : [0, 0, 0, 0]);
    }
  }

  function fillRect(x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPx(x, y, CREAM);
  }

  fillRect(mLeft, letterY, mLeft + letterW, letterY + letterH);
  fillRect(mPeak, letterY, mPeak + letterW, letterY + letterH);
  fillRect(mLeft, letterY, mPeak + letterW, letterY + letterW);
  for (let i = 0; i < letterW; i++) {
    fillRect(mLeft + i, letterY, mLeft + letterW + i, letterY + letterW);
    fillRect(mPeak - i, letterY, mPeak + letterW - i, letterY + letterW);
  }

  fillRect(cLeft, letterY, cRight, letterY + letterW);
  fillRect(cLeft, letterY + letterH - letterW, cRight, letterY + letterH);
  fillRect(cLeft, letterY, cLeft + letterW, letterY + letterH);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "icon-192.png"), drawIcon(192));
writeFileSync(join(dir, "icon-512.png"), drawIcon(512));
writeFileSync(join(dir, "apple-touch-icon.png"), drawIcon(180));
console.log("icons written");
