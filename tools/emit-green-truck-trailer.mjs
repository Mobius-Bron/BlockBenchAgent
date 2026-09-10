// Build green semi truck: white-low-poly-semi-truck cab + matching trailer.
// - Cab texture kept ORIGINAL; solid trailer paint + disc decal applied inside Blockbench (canvas op).
// - Trailer profile (side view): main box (with wheel-arch recesses) -> trapezoid wedge -> raised neck,
//   connected to the cab's rear deck via a kingpin cylinder on a fifth-wheel disc.
// - 4 wheel pairs; left/right wheels use their matching source-side templates.
// Usage: node tools/emit-green-truck-trailer.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'projects', 'white-low-poly-semi-truck.bbmodel');
const OUT = join(ROOT, 'projects', 'green-truck-trailer.bbmodel');

const src = JSON.parse(readFileSync(SRC, 'utf-8'));

function uuid() {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
}

/* ===== mesh helpers ===== */
function baseElement(name) {
  return {
    name, box_uv: false, render_order: 'default', rescale: false, locked: false,
    shade: true, light_emission: 0, export: true, scope: 0, allow_mirror_modeling: true,
    vertices: {}, origin: [0, 0, 0], rotation: [0, 0, 0],
    faces: {}, type: 'mesh', uuid: uuid(),
  };
}
// auto-flip face winding so the normal points along `outward`
function orient(face, verts, outward) {
  const [a, b, c] = face.vertices.map((k) => verts[k]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2];
  if (dot < 0) {
    face.vertices = [...face.vertices].reverse();
    // keep uv attached to the right vertices (uv is keyed by vertex id, no change needed)
  }
}
function addQuad(el, keys, uvMap, outward, faceKey) {
  const f = { vertices: keys, uv: uvMap, texture: 0 };
  orient(f, el.vertices, outward);
  el.faces[faceKey || 'f' + Object.keys(el.faces).length] = f;
}

