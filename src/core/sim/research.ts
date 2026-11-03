import { BUILDING_MAP } from '../data/buildings';
import { ERAS, nextEra } from '../data/eras';
import { EVENTS } from '../data/events';
import { RESEARCH_MAP } from '../data/research';
import { GameState, ResearchTrack } from '../types';
import { SimContext, canResearch, ensurePartners, notify, refreshModifiers } from './context';
import { fireEvent } from './events';

/** idle research banks at most this many ticks of output */
export const BANK_CAP_TICKS = 10;

export function trackFor(state: GameState, id: string): ResearchTrack | null {
  const def = RESEARCH_MAP[id];
  if (!def) return null;
  return def.kind === 'tech' ? state.research : state.civics;
}

/** Advance one research track by `points`; returns id of completed item if any. */
export function progressTrack(state: GameState, ctx: SimContext, track: ResearchTrack, points: number): string | null {
  if (!track.current) {
    // idle research only banks a limited amount
    track.bank = Math.min(track.bank + points, Math.max(track.bank, BANK_CAP_TICKS * points));
    return null;
  }
  const id = track.current;
  const def = RESEARCH_MAP[id];
  const add = points + track.bank;
  track.bank = 0;
  track.progress[id] = (track.progress[id] ?? 0) + add;
  if (track.progress[id] >= def.cost) {
    track.bank = track.progress[id] - def.cost;
    delete track.progress[id];
    track.done.push(id);
    track.current = null;
    notify(state, 'good', def.kind === 'tech' ? 'notice.techDone' : 'notice.civicDone', { id }, def.entry);
    refreshModifiers(state, ctx);
    return id;
  }
  return null;
}

export function grantResearch(state: GameState, ctx: SimContext, id: string): void {
  const track = trackFor(state, id);
  if (!track || track.done.includes(id)) return;
  track.done.push(id);
  if (track.current === id) track.current = null;
  delete track.progress[id];
  refreshModifiers(state, ctx);
}

export interface Requirement {
  kind: 'tech' | 'civic' | 'population' | 'landmark';
  id: string;
  met: boolean;
  current?: number;
  target?: number;
}

export function eraRequirements(state: GameState): Requirement[] {
  const adv = ERAS[state.era].advance;
  const reqs: Requirement[] = [];
  for (const t of adv.techs) reqs.push({ kind: 'tech', id: t, met: state.research.done.includes(t) });
  for (const c of adv.civics) reqs.push({ kind: 'civic', id: c, met: state.civics.done.includes(c) });
  reqs.push({ kind: 'population', id: 'population', met: state.derived.population >= adv.population, current: state.derived.population, target: adv.population });
  reqs.push({ kind: 'landmark', id: adv.landmark, met: state.buildings.some((b) => b.def === adv.landmark) });
  return reqs;
}

export function canAdvanceEra(state: GameState): boolean {
  return state.era < 4 && eraRequirements(state).every((r) => r.met);
}

export function advanceEra(state: GameState, ctx: SimContext): boolean {
  if (!canAdvanceEra(state)) return false;
  const ne = nextEra(state.era)!;
  state.era = ne;
  const def = ERAS[ne];
  if (state.year < def.startYear) {
    state.year = def.startYear;
    state.month = 0;
  }
  ensurePartners(state);
  notify(state, 'era', 'notice.newEra', { era: ne }, def.entry);
  for (const ev of EVENTS) if (ev.onEraStart && ev.eras.includes(ne) && !state.firedEvents.includes(ev.id)) fireEvent(state, ctx, ev.id);
  refreshModifiers(state, ctx);
  ctx.networkDirty = true;
  return true;
}

export function checkVictory(state: GameState): boolean {
  if (state.victory || state.era !== 4) return false;
  if (eraRequirements(state).every((r) => r.met)) {
    state.victory = true;
    notify(state, 'era', 'notice.victory', {}, 'menara_berkembar');
    return true;
  }
  return false;
}

export function availableResearch(state: GameState, kind: 'tech' | 'civic'): string[] {
  return Object.values(RESEARCH_MAP)
    .filter((r) => r.kind === kind && canResearch(state, r.id))
    .map((r) => r.id);
}

export function landmarkBuilt(state: GameState, id: string): boolean {
  return state.buildings.some((b) => b.def === id && BUILDING_MAP[id]?.landmark);
}
