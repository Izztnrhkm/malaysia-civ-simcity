import { flatEngine } from '../helpers/flat';
import { ZONE_CAPACITY } from '../../src/core/data/buildings';
import { computeDemand, zoneTotals } from '../../src/core/sim/zoning';
import { siteFactor } from '../../src/core/sim/economy';
import { ZONE } from '../../src/core/types';

function settledTown() {
  const e = flatEngine();
  e.state.money = 50000;
  e.placeBuilding('pelabuhan', 2, 4);
  e.buildTransport('road', 4, 5, 28, 5);
  e.buildTransport('road', 12, 5, 12, 14);
  e.placeBuilding('pasar', 6, 6);
  return e;
}

describe('zone totals and demand', () => {
  it('counts residents and jobs from zone density', () => {
    const e = flatEngine();
    const m = e.state.map;
    m.zone[100] = ZONE.R;
    m.density[100] = 2;
    m.zone[101] = ZONE.C;
    m.density[101] = 3;
    m.zone[102] = ZONE.I;
    m.density[102] = 1;
    const z = zoneTotals(e.state);
    expect(z.population).toBe(ZONE_CAPACITY.R[2]);
    expect(z.cJobs).toBe(ZONE_CAPACITY.C[3]);
    expect(z.iJobs).toBe(ZONE_CAPACITY.I[1]);
    expect(z.counts).toEqual({ R: 1, C: 1, I: 1 });
  });

  it('residential demand rises with available jobs and falls with high taxes', () => {
    const e = flatEngine();
    const base = { population: 2000, workers: 1100, cJobs: 300, iJobs: 300, happiness: 60, foodSatisfaction: 1, unemployment: 0, exportCapacity: 0 };
    const lowJobs = computeDemand(e.state, e.ctx, { ...base, jobs: 600 });
    const highJobs = computeDemand(e.state, e.ctx, { ...base, jobs: 1600 });
    expect(highJobs.R).toBeGreaterThan(lowJobs.R);
    e.state.tax.R = 20;
    expect(computeDemand(e.state, e.ctx, { ...base, jobs: 1600 }).R).toBeLessThan(highJobs.R);
  });

  it('demand is always within -100..100', () => {
    const e = flatEngine();
    const d = computeDemand(e.state, e.ctx, { population: 0, workers: 0, jobs: 100000, cJobs: 0, iJobs: 0, happiness: 100, foodSatisfaction: 1, unemployment: 1, exportCapacity: 1e6 });
    for (const v of [d.R, d.C, d.I]) {
      expect(v).toBeLessThanOrEqual(100);
      expect(v).toBeGreaterThanOrEqual(-100);
    }
  });
});

describe('zone growth', () => {
  it('zones with road access develop over time; zones without access do not', () => {
    const e = settledTown();
    e.zone('R', 14, 6, 20, 7);
    e.zone('R', 14, 20, 20, 21); // far from any road or water
    for (let i = 0; i < 80; i++) e.tick();
    const m = e.state.map;
    let near = 0;
    let far = 0;
    for (let x = 14; x <= 20; x++) {
      near += m.density[6 * 32 + x] + m.density[7 * 32 + x];
      far += m.density[20 * 32 + x] + m.density[21 * 32 + x];
    }
    expect(near).toBeGreaterThan(0);
    expect(far).toBe(0);
    expect(e.state.derived.population).toBeGreaterThan(0);
  });

  it('density never exceeds the era maximum', () => {
    const e = settledTown();
    e.zone('R', 14, 6, 26, 8);
    for (let i = 0; i < 300; i++) e.tick();
    const max = Math.max(...Array.from(e.state.map.density));
    expect(max).toBeLessThanOrEqual(2);
  });
});

describe('production, consumption and trade', () => {
  it('fields produce rice, residents eat it and surplus is exported through the port', () => {
    const e = settledTown();
    e.placeBuilding('sawah', 14, 6);
    e.placeBuilding('sawah', 16, 6);
    e.zone('R', 18, 6, 26, 7);
    for (let i = 0; i < 40; i++) e.tick();
    const d = e.state.derived;
    expect(d.production.padi).toBeGreaterThan(0);
    expect(d.consumption.padi).toBeGreaterThan(0);
    expect(d.exportCapacity).toBeGreaterThan(0);
    expect(d.foodSatisfaction).toBeCloseTo(1, 2);
  });

  it('nothing is exported without an export hub', () => {
    const e = flatEngine();
    e.state.money = 50000;
    e.buildTransport('road', 4, 5, 28, 5);
    e.placeBuilding('sawah', 14, 6);
    for (let i = 0; i < 10; i++) e.tick();
    expect(e.state.derived.exportCapacity).toBe(0);
    expect(e.state.derived.budget.exports).toBe(0);
  });

  it('higher tax rates raise residential tax income', () => {
    const run = (rate: number) => {
      const e = settledTown();
      e.zone('R', 14, 6, 26, 8);
      for (let i = 0; i < 60; i++) e.tick();
      e.setTax('R', rate);
      e.tick();
      return e.state.derived.budget.taxR / Math.max(1, e.state.derived.population);
    };
    expect(run(15)).toBeGreaterThan(run(5));
  });

  it('upkeep is charged for buildings and transport', () => {
    const e = settledTown();
    const before = e.state.money;
    e.tick();
    const b = e.state.derived.budget;
    expect(b.upkeepBuildings).toBeGreaterThan(0);
    expect(b.upkeepTransport).toBeGreaterThan(0);
    expect(e.state.money).toBeCloseTo(before + e.state.derived.netIncome, 6);
  });

  it('food shortage is covered by imports when a port exists', () => {
    const e = settledTown();
    const m = e.state.map;
    for (let x = 14; x < 26; x++) {
      m.zone[6 * 32 + x] = ZONE.R;
      m.density[6 * 32 + x] = 2;
    }
    e.state.stock.padi = 0;
    e.state.stock.ikan = 0;
    e.tick();
    expect(e.state.derived.imported.padi).toBeGreaterThan(0);
    expect(e.state.derived.budget.imports).toBeGreaterThan(0);
  });

  it('site factor rewards rich tin and fertile soil', () => {
    const e = flatEngine();
    e.state.map.tin[0] = 255;
    expect(siteFactor(e.state, 0, 0, 1, 1, 'tin')).toBeCloseTo(1.6);
    expect(siteFactor(e.state, 5, 5, 1, 1, 'tin')).toBeCloseTo(0.4);
    expect(siteFactor(e.state, 5, 5, 1, 1)).toBe(1);
  });

  it('loans add money and debt within the era limit', () => {
    const e = flatEngine();
    const m0 = e.state.money;
    expect(e.takeLoan(5000).ok).toBe(true);
    expect(e.state.money).toBe(m0 + 5000);
    expect(e.state.debt).toBe(5000);
    expect(e.takeLoan(1e9).reason).toBe('err.debtLimit');
    expect(e.repayLoan(2000).ok).toBe(true);
    expect(e.state.debt).toBe(3000);
  });
});
