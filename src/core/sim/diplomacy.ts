import { ERAS } from '../data/eras';
import { basePrice, isTradable } from '../data/goods';
import { PARTNER_MAP } from '../data/partners';
import { CommandResult, GameState, Good } from '../types';
import { SimContext, activePartners, ensurePartners, notify } from './context';

export const ENVOY_COST = [0, 150, 400, 1500, 4000];
export const EXCHANGE_COST = [0, 3, 8, 30, 80];
export const EXCHANGE_MIN_RELATION = 25;
export const MAX_DEALS_PER_PARTNER = 2;

export function dealPrice(state: GameState, ctx: SimContext, partnerId: string, good: Good): number {
  const def = PARTNER_MAP[partnerId];
  const rel = state.partners[partnerId]?.relation ?? 0;
  const mult = def?.buys[good] ?? 0;
  return basePrice(good, state.era) * mult * (1 + rel / 300) * (1 + ctx.effects.exportPrice);
}

export function sendEnvoy(state: GameState, ctx: SimContext, partnerId: string): CommandResult {
  ensurePartners(state);
  const p = state.partners[partnerId];
  if (!p || !activePartners(state).some((a) => a.id === partnerId)) return { ok: false, reason: 'err.noPartner' };
  if (p.envoyCooldown > 0) return { ok: false, reason: 'err.cooldown' };
  const cost = ENVOY_COST[state.era];
  if (state.money < cost) return { ok: false, reason: 'err.money' };
  state.money -= cost;
  const bonus = state.buildings.some((b) => b.def === 'syahbandar') ? 4 : 0;
  p.relation = Math.min(100, p.relation + 12 + bonus);
  p.envoyCooldown = 8;
  void ctx;
  return { ok: true, cost };
}

export function proposeDeal(state: GameState, ctx: SimContext, partnerId: string, good: Good, qty: number, duration: number): CommandResult {
  const def = PARTNER_MAP[partnerId];
  const p = state.partners[partnerId];
  if (!def || !p || !activePartners(state).some((a) => a.id === partnerId)) return { ok: false, reason: 'err.noPartner' };
  if (!def.buys[good] || !isTradable(good, state.era)) return { ok: false, reason: 'err.notWanted' };
  if (qty <= 0 || duration <= 0) return { ok: false, reason: 'err.invalid' };
  if (state.deals.filter((d) => d.partner === partnerId).length >= MAX_DEALS_PER_PARTNER) return { ok: false, reason: 'err.tooManyDeals' };
  if (p.relation < -20) return { ok: false, reason: 'err.relation' };
  const price = dealPrice(state, ctx, partnerId, good);
  state.deals.push({ id: state.nextId++, partner: partnerId, good, qty, price, remaining: duration, delivered: 0, missed: 0 });
  p.relation = Math.min(100, p.relation + 3);
  return { ok: true };
}

export function cancelDeal(state: GameState, dealId: number): CommandResult {
  const d = state.deals.find((x) => x.id === dealId);
  if (!d) return { ok: false, reason: 'err.invalid' };
  state.deals = state.deals.filter((x) => x.id !== dealId);
  const p = state.partners[d.partner];
  if (p) p.relation = Math.max(-100, p.relation - 10);
  return { ok: true };
}

export function toggleExchange(state: GameState, partnerId: string): CommandResult {
  const p = state.partners[partnerId];
  if (!p) return { ok: false, reason: 'err.noPartner' };
  if (!p.exchange && p.relation < EXCHANGE_MIN_RELATION) return { ok: false, reason: 'err.relation' };
  p.exchange = !p.exchange;
  return { ok: true };
}

export function acceptOffer(state: GameState, ctx: SimContext, offerId: number): CommandResult {
  const o = state.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, reason: 'err.invalid' };
  state.offers = state.offers.filter((x) => x.id !== offerId);
  const p = state.partners[o.partner];
  if (o.kind === 'deal' && o.good && o.qty && o.duration && o.price) {
    state.deals.push({ id: state.nextId++, partner: o.partner, good: o.good, qty: o.qty, price: o.price, remaining: o.duration, delivered: 0, missed: 0 });
  } else if (o.kind === 'investment' && o.money) {
    state.money += o.money;
    if (p) p.relation = Math.min(100, p.relation + 5);
  } else if (o.kind === 'exchange') {
    if (p) p.exchange = true;
  }
  void ctx;
  return { ok: true };
}

export function declineOffer(state: GameState, offerId: number): CommandResult {
  const o = state.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, reason: 'err.invalid' };
  state.offers = state.offers.filter((x) => x.id !== offerId);
  const p = state.partners[o.partner];
  if (p) p.relation = Math.max(-100, p.relation - 2);
  return { ok: true };
}

/** Per-tick diplomacy: relation drift, exchanges, and partner-initiated offers. Returns research gained. */
export function tickDiplomacy(state: GameState, ctx: SimContext): number {
  ensurePartners(state);
  const active = activePartners(state);
  let knowledge = 0;
  for (const def of active) {
    const p = state.partners[def.id];
    p.relation += (def.baseRelation - p.relation) * 0.004 + ctx.effects.relationGain;
    p.relation = Math.max(-100, Math.min(100, p.relation));
    if (p.envoyCooldown > 0) p.envoyCooldown -= 1;
    if (p.exchange) {
      const cost = EXCHANGE_COST[state.era];
      if (p.relation < EXCHANGE_MIN_RELATION || state.money < cost) p.exchange = false;
      else {
        state.money -= cost;
        knowledge += def.knowledge * state.era;
      }
    }
  }
  state.offers = state.offers.filter((o) => o.expires > state.tick && active.some((a) => a.id === o.partner));
  if (state.offers.length < 3 && state.tick > 12 && ctx.rng.chance(0.03)) {
    const def = ctx.rng.pick(active);
    const p = def && state.partners[def.id];
    if (p && p.relation >= -10) {
      const ftzOk = state.era >= 4 || state.civics.done.includes('zon_perdagangan_bebas');
      if (state.era >= 3 && ftzOk && p.relation >= 30 && ctx.rng.chance(0.4)) {
        const money = Math.round(ERAS[state.era].wealth * 8000 * (1 + p.relation / 100));
        state.offers.push({ id: state.nextId++, partner: def.id, kind: 'investment', money, expires: state.tick + 12 });
        notify(state, 'info', 'notice.offer', { partner: def.id });
      } else {
        const goods = (Object.keys(def.buys) as Good[]).filter((g) => isTradable(g, state.era) && (state.derived.production[g] ?? 0) > 0.5);
        if (goods.length) {
          const g = ctx.rng.pick(goods);
          const qty = Math.max(1, Math.round(state.derived.production[g] * ctx.rng.range(0.3, 0.6)));
          const price = dealPrice(state, ctx, def.id, g) * 1.08;
          state.offers.push({ id: state.nextId++, partner: def.id, kind: 'deal', good: g, qty, price, duration: 24, expires: state.tick + 12 });
          notify(state, 'info', 'notice.offer', { partner: def.id });
        }
      }
    }
  }
  return knowledge;
}
