import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameEngine } from '../../src/core/engine';
import { ADVISORS, ADVISOR_MAP } from '../../src/core/data/advisors';
import { BUILDINGS } from '../../src/core/data/buildings';
import { CRISES, CRISIS_MAP, CRISIS_TIMEOUT } from '../../src/core/data/crises';
import { ALL_RESEARCH } from '../../src/core/data/research';
import { createScenario, SCENARIOS } from '../../src/core/scenarios';
import { fireEvent } from '../../src/core/sim/events';
import { startCrisis } from '../../src/core/sim/crises';
import { retireAdvisors } from '../../src/core/sim/advisors';
import { infrastructureUpkeep, floodGuarded } from '../../src/core/sim/economy';
import { MILESTONES, checkMilestones, heritageLots } from '../../src/core/sim/milestones';
import { deserialize, toJSON } from '../../src/core/save/save';
import { ENTRIES } from '../../src/content/sejarahpedia';
import { PARTNERS } from '../../src/core/data/partners';
import { GOODS, ZONE } from '../../src/core/types';

const grantAll = (e: GameEngine, era: number) => {
  for (const r of ALL_RESEARCH) if (r.era <= era) (r.kind === 'tech' ? e.state.research : e.state.civics).done.push(r.id);
};

describe('content counts are preserved from v1', () => {
  it('keeps 41 technologies, 25 civics, 18 partners and 40 Sejarahpedia entries', () => {
    expect(ALL_RESEARCH.filter((r) => r.kind === 'tech')).toHaveLength(41);
    expect(ALL_RESEARCH.filter((r) => r.kind === 'civic')).toHaveLength(25);
    expect(PARTNERS).toHaveLength(18);
    expect(ENTRIES).toHaveLength(40);
    // 47 original buildings + watchtower, Parliament, flood barrage, Megatower 118
    expect(BUILDINGS).toHaveLength(51);
  });
});

describe('historical crises', () => {
  it('every crisis is bilingual, has 2-3 choices and a valid default', () => {
    for (const c of CRISES) {
      expect(c.name.ms && c.name.en && c.desc.ms && c.desc.en).toBeTruthy();
      expect(c.choices.length).toBeGreaterThanOrEqual(2);
      expect(c.choices.length).toBeLessThanOrEqual(3);
      expect(c.choices[c.defaultChoice]).toBeDefined();
      expect(c.choices[c.defaultChoice].cost ?? 0).toBe(0);
      for (const ch of c.choices) expect(ch.name.ms.length * ch.name.en.length * ch.desc.ms.length * ch.desc.en.length).toBeGreaterThan(0);
    }
    expect(CRISES.map((c) => c.id)).toEqual(['angin_monsun', 'bah_besar', 'kemelesetan_1930', 'krisis_timah', 'krisis_kewangan']);
  });

  it('the 1926 Great Flood starts in era 2 by year, floods the city and waits for a decision', () => {
    const e = GameEngine.newGame(42);
    e.state.era = 2;
    e.state.year = 1926;
    e.tick();
    expect(e.state.crisis?.id).toBe('bah_besar');
    expect(e.state.effects.some((x) => x.flood)).toBe(true);
    expect(e.ctx.flood).toBe(true);
    expect(e.state.notices.some((n) => n.key === 'crisis.bah_besar')).toBe(true);
  });

  it('resolving charges the cost, applies the choice and logs it', () => {
    const e = GameEngine.newGame(42);
    e.state.era = 2;
    startCrisis(e.state, e.ctx, CRISIS_MAP.bah_besar);
    e.state.money = 10000;
    const r = e.resolveCrisis(1);
    expect(r.ok).toBe(true);
    expect(e.state.money).toBe(10000 - 3500);
    expect(e.state.crisis).toBeNull();
    expect(e.state.crisisLog).toEqual([{ id: 'bah_besar', choice: 'tebatan', tick: e.state.tick }]);
    expect(e.state.effects.find((x) => x.id === 'crisis_bah_besar_tebatan')?.productionMult).toBe(1.08);
    expect(e.resolveCrisis(0).ok).toBe(false);
  });

  it('cannot pick an unaffordable response', () => {
    const e = GameEngine.newGame(42);
    e.state.era = 4;
    startCrisis(e.state, e.ctx, CRISIS_MAP.krisis_kewangan);
    e.state.money = 100;
    expect(e.resolveCrisis(2)).toMatchObject({ ok: false, reason: 'err.money' });
    expect(e.state.crisis?.id).toBe('krisis_kewangan');
  });

  it('event-triggered crises follow their historical event and the event keeps its own effect', () => {
    const e = GameEngine.newGame(42);
    e.state.era = 3;
    fireEvent(e.state, e.ctx, 'krisis_timah_1985');
    expect(e.state.crisis?.id).toBe('krisis_timah');
    expect(e.state.effects.find((x) => x.id === 'krisis_timah_1985')?.priceMult?.timah).toBe(0.45);
  });

  it('auto-resolves with the default after the timeout so the simulation never stalls', () => {
    const e = GameEngine.newGame(42);
    e.state.era = 3;
    fireEvent(e.state, e.ctx, 'krisis_timah_1985');
    for (let i = 0; i <= CRISIS_TIMEOUT; i++) e.tick();
    expect(e.state.crisis).toBeNull();
    expect(e.state.crisisLog?.[0]).toMatchObject({ id: 'krisis_timah', choice: 'pasaran' });
    expect(e.state.notices.some((n) => n.key === 'notice.crisisAuto')).toBe(true);
  });

  it('the monsoon crisis recurs only after its cooldown', () => {
    const e = GameEngine.newGame(7);
    let starts = 0;
    for (let i = 0; i < 400; i++) {
      const before = e.state.crisis;
      e.tick();
      if (!before && e.state.crisis) starts++;
    }
    const log = e.state.crisisLog ?? [];
    for (let i = 1; i < log.length; i++) expect(log[i].tick - log[i - 1].tick).toBeGreaterThanOrEqual(CRISIS_MAP.angin_monsun.trigger.cooldown! - CRISIS_TIMEOUT);
    expect(starts).toBeLessThan(15);
  });
});

