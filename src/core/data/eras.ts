import { Bilingual, EraId } from '../types';

export interface EraDef {
  id: EraId;
  name: Bilingual;
  short: Bilingual;
  span: Bilingual;
  startYear: number;
  /** calendar is clamped at this year until the player advances */
  endYear: number;
  monthsPerTick: number;
  currency: Bilingual;
  currencySymbol: string;
  maxDensity: number;
  /** per-capita prosperity used by the tax model */
  wealth: number;
  commercialRatio: number;
  industrialRatio: number;
  policySlots: number;
  advance: { techs: string[]; civics: string[]; population: number; landmark: string };
  intro: Bilingual;
  entry: string;
}

export const ERAS: Record<EraId, EraDef> = {
  1: {
    id: 1,
    name: { ms: 'Zaman Entrepôt Maritim', en: 'Maritime Entrepôt Age' },
    short: { ms: 'Entrepôt', en: 'Entrepôt' },
    span: { ms: 'Lembah Bujang hingga Kesultanan Melaka', en: 'Bujang Valley to the Melaka Sultanate' },
    startYear: 1400,
    endYear: 1823,
    monthsPerTick: 6,
    currency: { ms: 'Jongkong Timah', en: 'Tin ingots' },
    currencySymbol: '₮',
    maxDensity: 2,
    wealth: 0.3,
    commercialRatio: 0.16,
    industrialRatio: 0.12,
    policySlots: 1,
    advance: {
      techs: ['navigasi_monsun', 'pembinaan_jong', 'mata_wang_timah'],
      civics: ['kesultanan_melaka', 'undang_laut'],
      population: 1200,
      landmark: 'istana',
    },
    intro: {
      ms: 'Angin monsun membawa kapal dari Gujerat, China dan Jawa. Bina pelabuhan entrepôt, kampung di tebing sungai dan bazar yang sibuk.',
      en: 'Monsoon winds bring ships from Gujarat, China and Java. Build an entrepôt port, riverside kampung and a busy bazaar.',
    },
    entry: 'era_entrepot',
  },
  2: {
    id: 2,
    name: { ms: 'Era Bijih Timah, Getah & Kereta Api', en: 'Tin, Rubber & Rail Era' },
    short: { ms: 'Timah & Getah', en: 'Tin & Rubber' },
    span: { ms: 'Perjanjian 1824 hingga Pilihan Raya 1955', en: 'The 1824 Treaty to the 1955 election' },
    startYear: 1824,
    endYear: 1956,
    monthsPerTick: 4,
    currency: { ms: 'Dolar Negeri-Negeri Selat', en: 'Straits dollar' },
    currencySymbol: '$',
    maxDensity: 3,
    wealth: 0.45,
    commercialRatio: 0.18,
    industrialRatio: 0.16,
    policySlots: 2,
    advance: {
      techs: ['kereta_api', 'getah_para', 'perlombongan_timah'],
      civics: ['negeri_bersekutu', 'pilihan_raya'],
      population: 5000,
      landmark: 'bangunan_moorish',
    },
    intro: {
      ms: 'Bijih timah ditemui di kaki bukit dan pokok getah tiba dari Brazil melalui Ceylon. Hubungkan lombong ke pelabuhan dengan landasan kereta api.',
      en: 'Tin is found in the foothills and rubber seedlings arrive from Brazil via Ceylon. Link the mines to the port by railway.',
    },
    entry: 'era_timah',
  },
  3: {
    id: 3,
    name: { ms: 'Perindustrian Pasca-Merdeka', en: 'Post-Merdeka Industrialisation' },
    short: { ms: 'Merdeka', en: 'Merdeka' },
    span: { ms: '1957 hingga 1995', en: '1957 to 1995' },
    startYear: 1957,
    endYear: 1995,
    monthsPerTick: 2,
    currency: { ms: 'Ringgit', en: 'Ringgit' },
    currencySymbol: 'RM',
    maxDensity: 4,
    wealth: 0.7,
    commercialRatio: 0.2,
    industrialRatio: 0.2,
    policySlots: 3,
    advance: {
      techs: ['semikonduktor', 'automotif', 'lebuhraya'],
      civics: ['dasar_ekonomi_baru', 'pembentukan_malaysia'],
      population: 15000,
      landmark: 'stadium',
    },
    intro: {
      ms: 'Merdeka! Bina taman perumahan, zon perdagangan bebas dan kilang. Bekalan elektrik dan air kini penting untuk pembangunan.',
      en: 'Merdeka! Build housing estates, free trade zones and factories. Power and water now matter for development.',
    },
    entry: 'era_merdeka',
  },
  4: {
    id: 4,
    name: { ms: 'Era Bandar Pintar Digital', en: 'Digital Smart City Era' },
    short: { ms: 'Digital', en: 'Digital' },
    span: { ms: '1996 dan seterusnya', en: '1996 onwards' },
    startYear: 1996,
    endYear: 2100,
    monthsPerTick: 1,
    currency: { ms: 'Ringgit', en: 'Ringgit' },
    currencySymbol: 'RM',
    maxDensity: 4,
    wealth: 1.1,
    commercialRatio: 0.24,
    industrialRatio: 0.16,
    policySlots: 4,
    advance: {
      techs: ['bandar_pintar'],
      civics: ['negara_maju'],
      population: 30000,
      landmark: 'menara_berkembar',
    },
    intro: {
      ms: 'Koridor Raya Multimedia dilancarkan. Bina pusat data, MRT dan hab inovasi untuk menjadi negara maju.',
      en: 'The Multimedia Super Corridor is launched. Build data centres, MRT and innovation hubs to become a developed nation.',
    },
    entry: 'era_digital',
  },
};

export const nextEra = (e: EraId): EraId | null => (e < 4 ? ((e + 1) as EraId) : null);
