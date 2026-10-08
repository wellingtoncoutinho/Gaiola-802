import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create public/icon.svg
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#1B2A4A" />
  <!-- Wave / drying line subtle curve -->
  <path d="M 64 160 Q 256 195 448 160" stroke="#FEF9C3" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.9" />
  <!-- Two pegs -->
  <rect x="180" y="148" width="16" height="42" rx="6" fill="#FDE68A" />
  <rect x="316" y="148" width="16" height="42" rx="6" fill="#FDE68A" />
  <!-- Washing machine body -->
  <rect x="140" y="220" width="232" height="232" rx="36" fill="#FFFFFF" fill-opacity="0.08" stroke="#FFFFFF" stroke-width="8" />
  <!-- Drum circle -->
  <circle cx="256" cy="345" r="66" fill="none" stroke="#FEF9C3" stroke-width="10" />
  <circle cx="256" cy="345" r="42" fill="#38BDF8" fill-opacity="0.25" stroke="#38BDF8" stroke-width="6" stroke-dasharray="14 10" />
  <!-- Machine controls -->
  <circle cx="180" cy="252" r="10" fill="#FEF9C3" />
  <line x1="220" y1="252" x2="330" y2="252" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-opacity="0.4" />
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');
console.log('Created icon.svg');

// 2. Generate uncompressed PNG files using pure node zlib
function createPng(size, colorNavy = [27, 42, 74, 255], colorAccent = [254, 249, 195, 255]) {
  const width = size;
  const height = size;

  // Raw uncompressed RGBA pixel buffer
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Birdcage icon geometry
      const nx = (x - center) / (size * 0.45);
      const ny = (y - center) / (size * 0.45);

      // Chain
      const inChain = Math.abs(nx) < 0.05 && ny < -0.4 && ny > -0.9;
      // Dome and cage outline
      const inDome = ny >= -0.4 && ny <= 0.65 && Math.abs(nx) <= (ny < 0 ? (0.75 - Math.abs(ny + 0.4) * 0.5) : (0.75 - (ny - 0) * 0.15));
      const inDomeBorder = inDome && (
        Math.abs(Math.abs(nx) - (ny < 0 ? (0.75 - Math.abs(ny + 0.4) * 0.5) : (0.75 - (ny - 0) * 0.15))) < 0.08 ||
        Math.abs(ny - 0.65) < 0.07 // Base
      );
      // Bars
      const inCrossbar1 = Math.abs(ny - (-0.05)) < 0.04 && Math.abs(nx) < 0.68;
      const inCrossbar2 = Math.abs(ny - 0.3) < 0.04 && Math.abs(nx) < 0.62;
      const inVertBars = (Math.abs(nx) < 0.04 || Math.abs(Math.abs(nx) - 0.28) < 0.04 || Math.abs(Math.abs(nx) - 0.5) < 0.04) && ny > -0.35 && ny < 0.65;
      // Birds
      const inBird1 = Math.hypot(nx - 0.3, ny - (-0.12)) < 0.1;
      const inBird2 = Math.hypot(nx - (-0.2), ny - 0.22) < 0.11;

      if (inChain || inDomeBorder || inCrossbar1 || inCrossbar2 || inVertBars || inBird1 || inBird2) {
        rawData[offset++] = colorAccent[0];
        rawData[offset++] = colorAccent[1];
        rawData[offset++] = colorAccent[2];
        rawData[offset++] = colorAccent[3];
      } else {
        rawData[offset++] = colorNavy[0];
        rawData[offset++] = colorNavy[1];
        rawData[offset++] = colorNavy[2];
        rawData[offset++] = colorNavy[3];
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit depth
  ihdrData[9] = 6; // color type 6: RGBA
  ihdrData[10] = 0; // compression method 0
  ihdrData[11] = 0; // filter method 0
  ihdrData[12] = 0; // interlace method 0

  function makeChunk(typeStr, data) {
    const typeBuf = Buffer.from(typeStr, 'ascii');
    const length = data.length;
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(length, 0);

    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Simple CRC32 implementation
function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180));
console.log('PNG icons created successfully');
