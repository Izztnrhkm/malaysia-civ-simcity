import { BUILDING_MAP, CLEAR_JUNGLE_COST, TRANSPORT_BY_KEY, ZONE_COST } from '../data/buildings';
import { DIRS4, inBounds, isCoastal, isRiverside } from '../map/terrain';
import { CommandResult, GameState, T, TRANSPORT, TransportKey, ZoneId, isSea, isWater } from '../types';
import { SimContext, isBuildingUnlocked, isTransportUnlocked } from './context';

export function constructionMult(ctx: SimContext): number {
  return Math.max(0.3, 1 + ctx.effects.construction);
}

/** L-shaped path from a to b (horizontal first), used for road/rail dragging. */
export function linePath(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const sx = Math.sign(x1 - x0);
  const sy = Math.sign(y1 - y0);
  let x = x0;
  let y = y0;
  out.push([x, y]);
  while (x !== x1) {
    x += sx;
    out.push([x, y]);
  }
  while (y !== y1) {
    y += sy;
    out.push([x, y]);
  }
  return out;
}

export function rectTiles(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]);
  return out;
}

export interface PlacementCheck extends CommandResult {
  cost?: number;
}

export function checkBuilding(state: GameState, ctx: SimContext, defId: string, x: number, y: number): PlacementCheck {
  const def = BUILDING_MAP[defId];
  if (!def) return { ok: false, reason: 'err.invalid' };
  if (!isBuildingUnlocked(state, defId)) return { ok: false, reason: 'err.locked' };
  if (def.landmark && state.buildings.some((b) => b.def === defId)) return { ok: false, reason: 'err.unique' };
  const m = state.map;
  const s = def.size;
  let jungle = 0;
  let coastal = false;
  let riverside = false;
  let tin = 0;
  let fert = 0;
  let forest = false;
  let rail = false;
  for (let dy = 0; dy < s; dy++)
    for (let dx = 0; dx < s; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(m, tx, ty)) return { ok: false, reason: 'err.bounds' };
      const i = ty * m.width + tx;
      const t = m.terrain[i];
      if (isWater(t) || t === T.MOUNTAIN) return { ok: false, reason: 'err.terrain' };
      if (m.building[i] !== -1 || m.transport[i] !== TRANSPORT.NONE) return { ok: false, reason: 'err.occupied' };
      if (t === T.JUNGLE) {
        jungle++;
        forest = true;
      }
      if (isCoastal(m, tx, ty)) coastal = true;
      if (isRiverside(m, tx, ty)) riverside = true;
      tin += m.tin[i];
      fert += t === T.HILL ? 0 : m.fertility[i];
      for (const [ax, ay] of DIRS4) {
        const nx = tx + ax;
        const ny = ty + ay;
        if (!inBounds(m, nx, ny)) continue;
        const j = ny * m.width + nx;
        if (m.terrain[j] === T.JUNGLE) forest = true;
        if (m.transport[j] === TRANSPORT.RAIL) rail = true;
      }
    }
  const area = s * s;
  switch (def.placement) {
    case 'coast':
      if (!coastal) return { ok: false, reason: 'err.needCoast' };
      break;
    case 'water':
      if (!coastal && !riverside) return { ok: false, reason: 'err.needWater' };
      break;
    case 'river':
      if (!riverside) return { ok: false, reason: 'err.needRiver' };
      break;
    case 'tin':
      if (tin / area < 40) return { ok: false, reason: 'err.needTin' };
      break;
    case 'fertile':
      if (fert / area < 105) return { ok: false, reason: 'err.needFertile' };
      break;
    case 'forest':
      if (!forest) return { ok: false, reason: 'err.needForest' };
      break;
    case 'rail':
      if (!rail) return { ok: false, reason: 'err.needRail' };
      break;
  }
  const cost = Math.round(def.cost * constructionMult(ctx) + (def.placement === 'forest' ? 0 : jungle * CLEAR_JUNGLE_COST));
  if (state.money < cost) return { ok: false, reason: 'err.money', cost };
  return { ok: true, cost };
}

export function placeBuilding(state: GameState, ctx: SimContext, defId: string, x: number, y: number): CommandResult {
  const chk = checkBuilding(state, ctx, defId, x, y);
  if (!chk.ok) return chk;
  const def = BUILDING_MAP[defId];
  const m = state.map;
  const id = state.nextId++;
  for (let dy = 0; dy < def.size; dy++)
    for (let dx = 0; dx < def.size; dx++) {
      const i = (y + dy) * m.width + (x + dx);
      m.building[i] = id;
      m.zone[i] = 0;
      m.density[i] = 0;
      if (m.terrain[i] === T.JUNGLE && def.placement !== 'forest') m.terrain[i] = T.PLAIN;
    }
  state.buildings.push({ id, def: defId, x, y, w: def.size, h: def.size, built: state.tick, efficiency: 1 });
  state.money -= chk.cost!;
  ctx.networkDirty = true;
  return { ok: true, cost: chk.cost };
}

