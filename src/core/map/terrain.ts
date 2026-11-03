import { Rng } from '../rng';
import { clamp, fbm, smoothstep } from '../noise';
import { MapLayers, T, isSea, isWater } from '../types';

export const SEA_LEVEL = 77; // elevation byte separating sea from land

export function createEmptyLayers(width: number, height: number, seed: number): MapLayers {
  const n = width * height;
  return {
    width,
    height,
    seed,
    terrain: new Uint8Array(n),
    elevation: new Uint8Array(n),
    fertility: new Uint8Array(n),
    tin: new Uint8Array(n),
    zone: new Uint8Array(n),
    density: new Uint8Array(n),
    style: new Uint8Array(n),
    transport: new Uint8Array(n),
    building: new Int32Array(n).fill(-1),
    landValue: new Uint8Array(n),
    pollution: new Uint8Array(n),
    access: new Uint8Array(n),
    coverage: new Uint8Array(n),
    logistics: new Uint8Array(n),
  };
}

export const inBounds = (m: { width: number; height: number }, x: number, y: number) =>
  x >= 0 && y >= 0 && x < m.width && y < m.height;

export const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface TerrainInfo {
  riverPath: Array<[number, number]>;
  mouth: [number, number];
}

/**
 * Procedurally generate a Malaysian west-coast landscape:
 *  - the Straits of Melaka along the west edge (low x) with an irregular coast
 *    and a few offshore islands,
 *  - a granite main range in the east producing hills and mountains,
 *  - tin deposits in the foothills and the alluvial valley at their feet
 *    (the Kinta / Larut pattern),
 *  - a meandering river from the range to an estuary fringed by mangrove,
 *  - lowland rainforest and fertile alluvial plains along the river.
 */
export function generateTerrain(width: number, height: number, seed: number): { map: MapLayers; info: TerrainInfo } {
  const map = createEmptyLayers(width, height, seed);
  const rng = new Rng(seed ^ 0x51a7);
  const elev = new Float32Array(width * height);
  const W = width;
  const H = height;

  // --- 1. elevation field ---
  for (let y = 0; y < H; y++) {
    const coast = W * (0.2 + 0.09 * (fbm(0.5, y / 22, seed + 11, 3) - 0.5) * 2);
    const ridgeX = W * (0.82 + 0.07 * (fbm(3.1, y / 30, seed + 23, 3) - 0.5) * 2);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const n = fbm(x / 18, y / 18, seed + 5, 5);
      // distance inland from the coast line, 0 at coast
      const inland = (x - coast) / W;
      let e: number;
      if (inland < 0) {
        e = 0.3 + inland * 2.2 + (n - 0.5) * 0.08; // seabed slopes down to the west
      } else {
        const ramp = smoothstep(0, 0.6, inland) * 0.17;
        const ridge = Math.exp(-(((x - ridgeX) / (W * 0.12)) ** 2)) * (0.2 + 0.26 * fbm(x / 9, y / 9, seed + 41, 3));
        e = Math.max(0.312, 0.318 + ramp + ridge + (n - 0.5) * 0.1);
      }
      elev[i] = e;
    }
  }
  // offshore islands
  const islands = 2 + rng.int(0, 2);
  for (let k = 0; k < islands; k++) {
    const cx = rng.range(W * 0.03, W * 0.13);
    const cy = rng.range(H * 0.1, H * 0.9);
    const r = rng.range(2.2, 4.5);
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (!inBounds(map, x, y)) continue;
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d < 1) elev[y * W + x] = Math.max(elev[y * W + x], 0.36 - d * 0.06 + (1 - d) * 0.08);
      }
  }

  const toByte = (e: number) => clamp(Math.round(e * 255), 0, 255);
  for (let i = 0; i < elev.length; i++) map.elevation[i] = toByte(elev[i]);

  // --- 2. base terrain classification ---
  for (let i = 0; i < elev.length; i++) {
    const b = map.elevation[i];
    let t: number;
    if (b < SEA_LEVEL - 30) t = T.DEEP;
    else if (b < SEA_LEVEL - 10) t = T.SEA;
    else if (b < SEA_LEVEL) t = T.SHALLOW;
    else if (b < 162) t = T.PLAIN;
    else if (b < 205) t = T.HILL;
    else t = T.MOUNTAIN;
    map.terrain[i] = t;
  }
  // beaches: land touching sea
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (map.terrain[i] !== T.PLAIN) continue;
      if (map.elevation[i] > SEA_LEVEL + 12) continue;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(map, nx, ny) && isSea(map.terrain[ny * W + nx])) {
          map.terrain[i] = T.BEACH;
          break;
        }
      }
    }

  // --- 3. river by steepest descent with westward bias ---
  const riverPath = carveRiver(map, rng);
  const mouth = riverPath[riverPath.length - 1];

  // --- 4. mangrove around the estuary and on muddy low coast ---
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = map.terrain[i];
      if (t !== T.PLAIN && t !== T.BEACH) continue;
      const dMouth = Math.hypot(x - mouth[0], y - mouth[1]);
      const low = map.elevation[i] < SEA_LEVEL + 20;
      if (low && dMouth < 7 + fbm(x / 4, y / 4, seed + 77, 2) * 4) map.terrain[i] = T.MANGROVE;
    }

  // --- 5. fertility from distance to river (alluvium) ---
  const riverDist = distanceField(map, (t) => t === T.RIVER);
  for (let i = 0; i < elev.length; i++) {
    const t = map.terrain[i];
    if (isWater(t)) continue;
    const near = Math.exp(-riverDist[i] / 7);
    const flat = t === T.PLAIN ? 1 : t === T.HILL ? 0.35 : t === T.MOUNTAIN ? 0.05 : 0.5;
    const x = i % W;
    const y = (i / W) | 0;
    map.fertility[i] = toByte(clamp((0.25 + 0.75 * near) * flat * (0.7 + 0.5 * fbm(x / 7, y / 7, seed + 99, 2)), 0, 1));
  }

  // --- 6. tin: foothills + alluvial valley floor near hills ---
  const hillDist = distanceField(map, (t) => t === T.HILL || t === T.MOUNTAIN);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = map.terrain[i];
      const eligible = (t === T.HILL && map.elevation[i] < 192) || (t === T.PLAIN && hillDist[i] <= 3);
      if (!eligible) continue;
      const v = fbm(x / 6, y / 6, seed + 131, 3);
      if (v > 0.52) map.tin[i] = toByte(clamp((v - 0.52) * 4.5, 0.15, 1));
    }

  // --- 7. rainforest on undeveloped plains and lower hills ---
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (map.terrain[i] !== T.PLAIN) continue;
      const moist = fbm(x / 10, y / 10, seed + 201, 3);
      const nearRiver = riverDist[i] < 3;
      if (moist > 0.47 && !nearRiver && map.tin[i] === 0) map.terrain[i] = T.JUNGLE;
    }

  return { map, info: { riverPath, mouth } };
}