// axis-aligned box; regionMap: face -> REG key (missing face is skipped)
function boxMesh(name, [x1, y1, z1], [x2, y2, z2], regionMap, REG) {
  const el = baseElement(name);
  const P = {
    tfl: [x1, y2, z1], tfr: [x2, y2, z1], tbr: [x2, y2, z2], tbl: [x1, y2, z2],
    bfl: [x1, y1, z1], bfr: [x2, y1, z1], bbr: [x2, y1, z2], bbl: [x1, y1, z2],
  };
  const vk = {};
  Object.entries(P).forEach(([k, v], i) => { el.vertices['v' + i] = v; vk[k] = 'v' + i; });
  const C = [(x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2];
  const defs = {
    north: [['tfl', 'tfr', 'bfr', 'bfl'], [0, 0, -1]],
    south: [['tbr', 'tbl', 'bbl', 'bbr'], [0, 0, 1]],
    east: [['tfr', 'tbr', 'bbr', 'bfr'], [1, 0, 0]],
    west: [['tbl', 'tfl', 'bfl', 'bbl'], [-1, 0, 0]],
    up: [['tbl', 'tbr', 'tfr', 'tfl'], [0, 1, 0]],
    down: [['bfl', 'bfr', 'bbr', 'bbl'], [0, -1, 0]],
  };
  for (const [fk, [order, outward]] of Object.entries(defs)) {
    const region = regionMap[fk];
    if (!region) continue;
    const [rx, ry, rw, rh] = REG[region];
    const vs = order.map((k) => vk[k]);
    const uv = { [vs[0]]: [rx, ry], [vs[1]]: [rx + rw, ry], [vs[2]]: [rx + rw, ry + rh], [vs[3]]: [rx, ry + rh] };
    addQuad(el, vs, uv, outward, fk);
  }
  return el;
}

// trapezoid wedge: front section (z1, yf1..yf2) -> back section (z2, yb1..yb2), width x1..x2
function wedgeMesh(name, [x1, x2], z1, z2, yf1, yf2, yb1, yb2, regionMap, REG) {
  const el = baseElement(name);
  const P = {
    ftl: [x1, yf2, z1], ftr: [x2, yf2, z1], fbl: [x1, yf1, z1], fbr: [x2, yf1, z1],
    btl: [x1, yb2, z2], btr: [x2, yb2, z2], bbl: [x1, yb1, z2], bbr: [x2, yb1, z2],
  };
  const vk = {};
  Object.entries(P).forEach(([k, v], i) => { el.vertices['v' + i] = v; vk[k] = 'v' + i; });
  const cx = (x1 + x2) / 2, cy = (yf1 + yf2 + yb1 + yb2) / 4, cz = (z1 + z2) / 2;
  const q = (keys, outward, region) => {
    if (!region) return;
    const [rx, ry, rw, rh] = REG[region];
    const vs = keys.map((k) => vk[k]);
    const uv = { [vs[0]]: [rx, ry], [vs[1]]: [rx + rw, ry], [vs[2]]: [rx + rw, ry + rh], [vs[3]]: [rx, ry + rh] };
    const out = [outward[0] - cx, outward[1] - cy, outward[2] - cz];
    addQuad(el, vs, uv, out);
  };
  q(['ftl', 'ftr', 'fbr', 'fbl'], [(x1 + x2) / 2, (yf1 + yf2) / 2, z1], regionMap.front);
  q(['btr', 'btl', 'bbl', 'bbr'], [(x1 + x2) / 2, (yb1 + yb2) / 2, z2], regionMap.back);
  q(['btl', 'ftl', 'fbl', 'bbl'], [x1, (yf2 + yb2 + yf1 + yb1) / 4, (z1 + z2) / 2], regionMap.west);
  q(['ftr', 'btr', 'bbr', 'fbr'], [x2, (yf2 + yb2 + yf1 + yb1) / 4, (z1 + z2) / 2], regionMap.east);
  q(['ftl', 'btl', 'btr', 'ftr'], [cx, Math.max(yf2, yb2), cz], regionMap.up);
  q(['fbl', 'bbl', 'bbr', 'fbr'], [cx, Math.min(yf1, yb1), cz], regionMap.down);
  return el;
}

// cylinder along Y: side quads + top cap fan (with radial uv for the disc decal)
function cylinderMesh(name, cxr, cyBot, cyTop, r, seg, sideRegion, capRegion, REG) {
  const el = baseElement(name);
  const ring = [], topC = 'c_top';
  el.vertices[topC] = [cxr[0], cyTop, cxr[2]];
  if (capRegion) el.vertices['c_bot'] = [cxr[0], cyBot, cxr[2]];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = cxr[0] + r * Math.cos(a), z = cxr[2] + r * Math.sin(a);
    el.vertices['b' + i] = [x, cyBot, z];
    el.vertices['t' + i] = [x, cyTop, z];
    ring.push(i);
  }
  const [sx, sy, sw, sh] = REG[sideRegion];
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    const u0 = sx + (i / seg) * sw, u1 = sx + ((i + 1) / seg) * sw;
    const keys = ['b' + i, 'b' + j, 't' + j, 't' + i];
    const uv = { ['b' + i]: [u0, sy + sh], ['b' + j]: [u1, sy + sh], ['t' + j]: [u1, sy], ['t' + i]: [u0, sy] };
    const mid = [(el.vertices['b' + i][0] + el.vertices['t' + j][0]) / 2, cyBot, (el.vertices['b' + i][2] + el.vertices['t' + j][2]) / 2];
    addQuad(el, keys, uv, [mid[0] - cxr[0], 0, mid[2] - cxr[2]]);
  }
  if (capRegion) {
    const [rx, ry, rw, rh] = REG[capRegion];
    const ccx = rx + rw / 2, ccy = ry + rh / 2;
    el.faces.cap = { vertices: [], uv: {}, texture: 0 };
    const cap = el.faces.cap;
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      const a1 = (i / seg) * Math.PI * 2, a2 = (j / seg) * Math.PI * 2;
      const u1 = ccx + (rw / 2 - 0.4) * Math.cos(a1), v1 = ccy + (rh / 2 - 0.4) * Math.sin(a1);
      const u2 = ccx + (rw / 2 - 0.4) * Math.cos(a2), v2 = ccy + (rh / 2 - 0.4) * Math.sin(a2);
      cap.uv[topC] = [ccx, ccy];
      cap.uv['t' + i] = [u1, v1];
      cap.uv['t' + j] = [u2, v2];
      cap.vertices.push(topC, 't' + i, 't' + j);
    }
    orient(cap, el.vertices, [0, 1, 0]);
  }
  return el;
}

