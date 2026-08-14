import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// 生成 16x16 托盘图标：琥珀色六边形环 + 中心点（海克斯风格），透明背景
const SIZE = 16;
const AMBER: [number, number, number, number] = [255, 215, 110, 255];

function hexDistance(dx: number, dy: number): number {
  // 尖顶六边形的距离近似
  return Math.max(Math.abs(dx) * 0.8660254 + Math.abs(dy) * 0.5, Math.abs(dy));
}

function pixelColor(x: number, y: number): [number, number, number, number] {
  const dx = x - (SIZE - 1) / 2;
  const dy = y - (SIZE - 1) / 2;
  const d = hexDistance(dx, dy);
  if (d >= 5.2 && d <= 6.8) return AMBER; // 六边形环
  if (d <= 2.2) return AMBER; // 中心点
  return [0, 0, 0, 0];
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // 位深
ihdr[9] = 6; // RGBA
// 压缩/滤波/隔行均为 0

const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  raw[rowStart] = 0; // 滤波器：None
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b, a] = pixelColor(x, y);
    const offset = rowStart + 1 + x * 4;
    raw[offset] = r;
    raw[offset + 1] = g;
    raw[offset + 2] = b;
    raw[offset + 3] = a;
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = join(import.meta.dirname, '..', '..', 'apps', 'desktop', 'resources');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'tray.png');
writeFileSync(outPath, png);
console.log('tray icon written: ' + outPath + ' (' + png.length + ' bytes)');
