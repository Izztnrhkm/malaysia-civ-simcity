import { flatEngine } from '../helpers/flat';
import { BUILDINGS, BUILDING_MAP } from '../../src/core/data/buildings';
import { ERAS } from '../../src/core/data/eras';
import { EVENTS } from '../../src/core/data/events';
import { PARTNERS } from '../../src/core/data/partners';
import { ALL_RESEARCH, POLICIES, RESEARCH_MAP, STARTING_BUILDINGS } from '../../src/core/data/research';
import { GOOD_DEFS } from '../../src/core/data/goods';
import { BANK_CAP_TICKS, canAdvanceEra, eraRequirements, progressTrack } from '../../src/core/sim/research';
import { canResearch, isBuildingUnlocked, isPolicyUnlocked } from '../../src/core/sim/context';
import { ERA_IDS, GOODS } from '../../src/core/types';

describe('content integrity', () => {
  it('ids are unique across buildings and research', () => {
    expect(new Set(BUILDINGS.map((b) => b.id)).size).toBe(BUILDINGS.length);
    expect(new Set(ALL_RESEARCH.map((r) => r.id)).size).toBe(ALL_RESEARCH.length);
  });

  it('every prerequisite and unlock reference resolves', () => {
    const policyIds = new Set(POLICIES.map((p) => p.id));
    for (const r of ALL_RESEARCH) {
      for (const p of r.prereqs) {
        expect(RESEARCH_MAP[p], `${r.id} prereq ${p}`).toBeDefined();
        expect(RESEARCH_MAP[p].era).toBeLessThanOrEqual(r.era);
      }
      for (const b of r.unlocks.buildings ?? []) {
        expect(BUILDING_MAP[b], `${r.id} unlock ${b}`).toBeDefined();
        expect(BUILDING_MAP[b].era).toBeLessThanOrEqual(r.era);
      }
      for (const p of r.unlocks.policies ?? []) expect(policyIds.has(p)).toBe(true);
    }
  });

  it('the research graph is acyclic', () => {
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string) => {
      if (done.has(id)) return;
      expect(visiting.has(id), `cycle at ${id}`).toBe(false);
      visiting.add(id);
      for (const p of RESEARCH_MAP[id].prereqs) visit(p);
      visiting.delete(id);
      done.add(id);
    };
    for (const r of ALL_RESEARCH) visit(r.id);
  });

  it('every non-starting building is unlocked by exactly one research item', () => {
    for (const b of BUILDINGS) {
      if (STARTING_BUILDINGS.includes(b.id)) continue;
      const by = ALL_RESEARCH.filter((r) => r.unlocks.buildings?.includes(b.id));
      expect(by.length, b.id).toBe(1);
    }
  });

  it('era requirements and events reference real content', () => {
    for (const e of ERA_IDS) {
      const adv = ERAS[e].advance;
      for (const t of adv.techs) expect(RESEARCH_MAP[t]?.kind).toBe('tech');
      for (const c of adv.civics) expect(RESEARCH_MAP[c]?.kind).toBe('civic');
      expect(BUILDING_MAP[adv.landmark]?.landmark).toBe(true);
      expect(BUILDING_MAP[adv.landmark].era).toBe(e);
    }
    const partnerIds = new Set(PARTNERS.map((p) => p.id));
    for (const ev of EVENTS) {
      for (const pid of Object.keys(ev.effect.relations ?? {})) expect(partnerIds.has(pid), `${ev.id} -> ${pid}`).toBe(true);
      if (ev.effect.grantCivic) expect(RESEARCH_MAP[ev.effect.grantCivic]).toBeDefined();
      if (ev.year) expect(ev.year).toBeGreaterThanOrEqual(ERAS[ev.eras[0]].startYear);
      if (ev.year) expect(ev.year).toBeLessThanOrEqual(ERAS[ev.eras[0]].endYear);
    }
  });

  it('goods have prices for every era in which they are produced', () => {
    for (const b of BUILDINGS) for (const g of Object.keys(b.produces ?? {})) {
      for (let e = b.era; e <= 4; e++) expect(GOOD_DEFS[g as (typeof GOODS)[number]].price[e - 1], `${b.id}:${g}@${e}`).not.toBeNull();
    }
  });

  it('all bilingual strings are non-empty in both languages', () => {
    const all = [...BUILDINGS, ...ALL_RESEARCH, ...POLICIES, ...PARTNERS, ...EVENTS];
    for (const x of all) {
      expect(x.name.ms.length).toBeGreaterThan(1);
      expect(x.name.en.length).toBeGreaterThan(1);
      expect(x.desc.ms.length).toBeGreaterThan(5);
      expect(x.desc.en.length).toBeGreaterThan(5);
    }
  });
});

