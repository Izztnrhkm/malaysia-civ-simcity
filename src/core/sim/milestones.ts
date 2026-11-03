import { Bilingual, GameState, ZONE } from '../types';
import { notify } from './context';

export interface MilestoneReq {
  label: Bilingual;
  met: boolean;
  current?: number;
  target?: number;
}

export interface MilestoneDef {
  id: string;
  icon: string;
  name: Bilingual;
  desc: Bilingual;
  requirements: (s: GameState) => MilestoneReq[];
}

const has = (s: GameState, id: string) => s.buildings.some((b) => b.def === id);
const num = (label: Bilingual, current: number, target: number): MilestoneReq => ({ label, met: current >= target, current: Math.round(current), target });
const flag = (label: Bilingual, met: boolean): MilestoneReq => ({ label, met });

/** Lots still standing in era 1-2 architecture (kampung houses, bazaars, shophouses). */
export function heritageLots(s: GameState): number {
  const m = s.map;
  let n = 0;
  for (let i = 0; i < m.zone.length; i++) if (m.zone[i] !== ZONE.NONE && m.density[i] > 0 && m.style[i] > 0 && m.style[i] <= 2 && m.building[i] < 0) n++;
  return n;
}

export const MILESTONES: MilestoneDef[] = [
  {
    id: 'economic_hegemon',
    icon: '💰',
    name: { ms: 'Kuasa Ekonomi Serantau', en: 'Economic Hegemon' },
    desc: { ms: 'Jadikan bandar anda hab perdagangan rantau: tabung besar, eksport tinggi dan rakan dagang yang setia.', en: 'Make your city the region’s trading hub: a deep treasury, booming exports and loyal partners.' },
    requirements: (s) => {
      const b = s.derived.budget;
      const friends = Object.values(s.partners).filter((p) => p.relation >= 50).length;
      return [
        flag({ ms: 'Capai Era Bandar Pintar Digital', en: 'Reach the Digital Smart City era' }, s.era >= 4),
        num({ ms: 'Tabung negeri', en: 'Treasury' }, s.money, 500000),
        num({ ms: 'Pendapatan eksport & perjanjian setiap giliran', en: 'Export and deal income per turn' }, b.exports + b.deals, 6000),
        num({ ms: 'Rakan dagang dengan hubungan ≥ 50', en: 'Trade partners with relations ≥ 50' }, friends, 3),
      ];
    },
  },
  {
    id: 'smart_nation',
    icon: '🛰️',
    name: { ms: 'Perintis Negara Pintar', en: 'Smart Nation Pioneer' },
    desc: { ms: 'Bina bandar pintar yang dipacu ilmu: AI, data, MRT dan tenaga bersih.', en: 'Build a knowledge-driven smart city: AI, data, MRT and clean power.' },
    requirements: (s) => [
      flag({ ms: 'Teknologi Bandar Pintar', en: 'Smart City technology' }, s.research.done.includes('bandar_pintar')),
      flag({ ms: 'Teknologi Kecerdasan Buatan', en: 'Artificial Intelligence technology' }, s.research.done.includes('kecerdasan_buatan')),
      flag({ ms: 'Hab Inovasi dan Pusat Data', en: 'An Innovation Hub and a Data Centre' }, has(s, 'hab_inovasi') && has(s, 'pusat_data')),
      flag({ ms: 'Stesen MRT dan Ladang Solar', en: 'An MRT station and a Solar Farm' }, has(s, 'stesen_mrt') && has(s, 'ladang_solar')),
      num({ ms: 'Penduduk', en: 'Population' }, s.derived.population, 30000),
    ],
  },
  {
    id: 'heritage_metropolis',
    icon: '🏛️',
    name: { ms: 'Metropolis Warisan Budaya', en: 'Cultural Heritage Metropolis' },
    desc: { ms: 'Bangunkan bandar moden tanpa memusnahkan warisan: kekalkan mercu tanda lama dan kampung serta rumah kedai bersejarah.', en: 'Grow a modern city without erasing its past: keep the old landmarks and historic kampung and shophouses.' },
    requirements: (s) => [
      flag({ ms: 'Capai Era Perindustrian Pasca-Merdeka', en: 'Reach the Post-Merdeka era' }, s.era >= 3),
      flag({ ms: 'Istana, Masjid Bumbung Bertingkat dan Candi masih berdiri', en: 'Palace, Tiered-Roof Mosque and Candi still standing' }, has(s, 'istana') && has(s, 'masjid') && has(s, 'candi')),
      flag({ ms: 'Stesen Besar Moorish masih berdiri', en: 'Grand Moorish Station still standing' }, has(s, 'bangunan_moorish')),
      num({ ms: 'Lot warisan era 1-2 dipelihara', en: 'Era 1-2 heritage lots preserved' }, heritageLots(s), 120),
      num({ ms: 'Budaya setiap giliran', en: 'Culture per turn' }, s.derived.culturePerTick, 60),
      num({ ms: 'Kebahagiaan', en: 'Happiness' }, s.derived.happiness, 70),
      num({ ms: 'Penduduk', en: 'Population' }, s.derived.population, 20000),
    ],
  },
];

export const MILESTONE_MAP: Record<string, MilestoneDef> = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

/** Award newly met milestones; returns their ids. */
export function checkMilestones(s: GameState): string[] {
  const got = s.milestones ?? [];
  const fresh: string[] = [];
  for (const m of MILESTONES) {
    if (got.includes(m.id)) continue;
    if (m.requirements(s).every((r) => r.met)) fresh.push(m.id);
  }
  if (fresh.length) {
    s.milestones = [...got, ...fresh];
    for (const id of fresh) notify(s, 'era', 'notice.milestone', { id });
  }
  return fresh;
}
