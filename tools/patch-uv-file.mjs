// Backfill per-face uv into an exported replica .bbmodel using source mesh uv,
// matching elements by (name, origin).
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('projects/white-low-poly-semi-truck.bbmodel', 'utf-8'));
const outPath = 'projects/truck_replica2.bbmodel';
const out = JSON.parse(readFileSync(outPath, 'utf-8'));

const srcMeshes = src.elements.filter((e) => e.type === 'mesh');
let patchedFaces = 0;
let matched = 0;

for (const m of out.elements) {
  if (m.type !== 'mesh') continue;
  const key = (x) => x.name + '@' + JSON.stringify(x.origin);
  const srcMesh = srcMeshes.find((s) => key(s) === key(m));
  if (!srcMesh) continue;
  matched++;

  // map source vertex key -> index in source vertices insertion order
  const oldKeys = Object.keys(srcMesh.vertices);
  // exported mesh vertices are stored in insertion order same as source;
  // verify counts
  const newKeys = Object.keys(m.vertices);
  if (oldKeys.length !== newKeys.length) continue;
  const oldToNew = {};
  oldKeys.forEach((k, i) => (oldToNew[k] = newKeys[i]));

  for (const [fk, face] of Object.entries(m.faces)) {
    const sFace = srcMesh.faces[fk]; // same face key order? not guaranteed - find by matching vertex count/order
  }
  // safer: iterate both face lists in order (identical order preserved by exporter)
  const srcFaceKeys = Object.keys(srcMesh.faces);
  const newFaceKeys = Object.keys(m.faces);
  if (srcFaceKeys.length !== newFaceKeys.length) continue;
  for (let i = 0; i < newFaceKeys.length; i++) {
    const face = m.faces[newFaceKeys[i]];
    const sFace = srcMesh.faces[srcFaceKeys[i]];
    if (!face || !sFace || !sFace.uv) continue;
    const uv = {};
    const verts = face.vertices || [];
    for (let j = 0; j < verts.length; j++) {
      const vk = verts[j];
      const suv = sFace.uv[sFace.vertices[j]];
      uv[vk] = suv ? [suv[0], suv[1]] : [0, 0];
    }
    face.uv = uv;
    face.texture = 0;
    patchedFaces++;
  }
}

writeFileSync(outPath, JSON.stringify(out, null, 1));
const check = JSON.parse(readFileSync(outPath, 'utf-8'));
const body = check.elements.find((e) => e.name === 'body');
const fk = Object.keys(body.faces)[0];
console.log('matched meshes:', matched, 'patched faces:', patchedFaces);
console.log('body face0 uv:', JSON.stringify(body.faces[fk].uv));
