import { Bilingual, EraId } from '../types';
import { EventEffect } from './events';

/**
 * Interactive historical crises. A crisis pauses for a policy decision; each
 * choice applies its own trade-off on top of the crisis' base shock. If the
 * player does not decide within CRISIS_TIMEOUT turns the default applies.
 * Event-triggered crises are responses to an existing historical event (whose
 * own effect is unchanged), so the original simulation rules still apply.
 */
export interface CrisisChoice {
  id: string;
  name: Bilingual;
  desc: Bilingual;
  /** money spent immediately (era currency) */
  cost?: number;
  effect: EventEffect;
}

export interface CrisisDef {
  id: string;
  eras: EraId[];
  trigger: { event?: string; year?: number; months?: number[]; chance?: number; cooldown?: number; minTick?: number };
  /** shock applied when the crisis starts (event-triggered crises rely on their event instead) */
  base?: EventEffect;
  name: Bilingual;
  desc: Bilingual;
  choices: CrisisChoice[];
  defaultChoice: number;
  entry?: string;
}

export const CRISIS_TIMEOUT = 8;

const C = (d: CrisisDef) => d;

export const CRISES: CrisisDef[] = [
  C({
    id: 'angin_monsun',
    eras: [1],
    trigger: { months: [3, 4, 9, 10], chance: 0.03, cooldown: 40, minTick: 30 },
    base: { exportCapMult: 0.75, duration: 4 },
    name: { ms: 'Angin Monsun Berubah', en: 'The Monsoon Winds Shift' },
    desc: {
      ms: 'Angin peralihan monsun datang lewat tahun ini. Armada dari Gujerat dan China tertahan dan gudang mula penuh.',
      en: 'The inter-monsoon winds turn late this year. Fleets from Gujarat and China are delayed and warehouses fill up.',
    },
    defaultChoice: 0,
    entry: 'monsun',
    choices: [
      {
        id: 'tunggu',
        name: { ms: 'Tunggu angin', en: 'Wait for the winds' },
        desc: { ms: 'Tiada kos, tetapi eksport perlahan lebih lama.', en: 'No cost, but exports stay slow for longer.' },
        effect: { exportCapMult: 0.8, duration: 6 },
      },
      {
        id: 'gudang',
        name: { ms: 'Simpan dagangan di gudang', en: 'Hold cargo in warehouses' },
        desc: { ms: 'Bayar sewa gudang supaya dagangan tidak rosak; pedagang berpuas hati.', en: 'Pay for storage so cargo does not spoil; merchants are pleased.' },
        cost: 400,
        effect: { relations: { gujerat: 5, ming: 5 }, happiness: 1 },
      },
      {
        id: 'jurumudi',
        name: { ms: 'Upah jurumudi tempatan', en: 'Hire local pilots' },
        desc: { ms: 'Jurumudi Orang Laut membawa kapal melalui angin lemah. Ilmu pelayaran bertambah.', en: 'Orang Laut pilots guide ships through the slack winds. Seamanship knowledge grows.' },
        cost: 250,
        effect: { exportCapMult: 1.15, duration: 4, research_once: 12 },
      },
    ],
  }),
  C({
    id: 'bah_besar',
    eras: [2],
    trigger: { year: 1926 },
    base: { flood: true, happiness: -6, duration: 4 },
    name: { ms: 'Bah Besar 1926', en: 'The Great Flood of 1926' },
    desc: {
      ms: 'Pada akhir Disember 1926 hujan luar biasa (dikaitkan dengan La Niña) membanjiri Pahang, Kelantan, Terengganu, Perak dan Selangor. Penebangan hutan untuk estet dan lombong memburukkan banjir.',
      en: 'In late December 1926 extraordinary rains (linked to La Niña) flood Pahang, Kelantan, Terengganu, Perak and Selangor. Forest clearing for estates and mines made the floods worse.',
    },
    defaultChoice: 2,
    entry: 'monsun',
    choices: [
      {
        id: 'bantuan',
        name: { ms: 'Dapur bantuan & pemindahan', en: 'Relief kitchens and evacuation' },
        desc: { ms: 'Lindungi rakyat; kebahagiaan pulih dengan cepat.', en: 'Protect the people; happiness recovers quickly.' },
        cost: 2000,
        effect: { happiness: 6, duration: 8 },
      },
      {
        id: 'tebatan',
        name: { ms: 'Bina semula tebatan & parit', en: 'Rebuild bunds and drains' },
        desc: { ms: 'Pemulihan lebih pantas; pengeluaran kembali normal.', en: 'Faster recovery; production returns to normal.' },
        cost: 3500,
        effect: { productionMult: 1.08, duration: 10 },
      },
      {
        id: 'biarkan',
        name: { ms: 'Biarkan daerah pulih sendiri', en: 'Leave the districts to recover' },
        desc: { ms: 'Tiada kos, tetapi pengeluaran dan semangat rakyat merosot.', en: 'No cost, but output and morale suffer.' },
        effect: { productionMult: 0.88, happiness: -4, duration: 8 },
      },
    ],
  }),
  C({
    id: 'kemelesetan_1930',
    eras: [2],
    trigger: { event: 'kemelesetan_besar' },
    name: { ms: 'Kemelesetan: Kejatuhan Harga Komoditi', en: 'Depression: the Commodity Crash' },
    desc: {
      ms: 'Harga timah dan getah runtuh. Pada 1 Mac 1931 Tanah Melayu, Bolivia, Hindia Timur Belanda dan Nigeria memulakan Skim Kawalan Timah Antarabangsa untuk menyekat pengeluaran.',
      en: 'Tin and rubber prices collapse. On 1 March 1931 British Malaya, Bolivia, the Netherlands East Indies and Nigeria begin the International Tin Control Scheme to restrict output.',
    },
    defaultChoice: 2,
    choices: [
      {
        id: 'kuota',
        name: { ms: 'Sertai skim sekatan pengeluaran', en: 'Join the output-restriction scheme' },
        desc: { ms: 'Harga timah dan getah disokong, tetapi pengeluaran dihadkan.', en: 'Tin and rubber prices are propped up, but output is capped.' },
        effect: { priceMult: { timah: 1.4, getah: 1.25 }, productionMult: 0.88, duration: 30 },
      },
      {
        id: 'kerja_awam',
        name: { ms: 'Kerja awam & bantuan', en: 'Public works and relief' },
        desc: { ms: 'Belanja untuk jalan dan bantuan; rakyat lebih tenang.', en: 'Spend on roads and relief; the people stay calm.' },
        cost: 3000,
        effect: { happiness: 5, duration: 18 },
      },
      {
        id: 'jimat',
        name: { ms: 'Berjimat cermat', en: 'Austerity' },
        desc: { ms: 'Potong perbelanjaan untuk menambah tabung, tetapi rakyat menderita.', en: 'Cut spending to rebuild the treasury, but people suffer.' },
        effect: { money: 1500, happiness: -5, duration: 18 },
      },
    ],
  }),
  C({
    id: 'krisis_timah',
    eras: [3],
    trigger: { event: 'krisis_timah_1985' },
    name: { ms: 'Keruntuhan Pasaran Timah 1985', en: 'The 1985 Tin Market Collapse' },
    desc: {
      ms: 'Pada 24 Oktober 1985 Majlis Timah Antarabangsa gagal membayar hutangnya dan Bursa Logam London menggantung dagangan timah. Malaysia menutup hampir separuh lombongnya.',
      en: 'On 24 October 1985 the International Tin Council defaults on its debts and the London Metal Exchange suspends tin trading. Malaysia closes nearly half its mines.',
    },
    defaultChoice: 2,
    choices: [
      {
        id: 'pelbagai',
        name: { ms: 'Pelbagaikan ke perkilangan', en: 'Diversify into manufacturing' },
        desc: { ms: 'Latih semula pelombong untuk kilang elektronik.', en: 'Retrain miners for electronics plants.' },
        cost: 8000,
        effect: { priceMult: { elektronik: 1.15, barang: 1.1 }, research_once: 120, duration: 24 },
      },
      {
        id: 'selamatkan',
        name: { ms: 'Selamatkan pelombong', en: 'Bail out the miners' },
        desc: { ms: 'Subsidi menyokong harga timah tempatan untuk sementara.', en: 'Subsidies prop up local tin prices for a while.' },
        cost: 12000,
        effect: { priceMult: { timah: 1.6 }, happiness: 2, duration: 24 },
      },
      {
        id: 'pasaran',
        name: { ms: 'Biarkan pasaran menyesuaikan diri', en: 'Let the market adjust' },
        desc: { ms: 'Tiada kos; bandar timah merana.', en: 'No cost; tin towns suffer.' },
        effect: { happiness: -4, duration: 12 },
      },
    ],
  }),
  C({
    id: 'krisis_kewangan',
    eras: [4],
    trigger: { event: 'krisis_asia_1997' },
    name: { ms: 'Krisis Kewangan Asia 1997', en: 'The 1997 Asian Financial Crisis' },
    desc: {
      ms: 'Ringgit menjunam dan modal asing lari. Pada 1 September 1998 Malaysia memperkenalkan kawalan modal terpilih dan memaku ringgit pada RM3.80 se-USD (dimansuhkan 2005).',
      en: 'The ringgit plunges and foreign capital flees. On 1 September 1998 Malaysia introduces selective capital controls and pegs the ringgit at RM3.80 per US dollar (dropped in 2005).',
    },
    defaultChoice: 0,
    choices: [
      {
        id: 'kawalan',
        name: { ms: 'Kawalan modal & tambatan ringgit', en: 'Capital controls and a ringgit peg' },
        desc: { ms: 'Kestabilan pulih, tetapi rakan Barat kurang senang.', en: 'Stability returns, but Western partners are uneasy.' },
        effect: { productionMult: 1.1, happiness: 2, relations: { kesatuan_eropah: -6, amerika: -6 }, duration: 18 },
      },
      {
        id: 'imf',
        name: { ms: 'Pakej penjimatan gaya IMF', en: 'IMF-style austerity' },
        desc: { ms: 'Kadar faedah tinggi dan potongan belanja; pelabur Barat lega.', en: 'High interest rates and spending cuts; Western investors relax.' },
        effect: { money: 15000, happiness: -6, productionMult: 0.95, relations: { kesatuan_eropah: 8, amerika: 8 }, duration: 18 },
      },
      {
        id: 'rangsangan',
        name: { ms: 'Rangsangan fiskal', en: 'Fiscal stimulus' },
        desc: { ms: 'Belanja besar untuk projek awam memastikan pekerjaan.', en: 'Big public spending keeps people in work.' },
        cost: 40000,
        effect: { productionMult: 1.08, happiness: 4, duration: 18 },
      },
    ],
  }),
];

export const CRISIS_MAP: Record<string, CrisisDef> = Object.fromEntries(CRISES.map((c) => [c.id, c]));
