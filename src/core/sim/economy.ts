import { BUILDING_MAP, TRANSPORT_BY_ID } from '../data/buildings';
import { ERAS } from '../data/eras';
import { GOOD_DEFS, basePrice, isTradable } from '../data/goods';
import { SEA_LEVEL } from '../map/terrain';
import { Budget, GOODS, GameState, Good, GoodMap, ZONE, emptyGoods } from '../types';
import { SimContext } from './context';
import { costToEfficiency } from './transport';
import { ADVISOR_MAP } from '../data/advisors';

export const FOOD_PER_CAPITA = 0.012;
export const WORKER_SHARE = 0.55;
export const BASE_STORAGE = 300;
export const BASE_RESEARCH = 1;
export const BASE_CULTURE = 0.5;
/** public-service cost per resident (x era wealth) */
export const ADMIN_PER_CAPITA = [0, 0.004, 0.02, 0.07, 0.12];

export interface EconomyResult {
  population: number;
  workers: number;
  jobs: number;
  employed: number;
  unemployment: number;
  staffRatio: number;
  powerRatio: number;
  waterRatio: number;
  power: { supply: number; demand: number };
  water: { supply: number; demand: number };
  production: GoodMap;
  consumption: GoodMap;
  exported: GoodMap;
  imported: GoodMap;
  exportCapacity: number;
  foodSatisfaction: number;
  budget: Budget;
  netIncome: number;
  researchPerTick: number;
  culturePerTick: number;
  buildingHappiness: number;
  storage: number;
}

/** Industrial zone output per job, by era. */
function industrialOutput(state: GameState): Partial<Record<Good, number>> {
  const has = (id: string) => state.research.done.includes(id);
  switch (state.era) {
    case 1:
      return { barang: 0.04 };
    case 2:
      return { barang: 0.05 };
    case 3:
      return has('semikonduktor') ? { barang: 0.03, elektronik: 0.008 } : { barang: 0.04 };
    default:
      return has('internet') ? { barang: 0.015, elektronik: 0.012, digital: 0.006 } : { barang: 0.02, elektronik: 0.012 };
  }
}

export function priceOf(state: GameState, ctx: SimContext, g: Good): number {
  return basePrice(g, state.era) * (ctx.priceMult[g] ?? 1) * (1 + ctx.effects.exportPrice);
}

export function tileEfficiency(state: GameState, ctx: SimContext, i: number): number {
  if (!ctx.cost) return 0.25;
  return costToEfficiency(ctx.cost[i], state.era);
}

