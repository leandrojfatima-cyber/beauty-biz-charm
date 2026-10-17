const fs = require('fs');
const zlib = require('zlib');

function createPng(width, height, r, g, b) {
  // Construct a minimal uncompressed RGBA PNG
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      // Border / emblem effect: gold frame or gold diamond
      const dx = Math.abs(x - width / 2);
      const dy = Math.abs(y - height / 2);
      const isCenter = dx + dy < width * 0.28;
      const isRing = Math.abs(dx + dy - width * 0.35) < width * 0.02;

      if (isCenter || isRing) {
        rawData[pixelOffset] = 212;     // R (Gold #D4AF37)
        rawData[pixelOffset + 1] = 175; // G
        rawData[pixelOffset + 2] = 55;  // B
        rawData[pixelOffset + 3] = 255; // A
      } else {
        rawData[pixelOffset] = r;       // Dark Navy #0F172A
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = 255;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate PWA icons in /public
fs.writeFileSync('public/pwa-192x192.png', createPng(192, 192, 15, 23, 42));
fs.writeFileSync('public/pwa-512x512.png', createPng(512, 512, 15, 23, 42));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPng(512, 512, 15, 23, 42));
fs.writeFileSync('public/apple-touch-icon.png', createPng(180, 180, 15, 23, 42));
console.log('PWA PNG assets successfully generated in public/ directory.');
