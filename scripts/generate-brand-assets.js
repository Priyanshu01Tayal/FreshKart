/**
 * Generates valid PNG brand assets for FreshKart Mobile App
 * using pure Node.js built-in zlib & buffer modules.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crc]);
}

function createPng(width, height, isSplash = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 2; // Color type: 2 (RGB)
  ihdrData[10] = 0; // Compression: 0
  ihdrData[11] = 0; // Filter: 0
  ihdrData[12] = 0; // Interlace: 0

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data: scanline filter byte (0) + RGB bytes
  // Background: #168447 -> R: 22, G: 132, B: 71
  // Center logo: White (#FFFFFF)
  const bgR = 0x16;
  const bgG = 0x84;
  const bgB = 0x47;

  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const iconRadius = Math.min(width, height) * 0.22;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // No filter

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      const dx = x - cx;
      const dy = y - cy;

      // Draw rounded basket / shopping bag silhouette
      const inBagBody = Math.abs(dx) < iconRadius * 0.8 && dy > -iconRadius * 0.2 && dy < iconRadius * 0.8;
      const inBagHandle = (dx * dx + (dy + iconRadius * 0.2) * (dy + iconRadius * 0.2) < iconRadius * iconRadius * 0.35) &&
                          (dx * dx + (dy + iconRadius * 0.2) * (dy + iconRadius * 0.2) > iconRadius * iconRadius * 0.2) &&
                          dy < -iconRadius * 0.2;

      if (inBagBody || inBagHandle) {
        // White logo
        rawData[pxOffset] = 0xff;
        rawData[pxOffset + 1] = 0xff;
        rawData[pxOffset + 2] = 0xff;
      } else {
        // Brand Green
        rawData[pxOffset] = bgR;
        rawData[pxOffset + 1] = bgG;
        rawData[pxOffset + 2] = bgB;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const assetsDir = path.join(__dirname, '..', 'apps', 'customer-mobile', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate icon.png (512x512)
fs.writeFileSync(path.join(assetsDir, 'icon.png'), createPng(512, 512));
// Generate adaptive-icon.png (512x512)
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), createPng(512, 512));
// Generate splash.png (1024x1024)
fs.writeFileSync(path.join(assetsDir, 'splash.png'), createPng(1024, 1024, true));

console.log('FreshKart brand assets generated successfully in apps/customer-mobile/assets/');
