// Second attempt: recreate truck 1:1 with texture registered at face-creation time.
// Usage: node tools/emit-truck-replica2.mjs
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
const dataURL = texSrc.source || '';

const meshes = j.elements.filter((e) => e.type === 'mesh');
const sig = (m) => JSON.stringify([m.vertices, m.faces]);
const groups = [];
for (const m of meshes) {
  const s = sig(m);
  let g = groups.find((x) => x.sig === s);
  if (!g) {
    g = { sig: s, kind: m.name + '_' + groups.length, localVerts: [], faces: [], instances: [] };
    groups.push(g);
    const vMap = {};
    let vi = 0;
    for (const [k, v] of Object.entries(m.vertices)) {
      vMap[k] = vi++;
      g.localVerts.push(v);
    }
    for (const f of Object.values(m.faces)) {
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
    "(async()=>{const ds=" + ds + ";const tex=Project.textures.find(t=>t&&t.name==='tex.png'&&t.uv_width===128);const added=[];for(const inst of ds.instances){const mesh=new Mesh({name:inst.name,vertices:{},origin:inst.origin,rotation:inst.rotation,shading:'smooth'}).init();const map=[];for(const v of ds.localVerts){map.push(mesh.addVertices(v)[0]);}for(const f of ds.faces){const vs=f.inds.map(i=>map[i]);const face=new MeshFace(mesh,{vertices:vs,texture:tex?tex.uuid:undefined});const fk=mesh.addFaces(face)[0];const fc=mesh.faces[fk];if(fc&&tex){const uo={};for(const ent of f.uvMap){const i=ent[0],uv=ent[1];uo[map[i]]=[uv[0],uv[1]];}fc.uv=uo;}}mesh.addTo('root');if(mesh.preview_controller){mesh.preview_controller.updateGeometry(mesh);mesh.preview_controller.updateUV(mesh);}added.push(mesh.name);}Canvas.updateView({});return {added:added.length,tex:!!tex};})()";
  return code;
};

const calls = [
  { tool: 'create_project', args: { name: 'truck_replica2', format: 'generic' } },
  {
    tool: 'create_texture',
    args: { name: 'tex.png', width: texSrc.width || 128, height: texSrc.height || 128, data: dataURL, layer_name: 'base' },
  },
];
for (const g of groups) {
  calls.push({ tool: 'risky_eval', args: { code: mkCode(g) } });
}
const payload = { calls };
writeFileSync(join(OUT, 'payload2.json'), JSON.stringify(payload, null, 1));
console.log('payload2 groups:', groups.length, 'instances:', groups.reduce((a, g) => a + g.instances.length, 0));
console.log('size:', JSON.stringify(payload).length);