export function runEconomy(state: GameState, ctx: SimContext, z: { population: number; cJobs: number; iJobs: number }): EconomyResult {
  const m = state.map;
  const W = m.width;
  const era = ERAS[state.era];
  const fx = ctx.effects;

  // ---- labour ----
  let bJobs = 0;
  for (const b of state.buildings) bJobs += BUILDING_MAP[b.def]?.jobs ?? 0;
  const population = z.population;
  const workers = population * WORKER_SHARE;
  const jobs = z.cJobs + z.iJobs + bJobs;
  const employed = Math.min(workers, jobs);
  const staffRatio = jobs > 0 ? employed / jobs : 1;
  const unemployment = workers > 0 ? (workers - employed) / workers : 0;

  // ---- utilities (matter from era 3) ----
  let pSupply = 0;
  let pDemand = population * 0.03 + z.cJobs * 0.05 + z.iJobs * 0.08;
  let wSupply = 0;
  let wDemand = population * 0.03 + z.iJobs * 0.05;
  for (const b of state.buildings) {
    const d = BUILDING_MAP[b.def];
    if (!d) continue;
    if (d.power) {
      if (d.power > 0) pSupply += d.power * staffRatioFor(d.jobs, staffRatio);
      else pDemand -= d.power;
    }
    if (d.water) {
      if (d.water > 0) wSupply += d.water * staffRatioFor(d.jobs, staffRatio);
      else wDemand -= d.water;
    }
  }
  const powerRatio = state.era < 3 ? 1 : pDemand <= 0 ? 1 : Math.min(1, pSupply / pDemand);
  const waterRatio = state.era < 3 ? 1 : wDemand <= 0 ? 1 : Math.min(1, wSupply / wDemand);

  // ---- production ----
  const production = emptyGoods();
  const consumption = emptyGoods();
  const stock = state.stock;
  const prodMult = (g: Good) => Math.max(0, 1 + (fx.production[g] ?? 0) + fx.productionAll) * ctx.productionMult;
  let research = 0;
  let culture = 0;
  let buildingHappiness = 0;
  let storage = BASE_STORAGE;
  let rawExportCap = 0;
  let hasExportHub = false;
  for (const b of state.buildings) {
    const def = BUILDING_MAP[b.def];
    if (!def) continue;
    const staff = staffRatioFor(def.jobs, staffRatio);
    const needsUtil = (def.power ?? 0) < 0 || (def.water ?? 0) < 0;
    const util = state.era >= 3 && needsUtil ? Math.min(powerRatio, waterRatio) : 1;
    storage += def.storage ?? 0;
    if (def.exportHub) hasExportHub = true;
    rawExportCap += (def.exportCapacity ?? 0) * staff;
    research += (def.research ?? 0) * staff * util;
    culture += (def.culture ?? 0) * staff;
    buildingHappiness += def.happiness ?? 0;
    let eff = staff * util;
    if (def.produces) {
      const ci = (b.y + (b.h >> 1)) * W + (b.x + (b.w >> 1));
      eff *= tileEfficiency(state, ctx, ci);
      if (ctx.flood && m.elevation[ci] < SEA_LEVEL + 14 && ctx.waterDist[ci] <= 2 && !floodGuarded(state, b.x + (b.w >> 1), b.y + (b.h >> 1))) eff *= 0.5;
      eff *= siteFactor(state, b.x, b.y, b.w, b.h, def.placement);
      if (def.consumes) {
        let f = 1;
        for (const [g, q] of Object.entries(def.consumes) as [Good, number][]) {
          const need = q * eff;
          if (need > 0) f = Math.min(f, stock[g] / need);
        }
        f = Math.max(0, Math.min(1, f));
        eff *= f;
        for (const [g, q] of Object.entries(def.consumes) as [Good, number][]) {
          const used = q * eff;
          stock[g] -= used;
          consumption[g] += used;
        }
      }
      for (const [g, q] of Object.entries(def.produces) as [Good, number][]) {
        const out = q * eff * prodMult(g);
        stock[g] += out;
        production[g] += out;
      }
    }
    b.efficiency = eff;
  }
  // industrial zones
  const perJob = industrialOutput(state);
  const iUtil = state.era >= 3 ? Math.min(powerRatio, waterRatio) : 1;
  for (let i = 0; i < m.zone.length; i++) {
    if (m.zone[i] !== ZONE.I || !m.density[i]) continue;
    const jobsHere = [0, 4, 12, 30, 70][m.density[i]] * staffRatio;
    const eff = tileEfficiency(state, ctx, i) * iUtil;
    for (const [g, q] of Object.entries(perJob) as [Good, number][]) {
      const out = jobsHere * q * eff * prodMult(g);
      stock[g] += out;
      production[g] += out;
    }
  }

  // ---- food ----
  const imported = emptyGoods();
  const budget: Budget = { taxR: 0, taxC: 0, taxI: 0, exports: 0, deals: 0, upkeepBuildings: 0, upkeepTransport: 0, imports: 0, interest: 0, admin: 0, infrastructure: 0, advisors: 0 };
  const foodNeed = population * FOOD_PER_CAPITA;
  let foodGot = 0;
  for (const g of ['padi', 'ikan'] as Good[]) {
    const take = Math.min(stock[g], Math.max(0, foodNeed - foodGot));
    stock[g] -= take;
    consumption[g] += take;
    foodGot += take;
  }
  if (foodGot < foodNeed - 1e-6 && hasExportHub) {
    const short = foodNeed - foodGot;
    const unit = basePrice('padi', state.era) * 1.5;
    const afford = Math.max(0, Math.min(short, state.money / unit));
    imported.padi += afford;
    budget.imports += afford * unit;
    foodGot += afford;
  }
  const foodSatisfaction = foodNeed > 0 ? Math.min(1, foodGot / foodNeed) : 1;

  // commercial goods demand (improves commercial tax)
  const cGoodsNeed = z.cJobs * 0.01;
  const cGoodsTake = Math.min(stock.barang, cGoodsNeed);
  stock.barang -= cGoodsTake;
  consumption.barang += cGoodsTake;
  const cGoodsFactor = cGoodsNeed > 0 ? 0.8 + 0.4 * (cGoodsTake / cGoodsNeed) : 1;

  // ---- exports: deals first, then surplus at world prices ----
  const exported = emptyGoods();
  const exportCapacity = hasExportHub ? rawExportCap * Math.max(0, 1 + fx.exportCap) * ctx.exportCapMult : 0;
  let capLeft = exportCapacity;
  for (const deal of state.deals) {
    const want = deal.qty;
    const give = Math.max(0, Math.min(want, stock[deal.good], capLeft));
    stock[deal.good] -= give;
    capLeft -= give;
    exported[deal.good] += give;
    budget.deals += give * deal.price * (ctx.priceMult[deal.good] ?? 1) ** 0.5;
    deal.delivered += give;
    deal.remaining -= 1;
    const p = state.partners[deal.partner];
    if (give + 1e-6 < want) {
      deal.missed += 1;
      if (p) p.relation = Math.max(-100, p.relation - 0.6);
    } else if (p) p.relation = Math.min(100, p.relation + 0.04);
  }
  state.deals = state.deals.filter((d) => d.remaining > 0);

  const inputReserve = emptyGoods();
  for (const b of state.buildings) {
    const def = BUILDING_MAP[b.def];
    if (def?.consumes) for (const [g, q] of Object.entries(def.consumes) as [Good, number][]) inputReserve[g] += q * 4;
  }
  const order = GOODS.filter((g) => isTradable(g, state.era)).sort((a, b) => priceOf(state, ctx, b) - priceOf(state, ctx, a));
  for (const g of order) {
    if (capLeft <= 0) break;
    const reserve = GOOD_DEFS[g].food ? foodNeed * 6 : inputReserve[g] + (g === 'barang' ? cGoodsNeed * 4 : 0);
    const surplus = stock[g] - reserve;
    if (surplus <= 0) continue;
    const q = Math.min(surplus, capLeft);
    stock[g] -= q;
    capLeft -= q;
    exported[g] += q;
    budget.exports += q * priceOf(state, ctx, g);
  }
  for (const g of GOODS) stock[g] = Math.max(0, Math.min(stock[g], storage));

  // ---- taxes ----
  const taxMult = Math.max(0, 1 + fx.tax);
  const wealth = era.wealth * (0.6 + 0.4 * foodSatisfaction);
  budget.taxR = population * (state.tax.R / 100) * wealth * taxMult;
  budget.taxC = z.cJobs * staffRatio * (state.tax.C / 100) * wealth * 3 * cGoodsFactor * taxMult;
  budget.taxI = z.iJobs * staffRatio * (state.tax.I / 100) * wealth * 2.5 * taxMult;

  // ---- upkeep ----
  const upMult = Math.max(0.2, 1 + fx.upkeep);
  for (const b of state.buildings) budget.upkeepBuildings += (BUILDING_MAP[b.def]?.upkeep ?? 0) * upMult;
  for (let i = 0; i < m.transport.length; i++) {
    const t = m.transport[i];
    if (t) budget.upkeepTransport += TRANSPORT_BY_ID[t].upkeep * upMult;
  }
  budget.interest = state.debt * 0.004;
  budget.admin = population * era.wealth * ADMIN_PER_CAPITA[state.era] * upMult;
  budget.infrastructure = infrastructureUpkeep(state, budget, population) * upMult;
  for (const id of state.advisors ?? []) budget.advisors += ADVISOR_MAP[id]?.upkeep ?? 0;

  const income = budget.taxR + budget.taxC + budget.taxI + budget.exports + budget.deals;
  const expense = budget.upkeepBuildings + budget.upkeepTransport + budget.imports + budget.interest + budget.admin + budget.infrastructure + budget.advisors;
  const netIncome = income - expense;
  state.money += netIncome;

  // the court and its scholars provide a small baseline of knowledge and culture
  const researchPerTick = (BASE_RESEARCH + population / 250 + research) * Math.max(0, 1 + fx.research) + ctx.eventResearch;
  const culturePerTick = (BASE_CULTURE + population / 400 + culture) * Math.max(0, 1 + fx.culture);

  return {
    population,
    workers,
    jobs,
    employed,
    unemployment,
    staffRatio,
    powerRatio,
    waterRatio,
    power: { supply: pSupply, demand: pDemand },
    water: { supply: wSupply, demand: wDemand },
    production,
    consumption,
    exported,
    imported,
    exportCapacity,
    foodSatisfaction,
    budget,
    netIncome,
    researchPerTick,
    culturePerTick,
    buildingHappiness,
    storage,
  };
}

