import { flatEngine } from '../helpers/flat';
import { ENVOY_COST, EXCHANGE_MIN_RELATION, dealPrice } from '../../src/core/sim/diplomacy';
import { fireEvent, tickEvents } from '../../src/core/sim/events';
import { activePartners, refreshModifiers } from '../../src/core/sim/context';
import { ERAS } from '../../src/core/data/eras';

describe('diplomacy', () => {
  it('era 1 starts with historical partners; the Portuguese appear only after 1511', () => {
    const e = flatEngine();
    const ids = activePartners(e.state).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['ming', 'gujerat', 'jawa', 'ryukyu', 'ayutthaya', 'arab_parsi']));
    expect(ids).not.toContain('portugis');
    fireEvent(e.state, e.ctx, 'kejatuhan_melaka');
    expect(activePartners(e.state).map((p) => p.id)).toContain('portugis');
    expect(e.state.partners.portugis.relation).toBeLessThan(0);
  });

  it('envoys cost money, raise relations and have a cooldown', () => {
    const e = flatEngine();
    const r0 = e.state.partners.ming.relation;
    const m0 = e.state.money;
    expect(e.sendEnvoy('ming').ok).toBe(true);
    expect(e.state.money).toBe(m0 - ENVOY_COST[1]);
    expect(e.state.partners.ming.relation).toBe(r0 + 12);
    expect(e.sendEnvoy('ming').reason).toBe('err.cooldown');
    expect(e.sendEnvoy('nowhere').reason).toBe('err.noPartner');
  });

  it('deals require demand, are capped per partner, and pay a premium', () => {
    const e = flatEngine();
    expect(e.proposeDeal('ming', 'padi', 2, 12).reason).toBe('err.notWanted');
    expect(e.proposeDeal('ming', 'rempah', 2, 12).ok).toBe(true);
    expect(e.proposeDeal('ming', 'timah', 1, 12).ok).toBe(true);
    expect(e.proposeDeal('ming', 'kayu', 1, 12).reason).toBe('err.tooManyDeals');
    expect(e.state.deals[0].price).toBeGreaterThan(12);
    expect(dealPrice(e.state, e.ctx, 'gujerat', 'rempah')).toBeGreaterThan(12);
  });

  it('deals deliver from stock through the port; missed deliveries hurt relations', () => {
    const e = flatEngine();
    e.state.money = 1e5;
    e.placeBuilding('pelabuhan', 2, 4);
    // a few residents to staff the port
    for (let x = 10; x < 20; x++) {
      e.state.map.zone[20 * 32 + x] = 1;
      e.state.map.density[20 * 32 + x] = 2;
    }
    e.proposeDeal('gujerat', 'rempah', 3, 4);
    e.state.stock.rempah = 6;
    e.tick();
    expect(e.state.derived.budget.deals).toBeGreaterThan(0);
    const rel = e.state.partners.gujerat.relation;
    e.state.stock.rempah = 0;
    e.tick();
    e.tick();
    expect(e.state.partners.gujerat.relation).toBeLessThan(rel);
    expect(e.state.deals[0].missed).toBeGreaterThan(0);
  });

  it('cancelling a deal damages relations', () => {
    const e = flatEngine();
    e.proposeDeal('ming', 'rempah', 2, 12);
    const r = e.state.partners.ming.relation;
    expect(e.cancelDeal(e.state.deals[0].id).ok).toBe(true);
    expect(e.state.partners.ming.relation).toBe(r - 10);
  });

  it('knowledge exchange needs good relations and yields research', () => {
    const e = flatEngine();
    expect(e.toggleExchange('ming').reason).toBe('err.relation');
    e.state.partners.ming.relation = EXCHANGE_MIN_RELATION + 10;
    expect(e.toggleExchange('ming').ok).toBe(true);
    e.tick();
    expect(e.state.derived.researchPerTick).toBeGreaterThan(0);
  });

  it('accepting an offer creates a deal; declining hurts relations a little', () => {
    const e = flatEngine();
    e.state.offers.push({ id: 900, partner: 'ming', kind: 'deal', good: 'rempah', qty: 2, price: 20, duration: 10, expires: 50 });
    e.state.offers.push({ id: 901, partner: 'jawa', kind: 'deal', good: 'besi', qty: 1, price: 12, duration: 10, expires: 50 });
    expect(e.acceptOffer(900).ok).toBe(true);
    expect(e.state.deals.some((d) => d.partner === 'ming' && d.price === 20)).toBe(true);
    const r = e.state.partners.jawa.relation;
    expect(e.declineOffer(901).ok).toBe(true);
    expect(e.state.partners.jawa.relation).toBe(r - 2);
  });
});

describe('events', () => {
  it('historical events fire once when their year is reached', () => {
    const e = flatEngine();
    e.state.year = 1409;
    const rel = e.state.partners.ming.relation;
    tickEvents(e.state, e.ctx);
    expect(e.state.firedEvents).toContain('zheng_he');
    expect(e.state.partners.ming.relation).toBeGreaterThan(rel);
    const n = e.state.notices.length;
    tickEvents(e.state, e.ctx);
    expect(e.state.notices.filter((x) => x.key === 'event.zheng_he')).toHaveLength(1);
    expect(e.state.notices.length).toBe(n);
  });

  it('timed effects modify prices and expire', () => {
    const e = flatEngine();
    e.state.era = 2;
    fireEvent(e.state, e.ctx, 'kemelesetan_besar');
    expect(e.ctx.priceMult.getah).toBeLessThan(1);
    const eff = e.state.effects.find((x) => x.id === 'kemelesetan_besar')!;
    eff.ticksLeft = 1;
    tickEvents(e.state, e.ctx);
    expect(e.state.effects.find((x) => x.id === 'kemelesetan_besar')).toBeUndefined();
    refreshModifiers(e.state, e.ctx);
    expect(e.ctx.priceMult.getah).toBeUndefined();
  });

  it('gated events wait for their requirement', () => {
    const e = flatEngine();
    e.state.era = 3;
    e.state.year = 1986;
    tickEvents(e.state, e.ctx);
    expect(e.state.firedEvents).not.toContain('kereta_nasional_1985');
    expect(e.state.firedEvents).toContain('krisis_timah_1985');
  });

  it('the calendar advances by the era pace and clamps at the era end', () => {
    const e = flatEngine();
    e.tick();
    expect(e.state.month).toBe(ERAS[1].monthsPerTick);
    e.state.year = ERAS[1].endYear;
    e.state.month = 11;
    e.tick();
    expect(e.state.year).toBe(ERAS[1].endYear);
  });
});
