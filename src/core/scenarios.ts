import { GameEngine } from './engine';
import { BUILDING_MAP } from './data/buildings';
import { EVENTS } from './data/events';
import { ALL_RESEARCH } from './data/research';
import { ensurePartners, refreshModifiers } from './sim/context';
import { fireEvent } from './sim/events';
import { Bilingual, EraId, T, ZONE } from './types';

export interface ScenarioDef {
  id: string;
  icon: string;
  era: EraId;
  year: number;
  name: Bilingual;
  desc: Bilingual;
  objectives: Bilingual[];
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'melaka_1400',
    icon: '⛵',
    era: 1,
    year: 1400,
    name: { ms: '1400: Kebangkitan Entrepôt Melaka', en: '1400: Rise of the Melaka Entrepôt' },
    desc: {
      ms: 'Kempen penuh. Mulakan dengan sebuah kuala sungai di Selat Melaka dan bina tamadun merentasi empat era.',
      en: 'The full campaign. Start at a river mouth on the Straits of Melaka and build a civilisation across all four eras.',
    },
    objectives: [
      { ms: 'Bina pelabuhan entrepôt dan pasar', en: 'Build an entrepôt harbour and a market' },
      { ms: 'Bina Istana Kesultanan', en: 'Build the Sultanate Palace' },
      { ms: 'Mara ke era seterusnya', en: 'Advance through the eras' },
    ],
  },
  {
    id: 'larut_1875',
    icon: '⛏️',
    era: 2,
    year: 1875,
    name: { ms: '1875: Demam Bijih Timah Larut & Kinta', en: '1875: Larut & Kinta Tin Rush' },
    desc: {
      ms: 'Bandar perlombongan yang pesat dengan lombong di kaki bukit dan pelabuhan kapal wap. Tiada landasan kereta api lagi: hubungkan lombong ke laut!',
      en: 'A booming mining town with foothill mines and a steamship port, but no railway yet: link the mines to the sea!',
    },
    objectives: [
      { ms: 'Selidik Kereta Api dan bina landasan dari lombong ke pelabuhan', en: 'Research Railways and lay track from the mines to the port' },
      { ms: 'Bina Stesen Kereta Api', en: 'Build a Railway Station' },
      { ms: 'Capai 5,000 penduduk dan Stesen Besar Moorish', en: 'Reach 5,000 people and the Grand Moorish Station' },
    ],
  },
  {
    id: 'msc_1996',
    icon: '🛰️',
    era: 4,
    year: 1996,
    name: { ms: '1996: Koridor MSC & Negara Pintar', en: '1996: MSC & Smart Nation Corridor' },
    desc: {
      ms: 'Bandar perindustrian era Merdeka dengan kilang, janakuasa dan pelabuhan kontena. Peralihan ke ekonomi digital bermula.',
      en: 'A Merdeka-era industrial city with factories, power and a container port. The shift to the digital economy begins.',
    },
    objectives: [
      { ms: 'Bina Hab Inovasi dan Pusat Data', en: 'Build an Innovation Hub and a Data Centre' },
      { ms: 'Buka laluan MRT', en: 'Open an MRT line' },
      { ms: 'Capai pencapaian Perintis Negara Pintar', en: 'Earn the Smart Nation Pioneer milestone' },
    ],
  },
];

export const SCENARIO_MAP: Record<string, ScenarioDef> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

/** River mouth: the river tile closest to the sea (smallest x). */
function riverMouth(e: GameEngine): [number, number] {
  const m = e.state.map;
  let best: [number, number] = [Math.floor(m.width / 4), Math.floor(m.height / 2)];
  let bx = Infinity;
  for (let i = 0; i < m.terrain.length; i++)
    if (m.terrain[i] === T.RIVER && i % m.width < bx) {
      bx = i % m.width;
      best = [bx, (i / m.width) | 0];
    }
  return best;
}

function findSpot(e: GameEngine, id: string, cx: number, cy: number, maxR = 40): [number, number] | null {
  for (let r = 0; r <= maxR; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (e.checkBuilding(id, cx + dx, cy + dy).ok) return [cx + dx, cy + dy];
      }
  return null;
}

function build(e: GameEngine, id: string, cx: number, cy: number, maxR = 40): [number, number] | null {
  const p = findSpot(e, id, cx, cy, maxR);
  if (p && e.placeBuilding(id, p[0], p[1]).ok) return p;
  return null;
}

/** Zone a strip and develop it to a given density and architectural style. */
function town(e: GameEngine, zone: 'R' | 'C' | 'I', x0: number, y0: number, x1: number, y1: number, density: number, style: number) {
  e.zone(zone, x0, y0, x1, y1);
  const m = e.state.map;
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue;
      const i = y * m.width + x;
      if (m.zone[i] === ZONE[zone] && m.building[i] < 0) {
        m.density[i] = density;
        m.style[i] = style;
      }
    }
}

/** Grant all research of eras below `era`, plus extra ids. */
function grantResearch(e: GameEngine, era: EraId, extra: string[]) {
  const s = e.state;
  for (const r of ALL_RESEARCH) {
    if (r.era >= era && !extra.includes(r.id)) continue;
    const track = r.kind === 'tech' ? s.research : s.civics;
    if (!track.done.includes(r.id)) track.done.push(r.id);
  }
}

function setEra(e: GameEngine, era: EraId, year: number) {
  const s = e.state;
  s.era = era;
  s.year = year;
  s.month = 0;
  ensurePartners(s);
  // events dated before the start year are history already; on-start events still play
  for (const ev of EVENTS) if (ev.kind === 'historical' && ev.year != null && ev.year < year && !s.firedEvents.includes(ev.id)) s.firedEvents.push(ev.id);
  refreshModifiers(s, e.ctx);
}

