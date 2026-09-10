// Emit "rym" gothic-lolita character .bbmodel (MC mod style, cube rig)
// Static height: 24.8 units = 1.55 m (1 unit = 1/16 block). Hat & heels excluded.
// Usage: node tools/emit-rym-character.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_DIR = join(ROOT, 'projects');
mkdirSync(OUT_DIR, { recursive: true });

/* ============================ TEXTURE ATLAS ============================ */
const TW = 128, TH = 128;
const px = new Uint8ClampedArray(TW * TH * 4);

// start fully opaque so no accidental transparent faces
for (let i = 0; i < TW * TH; i++) {
  px[i * 4 + 0] = 16; px[i * 4 + 1] = 16; px[i * 4 + 2] = 20; px[i * 4 + 3] = 255;
}

function set(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= TW || y >= TH) return;
  const i = (y * TW + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}
function hex(h, a = 255) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}
function rect(x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, ...c);
}
function noise(x, y, w, h, cA, cB, prob = 0.4) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    set(x + i, y + j, ...(Math.random() < prob ? cA : cB));
  }
}

// palette
const BLACK   = hex('#17171c');
const BLACK_D = hex('#101014');
const BLACK_H = hex('#26262e');
const WHITE   = hex('#e9e9ef');
const HAIR    = hex('#f2f2f5');
const HAIR_S  = hex('#d9d9e3');
const HAIR_D  = hex('#bfbfcc');
const SKIN    = hex('#fbe3d0');
const SKIN_S  = hex('#eecdb4');
const TEAL    = hex('#2f5d50');
const TEAL_L  = hex('#3f7a68');
const LACE    = hex('#dcdce4');
const LIP     = hex('#c96f6f');
const BLUSH   = hex('#f5b8a8');
const EYE     = hex('#3fae8c');
const EYE_D   = hex('#2a7a63');

// region registry: name -> [x, y, w, h]
const REG = {};
function alloc(name, x, y, w, h, painter) {
  REG[name] = [x, y, w, h];
  if (painter) painter(x, y, w, h);
}

/* --- head / hair --- */
alloc('face', 0, 0, 6, 7, (x, y) => {
  rect(x, y, 6, 7, SKIN);
  // fringe rows
  rect(x, y, 6, 2, HAIR);
  set(x + 1, y + 1, ...HAIR_S); set(x + 4, y + 1, ...HAIR_S);
  // eyes (rows 3-4), teal
  for (const ex of [1, 4]) {
    set(x + ex, y + 3, ...EYE_D); set(x + ex, y + 4, ...EYE);
    set(x + ex, y + 3 - 1, ...HAIR_S); // brow shadow
  }
  set(x + 1, y + 4, ...EYE_L_Glint());
  function EYE_L_Glint() { return hex('#eafff7'); }
  // mouth + blush
  set(x + 3, y + 6, ...LIP);
  set(x + 0, y + 5, ...BLUSH); set(x + 5, y + 5, ...BLUSH);
});
alloc('hairTop', 8, 0, 6, 6, (x, y) => {
  rect(x, y, 6, 6, HAIR);
  for (let j = 0; j < 6; j++) set(x + 2, y + j, ...HAIR_S);
  set(x + 4, y + 3, ...HAIR_S);
});
alloc('hairSide', 16, 0, 6, 7, (x, y) => {
  rect(x, y, 6, 7, HAIR);
  for (let j = 2; j < 7; j++) set(x + j, y + j - 2 + 2, ...HAIR_S); // diagonal shade
  for (let j = 0; j < 7; j++) set(x + 0, y + j, ...HAIR_S);
});
alloc('hairBackHead', 24, 0, 6, 7, (x, y) => {
  rect(x, y, 6, 7, HAIR);
  for (let j = 0; j < 7; j++) { set(x + 1, y + j, ...HAIR_S); set(x + 4, y + j, ...HAIR_S); }
});
alloc('hairDown', 8, 8, 6, 6, (x, y) => rect(x, y, 6, 6, HAIR_S));
alloc('bangs', 0, 9, 7, 2, (x, y) => {
  rect(x, y, 7, 2, HAIR);
  for (let i = 0; i < 7; i += 2) set(x + i, y + 1, ...HAIR_S);
  set(x + 3, y + 1, ...HAIR_D);
});
alloc('lockStrand', 0, 16, 1, 7, (x, y) => {
  rect(x, y, 1, 7, HAIR); set(x, y + 2, ...HAIR_S); set(x, y + 5, ...HAIR_S);
});
alloc('lockTop', 1, 16, 1, 1, (x, y) => set(x, y, ...HAIR));
alloc('lockBot', 2, 16, 1, 1, (x, y) => set(x, y, ...HAIR_S));
alloc('hairDark', 32, 0, 6, 12, (x, y) => rect(x, y, 6, 12, HAIR_S));
alloc('backHair', 0, 20, 6, 12, (x, y) => {
  rect(x, y, 6, 12, HAIR);
  for (let j = 0; j < 12; j++) {
    set(x + 0, y + j, ...HAIR_S);
    set(x + 2, y + j, ...HAIR_S);
    set(x + 5, y + j, ...HAIR_D);
    if (j % 3 === 0) set(x + 3, y + j, ...HAIR_S);
  }
});
alloc('backHairE', 6, 20, 1, 12, (x, y) => rect(x, y, 1, 12, HAIR_S));
alloc('backHairUp', 8, 20, 6, 1, (x, y) => rect(x, y, 6, 1, HAIR));
alloc('backHairDown', 8, 22, 6, 1, (x, y) => rect(x, y, 6, 1, HAIR_S));

