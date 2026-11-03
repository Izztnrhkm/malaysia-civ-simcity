import { BUILDING_MAP } from '../core/data/buildings';
import { Rng } from '../core/rng';
import { GameState, T, TRANSPORT, isSea } from '../core/types';
import { Instance } from './instancing';
import { WATER_Y, standHeight } from './terrain';

type Net = 'road' | 'highway' | 'rail' | 'mrt';
const NET_ID: Record<Net, number> = { road: TRANSPORT.ROAD, highway: TRANSPORT.HIGHWAY, rail: TRANSPORT.RAIL, mrt: TRANSPORT.MRT };
const NET_Y: Record<Net, number> = { road: 0.02, highway: 0.49, rail: 0.05, mrt: 0.86 };
const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

interface Pt {
  x: number;
  y: number;
  z: number;
}

interface NetAgent {
  net: Net;
  cars: string[];
  spacing: number;
  /** tiles visited, most recent last (for followers) */
  trail: Pt[];
  from: [number, number];
  to: [number, number];
  t: number;
  speed: number;
  lane: number;
}

interface PathAgent {
  model: string;
  path: Pt[];
  s: number;
  speed: number;
  /** ping-pong along the path, pausing at the ends */
  dir: 1 | -1;
  wait: number;
  loop: boolean;
}

export const ERA_ROAD_VEHICLES: Record<number, string[]> = {
  1: ['vehicle_bullock_cart'],
  2: ['vehicle_bullock_cart', 'vehicle_vintage_car', 'vehicle_vintage_car'],
  3: ['vehicle_car', 'vehicle_car_white', 'vehicle_car', 'vehicle_bus'],
  4: ['vehicle_car', 'vehicle_car_white', 'vehicle_car_white', 'vehicle_bus'],
};
export const ERA_SHIPS: Record<number, string[]> = {
  1: ['vehicle_jong', 'vehicle_junk'],
  2: ['vehicle_steamship', 'vehicle_junk'],
  3: ['vehicle_container_ship', 'vehicle_steamship'],
  4: ['vehicle_container_ship'],
};

/**
 * Ambient traffic simulation for the 3D view: vehicles wander the connected
 * road, highway, rail and MRT networks; ships sail between the open Straits
 * and export harbours; perahu ply the river. Purely visual (no game effect).
 */
export class Traffic {
  netAgents: NetAgent[] = [];
  pathAgents: PathAgent[] = [];
  private state: GameState | null = null;
  private heights: Float32Array | null = null;
  private rng = new Rng(97);

  rebuild(state: GameState, heights: Float32Array) {
    this.state = state;
    this.heights = heights;
    this.netAgents = [];
    this.pathAgents = [];
    const m = state.map;
    const era = state.era;
    const tiles: Record<Net, number[]> = { road: [], highway: [], rail: [], mrt: [] };
    for (let i = 0; i < m.transport.length; i++) {
      const t = m.transport[i];
      if (t === TRANSPORT.ROAD) tiles.road.push(i);
      else if (t === TRANSPORT.HIGHWAY) tiles.highway.push(i);
      else if (t === TRANSPORT.RAIL) tiles.rail.push(i);
      else if (t === TRANSPORT.MRT) tiles.mrt.push(i);
    }
    const spawn = (net: Net, n: number, cars: () => string[], speed: number, spacing: number) => {
      const list = tiles[net].filter((i) => this.neighbours(net, i % m.width, (i / m.width) | 0).length > 0);
      for (let k = 0; k < n && list.length; k++) {
        const i = list[this.rng.int(0, list.length - 1)];
        const x = i % m.width;
        const y = (i / m.width) | 0;
        const nb = this.neighbours(net, x, y);
        const to = nb[this.rng.int(0, nb.length - 1)];
        const start = this.point(net, x, y);
        this.netAgents.push({ net, cars: cars(), spacing, trail: [start], from: [x, y], to, t: this.rng.next(), speed: speed * (0.8 + this.rng.next() * 0.4), lane: net === 'rail' || net === 'mrt' ? 0 : 0.11 });
      }
    };
    const roadModels = ERA_ROAD_VEHICLES[era];
    spawn('road', Math.min(70, Math.floor(tiles.road.length / 5)), () => [roadModels[this.rng.int(0, roadModels.length - 1)]], era === 1 ? 0.45 : 1.2, 0.3);
    spawn('highway', Math.min(40, Math.floor(tiles.highway.length / 3)), () => [roadModels[this.rng.int(0, roadModels.length - 1)]], 2.2, 0.3);
    const loco = era <= 2 ? 'vehicle_steam_loco' : 'vehicle_diesel_loco';
    spawn('rail', tiles.rail.length >= 3 ? Math.min(6, 1 + Math.floor(tiles.rail.length / 30)) : 0, () => [loco, 'vehicle_rail_wagon', 'vehicle_rail_wagon', 'vehicle_rail_wagon'], 1.5, 0.42);
    spawn('mrt', tiles.mrt.length >= 3 ? Math.min(5, 1 + Math.floor(tiles.mrt.length / 20)) : 0, () => ['vehicle_mrt', 'vehicle_mrt', 'vehicle_mrt'], 2.4, 0.62);
    this.spawnShips(state);
  }