export function transportTileCost(state: GameState, ctx: SimContext, key: TransportKey, x: number, y: number): number | null {
  const m = state.map;
  if (!inBounds(m, x, y)) return null;
  const i = y * m.width + x;
  const t = m.terrain[i];
  if (isSea(t)) return null;
  if (m.building[i] !== -1) return null;
  const def = TRANSPORT_BY_KEY[key];
  if (m.transport[i] === def.id) return 0;
  let c = def.cost;
  if (t === T.RIVER) c *= 3;
  if (t === T.MOUNTAIN) c *= 3;
  if (t === T.HILL) c *= 1.4;
  if (t === T.JUNGLE) c += CLEAR_JUNGLE_COST;
  return Math.round(c * constructionMult(ctx));
}

export function buildTransport(state: GameState, ctx: SimContext, key: TransportKey, path: Array<[number, number]>): CommandResult {
  if (!isTransportUnlocked(state, key)) return { ok: false, reason: 'err.locked' };
  let total = 0;
  const valid: Array<[number, number]> = [];
  for (const [x, y] of path) {
    const c = transportTileCost(state, ctx, key, x, y);
    if (c == null) continue;
    if (c > 0) valid.push([x, y]);
    total += c;
  }
  if (!valid.length) return { ok: false, reason: path.length ? 'err.terrain' : 'err.invalid' };
  if (state.money < total) return { ok: false, reason: 'err.money', cost: total };
  const m = state.map;
  const id = TRANSPORT_BY_KEY[key].id;
  for (const [x, y] of valid) {
    const i = y * m.width + x;
    m.transport[i] = id;
    m.zone[i] = 0;
    m.density[i] = 0;
    if (m.terrain[i] === T.JUNGLE) m.terrain[i] = T.PLAIN;
  }
  state.money -= total;
  ctx.networkDirty = true;
  return { ok: true, cost: total };
}

export function zoneArea(state: GameState, ctx: SimContext, zone: ZoneId, tiles: Array<[number, number]>, onlyEmpty = false): CommandResult {
  const m = state.map;
  let total = 0;
  const valid: number[] = [];
  for (const [x, y] of tiles) {
    if (!inBounds(m, x, y)) continue;
    const i = y * m.width + x;
    const t = m.terrain[i];
    if (isWater(t) || t === T.MOUNTAIN) continue;
    if (m.building[i] !== -1 || m.transport[i] !== TRANSPORT.NONE) continue;
    if (m.zone[i] === zone || (onlyEmpty && m.zone[i])) continue;
    valid.push(i);
    total += ZONE_COST + (t === T.JUNGLE ? CLEAR_JUNGLE_COST : 0);
  }
  total = Math.round(total * constructionMult(ctx));
  if (!valid.length) return { ok: false, reason: 'err.terrain' };
  if (state.money < total) return { ok: false, reason: 'err.money', cost: total };
  for (const i of valid) {
    m.zone[i] = zone;
    m.density[i] = 0;
    if (m.terrain[i] === T.JUNGLE) m.terrain[i] = T.PLAIN;
  }
  state.money -= total;
  return { ok: true, cost: total };
}

export function bulldoze(state: GameState, ctx: SimContext, tiles: Array<[number, number]>): CommandResult {
  const m = state.map;
  let total = 0;
  const removeIds = new Set<number>();
  const ops: Array<() => void> = [];
  for (const [x, y] of tiles) {
    if (!inBounds(m, x, y)) continue;
    const i = y * m.width + x;
    if (m.building[i] !== -1) {
      removeIds.add(m.building[i]);
      continue;
    }
    if (m.transport[i]) {
      total += 2;
      ops.push(() => (m.transport[i] = 0));
    } else if (m.zone[i]) {
      total += 1;
      ops.push(() => {
        m.zone[i] = 0;
        m.density[i] = 0;
      });
    } else if (m.terrain[i] === T.JUNGLE) {
      total += CLEAR_JUNGLE_COST;
      ops.push(() => (m.terrain[i] = T.PLAIN));
    }
  }
  for (const id of removeIds) {
    const b = state.buildings.find((bb) => bb.id === id);
    if (b) total += Math.round((BUILDING_MAP[b.def]?.cost ?? 0) * 0.05);
  }
  if (!ops.length && !removeIds.size) return { ok: false, reason: 'err.nothing' };
  if (state.money < total) return { ok: false, reason: 'err.money', cost: total };
  for (const op of ops) op();
  if (removeIds.size) {
    state.buildings = state.buildings.filter((b) => !removeIds.has(b.id));
    for (let i = 0; i < m.building.length; i++) if (removeIds.has(m.building[i])) m.building[i] = -1;
  }
  state.money -= total;
  ctx.networkDirty = true;
  return { ok: true, cost: total };
}