/* --- hat --- */
alloc('brimTop', 48, 0, 11, 11, (x, y) => {
  rect(x, y, 11, 11, BLACK);
  for (let i = 0; i < 11; i++) { set(x + i, y + 2, ...BLACK_H); set(x + i, y + 8, ...BLACK_H); }
  for (let j = 0; j < 11; j++) { set(x + 2, y + j, ...BLACK_H); set(x + 8, y + j, ...BLACK_H); }
});
alloc('brimDown', 48, 12, 11, 11, (x, y) => rect(x, y, 11, 11, BLACK_D));
alloc('brimEdge', 48, 24, 11, 1, (x, y) => rect(x, y, 11, 1, BLACK));
alloc('crownSide', 60, 0, 6, 3, (x, y) => {
  rect(x, y, 6, 3, BLACK);
  rect(x, y + 2, 6, 1, TEAL);          // teal ribbon band at crown base
  set(x + 1, y + 0, ...BLACK_H);
});
alloc('crownTop', 60, 4, 6, 6, (x, y) => rect(x, y, 6, 6, BLACK));
alloc('veil', 68, 0, 9, 8, (x, y) => {
  for (let j = 0; j < 8; j++) for (let i = 0; i < 9; i++) set(x + i, y + j, 12, 12, 18, 150);
  for (let j = 0; j < 8; j += 2) for (let i = (j / 2) % 2; i < 9; i += 2) set(x + i, y + j, 200, 205, 215, 70);
  for (let i = 0; i < 9; i++) if (i % 2 === 0) set(x + i, y + 7, 225, 225, 235, 120); // lace edge
});
alloc('veilInner', 78, 0, 9, 8, (x, y) => {
  for (let j = 0; j < 8; j++) for (let i = 0; i < 9; i++) set(x + i, y + j, 12, 12, 18, 130);
});
alloc('veilEdge', 68, 9, 1, 8, (x, y) => { for (let j = 0; j < 8; j++) set(x, y + j, 12, 12, 18, 140); });
alloc('veilTop', 68, 10, 9, 1, (x, y) => { for (let i = 0; i < 9; i++) set(x + i, y, 12, 12, 18, 140); });
alloc('veilBot', 70, 12, 9, 1, (x, y) => { for (let i = 0; i < 9; i++) set(x + i, y, 12, 12, 18, 140); });

