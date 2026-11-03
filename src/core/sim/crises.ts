import { CRISES, CRISIS_MAP, CRISIS_TIMEOUT, CrisisDef } from '../data/crises';
import { CommandResult, GameState } from '../types';
import { SimContext, notify, refreshModifiers } from './context';
import { applyEffect } from './events';

/** Crisis ids that have started (pending or resolved). */
function started(state: GameState, id: string): boolean {
  return state.crisis?.id === id || (state.crisisLog ?? []).some((c) => c.id === id);
}

export function startCrisis(state: GameState, ctx: SimContext, def: CrisisDef): void {
  if (state.crisis) return;
  state.crisis = { id: def.id, tick: state.tick };
  if (def.base) applyEffect(state, ctx, `crisis_${def.id}`, def.base);
  notify(state, 'bad', `crisis.${def.id}`, {}, def.entry);
  refreshModifiers(state, ctx);
}

/** Event-triggered crises: called whenever a historical event fires. */
export function onEventFired(state: GameState, ctx: SimContext, eventId: string): void {
  for (const c of CRISES) if (c.trigger.event === eventId && c.eras.includes(state.era) && !started(state, c.id)) startCrisis(state, ctx, c);
}

/** Year and random triggers plus auto-resolution. Returns true if modifiers changed. */
export function tickCrises(state: GameState, ctx: SimContext): boolean {
  const pending = state.crisis;
  if (pending) {
    if (state.tick - pending.tick >= CRISIS_TIMEOUT) {
      const def = CRISIS_MAP[pending.id];
      resolveCrisis(state, ctx, def ? def.defaultChoice : 0, true);
      return true;
    }
    return false;
  }
  for (const c of CRISES) {
    if (!c.eras.includes(state.era)) continue;
    const t = c.trigger;
    if (t.year != null) {
      if (state.year >= t.year && !started(state, c.id)) {
        startCrisis(state, ctx, c);
        return true;
      }
    } else if (t.chance) {
      if (t.months && !t.months.includes(state.month)) continue;
      if (state.tick < (t.minTick ?? 24)) continue;
      const last = [...(state.crisisLog ?? [])].reverse().find((l) => l.id === c.id);
      if (last && state.tick - last.tick < (t.cooldown ?? 30)) continue;
      if (ctx.rng.chance(t.chance)) {
        startCrisis(state, ctx, c);
        return true;
      }
    }
  }
  return false;
}

export function resolveCrisis(state: GameState, ctx: SimContext, choice: number, auto = false): CommandResult {
  const pending = state.crisis;
  if (!pending) return { ok: false, reason: 'err.invalid' };
  const def = CRISIS_MAP[pending.id];
  const ch = def?.choices[choice];
  if (!def || !ch) return { ok: false, reason: 'err.invalid' };
  const cost = ch.cost ?? 0;
  if (cost > 0 && state.money < cost && !auto) return { ok: false, reason: 'err.money' };
  state.money -= cost;
  applyEffect(state, ctx, `crisis_${def.id}_${ch.id}`, ch.effect);
  state.crisis = null;
  state.crisisLog = [...(state.crisisLog ?? []), { id: def.id, choice: ch.id, tick: state.tick }].slice(-40);
  notify(state, auto ? 'info' : 'good', auto ? 'notice.crisisAuto' : 'notice.crisisResolved', { crisis: def.id, choice: ch.id });
  refreshModifiers(state, ctx);
  return { ok: true, cost };
}
