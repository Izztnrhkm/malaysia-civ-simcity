import { addEffects, EffectTotals, emptyTotals } from '../data/effects';
import { ADVISOR_MAP } from '../data/advisors';
import { BUILDING_MAP, TRANSPORT_BY_KEY } from '../data/buildings';
import { ERAS } from '../data/eras';
import { EVENT_MAP } from '../data/events';
import { PARTNERS } from '../data/partners';
import { POLICY_MAP, RESEARCH_MAP, STARTING_BUILDINGS } from '../data/research';
import { distanceField, generateTerrain } from '../map/terrain';
import { Rng } from '../rng';
import { Derived, GameState, Good, NoticeKind, TransportKey, emptyGoods, isWater } from '../types';
import { Network } from './transport';

export const SAVE_VERSION = 1;
export const DEFAULT_MAP_SIZE = 128;

export interface SimContext {
  rng: Rng;
  effects: EffectTotals;
  /** static: distance (tiles) to river or sea */
  waterDist: Uint8Array;
  net: Network | null;
  cost: Float64Array | null;
  networkDirty: boolean;
  priceMult: Partial<Record<Good, number>>;
  productionMult: number;
  exportCapMult: number;
  eventHappiness: number;
  eventResearch: number;
  flood: boolean;
}

export function emptyDerived(): Derived {
  return {
    population: 0,
    workers: 0,
    jobs: 0,
    employed: 0,
    unemployment: 0,
    happiness: 60,
    demand: { R: 50, C: 0, I: 0 },
    production: emptyGoods(),
    consumption: emptyGoods(),
    exported: emptyGoods(),
    imported: emptyGoods(),
    budget: { taxR: 0, taxC: 0, taxI: 0, exports: 0, deals: 0, upkeepBuildings: 0, upkeepTransport: 0, imports: 0, interest: 0, admin: 0, infrastructure: 0, advisors: 0 },
    netIncome: 0,
    researchPerTick: 0,
    culturePerTick: 0,
    exportCapacity: 0,
    power: { supply: 0, demand: 0 },
    water: { supply: 0, demand: 0 },
    foodSatisfaction: 1,
    storage: 0,
    avgLandValue: 0,
    zoneCounts: { R: 0, C: 0, I: 0 },
  };
}

export function createGame(seed: number, name = 'Kota Baharu', size = DEFAULT_MAP_SIZE): GameState {
  const { map } = generateTerrain(size, size, seed);
  const stock = emptyGoods();
  stock.padi = 80;
  stock.ikan = 40;
  const state: GameState = {
    version: SAVE_VERSION,
    name,
    seed,
    tick: 0,
    year: ERAS[1].startYear,
    month: 0,
    era: 1,
    money: 12000,
    debt: 0,
    tax: { R: 9, C: 9, I: 9 },
    stock,
    research: { current: null, progress: {}, done: [], bank: 0 },
    civics: { current: null, progress: {}, done: [], bank: 0 },
    policies: [],
    partners: {},
    deals: [],
    offers: [],
    buildings: [],
    nextId: 1,
    map,
    firedEvents: [],
    effects: [],
    notices: [],
    history: [],
    rngState: (seed * 2654435761) >>> 0 || 1,
    victory: false,
    derived: emptyDerived(),
  };
  ensurePartners(state);
  return state;
}

export function createContext(state: GameState): SimContext {
  const rng = new Rng(1);
  rng.state = state.rngState;
  const ctx: SimContext = {
    rng,
    effects: emptyTotals(),
    waterDist: distanceField(state.map, isWater),
    net: null,
    cost: null,
    networkDirty: true,
    priceMult: {},
    productionMult: 1,
    exportCapMult: 1,
    eventHappiness: 0,
    eventResearch: 0,
    flood: false,
  };
  refreshModifiers(state, ctx);
  return ctx;
}

/** Recompute aggregated effect totals from research, policies and active events. */
export function refreshModifiers(state: GameState, ctx: SimContext): void {
  const t = emptyTotals();
  for (const id of state.research.done) addEffects(t, RESEARCH_MAP[id]?.effects);
  for (const id of state.civics.done) addEffects(t, RESEARCH_MAP[id]?.effects);
  for (const id of state.policies) addEffects(t, POLICY_MAP[id]?.effects);
  for (const id of state.advisors ?? []) addEffects(t, ADVISOR_MAP[id]?.effects);
  ctx.effects = t;
  const priceMult: Partial<Record<Good, number>> = {};
  let prod = 1;
  let exp = 1;
  let hap = 0;
  let res = 0;
  let flood = false;
  for (const e of state.effects) {
    if (e.priceMult) for (const [g, v] of Object.entries(e.priceMult)) priceMult[g as Good] = (priceMult[g as Good] ?? 1) * (v ?? 1);
    if (e.productionMult) prod *= e.productionMult;
    if (e.exportCapMult) exp *= e.exportCapMult;
    hap += e.happiness ?? 0;
    res += e.research ?? 0;
    if (e.flood) flood = true;
  }
  ctx.priceMult = priceMult;
  ctx.productionMult = prod;
  ctx.exportCapMult = exp;
  ctx.eventHappiness = hap;
  ctx.eventResearch = res;
  ctx.flood = flood;
}

export function notify(state: GameState, kind: NoticeKind, key: string, params?: Record<string, string | number>, entry?: string): void {
  const id = state.notices.length ? state.notices[state.notices.length - 1].id + 1 : 1;
  state.notices.push({ id, tick: state.tick, kind, key, params, entry });
  if (state.notices.length > 80) state.notices.splice(0, state.notices.length - 80);
}

// ---------------- unlocks ----------------

export function isResearched(state: GameState, id: string): boolean {
  return state.research.done.includes(id) || state.civics.done.includes(id);
}

export function isBuildingUnlocked(state: GameState, defId: string): boolean {
  const def = BUILDING_MAP[defId];
  if (!def || def.era > state.era) return false;
  if (def.obsolete && state.era > def.obsolete) return false;
  if (STARTING_BUILDINGS.includes(defId)) return true;
  for (const id of [...state.research.done, ...state.civics.done]) {
    if (RESEARCH_MAP[id]?.unlocks.buildings?.includes(defId)) return true;
  }
  return false;
}

export function isTransportUnlocked(state: GameState, key: TransportKey): boolean {
  if (key === 'road') return true;
  const def = TRANSPORT_BY_KEY[key];
  if (def.era > state.era) return false;
  return state.research.done.some((id) => RESEARCH_MAP[id]?.unlocks.transport?.includes(key));
}

export function isPolicyUnlocked(state: GameState, policyId: string): boolean {
  return state.civics.done.some((id) => RESEARCH_MAP[id]?.unlocks.policies?.includes(policyId));
}

export function canResearch(state: GameState, id: string): boolean {
  const def = RESEARCH_MAP[id];
  if (!def) return false;
  const track = def.kind === 'tech' ? state.research : state.civics;
  if (track.done.includes(id)) return false;
  if (def.era > state.era) return false;
  return def.prereqs.every((p) => isResearched(state, p));
}

// ---------------- partners ----------------

export function activePartners(state: GameState) {
  return PARTNERS.filter((p) => p.eras.includes(state.era) && (!p.requiresEvent || state.firedEvents.includes(p.requiresEvent)));
}

export function ensurePartners(state: GameState): void {
  for (const p of activePartners(state)) {
    if (!state.partners[p.id]) state.partners[p.id] = { relation: p.baseRelation, envoyCooldown: 0, exchange: false };
  }
}

export function eventIsKnown(id: string): boolean {
  return !!EVENT_MAP[id];
}