/* --- body --- */
alloc('torsoF', 0, 33, 5, 6, (x, y) => {
  rect(x, y, 5, 6, BLACK);
  set(x + 2, y + 0, ...TEAL_L);                    // brooch
  set(x + 2, y + 2, ...WHITE); set(x + 2, y + 4, ...WHITE); // frill buttons
  for (let i = 0; i < 5; i += 2) set(x + i, y + 5, ...LACE); // bottom lace
  set(x + 0, y + 0, ...BLACK_H);
});
alloc('torsoB', 8, 33, 5, 6, (x, y) => {
  rect(x, y, 5, 6, BLACK);
  for (let j = 0; j < 6; j++) set(x + 2, y + j, ...BLACK_H);
  for (let i = 0; i < 5; i += 2) set(x + i, y + 5, ...LACE);
});
alloc('torsoS', 16, 33, 3, 6, (x, y) => rect(x, y, 3, 6, BLACK));
alloc('torsoUp', 0, 40, 5, 3, (x, y) => rect(x, y, 5, 3, BLACK_D));
alloc('collarF', 24, 33, 6, 2, (x, y) => {
  rect(x, y, 6, 2, WHITE);
  for (let i = 1; i < 6; i += 2) set(x + i, y + 1, ...HAIR_S); // scallop
});
alloc('collarE', 24, 36, 4, 2, (x, y) => rect(x, y, 4, 2, WHITE));
alloc('collarUp', 24, 39, 6, 4, (x, y) => rect(x, y, 6, 4, WHITE));
alloc('corsetF', 32, 33, 5, 3, (x, y) => {
  rect(x, y, 5, 3, BLACK_D);
  set(x + 1, y + 0, ...TEAL); set(x + 3, y + 0, ...TEAL);
  set(x + 2, y + 1, ...TEAL_L);
  set(x + 1, y + 2, ...TEAL); set(x + 3, y + 2, ...TEAL);
  set(x + 0, y + 1, ...BLACK_H); set(x + 4, y + 1, ...BLACK_H);
});
alloc('corsetB', 38, 33, 5, 3, (x, y) => rect(x, y, 5, 3, BLACK_D));
alloc('corsetS', 32, 37, 4, 3, (x, y) => rect(x, y, 4, 3, BLACK_D));

/* --- skirt --- */
alloc('skirtF1', 0, 44, 7, 2, (x, y) => {
  rect(x, y, 7, 2, BLACK);
  set(x + 1, y + 1, ...BLACK_H); set(x + 4, y + 1, ...BLACK_H);
});
alloc('skirtB1', 8, 44, 7, 2, (x, y) => rect(x, y, 7, 2, BLACK_D));
alloc('skirtS1', 16, 44, 5, 2, (x, y) => rect(x, y, 5, 2, BLACK));
alloc('skirtUp1', 16, 50, 7, 5, (x, y) => rect(x, y, 7, 5, BLACK_D));
alloc('skirtF2', 0, 47, 8, 2, (x, y) => {
  rect(x, y, 8, 2, BLACK);
  for (let i = 0; i < 8; i += 2) set(x + i, y + 1, ...BLACK_H);
});
alloc('skirtB2', 8, 47, 8, 2, (x, y) => rect(x, y, 8, 2, BLACK_D));
alloc('skirtS2', 16, 47, 6, 2, (x, y) => rect(x, y, 6, 2, BLACK));
alloc('skirtD2', 0, 50, 8, 6, (x, y) => { // teal inner lining
  rect(x, y, 8, 6, TEAL);
  rect(x + 2, y + 2, 4, 2, TEAL_L);
  for (let i = 0; i < 8; i++) set(x + i, y + 5, ...LACE);
});
alloc('skirtF3', 0, 58, 10, 2, (x, y) => {
  rect(x, y, 10, 2, BLACK);
  for (let i = 0; i < 10; i++) set(x + i, y + 1, ...(i % 2 ? BLACK_H : LACE)); // lace trim
});
alloc('skirtB3', 10, 58, 10, 2, (x, y) => rect(x, y, 10, 2, BLACK_D));
alloc('skirtS3', 21, 58, 7, 2, (x, y) => rect(x, y, 7, 2, BLACK));
alloc('skirtD3', 0, 61, 10, 7, (x, y) => { // teal inner lining
  rect(x, y, 10, 7, TEAL);
  rect(x + 3, y + 2, 4, 3, TEAL_L);
  for (let i = 0; i < 10; i++) set(x + i, y + 6, ...LACE);
});
alloc('skirtUp3', 10, 61, 10, 7, (x, y) => rect(x, y, 10, 7, BLACK_D));