  private neighbours(net: Net, x: number, y: number): Array<[number, number]> {
    const m = this.state!.map;
    const id = NET_ID[net];
    const out: Array<[number, number]> = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      if (m.transport[ny * m.width + nx] === id) out.push([nx, ny]);
    }
    return out;
  }

  private point(net: Net, x: number, y: number): Pt {
    const i = y * this.state!.map.width + x;
    const water = this.state!.map.terrain[i] === T.RIVER || isSea(this.state!.map.terrain[i]);
    return { x: x + 0.5, y: standHeight(this.heights!, i) + NET_Y[net] + (water && (net === 'road' || net === 'rail') ? 0.09 : 0), z: y + 0.5 };
  }

  private spawnShips(state: GameState) {
    const m = state.map;
    const W = m.width;
    const ships = ERA_SHIPS[state.era];
    // ships sailing up and down the Straits, offshore
    let laneX = -1;
    for (let x = 2; x < W / 3; x++) {
      let deep = 0;
      for (let y = 0; y < m.height; y++) if (m.terrain[y * W + x] <= T.SEA) deep++;
      if (deep > m.height * 0.9) laneX = x;
    }
    if (laneX > 0) {
      for (let k = 0; k < 3; k++) {
        const x = laneX - k * 2 + 0.5;
        const path = [
          { x, y: WATER_Y, z: -8 },
          { x, y: WATER_Y, z: m.height + 8 },
        ];
        this.pathAgents.push({ model: ships[k % ships.length], path, s: this.rng.next() * (m.height + 16), speed: 0.9 + k * 0.2, dir: k % 2 ? -1 : 1, wait: 0, loop: true });
      }
    }
    // ships calling at export harbours
    const hubs = state.buildings.filter((b) => BUILDING_MAP[b.def]?.exportHub && BUILDING_MAP[b.def]?.placement === 'coast');
    for (const b of hubs.slice(0, 6)) {
      const path = this.seaPathFrom(b.x + (b.w >> 1), b.y + (b.h >> 1));
      if (path.length < 4) continue;
      for (let k = 0; k < 2; k++)
        this.pathAgents.push({ model: ships[(k + b.id) % ships.length], path, s: this.rng.next() * path.length, speed: 1.1, dir: k ? -1 : 1, wait: 0, loop: false });
    }
    // perahu on the river
    const river: number[] = [];
    for (let i = 0; i < m.terrain.length; i++) if (m.terrain[i] === T.RIVER) river.push(i);
    if (river.length > 10) {
      const mouth = river.reduce((a, b) => (b % W < a % W ? b : a));
      const path = this.bfsPath(mouth % W, (mouth / W) | 0, (t) => t === T.RIVER, 140);
      if (path.length > 6) for (let k = 0; k < 3; k++) this.pathAgents.push({ model: 'vehicle_perahu', path, s: this.rng.next() * path.length, speed: 0.6, dir: k % 2 ? 1 : -1, wait: 0, loop: false });
    }
  }

  /** Longest-reaching path over tiles matching `ok`, from (x, y). */
  private bfsPath(x0: number, y0: number, ok: (t: number) => boolean, maxLen: number): Pt[] {
    const m = this.state!.map;
    const W = m.width;
    const prev = new Int32Array(W * m.height).fill(-2);
    const start = y0 * W + x0;
    prev[start] = -1;
    const queue = [start];
    let last = start;
    let dist = 0;
    for (let qi = 0; qi < queue.length && dist < maxLen * 6; qi++) {
      const i = queue[qi];
      last = i;
      dist++;
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.height) continue;
        const j = ny * W + nx;
        if (prev[j] !== -2 || !ok(m.terrain[j])) continue;
        prev[j] = i;
        queue.push(j);
      }
    }
    const path: Pt[] = [];
    for (let i = last; i >= 0 && path.length < maxLen; i = prev[i]) path.push({ x: (i % W) + 0.5, y: WATER_Y, z: ((i / W) | 0) + 0.5 });
    return path.reverse();
  }

  /** Sea route from the open water at the west edge to the tile next to (x, y). */
  private seaPathFrom(x: number, y: number): Pt[] {
    const m = this.state!.map;
    const W = m.width;
    // nearest sea tile to the harbour
    let best = -1;
    let bd = Infinity;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.height) continue;
        const d = dx * dx + dy * dy;
        if (isSea(m.terrain[ny * W + nx]) && d < bd) {
          bd = d;
          best = ny * W + nx;
        }
      }
    if (best < 0) return [];
    // BFS over sea to the west edge
    const prev = new Int32Array(W * m.height).fill(-2);
    prev[best] = -1;
    const queue = [best];
    let goal = -1;
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi];
      if (i % W === 0) {
        goal = i;
        break;
      }
      const cx = i % W;
      const cy = (i / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.height) continue;
        const j = ny * W + nx;
        if (prev[j] !== -2 || !isSea(m.terrain[j])) continue;
        prev[j] = i;
        queue.push(j);
      }
    }
    if (goal < 0) return [];
    const path: Pt[] = [];
    for (let i = goal; i >= 0; i = prev[i]) path.push({ x: (i % W) + 0.5, y: WATER_Y, z: ((i / W) | 0) + 0.5 });
    path.unshift({ x: -6, y: WATER_Y, z: path[0].z });
    return path;
  }

  update(dt: number) {
    if (!this.state) return;
    const step = Math.min(0.1, Math.max(0, dt));
    for (const a of this.netAgents) {
      a.t += step * a.speed;
      while (a.t >= 1) {
        a.t -= 1;
        const nb = this.neighbours(a.net, a.to[0], a.to[1]);
        const forward = nb.filter(([x, y]) => x !== a.from[0] || y !== a.from[1]);
        const choices = forward.length ? forward : nb;
        a.trail.push(this.point(a.net, a.to[0], a.to[1]));
        if (a.trail.length > 8) a.trail.shift();
        a.from = a.to;
        a.to = choices.length ? choices[this.rng.int(0, choices.length - 1)] : a.from;
      }
    }
    for (const p of this.pathAgents) {
      if (p.wait > 0) {
        p.wait -= step;
        continue;
      }
      const len = p.loop ? p.path.length : p.path.length - 1;
      p.s += p.dir * p.speed * step * (p.loop ? 1 : 1.2);
      if (p.loop) {
        const total = Math.hypot(p.path[1].x - p.path[0].x, p.path[1].z - p.path[0].z);
        if (p.s > total) p.s -= total;
        if (p.s < 0) p.s += total;
      } else if (p.s >= len) {
        p.s = len;
        p.dir = -1;
        p.wait = 3;
      } else if (p.s <= 0) {
        p.s = 0;
        p.dir = 1;
        p.wait = 2;
      }
    }
  }

  instances(): Instance[] {
    const out: Instance[] = [];
    for (const a of this.netAgents) {
      const p0 = this.point(a.net, a.from[0], a.from[1]);
      const p1 = this.point(a.net, a.to[0], a.to[1]);
      const lead = lerpPt(p0, p1, a.t);
      // polyline backwards from the lead vehicle: lead, from, trail...
      const poly = [lead, p0, ...a.trail.slice(0, -1).reverse()];
      for (let c = 0; c < a.cars.length; c++) {
        const pos = alongPolyline(poly, c * a.spacing);
        if (!pos) break;
        const dx = pos.dir[0];
        const dz = pos.dir[1];
        const ry = Math.atan2(dx, dz);
        // drive on the left: offset to the left of travel direction
        out.push({ model: a.cars[c], x: pos.p.x + dz * a.lane, y: pos.p.y, z: pos.p.z - dx * a.lane, ry });
      }
    }
    for (const p of this.pathAgents) {
      let pos: Pt;
      let dir: [number, number];
      if (p.loop) {
        const a = p.path[0];
        const b = p.path[1];
        const total = Math.hypot(b.x - a.x, b.z - a.z);
        const f = p.s / total;
        pos = lerpPt(a, b, f);
        dir = [((b.x - a.x) / total) * p.dir, ((b.z - a.z) / total) * p.dir];
      } else {
        const i = Math.min(p.path.length - 2, Math.floor(p.s));
        const a = p.path[i];
        const b = p.path[i + 1];
        pos = lerpPt(a, b, p.s - i);
        const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        dir = [((b.x - a.x) / l) * p.dir, ((b.z - a.z) / l) * p.dir];
      }
      const bob = Math.sin((pos.x + pos.z) * 3 + p.s * 2) * 0.01;
      out.push({ model: p.model, x: pos.x, y: pos.y + bob, z: pos.z, ry: Math.atan2(dir[0], dir[1]) });
    }
    return out;
  }
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

/** Point at arc length `s` back along a polyline, with the forward direction there. */
function alongPolyline(poly: Pt[], s: number): { p: Pt; dir: [number, number] } | null {
  let rem = s;
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l < 1e-6) continue;
    if (rem <= l) {
      const p = lerpPt(a, b, rem / l);
      return { p, dir: [(a.x - b.x) / l, (a.z - b.z) / l] };
    }
    rem -= l;
  }
  if (s === 0 && poly.length) return { p: poly[0], dir: [0, 1] };
  return null;
}
