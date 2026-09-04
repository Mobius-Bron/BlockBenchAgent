// Extract geometry from a truck .bbmodel and emit a replayable MCP build payload.
// Usage: node tools/emit-truck-replica.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = process.argv[2] ?? join(ROOT, 'projects', 'white-low-poly-semi-truck.bbmodel');
const OUT = join(ROOT, '.bbdata', 'replica');
mkdirSync(OUT, { recursive: true });

const j = JSON.parse(readFileSync(SRC, 'utf-8'));
const texSrc = (j.textures && j.textures[0]) || {};
// save texture png
const b64 = (texSrc.source || '').split(',')[1] || '';
writeFileSync(join(OUT, 'tex.png'), Buffer.from(b64, 'base64'));

const meshes = j.elements.filter((e) => e.type === 'mesh');
// group by identical topology (vertices+faces signature)
const sig = (m) => JSON.stringify([m.vertices, m.faces]);
const groups = [];
for (const m of meshes) {
  const s = sig(m);
  let g = groups.find((x) => x.sig === s);
  if (!g) {
    g = { sig: s, kind: m.name + '_' + groups.length, localVerts: [], faces: [], instances: [] };
    groups.push(g);
    const vMap = {}; // original vertex key -> index
    let vi = 0;
    for (const [k, v] of Object.entries(m.vertices)) {
      vMap[k] = vi++;
      g.localVerts.push(v);
    }
    for (const [fk, f] of Object.entries(m.faces)) {
      const uvMap = [];
      for (const vk of f.vertices) {
        const idx = vMap[vk];
        const uv = (f.uv && f.uv[vk]) || [0, 0];
        uvMap.push([idx, uv]);
      }
      g.faces.push({ inds: f.vertices.map((vk) => vMap[vk]), uvMap });
    }
  }
  g.instances.push({ name: m.name, origin: m.origin, rotation: m.rotation });
}

const mkCode = (g) => {
  const ds = JSON.stringify({ localVerts: g.localVerts, faces: g.faces, instances: g.instances });
  const code =
    "(async()=>{const ds=" + ds + ";const tex=Project.textures.find(t=>t&&t.name==='truck_tex');const added=[];for(const inst of ds.instances){const mesh=new Mesh({name:inst.name,vertices:{},origin:inst.origin,rotation:inst.rotation,shading:'smooth'}).init();const map=[];for(const v of ds.localVerts){map.push(mesh.addVertices(v)[0]);}for(const f of ds.faces){const vs=f.inds.map(i=>map[i]);const face=new MeshFace(mesh,{vertices:vs,texture:tex?tex.uuid:undefined});const fk=mesh.addFaces(face)[0];const fc=mesh.faces[fk];if(fc){const uo={};for(const [i,uv] of f.uvMap){uo[map[i]]=[uv[0],uv[1]];}fc.uv=uo;}}mesh.addTo('root');if(tex)mesh.applyTexture(tex);if(mesh.preview_controller){mesh.preview_controller.updateGeometry(mesh);mesh.preview_controller.updateUV(mesh);}added.push(mesh.name);}Canvas.updateView({});return {added:added.length,tex:!!tex};})()";
  return code;
};

const calls = [
  { tool: 'create_project', args: { name: 'truck_replica', format: 'generic' } },
  {
    tool: 'create_texture',
    args: { name: 'truck_tex', width: texSrc.width || 128, height: texSrc.height || 128, data: join(OUT, 'tex.png') },
  },
];
for (const g of groups) {
  calls.push({ tool: 'risky_eval', args: { code: mkCode(g) } });
}

writeFileSync(join(OUT, 'payload.json'), JSON.stringify({ calls }, null, 1));
console.log('groups:', groups.length, 'templates');
console.log('total instances:', groups.reduce((a, g) => a + g.instances.length, 0));
console.log('payload bytes:', (join(OUT, 'payload.json').length, JSON.stringify({ calls }).length));