function carveRiver(map: MapLayers, rng: Rng): Array<[number, number]> {
  const { width: W, height: H } = map;
  // source: a high point in the range, central band of the map
  let sx = Math.floor(W * 0.8);
  let sy = Math.floor(H * 0.5);
  let best = -1;
  for (let k = 0; k < 60; k++) {
    const x = rng.int(Math.floor(W * 0.68), W - 3);
    const y = rng.int(Math.floor(H * 0.3), Math.floor(H * 0.7));
    const e = map.elevation[y * W + x];
    if (e > best) {
      best = e;
      sx = x;
      sy = y;
    }
  }
  const path: Array<[number, number]> = [];
  const visited = new Uint8Array(W * H);
  let x = sx;
  let y = sy;
  let drift = 0;
  for (let step = 0; step < W * 6; step++) {
    path.push([x, y]);
    visited[y * W + x] = 1;
    if (isSea(map.terrain[y * W + x])) break;
    drift += rng.range(-0.3, 0.3);
    if (rng.chance(0.04)) drift = -drift;
    drift = clamp(drift, -1, 1);
    let bestScore = Infinity;
    let nx = x - 1;
    let ny = y;
    for (const [dx, dy] of DIRS4) {
      const cx = x + dx;
      const cy = y + dy;
      if (!inBounds(map, cx, cy) || visited[cy * W + cx]) continue;
      const e = map.elevation[cy * W + cx];
      // prefer downhill, strongly prefer west, meander via drift
      const score = e * 1.2 + dx * 9 - dy * drift * 12 + rng.range(0, 7) + (cy < 2 || cy > H - 3 ? 200 : 0);
      if (score < bestScore) {
        bestScore = score;
        nx = cx;
        ny = cy;
      }
    }
    if (!inBounds(map, nx, ny)) break;
    x = nx;
    y = ny;
  }
  // ensure the river ends in the sea: extend straight west if needed
  const ly = path[path.length - 1][1];
  let lx = path[path.length - 1][0];
  while (!isSea(map.terrain[ly * W + lx]) && lx > 0) {
    lx -= 1;
    path.push([lx, ly]);
  }
  const total = path.length;
  path.forEach(([px, py], idx) => {
    const i = py * W + px;
    if (isSea(map.terrain[i])) return;
    map.terrain[i] = T.RIVER;
    map.elevation[i] = Math.min(map.elevation[i], Math.max(SEA_LEVEL + 2, map.elevation[i] - 12));
    // widen the lower course into an estuary
    if (idx > total * 0.72) {
      const nyy = py + 1;
      if (inBounds(map, px, nyy) && !isSea(map.terrain[nyy * W + px])) map.terrain[nyy * W + px] = T.RIVER;
    }
  });
  return path;
}

/** BFS distance (4-neighbour, capped at 255) to tiles matching the predicate. */
export function distanceField(map: MapLayers, pred: (t: number) => boolean): Uint8Array {
  const { width: W, height: H } = map;
  const dist = new Uint8Array(W * H).fill(255);
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < W * H; i++)
    if (pred(map.terrain[i])) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  while (head < tail) {
    const i = queue[head++];
    const x = i % W;
    const y = (i / W) | 0;
    const d = dist[i] + 1;
    if (d >= 255) continue;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const j = ny * W + nx;
      if (dist[j] > d) {
        dist[j] = d;
        queue[tail++] = j;
      }
    }
  }
  return dist;
}

/** True for land tiles orthogonally adjacent to sea: candidate harbour sites. */
export function isCoastal(map: MapLayers, x: number, y: number): boolean {
  const t = map.terrain[y * map.width + x];
  if (isWater(t)) return false;
  for (const [dx, dy] of DIRS4) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(map, nx, ny) && isSea(map.terrain[ny * map.width + nx])) return true;
  }
  return false;
}

export function isRiverside(map: MapLayers, x: number, y: number): boolean {
  const t = map.terrain[y * map.width + x];
  if (isWater(t)) return false;
  for (const [dx, dy] of DIRS4) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(map, nx, ny) && map.terrain[ny * map.width + nx] === T.RIVER) return true;
  }
  return false;
}