/* ===== trailer texture regions (free area of the source atlas) ===== */
const REG = {
  side: [0, 104, 44, 16],
  front: [48, 104, 20, 16],
  rear: [70, 112, 44, 12],
  roof: [0, 120, 44, 8],
  dark: [114, 104, 10, 6],
  mid: [114, 112, 10, 6],
  disc: [101, 104, 12, 12],
  cyl: [101, 117, 14, 3],
};

/* ===== trailer geometry =====
   cab deck top y=12 (z<=26.5); ground y0; wheel pairs at 4 axles */
const trailer = [];
const BOX_W = 12, BOX_TOP = 36, DECK = 8.5; // box width matches cab body width (wheels fully recessed)

// --- neck (small box over the cab connection) ---
trailer.push(boxMesh('trailer_neck', [-11, 17, 26.5], [11, 28, 40], {
  north: 'dark', south: 'dark', east: 'side', west: 'side', up: 'side', down: 'mid',
}, REG));
// --- trapezoid wedge: neck -> main box ---
trailer.push(wedgeMesh('trailer_wedge', [-BOX_W, BOX_W], 40, 46, 17, 28, DECK, BOX_TOP, {
  front: 'dark', back: 'dark', west: 'side', east: 'side', up: 'side', down: 'mid',
}, REG));
// --- main box: front wall / rear doors / roof / side sections with wheel-arch recess ---
trailer.push(boxMesh('trailer_front_wall', [-BOX_W, DECK, 46], [BOX_W, 34.5, 47.5], {
  north: 'mid', south: 'dark', east: 'side', west: 'side', up: 'dark',
}, REG));
trailer.push(boxMesh('trailer_rear_wall', [-BOX_W, DECK, 119.5], [BOX_W, 34.5, 121], {
  south: 'rear', north: 'mid', east: 'side', west: 'side', up: 'dark',
}, REG));
trailer.push(boxMesh('trailer_roof', [-BOX_W, 34.5, 46], [BOX_W, BOX_TOP, 121], {
  up: 'roof', down: 'mid', north: 'dark', south: 'dark', east: 'dark', west: 'dark',
}, REG));
const AXLES = [56, 68, 81, 93];
const ARCH0 = 50, ARCH1 = 99; // recess band (wheels span z 50.5..98.5)
for (const s of [-1, 1]) {
  const xo1 = s < 0 ? -BOX_W : BOX_W - 0.8, xo2 = s < 0 ? -BOX_W + 0.8 : BOX_W;
  const sn = s < 0 ? 'l' : 'r';
  const sideFaceKey = s < 0 ? 'west' : 'east';
  const sideFaces = { north: 'dark', south: 'dark', up: 'dark', down: 'mid' };
  sideFaces[sideFaceKey] = 'side';
  trailer.push(boxMesh('trailer_side_front_' + sn, [xo1, DECK, 47.5], [xo2, 34.5, ARCH0], sideFaces, REG));
  trailer.push(boxMesh('trailer_side_mid_' + sn, [xo1, 16, ARCH0], [xo2, 34.5, ARCH1], sideFaces, REG));
  trailer.push(boxMesh('trailer_side_rear_' + sn, [xo1, DECK, ARCH1], [xo2, 34.5, 119.5], sideFaces, REG));
  // landing gear (kept clear of the wheels, |x| < 6)
  trailer.push(boxMesh('landing_gear_' + sn, [s < 0 ? -5.5 : 4.5, 0, 48], [s < 0 ? -4.5 : 5.5, DECK, 50], {
    north: 'dark', south: 'dark', east: 'dark', west: 'dark', up: 'dark', down: 'dark',
  }, REG));
}
// central tunnel wall behind the wheel recess (clear of wheels |x| >= 6)
trailer.push(boxMesh('trailer_arch_back', [-4, DECK, ARCH0], [4, 16, ARCH1], {
  east: 'dark', west: 'dark', north: 'dark', south: 'dark', up: 'dark', down: 'dark',
}, REG));
// chassis rails (inner, clear of wheels)
for (const s of [-1, 1]) {
  trailer.push(boxMesh('trailer_rail_' + (s < 0 ? 'l' : 'r'), [s < 0 ? -5.5 : 3.5, 5.5, 47.5], [s < 0 ? -3.5 : 5.5, DECK, 119.5], {
    north: 'dark', south: 'dark', east: 'dark', west: 'dark', up: 'dark', down: 'dark',
  }, REG));
}
// underride bar
trailer.push(boxMesh('underride_bar', [-8.5, 2.5, 118], [8.5, 5, 119.5], {
  north: 'dark', south: 'dark', east: 'dark', west: 'dark', up: 'dark', down: 'dark',
}, REG));

