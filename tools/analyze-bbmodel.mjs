// Analyze a .bbmodel file: structure, counts, techniques.
// Usage: node tools/analyze-bbmodel.mjs <file.bbmodel> [more files...]
import { readFileSync } from 'node:fs';

function walkCount(els, acc) {
  if (!Array.isArray(els)) return;
  for (const e of els) {
    if (typeof e === 'string') continue;
    const type = e.type || '';
    if (type === 'cube') {
      acc.cubes++;
      if (acc.firstCube === null) acc.firstCube = e;
    } else if (type === 'mesh') {
      acc.meshes++;
      acc.meshVerts += (e.vertices ? e.vertices.length : 0);
      acc.meshFaces += (e.faces ? e.faces.length : 0);
      if (acc.firstMesh === null) acc.firstMesh = e;
    } else if (type === 'group' || e.origin || e.children) {
      acc.groups++;
      if (acc.firstGroup === null) acc.firstGroup = e;
    } else {
      acc.other++;
    }
    if (e.children) walkCount(e.children, acc);
  }
}

for (const f of process.argv.slice(2)) {
  let data;
  try {
    data = JSON.parse(readFileSync(f, 'utf-8'));
  } catch (err) {
    console.log('===', f, 'PARSE ERROR', err.message);
    continue;
  }
  const meta = data.meta || {};
  const acc = {
    cubes: 0, meshes: 0, groups: 0, other: 0,
    meshVerts: 0, meshFaces: 0,
    firstCube: null, firstMesh: null, firstGroup: null,
  };
  walkCount(data.elements, acc);

  console.log('====================', f);
  console.log('format:', meta.model_format, '| format_version:', meta.format_version, '| resolution:', JSON.stringify(data.resolution));
  console.log('top keys:', Object.keys(data).join(', '));
  console.log(`counts -> cubes:${acc.cubes} meshes:${acc.meshes} meshVerts:${acc.meshVerts} meshFaces:${acc.meshFaces} groups/nodes:${acc.groups}`);
  console.log('textures:', (data.textures || []).map(t => `${t.name}(${t.width || '?'}x${t.height || '?'}${t.source ? ',src' : ''})`).join(' ') || 'none');

  if (acc.firstCube) {
    const c = acc.firstCube;
    console.log('first cube:', JSON.stringify({ name: c.name, from: c.from, to: c.to, origin: c.origin, rotation: c.rotation, inflate: c.inflate, autouv: c.autouv }));
  }
  if (acc.firstMesh) {
    const m = acc.firstMesh;
    console.log('first mesh:', JSON.stringify({ name: m.name, vertices: (m.vertices || []).length, faces: (m.faces || []).length, origin: m.origin, rotation: m.rotation }));
  }
  // uv / box_uv presence
  const cubes = (data.elements || []).filter((e) => e.type === 'cube');
  const infl = cubes.filter((c) => c.inflate).length;
  const rotCubes = cubes.filter((c) => c.rotation && c.rotation.some((v) => v !== 0)).length;
  const faceKeys = new Set();
  for (const c of cubes) {
    if (c.faces) for (const k of Object.keys(c.faces)) faceKeys.add(k);
  }
  console.log(`cube details -> inflate:${infl} rotatedCubes:${rotCubes} facesWithCustomTexture:${[...faceKeys].join(',') || 'none'}`);
}