/** Lowest-x tin-rich tile at least `minX` (the foothills east of the coast). */
function tinSite(e: GameEngine, nearY: number): [number, number] {
  const m = e.state.map;
  let best: [number, number] = [Math.floor(m.width * 0.6), nearY];
  let score = Infinity;
  for (let i = 0; i < m.tin.length; i++) {
    if (m.tin[i] < 90) continue;
    const x = i % m.width;
    const y = (i / m.width) | 0;
    const d = Math.abs(y - nearY) * 1.5 + x * 0.5;
    if (d < score) {
      score = d;
      best = [x, y];
    }
  }
  return best;
}

/**
 * Start a game from a scenario. The standard campaign is a plain new game;
 * the others pre-build a period-appropriate city on the generated map.
 */
export function createScenario(id: string, seed: number, name?: string): GameEngine {
  const def = SCENARIO_MAP[id] ?? SCENARIOS[0];
  const e = GameEngine.newGame(seed, name);
  const s = e.state;
  s.scenario = def.id;
  if (def.id === 'melaka_1400') return e;

  s.money = 1e9; // building budget for the pre-built city, reset below
  const [mx, my] = riverMouth(e);
  const hub = findSpot(e, 'pelabuhan', mx, my - 3, 30) ?? [mx + 2, my - 3];

  if (def.id === 'larut_1875') {
    grantResearch(e, 2, ['perlombongan_timah', 'kapal_wap', 'pentadbiran_residen', 'masyarakat_majmuk']);
    setEra(e, 2, 1875);
    const port = build(e, 'pelabuhan_dagang', hub[0], hub[1], 30) ?? build(e, 'pelabuhan', hub[0], hub[1], 30);
    const px = port ? port[0] : hub[0];
    const py = port ? port[1] : hub[1];
    const ry = py + 1;
    e.buildTransport('road', px + 3, ry, px + 26, ry);
    build(e, 'pasar', px + 8, ry - 3, 8);
    build(e, 'masjid', px + 14, ry - 4, 10);
    build(e, 'balai_polis', px + 18, ry + 3, 10);
    build(e, 'sawah', px + 10, ry + 8, 15);
    build(e, 'sawah', px + 14, ry + 9, 15);
    town(e, 'C', px + 5, ry - 1, px + 24, ry - 1, 2, 2);
    town(e, 'R', px + 5, ry + 1, px + 24, ry + 2, 2, 2);
    town(e, 'R', px + 5, ry - 3, px + 12, ry - 2, 1, 1);
    town(e, 'I', px + 20, ry - 3, px + 24, ry - 2, 1, 2);
    // the tin fields in the foothills, linked to town by a cart road
    const [tx, ty] = tinSite(e, ry);
    const mine = build(e, 'lombong', tx, ty, 12);
    if (mine) {
      build(e, 'lombong', mine[0] + 3, mine[1], 10);
      e.buildTransport('road', px + 26, ry, mine[0] - 1, ry);
      e.buildTransport('road', mine[0] - 1, ry, mine[0] - 1, mine[1]);
      town(e, 'R', mine[0] - 3, mine[1] - 2, mine[0] - 2, mine[1] + 2, 1, 2);
    }
    s.research.current = 'kereta_api';
    s.money = 9000;
  } else {
    grantResearch(e, 4, []);
    setEra(e, 4, 1996);
    const port = build(e, 'pelabuhan_kontena', hub[0], hub[1], 30) ?? build(e, 'pelabuhan', hub[0], hub[1], 30);
    const px = port ? port[0] : hub[0];
    const py = port ? port[1] : hub[1];
    const ry = py + 1;
    e.buildTransport('highway', px + 4, ry, px + 34, ry);
    e.buildTransport('road', px + 10, ry - 9, px + 10, ry + 10);
    e.buildTransport('road', px + 22, ry - 9, px + 22, ry + 10);
    e.buildTransport('road', px + 10, ry - 9, px + 22, ry - 9);
    e.buildTransport('road', px + 10, ry + 10, px + 22, ry + 10);
    town(e, 'C', px + 11, ry - 2, px + 21, ry - 1, 3, 3);
    town(e, 'R', px + 11, ry - 8, px + 21, ry - 5, 3, 3);
    town(e, 'R', px + 11, ry + 4, px + 21, ry + 9, 2, 3);
    town(e, 'C', px + 11, ry + 1, px + 21, ry + 2, 3, 3);
    town(e, 'I', px + 23, ry + 1, px + 30, ry + 4, 3, 3);
    town(e, 'R', px + 5, ry - 6, px + 9, ry - 2, 2, 2);
    for (const [id, dx, dy] of [
      ['janakuasa', 28, -5],
      ['loji_air', 28, 8],
      ['ftz', 34, 3],
      ['universiti', 4, 7],
      ['stadium', 16, 14],
      ['hospital', 6, -9],
      ['sekolah', 14, -11],
      ['masjid', 18, -12],
    ] as Array<[string, number, number]>)
      if (BUILDING_MAP[id]) build(e, id, px + dx, ry + dy, 12);
    s.research.current = 'internet';
    s.money = 120000;
  }
  for (const ev of EVENTS) if (ev.onEraStart && ev.eras.includes(s.era) && !s.firedEvents.includes(ev.id)) fireEvent(s, e.ctx, ev.id);
  s.notices = s.notices.filter((n) => n.kind === 'event');
  s.tax = { R: 9, C: 9, I: 9 };
  s.derived.happiness = 62;
  e.refreshNetwork();
  e.updateDerivedOnly();
  e.emit();
  return e;
}