/* --- boots --- */
alloc('bootF', 0, 66, 2, 6, (x, y) => {
  rect(x, y, 2, 6, BLACK);
  rect(x, y + 0, 2, 1, LACE);                    // lace cuff
  set(x + 0, y + 2, ...hex('#45454f')); set(x + 1, y + 3, ...hex('#45454f'));
  set(x + 0, y + 4, ...hex('#45454f'));
});
alloc('bootB', 2, 66, 2, 6, (x, y) => { rect(x, y, 2, 6, BLACK); rect(x, y, 2, 1, LACE); });
alloc('bootSide', 5, 66, 3, 6, (x, y) => { rect(x, y, 3, 6, BLACK); rect(x, y, 3, 1, LACE); });
alloc('bootUp', 24, 66, 2, 3, (x, y) => rect(x, y, 2, 3, BLACK_D));

/* --- arms --- */
alloc('puffF', 0, 90, 2, 3, (x, y) => {
  rect(x, y, 2, 3, BLACK);
  set(x + 0, y + 0, ...BLACK_H); set(x + 1, y + 0, ...BLACK_H);
  set(x + 0, y + 2, ...WHITE);
});
alloc('puffB', 3, 90, 2, 3, (x, y) => rect(x, y, 2, 3, BLACK_D));
alloc('puffS', 6, 90, 3, 3, (x, y) => { rect(x, y, 3, 3, BLACK); set(x + 1, y + 0, ...BLACK_H); set(x + 0, y + 2, ...WHITE); });
alloc('puffU', 6, 94, 2, 3, (x, y) => rect(x, y, 2, 3, BLACK));

/* --- swatches --- */
alloc('black', 0, 70, 4, 4, (x, y) => { rect(x, y, 4, 4, BLACK); set(x, y, ...BLACK_H); });
alloc('blackD', 5, 70, 4, 4, (x, y) => rect(x, y, 4, 4, BLACK_D));
alloc('white', 0, 75, 4, 4, (x, y) => rect(x, y, 4, 4, WHITE));
alloc('hairWhite', 5, 75, 4, 4, (x, y) => rect(x, y, 4, 4, HAIR));
alloc('hairShade', 10, 75, 4, 4, (x, y) => rect(x, y, 4, 4, HAIR_S));
alloc('skin', 0, 80, 4, 4, (x, y) => { rect(x, y, 4, 4, SKIN); rect(x, y + 3, 4, 1, SKIN_S); });
alloc('thighF', 0, 85, 2, 7, (x, y) => { rect(x, y, 2, 7, SKIN); for (let j = 0; j < 7; j++) set(x + 1, y + j, ...SKIN_S); });
alloc('teal', 5, 80, 4, 4, (x, y) => rect(x, y, 4, 4, TEAL));
alloc('tealL', 10, 80, 4, 4, (x, y) => rect(x, y, 4, 4, TEAL_L));

/* minimal PNG encoder (RGBA8, no dependency) */
import { deflateSync } from 'node:zlib';
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function atlasDataURL() {
  const buf = encodePNG(px, TW, TH);
  return 'data:image/png;base64,' + buf.toString('base64');
}

/* ============================ MODEL GEOMETRY ============================ */
let uuidSeed = 0;
function uuid() {
  uuidSeed++;
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
}