describe('historical advisors', () => {
  it('have bilingual bios, sources and serve in valid eras', () => {
    expect(ADVISORS.length).toBeGreaterThanOrEqual(8);
    for (const id of ['tun_perak', 'long_jaafar', 'ridley', 'ungku_aziz']) expect(ADVISOR_MAP[id]).toBeDefined();
    for (const a of ADVISORS) {
      expect(a.bio.ms.length).toBeGreaterThan(40);
      expect(a.bio.en.length).toBeGreaterThan(40);
      expect(a.sources.length).toBeGreaterThan(0);
      for (const u of a.sources) expect(u).toMatch(/^https:\/\//);
      expect(a.eras.length).toBeGreaterThan(0);
    }
    for (const era of [1, 2, 3, 4]) expect(ADVISORS.some((a) => a.eras.includes(era as 1))).toBe(true);
  });

  it('recruiting costs money, uses a seat and grants its buff; upkeep appears in the budget', () => {
    const e = GameEngine.newGame(42);
    const tax0 = e.ctx.effects.tax;
    const m0 = e.state.money;
    expect(e.recruitAdvisor('tun_perak').ok).toBe(true);
    expect(e.state.money).toBe(m0 - ADVISOR_MAP.tun_perak.cost);
    expect(e.ctx.effects.tax).toBeCloseTo(tax0 + 0.1);
    expect(e.recruitAdvisor('tun_sri_lanang')).toMatchObject({ ok: false, reason: 'err.noSlot' });
    expect(e.recruitAdvisor('ungku_aziz')).toMatchObject({ ok: false, reason: 'err.locked' });
    e.tick();
    expect(e.state.derived.budget.advisors).toBe(ADVISOR_MAP.tun_perak.upkeep);
    expect(e.dismissAdvisor('tun_perak').ok).toBe(true);
    expect(e.ctx.effects.tax).toBeCloseTo(tax0);
  });

  it('stay through an era change they serve in, and retire after one they do not', () => {
    const e = GameEngine.newGame(42);
    e.recruitAdvisor('tun_sri_lanang');
    grantAll(e, 1);
    e.state.money = 1e6;
    let spot: [number, number] | null = null;
    for (let y = 10; y < 120 && !spot; y++) for (let x = 10; x < 120 && !spot; x++) if (e.checkBuilding('istana', x, y).ok) spot = [x, y];
    e.placeBuilding('istana', spot![0], spot![1]);
    e.state.derived.population = 99999;
    expect(e.advanceEra().ok).toBe(true);
    expect(e.state.advisors).toEqual(['tun_sri_lanang']);
    e.state.era = 3;
    e.state.advisors = ['tun_sri_lanang', 'zaba'];
    retireAdvisors(e.state, e.ctx);
    expect(e.state.advisors).toEqual(['zaba']);
    expect(e.state.notices.some((n) => n.key === 'notice.advisorRetired' && n.params?.id === 'tun_sri_lanang')).toBe(true);
  });
});

describe('late-game rebalance', () => {
  it('adds no infrastructure upkeep in eras 1-2 and a growing one in eras 3-4', () => {
    const e = GameEngine.newGame(42);
    e.state.buildings.push({ id: 999, def: 'universiti', x: 0, y: 0, w: 3, h: 3, built: 0, efficiency: 1 });
    const b = { upkeepBuildings: 100, upkeepTransport: 10 };
    for (const era of [1, 2] as const) {
      e.state.era = era;
      expect(infrastructureUpkeep(e.state, b, 10000)).toBe(0);
    }
    e.state.era = 3;
    const e3 = infrastructureUpkeep(e.state, b, 10000);
    e.state.era = 4;
    const e4 = infrastructureUpkeep(e.state, b, 10000);
    expect(e3).toBeGreaterThan(0);
    expect(e4).toBeGreaterThan(e3);
    expect(infrastructureUpkeep(e.state, b, 40000)).toBeGreaterThan(e4);
  });

  it('flood barrages protect nearby tiles', () => {
    const e = GameEngine.newGame(42);
    expect(floodGuarded(e.state, 50, 50)).toBe(false);
    e.state.buildings.push({ id: 1000, def: 'tebatan_banjir', x: 50, y: 50, w: 2, h: 2, built: 0, efficiency: 1 });
    expect(floodGuarded(e.state, 55, 55)).toBe(true);
    expect(floodGuarded(e.state, 70, 70)).toBe(false);
  });
});

describe('scenarios', () => {
  it.each(SCENARIOS.map((s) => s.id))('%s starts in its era and year and runs cleanly', (id) => {
    const def = SCENARIOS.find((s) => s.id === id)!;
    const e = createScenario(id, 2024, 'Ujian');
    const s = e.state;
    expect(s.scenario).toBe(id);
    expect(s.era).toBe(def.era);
    expect(s.year).toBe(def.year);
    if (id !== 'melaka_1400') {
      expect(s.buildings.length).toBeGreaterThan(5);
      expect(s.derived.population).toBeGreaterThan(300);
      expect(s.research.done.length + s.civics.done.length).toBeGreaterThan(15);
    }
    for (let i = 0; i < 120; i++) e.tick();
    expect(Number.isFinite(s.money)).toBe(true);
    for (const g of GOODS) expect(s.stock[g]).toBeGreaterThanOrEqual(0);
    expect(s.derived.happiness).toBeGreaterThanOrEqual(0);
  });

  it('the tin rush has mines and points research at railways; MSC starts with industry', () => {
    const tin = createScenario('larut_1875', 42);
    expect(tin.state.buildings.filter((b) => b.def === 'lombong').length).toBeGreaterThanOrEqual(1);
    expect(tin.state.research.current).toBe('kereta_api');
    const msc = createScenario('msc_1996', 42);
    expect(msc.state.buildings.map((b) => b.def)).toEqual(expect.arrayContaining(['pelabuhan_kontena', 'janakuasa', 'ftz']));
    expect(msc.state.firedEvents).toContain('msc_1996');
  });

  it('is deterministic for a seed', () => {
    const a = createScenario('larut_1875', 99);
    const b = createScenario('larut_1875', 99);
    expect(toJSON(a.state).replace(/"savedAt":"[^"]+"/, '')).toBe(toJSON(b.state).replace(/"savedAt":"[^"]+"/, ''));
  });
});

describe('victory milestones', () => {
  it('lists three milestones with requirements', () => {
    expect(MILESTONES.map((m) => m.id)).toEqual(['economic_hegemon', 'smart_nation', 'heritage_metropolis']);
    const e = GameEngine.newGame(1);
    for (const m of MILESTONES) expect(m.requirements(e.state).every((r) => !r.met || r.target === undefined || r.current! >= r.target)).toBe(true);
  });

  it('awards Economic Hegemon once its requirements are met', () => {
    const e = GameEngine.newGame(1);
    const s = e.state;
    s.era = 4;
    s.money = 600000;
    s.derived.budget.exports = 7000;
    s.partners = { a: { relation: 60, envoyCooldown: 0, exchange: false }, b: { relation: 70, envoyCooldown: 0, exchange: false }, c: { relation: 51, envoyCooldown: 0, exchange: false } };
    expect(checkMilestones(s)).toEqual(['economic_hegemon']);
    expect(s.milestones).toEqual(['economic_hegemon']);
    expect(checkMilestones(s)).toEqual([]);
    expect(s.notices.some((n) => n.key === 'notice.milestone')).toBe(true);
  });

  it('counts preserved era 1-2 heritage lots', () => {
    const e = GameEngine.newGame(1);
    const m = e.state.map;
    let n = 0;
    for (let i = 0; i < m.zone.length && n < 5; i++)
      if (m.terrain[i] === 6) {
        m.zone[i] = ZONE.R;
        m.density[i] = 1;
        m.style[i] = n < 3 ? 1 : 3;
        n++;
      }
    expect(heritageLots(e.state)).toBe(3);
  });
});

describe('save compatibility', () => {
  it('loads a save written by the v1 (2D) release unchanged and keeps playing', () => {
    const raw = readFileSync(join(__dirname, '../fixtures/v1-save.json'), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.state.advisors).toBeUndefined();
    const s = deserialize(raw);
    expect(s.name).toBe('Kota Lama v1');
    expect(s.era).toBe(3);
    const e = new GameEngine(s);
    const pop = e.state.derived.population;
    expect(pop).toBeGreaterThan(1000);
    for (let i = 0; i < 30; i++) e.tick();
    expect(Number.isFinite(e.state.money)).toBe(true);
    expect(e.state.history.at(-1)?.output).toBeGreaterThan(0);
  });

  it('round-trips the v2 fields and stays readable as format version 1', () => {
    const e = createScenario('msc_1996', 5);
    e.state.money = 1e6;
    e.recruitAdvisor('ungku_aziz');
    startCrisis(e.state, e.ctx, CRISIS_MAP.krisis_kewangan);
    e.state.milestones = ['smart_nation'];
    for (let i = 0; i < 12; i++) e.tick();
    const json = toJSON(e.state);
    expect(JSON.parse(json).version).toBe(1);
    const back = deserialize(json);
    expect(back.scenario).toBe('msc_1996');
    expect(back.advisors).toEqual(['ungku_aziz']);
    expect(back.milestones).toEqual(['smart_nation']);
    expect(back.crisisLog?.length).toBe(1);
    expect(back.history.at(-1)?.era).toBe(4);
  });

  it('drops unknown advisors and crises from hand-edited saves instead of failing', () => {
    const e = GameEngine.newGame(3);
    const f = JSON.parse(toJSON(e.state));
    f.state.advisors = ['tun_perak', 'nobody'];
    f.state.crisis = { id: 'no_such_crisis', tick: 0 };
    const s = deserialize(f);
    expect(s.advisors).toEqual(['tun_perak']);
    expect(s.crisis).toBeNull();
  });
});
