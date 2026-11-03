import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BUILDINGS } from '../../src/core/data/buildings';
import { CATALOG, CATALOG_MAP, buildingModelId } from '../../src/render3d/models/catalog';
import { MATERIALS, hexToLinear } from '../../src/render3d/models/materials';
import { buildMeshes, partPolygons, partsBounds, polygonNormal, Part } from '../../src/render3d/models/primitives';
import { partsToGlb, readGlb } from '../../src/render3d/models/glbWriter';
import { STYLE_MAX_DENSITY, zoneModelId } from '../../src/render3d/models/zones';
import { gltfToPieces } from '../../src/render3d/library';

const MODELS = join(__dirname, '../../public/models');

describe('procedural primitives', () => {
  const parts: Part[] = [
    { t: 'box', p: [0, 0, 0], s: [1, 2, 3], m: 'stone' },
    { t: 'frustum', p: [1, 0, 0], s: [1, 1, 0, 0, 1], m: 'stone' },
    { t: 'gable', p: [0, 1, 0], s: [1, 0.5, 2], r: [0, 0.7, 0], m: 'terracotta' },
    { t: 'cyl', p: [0, 0, 2], s: [0.3, 0.1, 1, 8], m: 'steel', smooth: true },
    { t: 'sphere', p: [2, 0, 2], s: [0.5, 0.3, 0.5, 10, 4, 1], m: 'gold' },
  ];

  it.each(parts.map((p) => [p.t, p] as const))('%s faces point outwards with unit normals', (_t, part) => {
    const polys = partPolygons(part);
    expect(polys.length).toBeGreaterThan(3);
    const all = polys.flatMap((p) => p.verts);
    const c = all.reduce((a, v) => [a[0] + v[0] / all.length, a[1] + v[1] / all.length, a[2] + v[2] / all.length], [0, 0, 0]);
    for (const poly of polys) {
      const n = polygonNormal(poly.verts);
      const pc = poly.verts.reduce((a, v) => [a[0] + v[0] / poly.verts.length, a[1] + v[1] / poly.verts.length, a[2] + v[2] / poly.verts.length], [0, 0, 0]);
      expect(n[0] * (pc[0] - c[0]) + n[1] * (pc[1] - c[1]) + n[2] * (pc[2] - c[2])).toBeGreaterThanOrEqual(-1e-6);
      for (const nn of poly.normals ?? []) expect(Math.hypot(...nn)).toBeCloseTo(1, 5);
    }
  });

  it('a box has 12 triangles and exact bounds', () => {
    const mesh = buildMeshes([parts[0]]).get('stone')!;
    expect(mesh.indices.length / 3).toBe(12);
    expect(partsBounds([parts[0]])).toEqual({ min: [-0.5, 0, -1.5], max: [0.5, 2, 1.5] });
  });

  it('converts sRGB material colours to linear for glTF', () => {
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToLinear('#000000')).toEqual([0, 0, 0]);
    expect(hexToLinear('#808080')[0]).toBeCloseTo(0.2158, 3);
  });
});

describe('3D model catalog', () => {
  it('has a model for every building, every reachable zone tier, vehicles, trees and transport pieces', () => {
    for (const b of BUILDINGS) expect(CATALOG_MAP[buildingModelId(b.id)], b.id).toBeDefined();
    for (const z of ['R', 'C', 'I'] as const)
      for (let style = 1; style <= 4; style++) for (let d = 1; d <= STYLE_MAX_DENSITY[style]; d++) expect(CATALOG_MAP[zoneModelId(z, d, style)], `${z}${d}e${style}`).toBeDefined();
    for (const v of ['vehicle_jong', 'vehicle_junk', 'vehicle_steam_loco', 'vehicle_mrt', 'vehicle_container_ship', 'vehicle_car']) expect(CATALOG_MAP[v]).toBeDefined();
    for (const k of ['infra_highway_arm', 'infra_mrt_arm', 'infra_rail_arm', 'infra_road_arm_e1', 'tree_rainforest', 'tree_oilpalm']) expect(CATALOG_MAP[k]).toBeDefined();
    expect(CATALOG.length).toBeGreaterThanOrEqual(120);
  });

  it('clamps zone lookups to existing tiers', () => {
    expect(zoneModelId('R', 4, 1)).toBe('zone_R_d2_e1');
    expect(zoneModelId('C', 0, 0)).toBe('zone_C_d1_e1');
  });

  it.each(CATALOG.map((e) => [e.id, e] as const))('%s builds valid, bounded geometry with known materials', (_id, e) => {
    const parts = e.build();
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) expect(MATERIALS[p.m], p.m).toBeDefined();
    const meshes = buildMeshes(parts);
    let tris = 0;
    for (const m of meshes.values()) {
      expect(m.positions.length).toBe(m.normals.length);
      for (const v of m.positions) expect(Number.isFinite(v)).toBe(true);
      tris += m.indices.length / 3;
    }
    expect(tris).toBeGreaterThan(5);
    expect(tris).toBeLessThan(8000);
    const { min, max } = partsBounds(parts);
    if (e.kind === 'building' || e.kind === 'zone') {
      // waterside models reach into the water in front (+z); everything else stays near its lot
      const reach = e.size / 2 + 1.1;
      expect(min[0]).toBeGreaterThan(-reach);
      expect(max[0]).toBeLessThan(reach);
      expect(min[2]).toBeGreaterThan(-reach);
      expect(min[1]).toBeGreaterThan(-0.6);
    }
    expect(max[1]).toBeLessThan(14);
  });

  it('landmarks are taller than ordinary buildings (the megatowers dominate the skyline)', () => {
    const h = (id: string) => partsBounds(CATALOG_MAP[buildingModelId(id)].build()).max[1];
    expect(h('menara_118')).toBeGreaterThan(h('menara_berkembar'));
    expect(h('menara_berkembar')).toBeGreaterThan(6);
    expect(h('istana')).toBeGreaterThan(h('surau'));
  });
});