// cube def: [name, from, to, bone, {face: regionName}]
const CUBES = [
  // ---- head ----
  ['head', [-3, 17.8, -3], [3, 24.8, 3], 'head', {
    north: 'face', south: 'hairBackHead', east: 'hairSide', west: 'hairSide', up: 'hairTop', down: 'hairDown',
  }],
  ['bangs', [-3.2, 22.9, -3.35], [3.2, 24.2, -2.85], 'head', {
    north: 'bangs', south: 'hairShade', east: 'hairShade', west: 'hairShade', up: 'hairWhite', down: 'hairShade',
  }],
  ['lock_l', [-3.55, 16.6, -3.05], [-2.85, 23.3, -2.35], 'head', {
    north: 'lockStrand', south: 'lockStrand', east: 'lockStrand', west: 'lockStrand', up: 'lockTop', down: 'lockBot',
  }],
  ['lock_r', [2.85, 16.6, -3.05], [3.55, 23.3, -2.35], 'head', {
    north: 'lockStrand', south: 'lockStrand', east: 'lockStrand', west: 'lockStrand', up: 'lockTop', down: 'lockBot',
  }],
  ['back_hair', [-2.8, 11.6, 2.6], [2.8, 23.2, 3.5], 'head', {
    north: 'hairDark', south: 'backHair', east: 'backHairE', west: 'backHairE', up: 'backHairUp', down: 'backHairDown',
  }],
  // ---- hat ----
  ['hat_brim', [-5.5, 24.4, -5.5], [5.5, 24.9, 5.5], 'hat', {
    north: 'brimEdge', south: 'brimEdge', east: 'brimEdge', west: 'brimEdge', up: 'brimTop', down: 'brimDown',
  }],
  ['hat_crown', [-2.8, 24.9, -2.8], [2.8, 27.2, 2.8], 'hat', {
    north: 'crownSide', south: 'crownSide', east: 'crownSide', west: 'crownSide', up: 'crownTop', down: 'blackD',
  }],
  ['hat_veil', [-4.6, 17.2, 4.75], [4.6, 24.5, 5.15], 'hat', {
    north: 'veilInner', south: 'veil', east: 'veilEdge', west: 'veilEdge', up: 'veilTop', down: 'veilBot',
  }],
  ['hat_ribbon', [-0.8, 26.4, -3.1], [0.8, 27.2, -2.7], 'hat', {
    north: 'tealL', south: 'teal', east: 'teal', west: 'teal', up: 'tealL', down: 'teal',
  }],
  // ---- body ----
  ['torso', [-2.5, 12.0, -1.4], [2.5, 17.6, 1.4], 'body', {
    north: 'torsoF', south: 'torsoB', east: 'torsoS', west: 'torsoS', up: 'torsoUp', down: 'blackD',
  }],
  ['collar', [-2.7, 17.0, -1.6], [2.7, 18.2, 1.6], 'body', {
    north: 'collarF', south: 'collarF', east: 'collarE', west: 'collarE', up: 'collarUp', down: 'white',
  }],
  ['corset', [-2.35, 10.8, -1.55], [2.35, 13.2, 1.55], 'body', {
    north: 'corsetF', south: 'corsetB', east: 'corsetS', west: 'corsetS', up: 'black', down: 'blackD',
  }],
  // ---- skirt ----
  ['skirt_1', [-3.2, 9.7, -2.1], [3.2, 11.7, 2.1], 'skirt', {
    north: 'skirtF1', south: 'skirtB1', east: 'skirtS1', west: 'skirtS1', up: 'skirtUp1', down: 'blackD',
  }],
  ['skirt_2', [-4.0, 8.4, -2.8], [4.0, 10.2, 2.8], 'skirt', {
    north: 'skirtF2', south: 'skirtB2', east: 'skirtS2', west: 'skirtS2', up: 'blackD', down: 'skirtD2',
  }],
  ['skirt_3', [-4.8, 7.1, -3.5], [4.8, 8.9, 3.5], 'skirt', {
    north: 'skirtF3', south: 'skirtB3', east: 'skirtS3', west: 'skirtS3', up: 'skirtUp3', down: 'skirtD3',
  }],
  // ---- left arm ----
  ['puff_l', [-4.6, 15.5, -1.45], [-2.7, 17.9, 1.45], 'arm_l', {
    north: 'puffF', south: 'puffB', east: 'puffS', west: 'puffS', up: 'puffU', down: 'blackD',
  }],
  ['sleeve_l', [-4.2, 12.6, -1.05], [-2.9, 16.2, 1.05], 'arm_l', {
    north: 'black', south: 'black', east: 'black', west: 'black', up: 'black', down: 'black',
  }],
  ['glove_l', [-4.1, 9.9, -0.95], [-3.0, 12.6, 0.95], 'arm_l', {
    north: 'black', south: 'black', east: 'black', west: 'black', up: 'black', down: 'black',
  }],
  ['hand_l', [-4.0, 8.9, -0.9], [-3.05, 10.1, 0.9], 'arm_l', {
    north: 'blackD', south: 'blackD', east: 'blackD', west: 'blackD', up: 'black', down: 'blackD',
  }],
  // ---- right arm ----
  ['puff_r', [2.7, 15.5, -1.45], [4.6, 17.9, 1.45], 'arm_r', {
    north: 'puffF', south: 'puffB', east: 'puffS', west: 'puffS', up: 'puffU', down: 'blackD',
  }],
  ['sleeve_r', [2.9, 12.6, -1.05], [4.2, 16.2, 1.05], 'arm_r', {
    north: 'black', south: 'black', east: 'black', west: 'black', up: 'black', down: 'black',
  }],
  ['glove_r', [3.0, 9.9, -0.95], [4.1, 12.6, 0.95], 'arm_r', {
    north: 'black', south: 'black', east: 'black', west: 'black', up: 'black', down: 'black',
  }],
  ['hand_r', [3.05, 8.9, -0.9], [4.0, 10.1, 0.9], 'arm_r', {
    north: 'blackD', south: 'blackD', east: 'blackD', west: 'blackD', up: 'black', down: 'blackD',
  }],
  // ---- left leg ----
  ['thigh_l', [-2.2, 5.7, -1.05], [-0.4, 12.2, 1.05], 'leg_l', {
    north: 'thighF', south: 'thighF', east: 'skin', west: 'skin', up: 'blackD', down: 'skin',
  }],
  ['boot_shaft_l', [-2.3, 1.9, -1.2], [-0.3, 5.9, 1.2], 'leg_l', {
    north: 'bootF', south: 'bootB', east: 'bootSide', west: 'bootSide', up: 'blackD', down: 'blackD',
  }],
  ['ankle_l', [-2.25, 0.9, -1.15], [-0.35, 2.1, 1.15], 'leg_l', {
    north: 'black', south: 'black', east: 'black', west: 'black', up: 'black', down: 'black',
  }],
  ['foot_l', [-2.35, 0.4, -2.2], [-0.25, 1.3, 1.2], 'leg_l', {
    north: 'black', south: 'black', east: 'black', west: 'black', up: 'blackD', down: 'black',
  }],
  ['heel_l', [-1.85, 0.0, -0.95], [-0.75, 0.95, -0.05], 'leg_l', {
    north: 'blackD', south: 'blackD', east: 'blackD', west: 'blackD', up: 'blackD', down: 'black',
  }],
  // ---- right leg ----
  ['thigh_r', [0.4, 5.7, -1.05], [2.2, 12.2, 1.05], 'leg_r', {
    north: 'thighF', south: 'thighF', east: 'skin', west: 'skin', up: 'blackD', down: 'skin',
  }],
  ['boot_shaft_r', [0.3, 1.9, -1.2], [2.3, 5.9, 1.2], 'leg_r', {
    north: 'bootF', south: 'bootB', east: 'bootSide', west: 'bootSide', up: 'blackD', down: 'blackD',
  }],
  ['ankle_r', [0.35, 0.9, -1.15], [2.25, 2.1, 1.15], 'leg_r', {
    north: 'black', south: 'black', east: 'black', west: 'black', up: 'black', down: 'black',
  }],
  ['foot_r', [0.25, 0.4, -2.2], [2.35, 1.3, 1.2], 'leg_r', {
    north: 'black', south: 'black', east: 'black', west: 'black', up: 'blackD', down: 'black',
  }],
  ['heel_r', [0.75, 0.0, -0.95], [1.85, 0.95, -0.05], 'leg_r', {
    north: 'blackD', south: 'blackD', east: 'blackD', west: 'blackD', up: 'blackD', down: 'black',
  }],
];

