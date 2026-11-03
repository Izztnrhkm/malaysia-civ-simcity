import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CATALOG_MAP } from './models/catalog';
import { MATERIALS, MATERIAL_IDS, MatId, MaterialDef } from './models/materials';
import { Part, buildMeshes } from './models/primitives';

export interface ModelPiece {
  mat: MatId;
  geometry: THREE.BufferGeometry;
}
export interface ModelGeom {
  id: string;
  pieces: ModelPiece[];
  /** where the geometry came from */
  source: 'inline' | 'glb';
}

export function partsToGeometry(parts: Part[]): ModelPiece[] {
  const out: ModelPiece[] = [];
  for (const [mat, mesh] of buildMeshes(parts)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
    g.setIndex(mesh.indices);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    out.push({ mat, geometry: g });
  }
  return out;
}

/**
 * Shared geometry and PBR materials for every catalog model. Geometry is built
 * inline on first use (instant, works offline and inside the single-file
 * Artifact) and can be swapped for the Blender-exported `.glb` files with
 * `loadGLB()`. `version` increments whenever geometry changes so instanced
 * layers know to rebuild.
 */
export class ModelLibrary {
  readonly materials = {} as Record<MatId, THREE.MeshStandardMaterial>;
  private models = new Map<string, ModelGeom>();
  version = 0;
  glbLoaded = 0;
  private night = 0;

  constructor() {
    for (const id of MATERIAL_IDS) {
      const d = MATERIALS[id] as MaterialDef;
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(d.color), metalness: d.metalness, roughness: d.roughness, name: id, flatShading: false });
      if (d.emissive) {
        m.emissive = new THREE.Color(d.emissive);
        m.emissiveIntensity = d.emissiveBase ?? 0;
      }
      if (d.opacity != null && d.opacity < 1) {
        m.transparent = true;
        m.opacity = d.opacity;
      }
      this.materials[id] = m;
    }
  }

  has(id: string) {
    return this.models.has(id) || !!CATALOG_MAP[id];
  }

  get(id: string): ModelGeom {
    let m = this.models.get(id);
    if (!m) {
      const entry = CATALOG_MAP[id];
      if (!entry) throw new Error(`Unknown model ${id}`);
      m = { id, pieces: partsToGeometry(entry.build()), source: 'inline' };
      this.models.set(id, m);
    }
    return m;
  }

  /** Register an ad-hoc model built from parts (e.g. foundation plinths). */
  register(id: string, parts: Part[]): ModelGeom {
    const m: ModelGeom = { id, pieces: partsToGeometry(parts), source: 'inline' };
    this.models.set(id, m);
    return m;
  }

  /** Night factor 0..1 drives window glow and lamps. */
  setNight(f: number) {
    if (Math.abs(f - this.night) < 0.002) return;
    this.night = f;
    for (const id of MATERIAL_IDS) {
      const d = MATERIALS[id] as MaterialDef;
      if (d.emissive) this.materials[id].emissiveIntensity = (d.emissiveBase ?? 0) + f * f * (d.glow ?? 0);
    }
  }

  /** Replace inline geometry with the meshes from `.glb` files. */
  async loadGLB(baseUrl: string, ids?: string[]): Promise<number> {
    const res = await fetch(`${baseUrl}manifest.json`);
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    const manifest = (await res.json()) as { models: Record<string, { file: string }> };
    const loader = new GLTFLoader();
    const wanted = ids ?? Object.keys(manifest.models);
    let n = 0;
    await Promise.all(
      wanted.map(async (id) => {
        const info = manifest.models[id];
        if (!info) return;
        const gltf = await loader.loadAsync(`${baseUrl}${info.file}`);
        const pieces = gltfToPieces(gltf.scene);
        if (!pieces.length) return;
        const old = this.models.get(id);
        this.models.set(id, { id, pieces, source: 'glb' });
        old?.pieces.forEach((p) => p.geometry.dispose());
        n++;
      }),
    );
    this.glbLoaded += n;
    if (n) this.version++;
    return n;
  }

  dispose() {
    for (const m of this.models.values()) m.pieces.forEach((p) => p.geometry.dispose());
    for (const id of MATERIAL_IDS) this.materials[id].dispose();
    this.models.clear();
  }
}

/** Flatten a loaded glTF scene into one geometry per catalog material. */
export function gltfToPieces(root: THREE.Object3D): ModelPiece[] {
  root.updateMatrixWorld(true);
  const byMat = new Map<MatId, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const name = (mats[0]?.name ?? '') as MatId;
    const mat: MatId = name in MATERIALS ? name : 'concrete';
    const g = mesh.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(mesh.matrixWorld);
    if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
    const list = byMat.get(mat) ?? [];
    list.push(g);
    byMat.set(mat, list);
  });
  const out: ModelPiece[] = [];
  for (const [mat, list] of byMat) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    out.push({ mat, geometry: merged });
  }
  return out;
}
