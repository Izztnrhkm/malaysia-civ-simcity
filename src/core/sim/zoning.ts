import { ZONE_CAPACITY } from '../data/buildings';
import { ERAS } from '../data/eras';
import { SEA_LEVEL } from '../map/terrain';
import { GameState, ZONE } from '../types';
import { SimContext } from './context';

export interface ZoneTotals {
  population: number;
  cJobs: number;
  iJobs: number;
  counts: { R: number; C: number; I: number };
}

export function zoneTotals(state: GameState): ZoneTotals {
  const m = state.map;
  let population = 0;
  let cJobs = 0;
  let iJobs = 0;
  const counts = { R: 0, C: 0, I: 0 };
  for (let i = 0; i < m.zone.length; i++) {
    const z = m.zone[i];
    if (!z) continue;
    const d = m.density[i];
    if (z === ZONE.R) {
      population += ZONE_CAPACITY.R[d];
      counts.R++;
    } else if (z === ZONE.C) {
      cJobs += ZONE_CAPACITY.C[d];
      counts.C++;
    } else {
      iJobs += ZONE_CAPACITY.I[d];
      counts.I++;
    }
  }
  return { population, cJobs, iJobs, counts };
}

export interface DemandInputs {
  population: number;
  workers: number;
  jobs: number;
  cJobs: number;
  iJobs: number;
  happiness: number;
  foodSatisfaction: number;
  unemployment: number;
  exportCapacity: number;
}

const clamp100 = (v: number) => Math.max(-100, Math.min(100, v));

/** RCI demand in -100..100. */
export function computeDemand(state: GameState, ctx: SimContext, d: DemandInputs): { R: number; C: number; I: number } {
  const era = ERAS[state.era];
  const pioneer = 45 * Math.exp(-d.population / 700);
  const jobsGap = Math.max(-1, Math.min(1, (d.jobs - d.workers) / Math.max(30, d.workers))) * 55;
  let R = pioneer + jobsGap + (d.happiness - 50) * 0.8 + (d.foodSatisfaction - 1) * 60 - (state.tax.R - 9) * 3;
  if (R > 0) R *= 1 + ctx.effects.growth;
  const cTarget = d.population * era.commercialRatio;
  const C = ((cTarget - d.cJobs) / Math.max(10, cTarget)) * 100 - (state.tax.C - 9) * 3 + d.unemployment * 30;
  const iTarget = d.population * era.industrialRatio + d.exportCapacity * 0.3;
  const I = ((iTarget - d.iJobs) / Math.max(10, iTarget)) * 100 - (state.tax.I - 9) * 3 + d.unemployment * 40;
  return { R: clamp100(R), C: clamp100(C), I: clamp100(I) };
}

export interface GrowthInputs {
  powerRatio: number;
  waterRatio: number;
}

/** Develops or decays zoned lots according to demand, access and land value. */
export function growZones(state: GameState, ctx: SimContext, g: GrowthInputs): void {
  const m = state.map;
  const rng = ctx.rng;
  const maxEra = ERAS[state.era].maxDensity;
  const demand = state.derived.demand;
  const growthMult = Math.max(0.2, 1 + ctx.effects.growth);
  const utilitiesOk = state.era < 3 || Math.min(g.powerRatio, g.waterRatio) >= 0.9;
  for (let i = 0; i < m.zone.length; i++) {
    const z = m.zone[i];
    if (!z) continue;
    let d = m.density[i];
    if (!m.access[i]) {
      if (d > 0 && rng.chance(0.03)) m.density[i] = d - 1;
      continue;
    }
    // industry ignores pollution when judging a site; commerce mostly ignores it
    const lv = m.landValue[i] + (z === ZONE.I ? m.pollution[i] * 0.75 : z === ZONE.C ? m.pollution[i] * 0.4 : 0);
    let maxD = maxEra;
    if (lv < 90) maxD = Math.min(maxD, 2);
    else if (lv < 140) maxD = Math.min(maxD, 3);
    if (!utilitiesOk) maxD = Math.min(maxD, 2);
    if (z === ZONE.R && m.pollution[i] > 150) maxD = Math.min(maxD, 1);
    if (ctx.flood && m.elevation[i] < SEA_LEVEL + 14 && ctx.waterDist[i] <= 2) continue;
    const dem = z === ZONE.R ? demand.R : z === ZONE.C ? demand.C : demand.I;
    if (d > maxD) {
      if (rng.chance(0.02)) m.density[i] = d - 1;
      continue;
    }
    if (dem > 0 && d < maxD) {
      const p = 0.05 * (dem / 100) * (0.5 + lv / 255) * growthMult;
      if (rng.chance(p)) d++;
    } else if (dem < -25 && d > 0) {
      const p = 0.02 * ((-dem - 25) / 75);
      if (rng.chance(p)) d--;
    }
    m.density[i] = d;
  }
}
