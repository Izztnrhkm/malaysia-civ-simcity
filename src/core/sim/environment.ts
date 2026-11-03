import { BUILDING_MAP, ServiceKind } from '../data/buildings';
import { GameState, T, ZONE } from '../types';
import { SimContext } from './context';

const KINDS: ServiceKind[] = ['faith', 'education', 'health', 'safety', 'leisure'];
/** industrial pollution per density level, by era */
const I_POLLUTION = [0, 5, 7, 8, 3];

/**
 * Stamps service coverage disks. Each kind is capped at 100 per tile and the
 * five kinds are combined into one 0..250 byte layer.
 */
export function computeCoverage(state: GameState): Record<ServiceKind, Uint8Array> {
  const m = state.map;
  const W = m.width;
  const H = m.height;
  const per: Record<ServiceKind, Uint8Array> = Object.fromEntries(KINDS.map((k) => [k, new Uint8Array(W * H)])) as Record<ServiceKind, Uint8Array>;
  for (const b of state.buildings) {
    const def = BUILDING_MAP[b.def];
    if (!def?.service) continue;
    const { kind, radius, strength } = def.service;
    const layer = per[kind];
    const cx = b.x + (b.w - 1) / 2;
    const cy = b.y + (b.h - 1) / 2;
    const s = strength * Math.max(0.3, b.efficiency || 1);
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(H - 1, Math.ceil(cy + radius)); y++)
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(W - 1, Math.ceil(cx + radius)); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > radius) continue;
        const v = s * (1 - (d / radius) * 0.6);
        const i = y * W + x;
        layer[i] = Math.min(100, layer[i] + v);
      }
  }
  const comb = m.coverage;
  for (let i = 0; i < W * H; i++) {
    let sum = 0;
    for (const k of KINDS) sum += per[k][i];
    comb[i] = Math.min(255, sum / 2);
  }
  return per;
}

function boxBlur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / (2 * r + 1);
      acc += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}

export function computePollution(state: GameState, ctx: SimContext): void {
  const m = state.map;
  const W = m.width;
  const H = m.height;
  const src = new Float32Array(W * H);
  const iMul = I_POLLUTION[state.era];
  for (let i = 0; i < W * H; i++) {
    if (m.zone[i] === ZONE.I) src[i] += m.density[i] * iMul * 4;
    if (m.transport[i] === 3) src[i] += 20;
  }
  const cleaners: Array<[number, number, number]> = [];
  for (const b of state.buildings) {
    const def = BUILDING_MAP[b.def];
    if (!def?.pollution) continue;
    if (def.pollution < 0) {
      cleaners.push([b.x + b.w / 2, b.y + b.h / 2, -def.pollution]);
      continue;
    }
    const per = (def.pollution * 6 * Math.max(0.3, b.efficiency || 1)) / (b.w * b.h);
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) src[(b.y + dy) * W + b.x + dx] += per;
  }
  let blurred = boxBlur(src, W, H, 2);
  blurred = boxBlur(blurred, W, H, 2);
  const mult = Math.max(0.1, 1 + ctx.effects.pollution);
  for (const [cx, cy, s] of cleaners) {
    const r = 9;
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(H, cy + r); y++)
      for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d < r) blurred[y * W + x] = Math.max(0, blurred[y * W + x] - s * (1 - d / r));
      }
  }
  for (let i = 0; i < W * H; i++) m.pollution[i] = Math.min(255, blurred[i] * 4 * mult);
}

export function computeLandValue(state: GameState, ctx: SimContext): number {
  const m = state.map;
  const n = m.width * m.height;
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const t = m.terrain[i];
    if (t <= T.SHALLOW || t === T.RIVER) {
      m.landValue[i] = 0;
      continue;
    }
    const wd = ctx.waterDist[i];
    let v = 45;
    if (wd <= 3) v += 30 - wd * 6;
    if (t === T.HILL) v += 8;
    if (t === T.MANGROVE) v -= 15;
    v += m.coverage[i] * 0.45;
    v += m.access[i] ? 12 : -10;
    v += state.era * 6;
    v -= m.pollution[i] * 0.75;
    const lv = Math.max(0, Math.min(255, v));
    m.landValue[i] = lv;
    if (m.zone[i]) {
      sum += lv;
      cnt++;
    }
  }
  return cnt ? sum / cnt : 0;
}

export interface HappinessInputs {
  foodSatisfaction: number;
  unemployment: number;
  powerRatio: number;
  waterRatio: number;
  buildingHappiness: number;
}

export function computeHappinessTarget(state: GameState, ctx: SimContext, inp: HappinessInputs): number {
  const m = state.map;
  let cov = 0;
  let pol = 0;
  let cnt = 0;
  for (let i = 0; i < m.zone.length; i++) {
    if (m.zone[i] !== ZONE.R || !m.density[i]) continue;
    cov += m.coverage[i];
    pol += m.pollution[i];
    cnt++;
  }
  const avgCov = cnt ? cov / cnt : 60;
  const avgPol = cnt ? pol / cnt : 0;
  let h = 55;
  h += (inp.foodSatisfaction - 1) * 45;
  h -= inp.unemployment * 45;
  h += Math.min(30, avgCov * 0.15);
  h -= avgPol * 0.18;
  h -= (state.tax.R - 9) * 1.6 + (state.tax.C - 9) * 0.5 + (state.tax.I - 9) * 0.5;
  h += ctx.effects.happiness + ctx.eventHappiness + Math.min(20, inp.buildingHappiness);
  if (state.era >= 3) h -= (1 - Math.min(inp.powerRatio, inp.waterRatio)) * 25;
  return Math.max(0, Math.min(100, h));
}
