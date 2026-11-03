/**
 * Exports the procedural 3D catalog.
 *
 *   npx vite-node scripts/generate-glb.ts            # spec + .glb files (Node packer)
 *   npx vite-node scripts/generate-glb.ts --spec-only # only scripts/model_spec.json
 *
 * `scripts/model_spec.json` is the input of `scripts/generate_blender_models.py`,
 * which rebuilds the same parts with Blender's bmesh and exports through
 * Blender's glTF exporter. This Node path is the fallback when Blender is not
 * installed: it writes byte-for-byte valid binary glTF 2.0 directly.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from '../src/render3d/models/catalog';
import { MATERIALS } from '../src/render3d/models/materials';
import { partsToGlb } from '../src/render3d/models/glbWriter';

const args = process.argv.slice(2);
const specOnly = args.includes('--spec-only');
const outDir = args[args.indexOf('--out') + 1] && args.includes('--out') ? args[args.indexOf('--out') + 1] : 'public/models';

const spec = {
  format: 'tamadun-kota-model-spec',
  version: 1,
  units: '1 unit = 1 map tile; +Y up; parts positioned by base centre; rotations X then Y then Z (radians)',
  materials: MATERIALS,
  models: CATALOG.map((e) => ({ id: e.id, kind: e.kind, size: e.size, era: e.era, parts: e.build() })),
};
writeFileSync('scripts/model_spec.json', JSON.stringify(spec));
console.log(`scripts/model_spec.json: ${spec.models.length} models, ${spec.models.reduce((n, m) => n + m.parts.length, 0)} parts`);

if (!specOnly) {
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (f.endsWith('.glb')) rmSync(join(outDir, f));
  let bytes = 0;
  const manifest: Record<string, { file: string; kind: string; size: number; era: number }> = {};
  for (const m of spec.models) {
    const glb = partsToGlb(m.id, m.parts, { kind: m.kind, size: m.size, era: m.era });
    writeFileSync(join(outDir, `${m.id}.glb`), glb);
    bytes += glb.byteLength;
    manifest[m.id] = { file: `${m.id}.glb`, kind: m.kind, size: m.size, era: m.era };
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ generator: 'node', version: 1, models: manifest }, null, 1));
  console.log(`${outDir}: ${spec.models.length} .glb files, ${(bytes / 1024).toFixed(0)} KiB`);
}
