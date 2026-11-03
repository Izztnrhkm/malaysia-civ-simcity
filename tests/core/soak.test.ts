import { GameEngine } from '../../src/core/engine';
import { GOODS } from '../../src/core/types';
import { Bot } from '../helpers/bot';

/**
 * Long headless runs with a scripted player. These guard against NaN/Infinity
 * leaks, runaway values and progression dead-ends across different maps.
 */
describe.each([42, 7, 2024])('soak test, seed %i', (seed) => {
  it('plays 650 ticks, stays numerically sane and progresses through eras', () => {
    const e = GameEngine.newGame(seed);
    const bot = new Bot(e);
    bot.setup();
    let maxEra = 1;
    for (let i = 0; i < 650; i++) {
      bot.step();
      e.tick();
      const s = e.state;
      const d = s.derived;
      maxEra = Math.max(maxEra, s.era);
      if (i % 25 === 0) {
        expect(Number.isFinite(s.money)).toBe(true);
        expect(Number.isFinite(d.happiness)).toBe(true);
        expect(d.happiness).toBeGreaterThanOrEqual(0);
        expect(d.happiness).toBeLessThanOrEqual(100);
        for (const g of GOODS) {
          expect(Number.isFinite(s.stock[g])).toBe(true);
          expect(s.stock[g]).toBeGreaterThanOrEqual(0);
        }
        for (const p of Object.values(s.partners)) expect(Math.abs(p.relation)).toBeLessThanOrEqual(100);
      }
    }
    expect(e.state.derived.population).toBeGreaterThan(3000);
    expect(maxEra).toBeGreaterThanOrEqual(3);
    expect(e.state.research.done.length).toBeGreaterThan(15);
    expect(e.state.history.length).toBeGreaterThan(50);
  });
});