// --- fifth-wheel disc + kingpin cylinder connecting neck to the cab deck (deck top y12) ---
trailer.push(cylinderMesh('fifth_wheel_disc', [0, 12, 26], 12, 13, 5, 14, 'cyl', 'disc', REG));
trailer.push(cylinderMesh('kingpin_cyl', [0, 13, 28], 13, 17, 1.7, 10, 'cyl', null, REG));

// --- 4 wheel pairs: left/right use their matching side templates ---
const leftWheelT = src.elements.find((e) => e.name === 'wheel' && e.origin[0] < 0);
const rightWheelT = src.elements.find((e) => e.name === 'wheel' && e.origin[0] > 0);
function cloneWheel(template, z, side) {
  const e = JSON.parse(JSON.stringify(template));
  e.uuid = uuid();
  e.name = 'trailer_wheel_' + side + '_' + z;
  e.origin = [template.origin[0], template.origin[1], z];
  return e;
}
for (const z of AXLES) {
  trailer.push(cloneWheel(leftWheelT, z, 'l'));
  trailer.push(cloneWheel(rightWheelT, z, 'r'));
}

/* ===== assemble model ===== */
const cabElements = src.elements;
const allElements = [...cabElements, ...trailer];

const trailerGroup = {
  name: 'trailer', origin: [0, 0, 0], rotation: [0, 0, 0], color: 0,
  uuid: uuid(), export: true, mirror_uv: false, isOpen: true, locked: false,
  visibility: true, autouv: 0, children: trailer.map((e) => e.uuid),
};
const cabGroup = {
  name: 'truck_cab', origin: [0, 0, 0], rotation: [0, 0, 0], color: 0,
  uuid: uuid(), export: true, mirror_uv: false, isOpen: true, locked: false,
  visibility: true, autouv: 0, children: cabElements.map((e) => e.uuid),
};
const rootGroup = {
  name: 'green_semi_truck', origin: [0, 0, 0], rotation: [0, 0, 0], color: 0,
  uuid: uuid(), export: true, mirror_uv: false, isOpen: true, locked: false,
  visibility: true, autouv: 0, children: [cabGroup, trailerGroup],
};

const model = {
  meta: { format_version: '5.0', model_format: 'free', box_uv: false },
  name: 'green_semi_truck',
  model_identifier: 'green_semi_truck',
  resolution: { width: 128, height: 128 },
  elements: allElements,
  outliner: [rootGroup],
  textures: [{ ...src.textures[0], name: 'green_semi_truck.png', uuid: uuid() }],
};

writeFileSync(OUT, JSON.stringify(model, null, 1));
console.log('elements:', allElements.length, '(cab', cabElements.length, '+ trailer', trailer.length + ')');
console.log('->', OUT);