// bones: name -> {parent, origin, rotation}
const BONES = {
  root:  { parent: null,  origin: [0, 0, 0],    rotation: [0, 0, 0] },
  body:  { parent: 'root', origin: [0, 12, 0],  rotation: [0, 0, 0] },
  head:  { parent: 'body', origin: [0, 17.8, 0], rotation: [0, 0, 0] },
  hat:   { parent: 'head', origin: [0, 24.6, 0], rotation: [0, 0, 0] },
  arm_l: { parent: 'body', origin: [-3.0, 17.2, 0], rotation: [0, 0, -7] },
  arm_r: { parent: 'body', origin: [3.0, 17.2, 0],  rotation: [0, 0, 7] },
  skirt: { parent: 'body', origin: [0, 12.3, 0], rotation: [0, 0, 0] },
  leg_l: { parent: 'root', origin: [-1.3, 11.8, 0], rotation: [0, 0, 0] },
  leg_r: { parent: 'root', origin: [1.3, 11.8, 0],  rotation: [0, 0, 0] },
};

function faceDims(from, to, face) {
  const dx = Math.abs(to[0] - from[0]);
  const dy = Math.abs(to[1] - from[1]);
  const dz = Math.abs(to[2] - from[2]);
  if (face === 'north' || face === 'south') return [Math.ceil(dx), Math.ceil(dy)];
  if (face === 'east' || face === 'west') return [Math.ceil(dz), Math.ceil(dy)];
  return [Math.ceil(dx), Math.ceil(dz)];
}

