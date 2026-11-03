import { BUILDING_MAP, TRANSPORT_BY_ID } from '../data/buildings';
import { DIRS4, inBounds } from '../map/terrain';
import { GameState, T, TRANSPORT, isSea } from '../types';

export const MODE = { ROAD: 1, RAIL: 2, MRT: 4, WATER: 8 } as const;
export const ALL_MODES = 15;

export interface Network {
  /** per-tile mode bitmask (0 = not a network node) */
  modes: Uint8Array;
  /** per-tile traversal cost for its road-like mode */
  roadStep: Float32Array;
  /** export/market hub tiles */
  hubs: number[];
}

const WATER_STEP_RIVER = 1;
const WATER_STEP_SEA = 0.7;
const RAIL_STEP = 0.6;
const MRT_STEP = 0.4;
/** cost per tile of carting goods off-network to the nearest node */
export const WALK_STEP = 3;
const WALK_RADIUS = 3;

export function buildNetwork(state: GameState): Network {
  const m = state.map;
  const n = m.width * m.height;
  const modes = new Uint8Array(n);
  const roadStep = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = m.terrain[i];
    if (t === T.RIVER || isSea(t)) modes[i] |= MODE.WATER;
    const tr = m.transport[i];
    if (tr === TRANSPORT.ROAD || tr === TRANSPORT.HIGHWAY) {
      modes[i] |= MODE.ROAD;
      roadStep[i] = TRANSPORT_BY_ID[tr].step;
    } else if (tr === TRANSPORT.RAIL) modes[i] |= MODE.RAIL;
    else if (tr === TRANSPORT.MRT) modes[i] |= MODE.MRT;
  }
  const hubs: number[] = [];
  for (const b of state.buildings) {
    const def = BUILDING_MAP[b.def];
    if (!def) continue;
    const isHub = def.exportHub || def.market;
    if (!def.transfer && !isHub) continue;
    for (let dy = 0; dy < b.h; dy++)
      for (let dx = 0; dx < b.w; dx++) {
        const i = (b.y + dy) * m.width + (b.x + dx);
        if (def.transfer) {
          modes[i] = ALL_MODES;
          roadStep[i] = 1;
        } else if (def.market) {
          modes[i] |= MODE.ROAD;
          roadStep[i] = 1;
        }
        if (isHub) hubs.push(i);
      }
  }
  return { modes, roadStep, hubs };
}

function stepCost(net: Network, terrain: Uint8Array, i: number, shared: number): number {
  let c = Infinity;
  if (shared & MODE.ROAD) c = Math.min(c, net.roadStep[i] || 2);
  if (shared & MODE.RAIL) c = Math.min(c, RAIL_STEP);
  if (shared & MODE.MRT) c = Math.min(c, MRT_STEP);
  if (shared & MODE.WATER) c = Math.min(c, terrain[i] === T.RIVER ? WATER_STEP_RIVER : WATER_STEP_SEA);
  return c;
}

/** Binary min-heap keyed by float priority. */
class Heap {
  private idx: number[] = [];
  private pri: number[] = [];
  get size() {
    return this.idx.length;
  }
  push(i: number, p: number) {
    this.idx.push(i);
    this.pri.push(p);
    let k = this.idx.length - 1;
    while (k > 0) {
      const parent = (k - 1) >> 1;
      if (this.pri[parent] <= this.pri[k]) break;
      this.swap(k, parent);
      k = parent;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.idx[0], this.pri[0]];
    const li = this.idx.pop()!;
    const lp = this.pri.pop()!;
    if (this.idx.length) {
      this.idx[0] = li;
      this.pri[0] = lp;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let s = k;
        if (l < this.idx.length && this.pri[l] < this.pri[s]) s = l;
        if (r < this.idx.length && this.pri[r] < this.pri[s]) s = r;
        if (s === k) break;
        this.swap(k, s);
        k = s;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.idx[a], this.idx[b]] = [this.idx[b], this.idx[a]];
    [this.pri[a], this.pri[b]] = [this.pri[b], this.pri[a]];
  }
}

/**
 * Multi-source Dijkstra over the multimodal network from every hub, then a
 * short "carting" relaxation so off-network tiles get the cost of reaching
 * the nearest node. Returns per-tile delivery cost (Infinity = unreachable).
 */
export function deliveryCost(state: GameState, net: Network): Float64Array {
  const m = state.map;
  const W = m.width;
  const n = W * m.height;
  const dist = new Float64Array(n).fill(Infinity);
  const heap = new Heap();
  for (const h of net.hubs) {
    dist[h] = 0;
    heap.push(h, 0);
  }
  while (heap.size) {
    const [i, d] = heap.pop();
    if (d > dist[i]) continue;
    const x = i % W;
    const y = (i / W) | 0;
    const mi = net.modes[i];
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(m, nx, ny)) continue;
      const j = ny * W + nx;
      const shared = mi & net.modes[j];
      if (!shared) continue;
      const nd = d + stepCost(net, m.terrain, j, shared);
      if (nd < dist[j]) {
        dist[j] = nd;
        heap.push(j, nd);
      }
    }
  }
  // carting relaxation onto land tiles that are not network nodes
  for (let pass = 0; pass < WALK_RADIUS; pass++) {
    // read from a snapshot so each pass extends reach by exactly one tile
    const prev = dist.slice();
    for (let i = 0; i < n; i++) {
      if (net.modes[i]) continue;
      const x = i % W;
      const y = (i / W) | 0;
      let best = dist[i];
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(m, nx, ny)) continue;
        const j = ny * W + nx;
        // carts cannot cross open water
        if (net.modes[j] === MODE.WATER && pass > 0) continue;
        const c = prev[j] + WALK_STEP;
        if (c < best) best = c;
      }
      dist[i] = best;
    }
  }
  return dist;
}

/** Converts delivery cost into an efficiency factor. */
export function costToEfficiency(cost: number, era: number): number {
  if (!isFinite(cost)) return 0.25;
  const maxCost = era === 1 ? 70 : era === 2 ? 90 : 110;
  return Math.max(0.25, Math.min(1, 1 - (cost / maxCost) * 0.75));
}

/**
 * Transport access for zone growth: within 3 tiles (Chebyshev) of a road-like
 * tile, a transfer hub or market, or directly beside navigable water.
 */
export function computeAccess(state: GameState, net: Network): Uint8Array {
  const m = state.map;
  const W = m.width;
  const H = m.height;
  const acc = new Uint8Array(W * H);
  const R = 3;
  for (let i = 0; i < W * H; i++) {
    const mode = net.modes[i];
    const roadLike = mode & MODE.ROAD;
    const water = mode === MODE.WATER;
    if (!roadLike && !water) continue;
    const r = roadLike ? R : 1;
    const x = i % W;
    const y = (i / W) | 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) acc[ny * W + nx] = 1;
      }
  }
  return acc;
}
