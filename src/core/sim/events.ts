import { EVENTS, EVENT_MAP } from '../data/events';
import { RESEARCH_MAP } from '../data/research';
import { GameState } from '../types';
import { SimContext, ensurePartners, notify, refreshModifiers } from './context';

export function fireEvent(state: GameState, ctx: SimContext, id: string): void {
  const ev = EVENT_MAP[id];
  if (!ev) return;
  if (ev.kind === 'historical') {
    if (state.firedEvents.includes(id)) return;
    state.firedEvents.push(id);
  }
  const e = ev.effect;
  if (e.duration) {
    state.effects = state.effects.filter((x) => x.id !== id);
    state.effects.push({
      id,
      ticksLeft: e.duration,
      priceMult: e.priceMult,
      productionMult: e.productionMult,
      happiness: e.happiness,
      research: e.research,
      exportCapMult: e.exportCapMult,
      flood: e.flood,
    });
  } else if (e.happiness) {
    state.effects.push({ id, ticksLeft: 6, happiness: e.happiness });
  }
  if (e.money) state.money += e.money;
  if (e.research_once) {
    const t = state.research;
    t.bank += e.research_once;
  }
  if (e.relations) {
    ensurePartners(state);
    for (const [pid, d] of Object.entries(e.relations)) {
      const p = state.partners[pid];
      if (p) p.relation = Math.max(-100, Math.min(100, p.relation + d));
    }
  }
  if (e.grantCivic && RESEARCH_MAP[e.grantCivic] && !state.civics.done.includes(e.grantCivic)) {
    state.civics.done.push(e.grantCivic);
    if (state.civics.current === e.grantCivic) state.civics.current = null;
  }
  ensurePartners(state);
  notify(state, 'event', `event.${id}`, {}, ev.entry);
  refreshModifiers(state, ctx);
}

export function tickEvents(state: GameState, ctx: SimContext): void {
  // expire active effects
  let changed = false;
  for (const e of state.effects) e.ticksLeft -= 1;
  const before = state.effects.length;
  state.effects = state.effects.filter((e) => e.ticksLeft > 0);
  if (state.effects.length !== before) changed = true;

  for (const ev of EVENTS) {
    if (!ev.eras.includes(state.era)) continue;
    if (ev.requires?.building && !state.buildings.some((b) => b.def === ev.requires!.building)) continue;
    if (ev.requires?.research && !state.research.done.includes(ev.requires.research) && !state.civics.done.includes(ev.requires.research)) continue;
    if (ev.kind === 'historical') {
      if (ev.onEraStart || ev.year == null) continue;
      if (state.firedEvents.includes(ev.id)) continue;
      if (state.year >= ev.year) {
        fireEvent(state, ctx, ev.id);
        changed = false;
      }
    } else {
      if (ev.months && !ev.months.includes(state.month)) continue;
      if (state.effects.some((e) => e.id === ev.id)) continue;
      if (state.tick < 24) continue;
      if (ctx.rng.chance(ev.chance ?? 0)) {
        fireEvent(state, ctx, ev.id);
        changed = false;
      }
    }
  }
  if (changed) refreshModifiers(state, ctx);
}
