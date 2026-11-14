/**
 * Gerador leve e clean-room de QR Code (ISO/IEC 18004, modo Byte, EC-L, versões 1–6) em SVG.
 * Compatível com ES5 e offline (não envia URLs/tokens para APIs externas de QR).
 */

interface QrVersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  blocks: number;
  ecPerBlock: number;
  align: number[];
}

const VERSIONS: QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 19, blocks: 1, ecPerBlock: 7, align: [] },
  { version: 2, size: 25, dataCodewords: 34, blocks: 1, ecPerBlock: 10, align: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, blocks: 1, ecPerBlock: 15, align: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, blocks: 1, ecPerBlock: 20, align: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, blocks: 1, ecPerBlock: 26, align: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, blocks: 2, ecPerBlock: 18, align: [6, 34] },
];

function buildGfTables(): { exp: number[]; log: number[] } {
  const exp: number[] = new Array(512);
  const log: number[] = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  log[0] = 0;
  return { exp, log };
}

const GF = buildGfTables();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF.exp[GF.log[a] + GF.log[b]];
}

function rsGeneratorPoly(ecCount: number): number[] {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next: number[] = new Array(poly.length + 1);
    for (let k = 0; k < next.length; k++) next[k] = 0;
    const root = GF.exp[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: number[], ecCount: number): number[] {
  const gen = rsGeneratorPoly(ecCount);
  const res: number[] = new Array(data.length + ecCount);
  for (let i = 0; i < res.length; i++) res[i] = i < data.length ? data[i] : 0;
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      res[i + j] ^= gfMul(gen[j], factor);
    }
  }
  return res.slice(data.length);
}

function utf8Bytes(str: string): number[] {
  const pct = encodeURIComponent(str);
  const out: number[] = [];
  for (let i = 0; i < pct.length; i++) {
    if (pct.charAt(i) === '%' && i + 2 < pct.length) {
      out.push(parseInt(pct.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(pct.charCodeAt(i));
    }
  }
  return out;
}

function encodeDataCodewords(bytes: number[], spec: QrVersionSpec): number[] {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  pushBits(4, 4); // Modo Byte (0100)
  pushBits(bytes.length, 8);
  for (let i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
  const totalBits = spec.dataCodewords * 8;
  const terminator = Math.min(4, totalBits - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
    codewords.push(b);
  }
  let padIdx = 0;
  while (codewords.length < spec.dataCodewords) {
    codewords.push(padIdx % 2 === 0 ? 0xec : 0x11);
    padIdx++;
  }
  return codewords;
}

function interleaveCodewords(data: number[], spec: QrVersionSpec): number[] {
  const blockLen = data.length / spec.blocks;
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  for (let b = 0; b < spec.blocks; b++) {
    const slice = data.slice(b * blockLen, (b + 1) * blockLen);
    dataBlocks.push(slice);
    ecBlocks.push(rsRemainder(slice, spec.ecPerBlock));
  }
  const out: number[] = [];
  for (let i = 0; i < blockLen; i++) {
    for (let b = 0; b < spec.blocks; b++) out.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) out.push(ecBlocks[b][i]);
  }
  return out;
}

function formatInfoBits(mask: number): number {
  // Nível EC-L = 01
  const data = (1 << 3) | mask;
  let rem = data << 10;
  const poly = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= poly << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function createMatrix(size: number): { modules: number[][]; reserved: boolean[][] } {
  const modules: number[][] = [];
  const reserved: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    modules.push(new Array(size));
    reserved.push(new Array(size));
    for (let c = 0; c < size; c++) {
      modules[r][c] = 0;
      reserved[r][c] = false;
    }
  }
  return { modules, reserved };
}

function placeFinder(modules: number[][], reserved: boolean[][], row: number, col: number, size: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      reserved[rr][cc] = true;
      const inOuter = r === 0 || r === 6 || c === 0 || c === 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const onBorder = r === -1 || r === 7 || c === -1 || c === 7;
      modules[rr][cc] = !onBorder && (inOuter || inInner) ? 1 : 0;
    }
  }
}

function placeAlignment(modules: number[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = row + r;
      const cc = col + c;
      reserved[rr][cc] = true;
      const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      modules[rr][cc] = dark ? 1 : 0;
    }
  }
}

function drawFormatBits(modules: number[][], reserved: boolean[][], mask: number, size: number) {
  const fmt = formatInfoBits(mask);
  for (let i = 0; i < 15; i++) {
    const bit = (fmt >> i) & 1;
    // Barra vertical perto dos finders esquerdo-superior e inferior
    if (i < 6) {
      modules[i][8] = bit;
      reserved[i][8] = true;
    } else if (i < 8) {
      modules[i + 1][8] = bit;
      reserved[i + 1][8] = true;
    } else {
      modules[size - 15 + i][8] = bit;
      reserved[size - 15 + i][8] = true;
    }
    // Barra horizontal
    if (i < 8) {
      modules[8][size - 1 - i] = bit;
      reserved[8][size - 1 - i] = true;
    } else if (i < 9) {
      modules[8][7] = bit;
      reserved[8][7] = true;
    } else {
      modules[8][14 - i] = bit;
      reserved[8][14 - i] = true;
    }
  }
  // Dark module fixo
  modules[size - 8][8] = 1;
  reserved[size - 8][8] = true;
}