/** Buildings without jobs always operate; others scale with the city-wide staffing ratio. */
function staffRatioFor(jobs: number | undefined, staffRatio: number): number {
  return jobs ? staffRatio : 1;
}

/** Terrain quality multiplier for resource buildings (tin richness, soil fertility). */
export function siteFactor(state: GameState, x: number, y: number, w: number, h: number, placement?: string): number {
  if (placement !== 'tin' && placement !== 'fertile') return 1;
  const m = state.map;
  let sum = 0;
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const i = (y + dy) * m.width + (x + dx);
    sum += placement === 'tin' ? m.tin[i] : m.fertility[i];
  }
  const avg = sum / (w * h) / 255;
  return placement === 'tin' ? 0.4 + 1.2 * avg : 0.5 + avg;
}

/** Era 3 / era 4 rates for progressive infrastructure upkeep. */
export const INFRA = {
  /** share of the city's building capital (sum of build costs) lost to depreciation each turn */
  depreciation: [0, 0, 0, 0.0006, 0.0015],
  /** extra maintenance of the transport network, as a multiple of its upkeep */
  network: [0, 0, 0, 0.5, 1.5],
  /** extra building upkeep that grows with city size: k * log2(1 + population / 8000) */
  urban: [0, 0, 0, 0.1, 0.5],
};

/**
 * Late-game rebalance: in the industrial and digital eras ageing capital and
 * a denser network cost more to keep running the bigger the city gets.
 * Eras 1-2 are unchanged (returns 0).
 */
export function infrastructureUpkeep(state: GameState, budget: Pick<Budget, 'upkeepBuildings' | 'upkeepTransport'>, population: number): number {
  const e = state.era;
  if (e < 3) return 0;
  let capital = 0;
  for (const b of state.buildings) capital += BUILDING_MAP[b.def]?.cost ?? 0;
  return capital * INFRA.depreciation[e] + budget.upkeepTransport * INFRA.network[e] + budget.upkeepBuildings * INFRA.urban[e] * Math.log2(1 + population / 8000);
}

/** True if a flood barrage protects tile (x, y). */
export function floodGuarded(state: GameState, x: number, y: number): boolean {
  for (const b of state.buildings) {
    const r = BUILDING_MAP[b.def]?.floodGuard;
    if (!r) continue;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) return true;
  }
  return false;
}

/** Value of a turn's production at base prices (for the timeline chart). */
export function outputValue(state: GameState, production: GoodMap): number {
  let v = 0;
  for (const g of GOODS) v += production[g] * basePrice(g, state.era);
  return v;
}