function buildElements() {
  return CUBES.map(([name, from, to, bone, faces]) => {
    const f = {};
    for (const [face, region] of Object.entries(faces)) {
      const [rx, ry, rw, rh] = REG[region];
      const [dw, dh] = faceDims(from, to, face);
      if (dw !== rw || dh !== rh) {
        console.warn(`[uv] ${name}.${face}: face ${dw}x${dh} vs region ${region} ${rw}x${rh}`);
      }
      f[face] = { uv: [rx, ry, rx + rw, ry + rh], texture: 0 };
    }
    return {
      name,
      box_uv: false,
      render_order: 'default',
      rescale: false,
      locked: false,
      shade: true,
      light_emission: 0,
      export: true,
      scope: 0,
      allow_mirror_modeling: true,
      from, to,
      autouv: 0,
      color: 0,
      origin: BONES[bone].origin,
      faces: f,
      type: 'cube',
      uuid: uuid(),
    };
  });
}

function buildOutliner(elements) {
  const byName = Object.fromEntries(elements.map((e) => [e.name, e]));
  const groups = {};
  const groupDefs = {};
  for (const [name, def] of Object.entries(BONES)) {
    groupDefs[name] = {
      name,
      origin: def.origin,
      rotation: def.rotation,
      color: 0,
      uuid: uuid(),
      export: true,
      mirror_uv: false,
      isOpen: true,
      locked: false,
      visibility: true,
      autouv: 0,
      children: [],
    };
    groups[name] = groupDefs[name];
  }
  for (const [name, , , bone] of CUBES) {
    groups[bone].children.push(byName[name].uuid);
  }
  const top = [];
  for (const [name, def] of Object.entries(BONES)) {
    if (def.parent) groups[def.parent].children.push(groupDefs[name]);
    else top.push(groupDefs[name]);
  }
  return top;
}

/* ============================ EMIT ============================ */
const model = {
  meta: { format_version: '4.5', model_format: 'generic', box_uv: false },
  name: 'rym_character',
  model_identifier: 'rym_character',
  resolution: { width: TW, height: TH },
  elements: null,
  outliner: null,
  textures: null,
};

const dataURL = await atlasDataURL();
model.elements = buildElements();
model.outliner = buildOutliner(model.elements);
model.textures = [{
  path: '',
  name: 'rym.png',
  folder: 'block',
  namespace: '',
  id: '0',
  group: '',
  scope: 0,
  width: TW,
  height: TH,
  uv_width: TW,
  uv_height: TH,
  particle: false,
  use_as_default: false,
  layers_enabled: false,
  sync_to_project: '',
  file_format: 'png',
  render_mode: 'default',
  render_sides: 'auto',
  wrap_mode: 'limited',
  pbr_channel: 'color',
  fps: 7,
  frame_time: 2,
  frame_order_type: 'loop',
  frame_order: '',
  frame_interpolate: false,
  visible: true,
  internal: true,
  saved: false,
  uuid: uuid(),
  relative_path: '',
  source: dataURL,
}];

const outPath = join(OUT_DIR, 'rym-character.bbmodel');
writeFileSync(outPath, JSON.stringify(model, null, 1));

// also save standalone texture png
const b64 = dataURL.split(',')[1];
writeFileSync(join(OUT_DIR, 'rym-texture.png'), Buffer.from(b64, 'base64'));

console.log('cubes:', model.elements.length, '->', outPath);
