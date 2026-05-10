/*
  Small offline QR Code renderer for this game.
  It provides a qrcode npm-like browser surface: window.QRCode.toCanvas(canvas, text, options, callback).
  The implementation intentionally uses a fixed QR version 5, error correction L, byte mode, and mask 0.
  Version 5-L supports invite URLs up to 106 UTF-8 bytes, which is enough for normal GitHub Pages room links.
*/
(() => {
  const VERSION = 5;
  const SIZE = 21 + (VERSION - 1) * 4;
  const DATA_CODEWORDS = 108;
  const ECC_CODEWORDS = 26;
  const TOTAL_CODEWORDS = 134;
  const FORMAT_ECL_L = 1;
  const MASK_PATTERN = 0;

  const gfExp = new Array(512).fill(0);
  const gfLog = new Array(256).fill(0);
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    gfExp[i] = value;
    gfLog[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) gfExp[i] = gfExp[i - 255];

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return gfExp[gfLog[a] + gfLog[b]];
  }

  function makeGenerator(degree) {
    let result = [1];
    for (let i = 0; i < degree; i += 1) {
      const next = new Array(result.length + 1).fill(0);
      for (let j = 0; j < result.length; j += 1) {
        next[j] ^= result[j];
        next[j + 1] ^= gfMul(result[j], gfExp[i]);
      }
      result = next;
    }
    return result.slice(1);
  }

  const generator = makeGenerator(ECC_CODEWORDS);

  function reedSolomonRemainder(data) {
    const result = new Array(ECC_CODEWORDS).fill(0);
    data.forEach(byte => {
      const factor = byte ^ result[0];
      result.shift();
      result.push(0);
      for (let i = 0; i < ECC_CODEWORDS; i += 1) {
        result[i] ^= gfMul(generator[i], factor);
      }
    });
    return result;
  }

  function appendBits(bits, value, length) {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  }

  function makeDataCodewords(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    if (bytes.length > 106) {
      throw new Error('Invite URL is too long for the built-in QR renderer. Use a shorter GitHub Pages URL.');
    }

    const bits = [];
    appendBits(bits, 0b0100, 4); // byte mode
    appendBits(bits, bytes.length, 8); // QR versions 1-9 byte length field
    bytes.forEach(byte => appendBits(bits, byte, 8));

    const maxBits = DATA_CODEWORDS * 8;
    appendBits(bits, 0, Math.min(4, maxBits - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }
    for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);
    return data;
  }

  function createBlankMatrix() {
    return {
      modules: Array.from({ length: SIZE }, () => new Array(SIZE).fill(false)),
      reserved: Array.from({ length: SIZE }, () => new Array(SIZE).fill(false))
    };
  }

  function setFunctionModule(matrix, x, y, isDark) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    matrix.modules[y][x] = Boolean(isDark);
    matrix.reserved[y][x] = true;
  }

  function drawFinder(matrix, x, y) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE) continue;
        const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark = inFinder && (
          dx === 0 || dx === 6 || dy === 0 || dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
        );
        setFunctionModule(matrix, xx, yy, dark);
      }
    }
  }

  function drawAlignment(matrix, cx, cy) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunctionModule(matrix, cx + dx, cy + dy, distance !== 1);
      }
    }
  }

  function drawTiming(matrix) {
    for (let i = 8; i < SIZE - 8; i += 1) {
      const dark = i % 2 === 0;
      setFunctionModule(matrix, i, 6, dark);
      setFunctionModule(matrix, 6, i, dark);
    }
  }

  function formatBits() {
    const data = (FORMAT_ECL_L << 3) | MASK_PATTERN;
    let rem = data << 10;
    for (let i = 14; i >= 10; i -= 1) {
      if (((rem >>> i) & 1) !== 0) rem ^= 0x537 << (i - 10);
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function drawFormatBits(matrix) {
    const bits = formatBits();
    const bit = i => ((bits >>> i) & 1) !== 0;

    for (let i = 0; i <= 5; i += 1) setFunctionModule(matrix, 8, i, bit(i));
    setFunctionModule(matrix, 8, 7, bit(6));
    setFunctionModule(matrix, 8, 8, bit(7));
    setFunctionModule(matrix, 7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) setFunctionModule(matrix, 14 - i, 8, bit(i));

    for (let i = 0; i < 8; i += 1) setFunctionModule(matrix, SIZE - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) setFunctionModule(matrix, 8, SIZE - 15 + i, bit(i));
    setFunctionModule(matrix, 8, SIZE - 8, true); // dark module
  }

  function applyMask(mask, x, y) {
    if (mask !== 0) return false;
    return ((x + y) & 1) === 0;
  }

  function placeData(matrix, codewords) {
    const bits = [];
    codewords.forEach(byte => appendBits(bits, byte, 8));
    let bitIndex = 0;
    let upward = true;

    for (let right = SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right -= 1;
      for (let vert = 0; vert < SIZE; vert += 1) {
        const y = upward ? SIZE - 1 - vert : vert;
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          if (matrix.reserved[y][x]) continue;
          const rawBit = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
          matrix.modules[y][x] = rawBit !== applyMask(MASK_PATTERN, x, y);
          bitIndex += 1;
        }
      }
      upward = !upward;
    }
  }

  function makeMatrix(text) {
    const data = makeDataCodewords(String(text));
    const ecc = reedSolomonRemainder(data);
    const codewords = data.concat(ecc);
    if (codewords.length !== TOTAL_CODEWORDS) throw new Error('Internal QR codeword length mismatch.');

    const matrix = createBlankMatrix();
    drawFinder(matrix, 0, 0);
    drawFinder(matrix, SIZE - 7, 0);
    drawFinder(matrix, 0, SIZE - 7);
    drawAlignment(matrix, 30, 30);
    drawTiming(matrix);
    drawFormatBits(matrix);
    placeData(matrix, codewords);
    drawFormatBits(matrix); // redraw after masking/data placement
    return matrix.modules;
  }

  function drawToCanvas(canvas, text, options = {}) {
    const modules = makeMatrix(text);
    const requestedWidth = Number(options.width || canvas.width || 176);
    const margin = Number.isFinite(options.margin) ? Math.max(0, options.margin) : 2;
    const moduleCount = modules.length;
    const pixelsPerModule = Math.max(1, Math.floor(requestedWidth / (moduleCount + margin * 2)));
    const actualWidth = pixelsPerModule * (moduleCount + margin * 2);

    canvas.width = actualWidth;
    canvas.height = actualWidth;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, actualWidth, actualWidth);
    ctx.fillStyle = '#0f172a';
    for (let y = 0; y < moduleCount; y += 1) {
      for (let x = 0; x < moduleCount; x += 1) {
        if (!modules[y][x]) continue;
        ctx.fillRect((x + margin) * pixelsPerModule, (y + margin) * pixelsPerModule, pixelsPerModule, pixelsPerModule);
      }
    }
  }

  function toCanvas(canvas, text, options, callback) {
    let opts = options;
    let cb = callback;
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    try {
      drawToCanvas(canvas, text, opts || {});
      if (typeof cb === 'function') cb(null);
      return Promise.resolve(canvas);
    } catch (error) {
      if (typeof cb === 'function') cb(error);
      return Promise.reject(error);
    }
  }

  window.QRCode = window.QRCode || {};
  window.QRCode.toCanvas = toCanvas;
  window.QRCode.__makeMatrix = makeMatrix;
})();