function penaltyScore(m: number[][], size: number): number {
  let score = 0;
  for (let r = 0; r < size; r++) {
    let runColor = m[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (m[r][c] === runColor) runLen++;
      else {
        if (runLen >= 5) score += runLen - 2;
        runColor = m[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) score += runLen - 2;
  }
  for (let c = 0; c < size; c++) {
    let runColor = m[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (m[r][c] === runColor) runLen++;
      else {
        if (runLen >= 5) score += runLen - 2;
        runColor = m[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) score += runLen - 2;
  }
  return score;
}

/** Gera matriz booleana de QR Code para qualquer texto de até ~134 bytes UTF-8. */
export function buildQrMatrix(text: string): number[][] | null {
  const bytes = utf8Bytes(text);
  let spec: QrVersionSpec | null = null;
  for (let i = 0; i < VERSIONS.length; i++) {
    // Overhead = 4 bits modo + 8 bits tamanho + 4 bits terminador = 2 bytes
    if (bytes.length + 2 <= VERSIONS[i].dataCodewords) {
      spec = VERSIONS[i];
      break;
    }
  }
  if (!spec) return null;

  const size = spec.size;
  const cw = interleaveCodewords(encodeDataCodewords(bytes, spec), spec);
  const totalBits: number[] = [];
  for (let i = 0; i < cw.length; i++) {
    for (let b = 7; b >= 0; b--) totalBits.push((cw[i] >> b) & 1);
  }

  let bestMatrix: number[][] | null = null;
  let bestScore = 1e9;

  for (let mask = 0; mask < 8; mask++) {
    const { modules, reserved } = createMatrix(size);
    placeFinder(modules, reserved, 0, 0, size);
    placeFinder(modules, reserved, 0, size - 7, size);
    placeFinder(modules, reserved, size - 7, 0, size);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      reserved[6][i] = true;
      reserved[i][6] = true;
      modules[6][i] = i % 2 === 0 ? 1 : 0;
      modules[i][6] = i % 2 === 0 ? 1 : 0;
    }

    // Alignment patterns
    for (let a = 0; a < spec.align.length; a++) {
      for (let b = 0; b < spec.align.length; b++) {
        const r = spec.align[a];
        const c = spec.align[b];
        if (reserved[r][c]) continue;
        placeAlignment(modules, reserved, r, c);
      }
    }

    // Reserva bits de formato antes de preencher dados
    drawFormatBits(modules, reserved, mask, size);

    let bitIdx = 0;
    let upward = true;
    for (let col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col = 5;
      for (let step = 0; step < size; step++) {
        const row = upward ? size - 1 - step : step;
        for (let dx = 0; dx < 2; dx++) {
          const cc = col - dx;
          if (reserved[row][cc]) continue;
          const rawBit = bitIdx < totalBits.length ? totalBits[bitIdx] : 0;
          bitIdx++;
          let inv = false;
          if (mask === 0) inv = (row + cc) % 2 === 0;
          else if (mask === 1) inv = row % 2 === 0;
          else if (mask === 2) inv = cc % 3 === 0;
          else if (mask === 3) inv = (row + cc) % 3 === 0;
          else if (mask === 4) inv = (Math.floor(row / 2) + Math.floor(cc / 3)) % 2 === 0;
          else if (mask === 5) inv = ((row * cc) % 2) + ((row * cc) % 3) === 0;
          else if (mask === 6) inv = (((row * cc) % 2) + ((row * cc) % 3)) % 2 === 0;
          else inv = (((row + cc) % 2) + ((row * cc) % 3)) % 2 === 0;
          modules[row][cc] = inv ? rawBit ^ 1 : rawBit;
        }
      }
      upward = !upward;
    }

    const s = penaltyScore(modules, size);
    if (s < bestScore) {
      bestScore = s;
      bestMatrix = modules;
    }
  }

  return bestMatrix;
}

/** Renderiza SVG crisp offline de um QR Code (sem dependências externas). */
export function buildQrSvg(text: string, pxSize = 260): string {
  const matrix = buildQrMatrix(text);
  if (!matrix) return '';
  const n = matrix.length;
  const quiet = 4;
  const full = n + quiet * 2;
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c] === 1) {
        path += 'M' + (c + quiet) + ',' + (r + quiet) + 'h1v1h-1z';
      }
    }
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    full +
    ' ' +
    full +
    '" width="' +
    pxSize +
    '" height="' +
    pxSize +
    '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="' +
    path +
    '" fill="#0b0f1a"/></svg>'
  );
}