describe('research progression', () => {
  it('only items with completed prerequisites in the current era are researchable', () => {
    const e = flatEngine();
    expect(canResearch(e.state, 'navigasi_monsun')).toBe(true);
    expect(canResearch(e.state, 'pembinaan_jong')).toBe(false);
    expect(canResearch(e.state, 'kereta_api')).toBe(false);
    expect(e.setResearch('kereta_api').ok).toBe(false);
  });

  it('completing a tech unlocks its building and carries overflow', () => {
    const e = flatEngine();
    expect(isBuildingUnlocked(e.state, 'gudang')).toBe(false);
    e.setResearch('sistem_gudang');
    const done = progressTrack(e.state, e.ctx, e.state.research, 30);
    expect(done).toBe('sistem_gudang');
    expect(e.state.research.bank).toBe(5);
    expect(isBuildingUnlocked(e.state, 'gudang')).toBe(true);
    expect(e.state.notices.some((n) => n.key === 'notice.techDone')).toBe(true);
  });

  it('idle research banks a limited amount', () => {
    const e = flatEngine();
    for (let i = 0; i < 100; i++) progressTrack(e.state, e.ctx, e.state.research, 5);
    expect(e.state.research.bank).toBe(5 * BANK_CAP_TICKS);
  });

  it('civics unlock policies that occupy limited slots', () => {
    const e = flatEngine();
    expect(e.adoptPolicy('gotong_royong').ok).toBe(false);
    e.setResearch('gotong_royong');
    progressTrack(e.state, e.ctx, e.state.civics, 100);
    expect(isPolicyUnlocked(e.state, 'gotong_royong')).toBe(true);
    expect(e.adoptPolicy('gotong_royong').ok).toBe(true);
    expect(e.ctx.effects.construction).toBeLessThan(0);
    e.state.civics.done.push('empat_syahbandar', 'undang_laut');
    expect(e.adoptPolicy('pelabuhan_bebas').reason).toBe('err.noSlot');
    expect(e.revokePolicy('gotong_royong').ok).toBe(true);
    expect(e.adoptPolicy('pelabuhan_bebas').ok).toBe(true);
  });

  it('era advance requires techs, civics, population and the landmark', () => {
    const e = flatEngine();
    e.state.money = 1e6;
    expect(canAdvanceEra(e.state)).toBe(false);
    const adv = ERAS[1].advance;
    e.state.research.done.push(...adv.techs, 'pendulangan', 'sistem_gudang');
    e.state.civics.done.push(...adv.civics, 'gotong_royong', 'empat_syahbandar');
    expect(e.placeBuilding('istana', 10, 4).ok).toBe(true);
    e.state.derived.population = adv.population;
    expect(eraRequirements(e.state).every((r) => r.met)).toBe(true);
    const r = e.advanceEra();
    expect(r.ok).toBe(true);
    expect(e.state.era).toBe(2);
    expect(e.state.year).toBe(ERAS[2].startYear);
    expect(e.state.firedEvents).toContain('perjanjian_1824');
    expect(e.state.partners.negeri_selat).toBeDefined();
  });

  it('entering era 3 grants Merdeka', () => {
    const e = flatEngine();
    e.state.era = 2;
    e.state.money = 1e6;
    const adv = ERAS[2].advance;
    e.state.research.done.push(...adv.techs, 'kapal_wap', 'seni_bina_moorish');
    e.state.civics.done.push(...adv.civics);
    e.placeBuilding('bangunan_moorish', 10, 4);
    e.state.derived.population = adv.population;
    expect(e.advanceEra().ok).toBe(true);
    expect(e.state.civics.done).toContain('kemerdekaan');
    expect(e.state.notices.some((n) => n.key === 'event.merdeka_1957')).toBe(true);
  });
});
