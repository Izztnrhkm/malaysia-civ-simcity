import { ADVISOR_MAP, ADVISOR_SLOTS } from '../data/advisors';
import { CommandResult, GameState } from '../types';
import { SimContext, notify, refreshModifiers } from './context';

export function advisorSlots(state: GameState): number {
  return ADVISOR_SLOTS[state.era];
}

export function canRecruit(state: GameState, id: string): CommandResult {
  const def = ADVISOR_MAP[id];
  if (!def || !def.eras.includes(state.era)) return { ok: false, reason: 'err.locked' };
  const list = state.advisors ?? [];
  if (list.includes(id)) return { ok: false, reason: 'err.invalid' };
  if (list.length >= advisorSlots(state)) return { ok: false, reason: 'err.noSlot' };
  if (state.money < def.cost) return { ok: false, reason: 'err.money', cost: def.cost };
  return { ok: true, cost: def.cost };
}

export function recruitAdvisor(state: GameState, ctx: SimContext, id: string): CommandResult {
  const chk = canRecruit(state, id);
  if (!chk.ok) return chk;
  state.money -= chk.cost!;
  state.advisors = [...(state.advisors ?? []), id];
  notify(state, 'good', 'notice.advisorJoined', { id });
  refreshModifiers(state, ctx);
  return chk;
}

export function dismissAdvisor(state: GameState, ctx: SimContext, id: string): CommandResult {
  if (!(state.advisors ?? []).includes(id)) return { ok: false, reason: 'err.invalid' };
  state.advisors = state.advisors!.filter((a) => a !== id);
  refreshModifiers(state, ctx);
  return { ok: true };
}

/** After an era change, advisors from earlier eras retire. */
export function retireAdvisors(state: GameState, ctx: SimContext): void {
  const keep: string[] = [];
  for (const id of state.advisors ?? []) {
    if (ADVISOR_MAP[id]?.eras.includes(state.era)) keep.push(id);
    else notify(state, 'info', 'notice.advisorRetired', { id });
  }
  state.advisors = keep.slice(0, advisorSlots(state));
  refreshModifiers(state, ctx);
}
