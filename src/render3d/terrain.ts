import * as THREE from 'three';
import { SEA_LEVEL } from '../core/map/terrain';
import { hash2 } from '../core/rng';
import { MapLayers, T, isWater } from '../core/types';

/** Water surface height. Land tile tops are above it, sea/river beds below. */
export const WATER_Y = 0;
export const SKIRT_Y = -1.6;
export const CHUNK = 16;

const q = (v: number, step: number) => Math.round(v / step) * step;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Terraced height of a tile top. */
export function tileHeight(t: number, e: number): number {
  switch (t) {
    case T.DEEP:
      return -1.1;
    case T.SEA:
      return -0.7;
    case T.SHALLOW:
      return -0.3;
    case T.RIVER:
      return -0.26;
    case T.BEACH:
      return 0.06;
    case T.MANGROVE:
      return 0.05;
    case T.HILL:
      return 0.85 + q(clamp01((e - 162) / 43) * 0.9, 0.25);
    case T.MOUNTAIN:
      return 1.85 + q(clamp01((e - 205) / 50) * 2.4, 0.3);
    default:
      return 0.12 + q(clamp01((e - SEA_LEVEL) / 85) * 0.6, 0.15);
  }
}

export function computeHeights(m: MapLayers): Float32Array {
  const h = new Float32Array(m.width * m.height);
  for (let i = 0; i < h.length; i++) h[i] = tileHeight(m.terrain[i], m.elevation[i]);
  return h;
}

/** Height at which things stand on a tile (water tiles: the water surface). */
export function standHeight(heights: Float32Array, i: number): number {
  return Math.max(WATER_Y, heights[i]);
}

const TOP_COLORS: Record<number, string> = {
  [T.DEEP]: '#22414c',
  [T.SEA]: '#35605e',
  [T.SHALLOW]: '#bfae80',
  [T.BEACH]: '#e3d19b',
  [T.MANGROVE]: '#4d6a38',
  [T.RIVER]: '#6b6748',
  [T.PLAIN]: '#69a64c',
  [T.JUNGLE]: '#2f6d33',
  [T.HILL]: '#7f9156',
  [T.MOUNTAIN]: '#8b887a',
};
const topColor = Object.fromEntries(Object.entries(TOP_COLORS).map(([k, v]) => [k, new THREE.Color(v)])) as Record<number, THREE.Color>;
const WALL_EARTH = new THREE.Color('#6b4d33');
const WALL_ROCK = new THREE.Color('#6d685d');
const WALL_SAND = new THREE.Color('#b59d68');
const SKIRT = new THREE.Color('#4a3626');
const FERTILE = new THREE.Color('#8fc04e');
const TIN = new THREE.Color('#b9b2a6');

export function tileColor(m: MapLayers, i: number, out = new THREE.Color()): THREE.Color {
  const t = m.terrain[i];
  out.copy(topColor[t] ?? topColor[T.PLAIN]);
  const x = i % m.width;
  const y = (i / m.width) | 0;
  if (t === T.PLAIN) out.lerp(FERTILE, (m.fertility[i] / 255) * 0.45);
  if (m.tin[i] && !isWater(t)) out.lerp(TIN, 0.25 + (m.tin[i] / 255) * 0.35);
  const n = (hash2(x, y, 11) - 0.5) * 0.08;
  out.r = clamp01(out.r + n);
  out.g = clamp01(out.g + n);
  out.b = clamp01(out.b + n * 0.6);
  return out;
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Geometry for one chunk of terraced tiles (tops, cliff walls and map-edge skirt). */
export function buildChunkGeometry(m: MapLayers, heights: Float32Array, cx: number, cy: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const quad = (a: number[], b: number[], cc: number[], d: number[], n: number[], color: THREE.Color) => {
    const base = pos.length / 3;
    for (const v of [a, b, cc, d]) {
      pos.push(v[0], v[1], v[2]);
      nrm.push(n[0], n[1], n[2]);
      col.push(color.r, color.g, color.b);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const W = m.width;
  const H = m.height;
  for (let y = cy; y < Math.min(H, cy + CHUNK); y++)
    for (let x = cx; x < Math.min(W, cx + CHUNK); x++) {
      const i = y * W + x;
      const h = heights[i];
      tileColor(m, i, c);
      // top, counter-clockwise seen from above
      quad([x, h, y], [x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [0, 1, 0], c);
      const t = m.terrain[i];
      const wall = t === T.HILL || t === T.MOUNTAIN ? WALL_ROCK : t === T.BEACH || t === T.SHALLOW ? WALL_SAND : WALL_EARTH;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const edge = nx < 0 || ny < 0 || nx >= W || ny >= H;
        const nh = edge ? SKIRT_Y : heights[ny * W + nx];
        if (nh >= h - 1e-4) continue;
        const wc = edge ? SKIRT : wall;
        if (dx === 1) quad([x + 1, h, y], [x + 1, h, y + 1], [x + 1, nh, y + 1], [x + 1, nh, y], [1, 0, 0], wc);
        else if (dx === -1) quad([x, h, y + 1], [x, h, y], [x, nh, y], [x, nh, y + 1], [-1, 0, 0], wc);
        else if (dy === 1) quad([x + 1, h, y + 1], [x, h, y + 1], [x, nh, y + 1], [x + 1, nh, y + 1], [0, 0, 1], wc);
        else quad([x, h, y], [x + 1, h, y], [x + 1, nh, y], [x, nh, y], [0, 0, -1], wc);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * Terrain made of CHUNK x CHUNK meshes. `sync()` rebuilds only chunks whose
 * terrain bytes changed (e.g. rainforest cleared for a building).
 */
export class TerrainMesh {
  readonly group = new THREE.Group();
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  heights: Float32Array;
  private snapshot: Uint8Array;
  private chunks = new Map<number, THREE.Mesh>();

  constructor(private map: MapLayers) {
    this.group.name = 'terrain';
    this.heights = computeHeights(map);
    this.snapshot = map.terrain.slice();
    const nx = Math.ceil(map.width / CHUNK);
    const ny = Math.ceil(map.height / CHUNK);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) this.buildChunk(i, j);
  }

  private buildChunk(i: number, j: number) {
    const key = j * 1000 + i;
    const old = this.chunks.get(key);
    const geo = buildChunkGeometry(this.map, this.heights, i * CHUNK, j * CHUNK);
    if (old) {
      old.geometry.dispose();
      old.geometry = geo;
      return;
    }
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.name = `chunk-${i}-${j}`;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.chunks.set(key, mesh);
    this.group.add(mesh);
  }

  get meshes(): THREE.Mesh[] {
    return [...this.chunks.values()];
  }

  /** Rebuild changed chunks; returns how many were rebuilt. */
  sync(): number {
    const m = this.map;
    const dirty = new Set<number>();
    for (let k = 0; k < m.terrain.length; k++) {
      if (m.terrain[k] === this.snapshot[k]) continue;
      this.snapshot[k] = m.terrain[k];
      this.heights[k] = tileHeight(m.terrain[k], m.elevation[k]);
      const x = k % m.width;
      const y = (k / m.width) | 0;
      // neighbours' walls may change too
      for (const [dx, dy] of [[0, 0], ...DIRS]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
        dirty.add(Math.floor(ny / CHUNK) * 1000 + Math.floor(nx / CHUNK));
      }
    }
    for (const key of dirty) this.buildChunk(key % 1000, Math.floor(key / 1000));
    return dirty.size;
  }

  dispose() {
    for (const c of this.chunks.values()) c.geometry.dispose();
    this.material.dispose();
    this.group.clear();
  }
}
