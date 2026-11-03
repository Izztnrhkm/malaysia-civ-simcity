import { Bilingual, EraId, Good } from '../types';

export interface EventEffect {
  duration?: number;
  priceMult?: Partial<Record<Good, number>>;
  productionMult?: number;
  happiness?: number;
  research?: number;
  /** one-off grant, multiplied by the era's wealth scale */
  money?: number;
  research_once?: number;
  relations?: Record<string, number>;
  grantCivic?: string;
  flood?: boolean;
  exportCapMult?: number;
}

export interface EventDef {
  id: string;
  kind: 'historical' | 'random';
  eras: EraId[];
  /** historical events fire once when this year is reached */
  year?: number;
  /** fire immediately when this era begins */
  onEraStart?: boolean;
  /** random events: months (0-11) when possible and chance per tick */
  months?: number[];
  chance?: number;
  /** optional gating: building, tech or civic that must exist */
  requires?: { building?: string; research?: string };
  name: Bilingual;
  desc: Bilingual;
  effect: EventEffect;
  entry?: string;
}

const E = (d: EventDef) => d;

export const EVENTS: EventDef[] = [
  // ---- Era 1 ----
  E({ id: 'zheng_he', kind: 'historical', eras: [1], year: 1409,
    name: { ms: 'Armada Laksamana Cheng Ho', en: 'Admiral Zheng He’s Fleet' },
    desc: { ms: 'Armada harta Ming singgah di pelabuhan anda. Hubungan dengan China bertambah baik.', en: 'The Ming treasure fleet calls at your port. Relations with China improve.' },
    effect: { relations: { ming: 25 }, money: 600, research_once: 15 }, entry: 'zheng_he' }),
  E({ id: 'kejatuhan_melaka', kind: 'historical', eras: [1], year: 1511,
    name: { ms: 'Kejatuhan Melaka (1511)', en: 'The Fall of Melaka (1511)' },
    desc: { ms: 'Portugis menawan Melaka. Pedagang Muslim beralih ke pelabuhan lain di rantau ini, termasuk pelabuhan anda.', en: 'The Portuguese capture Melaka. Muslim traders shift to other ports in the region, including yours.' },
    effect: { relations: { gujerat: 10, arab_parsi: 10 }, exportCapMult: 1.25, duration: 40 }, entry: 'melaka_1511' }),
  E({ id: 'lanun', kind: 'random', eras: [1, 2], chance: 0.006,
    name: { ms: 'Serangan Lanun', en: 'Pirate Raids' },
    desc: { ms: 'Lanun mengganggu laluan kapal. Eksport berkurang buat sementara.', en: 'Pirates disrupt shipping lanes. Exports fall for a while.' },
    effect: { exportCapMult: 0.7, duration: 6 } }),
  // ---- Era 2 ----
  E({ id: 'perjanjian_1824', kind: 'historical', eras: [2], onEraStart: true,
    name: { ms: 'Perjanjian Inggeris-Belanda 1824', en: 'Anglo-Dutch Treaty of 1824' },
    desc: { ms: 'Selat Melaka dibahagi antara British dan Belanda. Negeri-Negeri Selat dibentuk pada 1826.', en: 'The Straits are divided between the British and the Dutch. The Straits Settlements follow in 1826.' },
    effect: {}, entry: 'perjanjian_1824' }),
  E({ id: 'larut', kind: 'historical', eras: [2], year: 1848,
    name: { ms: 'Bijih Timah di Larut', en: 'Tin Found in Larut' },
    desc: { ms: 'Bijih timah ditemui di Larut (dikaitkan dengan Long Jaafar). Harga timah melonjak dan pelombong berpusu-pusu tiba.', en: 'Tin is found in Larut (credited to Long Jaafar). Tin prices jump and miners flock in.' },
    effect: { priceMult: { timah: 1.3 }, duration: 40 }, entry: 'larut' }),
  E({ id: 'pangkor', kind: 'historical', eras: [2], year: 1874,
    name: { ms: 'Perjanjian Pangkor', en: 'Pangkor Treaty' },
    desc: { ms: 'Perjanjian 1874 memperkenalkan Sistem Residen di Perak.', en: 'The 1874 treaty introduces the Residential System in Perak.' },
    effect: {}, entry: 'pangkor' }),
  E({ id: 'kereta_api_1885', kind: 'historical', eras: [2], year: 1885,
    name: { ms: 'Kereta Api Pertama', en: 'The First Railway' },
    desc: { ms: 'Landasan Taiping–Port Weld dibuka pada 1885 untuk mengangkut bijih timah ke laut.', en: 'The Taiping–Port Weld line opens in 1885 to carry tin to the sea.' },
    effect: { research_once: 40 }, entry: 'kereta_api' }),
  E({ id: 'ledakan_getah', kind: 'historical', eras: [2], year: 1905,
    name: { ms: 'Ledakan Getah', en: 'The Rubber Boom' },
    desc: { ms: 'Industri kereta di Amerika memerlukan tayar. Harga getah melambung.', en: 'The American car industry needs tyres. Rubber prices soar.' },
    effect: { priceMult: { getah: 1.8 }, duration: 36, relations: { amerika: 10 } }, entry: 'getah' }),
  E({ id: 'kemelesetan_besar', kind: 'historical', eras: [2], year: 1930,
    name: { ms: 'Kemelesetan Besar', en: 'The Great Depression' },
    desc: { ms: 'Permintaan dunia runtuh. Harga timah dan getah jatuh menjunam.', en: 'World demand collapses. Tin and rubber prices plunge.' },
    effect: { priceMult: { timah: 0.5, getah: 0.45 }, happiness: -5, duration: 36 } }),
  E({ id: 'wabak', kind: 'random', eras: [1, 2], chance: 0.004,
    name: { ms: 'Wabak Penyakit', en: 'Epidemic' },
    desc: { ms: 'Wabak merebak. Hospital dan klinik mengurangkan kesannya.', en: 'An epidemic spreads. Hospitals and clinics reduce its impact.' },
    effect: { happiness: -6, productionMult: 0.9, duration: 6 } }),
  // ---- Era 3 ----
  E({ id: 'merdeka_1957', kind: 'historical', eras: [3], onEraStart: true,
    name: { ms: 'Merdeka!', en: 'Merdeka!' },
    desc: { ms: 'Pada 31 Ogos 1957, Persekutuan Tanah Melayu mencapai kemerdekaan.', en: 'On 31 August 1957 the Federation of Malaya gains independence.' },
    effect: { happiness: 10, duration: 24, grantCivic: 'kemerdekaan' }, entry: 'merdeka' }),
  E({ id: 'malaysia_1963', kind: 'historical', eras: [3], year: 1963,
    name: { ms: 'Pembentukan Malaysia', en: 'Formation of Malaysia' },
    desc: { ms: 'Malaysia dibentuk pada 16 September 1963.', en: 'Malaysia is formed on 16 September 1963.' },
    effect: { happiness: 4, duration: 12 }, entry: 'malaysia_1963' }),
  E({ id: 'asean_1967', kind: 'historical', eras: [3], year: 1967,
    name: { ms: 'Penubuhan ASEAN', en: 'ASEAN Founded' },
    desc: { ms: 'Deklarasi Bangkok 1967 menubuhkan ASEAN.', en: 'The 1967 Bangkok Declaration founds ASEAN.' },
    effect: { relations: { asean: 15 } }, entry: 'asean' }),
  E({ id: 'fiz_1972', kind: 'historical', eras: [3], year: 1972,
    name: { ms: 'Zon Perindustrian Bebas Pertama', en: 'First Free Industrial Zone' },
    desc: { ms: 'Zon di Bayan Lepas dibuka pada 1972 dan menarik kilang semikonduktor antarabangsa.', en: 'The Bayan Lepas zone opens in 1972 and draws international chip plants.' },
    effect: { money: 3000, relations: { amerika: 10 } }, requires: { research: 'zon_perdagangan_bebas' }, entry: 'bayan_lepas' }),
  E({ id: 'pandang_timur_1982', kind: 'historical', eras: [3], year: 1982,
    name: { ms: 'Pandang ke Timur', en: 'Look East' },
    desc: { ms: 'Dasar Pandang ke Timur diumumkan pada 8 Februari 1982.', en: 'The Look East Policy is announced on 8 February 1982.' },
    effect: { relations: { jepun: 15 } }, entry: 'pandang_timur' }),
  E({ id: 'krisis_timah_1985', kind: 'historical', eras: [3], year: 1985,
    name: { ms: 'Krisis Timah 1985', en: 'The 1985 Tin Crisis' },
    desc: { ms: 'Pasaran timah antarabangsa runtuh pada Oktober 1985. Harga timah jatuh dan ekonomi meleset.', en: 'The international tin market collapses in October 1985. Tin prices crash and the economy slumps.' },
    effect: { priceMult: { timah: 0.45, getah: 0.8, sawit: 0.8 }, duration: 30 } }),
  E({ id: 'kereta_nasional_1985', kind: 'historical', eras: [3], year: 1985,
    name: { ms: 'Kereta Nasional Pertama', en: 'The First National Car' },
    desc: { ms: 'Kereta nasional pertama keluar dari barisan pengeluaran pada Julai 1985.', en: 'The first national car rolls off the line in July 1985.' },
    effect: { happiness: 5, duration: 12 }, requires: { building: 'kilang_kereta' }, entry: 'kereta_nasional' }),
  E({ id: 'jerebu', kind: 'random', eras: [3, 4], months: [5, 6, 7, 8, 9], chance: 0.02,
    name: { ms: 'Jerebu', en: 'Haze' },
    desc: { ms: 'Jerebu merentas sempadan menyelubungi bandar.', en: 'Transboundary haze blankets the city.' },
    effect: { happiness: -4, duration: 3 } }),
  // ---- Era 4 ----
  E({ id: 'msc_1996', kind: 'historical', eras: [4], onEraStart: true,
    name: { ms: 'Koridor Raya Multimedia', en: 'Multimedia Super Corridor' },
    desc: { ms: 'MSC dilancarkan pada 1996 untuk menarik syarikat teknologi.', en: 'The MSC is launched in 1996 to attract technology companies.' },
    effect: { research_once: 300 }, entry: 'msc' }),
  E({ id: 'krisis_asia_1997', kind: 'historical', eras: [4], year: 1997,
    name: { ms: 'Krisis Kewangan Asia', en: 'Asian Financial Crisis' },
    desc: { ms: 'Ringgit jatuh nilai. Pada September 1998 kawalan modal terpilih diperkenalkan dan ringgit dipaku pada RM3.80/USD.', en: 'The ringgit plunges. In September 1998 selective capital controls are introduced and the ringgit is pegged at RM3.80/USD.' },
    effect: { productionMult: 0.85, happiness: -6, duration: 18 } }),
  E({ id: 'klia_1998', kind: 'historical', eras: [4], year: 1998,
    name: { ms: 'Lapangan Terbang Antarabangsa Baharu', en: 'New International Airport' },
    desc: { ms: 'Lapangan terbang antarabangsa utama dibuka pada Jun 1998.', en: 'The main international airport opens in June 1998.' },
    effect: { relations: { jepun: 5, kesatuan_eropah: 5 } }, entry: 'klia' }),
  E({ id: 'krisis_global_2008', kind: 'historical', eras: [4], year: 2008,
    name: { ms: 'Krisis Kewangan Global', en: 'Global Financial Crisis' },
    desc: { ms: 'Permintaan eksport dunia merosot.', en: 'Global export demand slumps.' },
    effect: { priceMult: { elektronik: 0.75, sawit: 0.8, barang: 0.85 }, duration: 18 } }),
  E({ id: 'pandemik_2020', kind: 'historical', eras: [4], year: 2020,
    name: { ms: 'Pandemik', en: 'Pandemic' },
    desc: { ms: 'Perintah kawalan pergerakan. Perniagaan terjejas tetapi permintaan digital melonjak.', en: 'Movement control orders. Businesses suffer but digital demand surges.' },
    effect: { productionMult: 0.8, happiness: -8, priceMult: { digital: 1.5 }, duration: 18 } }),
  // ---- Any era ----
  E({ id: 'banjir_monsun', kind: 'random', eras: [1, 2, 3, 4], months: [10, 11, 0], chance: 0.05,
    name: { ms: 'Banjir Monsun', en: 'Monsoon Floods' },
    desc: { ms: 'Monsun timur laut membawa banjir. Kawasan rendah tepi sungai terjejas.', en: 'The north-east monsoon brings floods. Low riverside areas are hit.' },
    effect: { flood: true, happiness: -3, duration: 3 }, entry: 'monsun' }),
  E({ id: 'harga_naik', kind: 'random', eras: [2, 3, 4], chance: 0.008,
    name: { ms: 'Lonjakan Harga Komoditi', en: 'Commodity Price Spike' },
    desc: { ms: 'Permintaan dunia meningkat; harga komoditi naik.', en: 'World demand rises; commodity prices climb.' },
    effect: { priceMult: { timah: 1.3, getah: 1.3, sawit: 1.3 }, duration: 12 } }),
];

export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
