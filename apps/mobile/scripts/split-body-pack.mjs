// Splits the downloaded "male & female base mesh pack" (.glb, both bodies in
// one scene) into the two models the app loads.
//
// Usage: node scripts/split-body-pack.mjs <path/to/male__female_base_mesh_pack.glb>

import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = [
  { meshPrefix: 'Male1', out: 'male.glb' },
  { meshPrefix: 'LOD7', out: 'female.glb' },
];

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/split-body-pack.mjs <pack.glb>');
  process.exit(1);
}

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/models');
const io = new NodeIO();

for (const { meshPrefix, out } of MODELS) {
  const doc = await io.read(source);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (mesh && !mesh.getName().startsWith(meshPrefix)) node.dispose();
  }
  // The app applies its own material, so drop the source one and the UVs.
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      prim.setMaterial(null);
      prim.setAttribute('TEXCOORD_0', null);
    }
  }
  await doc.transform(prune());
  await io.write(path.join(outDir, out), doc);
  console.log(`${out}: ${doc.getRoot().listMeshes().map((m) => m.getName()).join(', ')}`);
}