describe('binary glTF pipeline', () => {
  it('the Node packer writes a valid glb that three.js GLTFLoader can parse', async () => {
    const e = CATALOG_MAP.building_masjid;
    const glb = partsToGlb(e.id, e.build(), { kind: 'building' });
    const { json, bin } = readGlb(glb);
    expect(json.asset.version).toBe('2.0');
    expect(bin.byteLength).toBe(json.buffers[0].byteLength);
    for (const v of json.bufferViews) expect(v.byteOffset % 4).toBe(0);
    const gltf = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer, '');
    const pieces = gltfToPieces(gltf.scene);
    expect(pieces.map((p) => p.mat).sort()).toEqual([...buildMeshes(e.build()).keys()].sort());
  });

  const manifestPath = join(MODELS, 'manifest.json');
  const hasModels = existsSync(manifestPath);

  it.runIf(hasModels)('public/models contains one glb per catalog model plus a manifest', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { generator: string; models: Record<string, { file: string; kind: string }> };
    const files = readdirSync(MODELS).filter((f) => f.endsWith('.glb'));
    expect(files.length).toBe(CATALOG.length);
    for (const e of CATALOG) {
      expect(manifest.models[e.id]?.file).toBe(`${e.id}.glb`);
      expect(manifest.models[e.id].kind).toBe(e.kind);
    }
  });

  it.runIf(hasModels)('every exported glb is valid glTF 2.0 with catalog material names', () => {
    let total = 0;
    for (const e of CATALOG) {
      const bytes = new Uint8Array(readFileSync(join(MODELS, `${e.id}.glb`)));
      total += bytes.byteLength;
      const { json } = readGlb(bytes);
      expect(json.asset.version).toBe('2.0');
      expect(json.meshes.length).toBeGreaterThan(0);
      for (const m of json.materials) expect(MATERIALS[m.name as keyof typeof MATERIALS], `${e.id}:${m.name}`).toBeDefined();
      const pos = json.accessors[json.meshes[0].primitives[0].attributes.POSITION] as { min: number[]; max: number[] };
      expect(pos.min).toHaveLength(3);
    }
    expect(total).toBeLessThan(8 * 1024 * 1024);
  });

  it.runIf(hasModels)('a Blender-exported model loads through GLTFLoader with the same materials as the inline build', async () => {
    const id = 'building_istana';
    const buf = readFileSync(join(MODELS, `${id}.glb`));
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(buf).buffer, '');
    const pieces = gltfToPieces(gltf.scene);
    expect(pieces.map((p) => p.mat).sort()).toEqual([...buildMeshes(CATALOG_MAP[id].build()).keys()].sort());
    const box = new THREE.Box3();
    for (const p of pieces) box.union(p.geometry.boundingBox!);
    const inline = partsBounds(CATALOG_MAP[id].build());
    expect(box.min.y).toBeCloseTo(inline.min[1], 3);
    expect(box.max.x).toBeCloseTo(inline.max[0], 3);
    expect(box.max.y).toBeCloseTo(inline.max[1], 3);
  });
});
