/**
 * Minimal binary glTF 2.0 (.glb) writer for the procedural catalog. Each
 * model becomes one node with one mesh holding a primitive per PBR material.
 * Spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
 */
import { MATERIALS, MatId, hexToLinear } from './materials';
import { MeshData, Part, buildMeshes } from './primitives';

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

interface GltfJson {
  asset: { version: string; generator: string };
  scene: number;
  scenes: Array<{ nodes: number[]; name?: string }>;
  nodes: Array<{ mesh: number; name: string; extras?: Record<string, unknown> }>;
  meshes: Array<{ name: string; primitives: Array<{ attributes: Record<string, number>; indices: number; material: number; mode: number }> }>;
  materials: Array<Record<string, unknown>>;
  accessors: Array<Record<string, unknown>>;
  bufferViews: Array<{ buffer: number; byteOffset: number; byteLength: number; target: number }>;
  buffers: Array<{ byteLength: number }>;
}

const pad4 = (n: number) => (n + 3) & ~3;

export function materialJson(id: MatId) {
  const m = MATERIALS[id] as (typeof MATERIALS)[MatId] & { emissive?: string; emissiveBase?: number; opacity?: number };
  const [r, g, b] = hexToLinear(m.color);
  const out: Record<string, unknown> = {
    name: id,
    pbrMetallicRoughness: { baseColorFactor: [r, g, b, m.opacity ?? 1], metallicFactor: m.metalness, roughnessFactor: m.roughness },
  };
  if (m.emissive && m.emissiveBase) {
    const e = hexToLinear(m.emissive);
    out.emissiveFactor = e.map((v) => Math.min(1, v * m.emissiveBase!));
  }
  return out;
}

/** Encode one model (list of parts) as a .glb file. */
export function partsToGlb(id: string, parts: Part[], extras: Record<string, unknown> = {}, generator = 'tamadun-kota procedural glb packer'): Uint8Array {
  return meshesToGlb(id, buildMeshes(parts), extras, generator);
}

export function meshesToGlb(id: string, meshes: Map<MatId, MeshData>, extras: Record<string, unknown> = {}, generator = 'tamadun-kota procedural glb packer'): Uint8Array {
  const json: GltfJson = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ nodes: [0], name: id }],
    nodes: [{ mesh: 0, name: id, extras }],
    meshes: [{ name: id, primitives: [] }],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const addView = (bytes: Uint8Array, target: number) => {
    const view = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target });
    const padded = new Uint8Array(pad4(bytes.byteLength));
    padded.set(bytes);
    chunks.push(padded);
    offset += padded.byteLength;
    return view;
  };
  for (const [mat, mesh] of meshes) {
    const count = mesh.positions.length / 3;
    if (!count) continue;
    const pos = new Float32Array(mesh.positions);
    const nrm = new Float32Array(mesh.normals);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3)
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], pos[i + k]);
        max[k] = Math.max(max[k], pos[i + k]);
      }
    const big = count > 65535;
    const idx = big ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices);
    const posAcc = json.accessors.length;
    json.accessors.push({ bufferView: addView(new Uint8Array(pos.buffer), ARRAY_BUFFER), componentType: FLOAT, count, type: 'VEC3', min, max });
    const nrmAcc = json.accessors.length;
    json.accessors.push({ bufferView: addView(new Uint8Array(nrm.buffer), ARRAY_BUFFER), componentType: FLOAT, count, type: 'VEC3' });
    const idxAcc = json.accessors.length;
    json.accessors.push({ bufferView: addView(new Uint8Array(idx.buffer), ELEMENT_ARRAY_BUFFER), componentType: big ? UNSIGNED_INT : UNSIGNED_SHORT, count: idx.length, type: 'SCALAR' });
    const matIndex = json.materials.length;
    json.materials.push(materialJson(mat));
    json.meshes[0].primitives.push({ attributes: { POSITION: posAcc, NORMAL: nrmAcc }, indices: idxAcc, material: matIndex, mode: 4 });
  }
  json.buffers.push({ byteLength: offset });

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = pad4(jsonBytes.byteLength);
  const total = 12 + 8 + jsonLen + 8 + offset;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true);
  dv.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonLen);
  let p = 20 + jsonLen;
  dv.setUint32(p, offset, true);
  dv.setUint32(p + 4, CHUNK_BIN, true);
  p += 8;
  for (const c of chunks) {
    out.set(c, p);
    p += c.byteLength;
  }
  return out;
}

/** Parse the header and JSON chunk of a .glb (for validation and tests). */
export function readGlb(bytes: Uint8Array): { json: GltfJson; bin: Uint8Array } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('not a glb file');
  if (dv.getUint32(4, true) !== 2) throw new Error('unsupported glTF version');
  if (dv.getUint32(8, true) !== bytes.byteLength) throw new Error('length mismatch');
  const jsonLen = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== CHUNK_JSON) throw new Error('first chunk must be JSON');
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen))) as GltfJson;
  let bin = new Uint8Array(0);
  const p = 20 + jsonLen;
  if (p + 8 <= bytes.byteLength) {
    const binLen = dv.getUint32(p, true);
    if (dv.getUint32(p + 4, true) !== CHUNK_BIN) throw new Error('second chunk must be BIN');
    bin = bytes.subarray(p + 8, p + 8 + binLen);
  }
  return { json, bin };
}
