import { Bilingual, EraId, Good, TransportKey } from '../types';

export type BuildingCategory =
  | 'trade'
  | 'production'
  | 'service'
  | 'utility'
  | 'culture'
  | 'research'
  | 'landmark';

export type Placement = 'land' | 'coast' | 'water' | 'river' | 'tin' | 'fertile' | 'forest' | 'rail';
export type ServiceKind = 'faith' | 'education' | 'health' | 'safety' | 'leisure';

export interface BuildingDef {
  id: string;
  name: Bilingual;
  desc: Bilingual;
  era: EraId;
  category: BuildingCategory;
  size: number;
  cost: number;
  upkeep: number;
  jobs?: number;
  produces?: Partial<Record<Good, number>>;
  consumes?: Partial<Record<Good, number>>;
  placement?: Placement;
  /** export hub (ports/airport): logistics flows towards these */
  exportHub?: boolean;
  /** transfer hub: links road, rail, water and MRT networks */
  transfer?: boolean;
  /** local market hub for food distribution */
  market?: boolean;
  exportCapacity?: number;
  storage?: number;
  service?: { kind: ServiceKind; radius: number; strength: number };
  research?: number;
  culture?: number;
  happiness?: number;
  power?: number;
  water?: number;
  pollution?: number;
  /** negative pollution = cleans the area */
  landmark?: boolean;
  /** protects low-lying tiles within this radius from monsoon flood losses */
  floodGuard?: number;
  /** era after which it can no longer be built (still works) */
  obsolete?: EraId;
  entry?: string;
}

const B = (d: BuildingDef) => d;

export const BUILDINGS: BuildingDef[] = [
  // ---------------- Era 1: Maritime Entrepôt ----------------
  B({ id: 'pasar', era: 1, category: 'trade', size: 2, cost: 300, upkeep: 2, jobs: 12, market: true, storage: 200,
    service: { kind: 'leisure', radius: 6, strength: 25 },
    name: { ms: 'Pasar', en: 'Market (Pasar)' },
    desc: { ms: 'Pusat jual beli tempatan. Mengagihkan makanan dan menarik peniaga.', en: 'Local trading centre. Distributes food and attracts traders.' },
    entry: 'pasar' }),
  B({ id: 'jeti', era: 1, category: 'trade', size: 1, cost: 150, upkeep: 1, jobs: 4, transfer: true, exportCapacity: 4, placement: 'water',
    name: { ms: 'Jeti', en: 'Jetty' },
    desc: { ms: 'Menghubungkan jalan darat dengan laluan sungai dan laut.', en: 'Links land routes with river and sea lanes.' } }),
  B({ id: 'pelabuhan', era: 1, category: 'trade', size: 2, cost: 1200, upkeep: 6, jobs: 30, exportHub: true, transfer: true, exportCapacity: 30, storage: 400, placement: 'coast',
    name: { ms: 'Pelabuhan Entrepôt', en: 'Entrepôt Harbour' },
    desc: { ms: 'Tempat kapal asing berlabuh, berdagang dan menunggu angin monsun.', en: 'Where foreign ships anchor, trade and wait for the monsoon winds.' },
    entry: 'entrepot' }),
  B({ id: 'gudang', era: 1, category: 'trade', size: 1, cost: 250, upkeep: 1.5, jobs: 6, exportCapacity: 8, storage: 300,
    name: { ms: 'Gudang', en: 'Warehouse (Gudang)' },
    desc: { ms: 'Menyimpan barang dagangan sementara menunggu kapal.', en: 'Stores trade goods while waiting for ships.' } }),
  B({ id: 'sawah', era: 1, category: 'production', size: 2, cost: 120, upkeep: 0.5, jobs: 10, produces: { padi: 8 }, placement: 'fertile',
    name: { ms: 'Sawah Padi', en: 'Paddy Field' },
    desc: { ms: 'Bendang di dataran aluvium yang subur.', en: 'Rice paddies on fertile alluvial plains.' },
    entry: 'padi' }),
  B({ id: 'nelayan', era: 1, category: 'production', size: 1, cost: 80, upkeep: 0.4, jobs: 6, produces: { ikan: 4 }, placement: 'water',
    name: { ms: 'Perkampungan Nelayan', en: 'Fishing Village' },
    desc: { ms: 'Nelayan menangkap ikan di sungai dan Selat Melaka.', en: 'Fishers working the river and the Straits.' } }),
  B({ id: 'pembalakan', era: 1, category: 'production', size: 1, cost: 100, upkeep: 0.6, jobs: 8, produces: { kayu: 4 }, placement: 'forest',
    name: { ms: 'Kem Pembalakan', en: 'Logging Camp' },
    desc: { ms: 'Kayu keras hutan hujan untuk kapal dan rumah.', en: 'Rainforest hardwood for ships and houses.' } }),
  B({ id: 'pendulang', era: 1, category: 'production', size: 1, cost: 160, upkeep: 0.8, jobs: 8, produces: { timah: 2 }, placement: 'tin', pollution: 10,
    name: { ms: 'Pendulang Bijih', en: 'Tin Panning (Dulang)' },
    desc: { ms: 'Mendulang bijih timah aluvium dengan dulang kayu.', en: 'Panning alluvial tin with wooden pans (dulang).' },
    entry: 'timah' }),
  B({ id: 'kebun_lada', era: 1, category: 'production', size: 2, cost: 220, upkeep: 0.8, jobs: 10, produces: { rempah: 3 },
    name: { ms: 'Kebun Lada', en: 'Pepper Garden' },
    desc: { ms: 'Lada hitam, komoditi utama perdagangan rempah.', en: 'Black pepper, a staple of the spice trade.' } }),
  B({ id: 'relau_besi', era: 1, category: 'production', size: 1, cost: 400, upkeep: 2, jobs: 10, produces: { besi: 3 }, consumes: { kayu: 1 }, pollution: 35,
    name: { ms: 'Relau Besi', en: 'Iron Smelter' },
    desc: { ms: 'Relau peleburan besi seperti yang ditemui di Sungai Batu.', en: 'An iron smelting furnace like those found at Sungai Batu.' },
    entry: 'sungai_batu' }),
  B({ id: 'limbungan', era: 1, category: 'production', size: 2, cost: 900, upkeep: 4, jobs: 20, produces: { barang: 3 }, consumes: { kayu: 2 }, exportCapacity: 10, placement: 'coast',
    name: { ms: 'Limbungan Jong', en: 'Jong Shipyard' },
    desc: { ms: 'Membina kapal jong dan perahu dagang.', en: 'Builds jong ships and trading boats.' } }),
  B({ id: 'surau', era: 1, category: 'service', size: 1, cost: 150, upkeep: 0.8, culture: 0.5, service: { kind: 'faith', radius: 5, strength: 40 },
    name: { ms: 'Surau', en: 'Surau (Prayer House)' },
    desc: { ms: 'Rumah ibadat kecil kampung.', en: 'A small village prayer house.' } }),
  B({ id: 'masjid', era: 1, category: 'culture', size: 2, cost: 800, upkeep: 3, jobs: 4, culture: 2, happiness: 1, service: { kind: 'faith', radius: 10, strength: 70 },
    name: { ms: 'Masjid Bumbung Bertingkat', en: 'Tiered-Roof Mosque' },
    desc: { ms: 'Masjid berbumbung tiga tingkat gaya Nusantara.', en: 'A three-tiered-roof mosque in the Nusantara style.' },
    entry: 'islam_melaka' }),
  B({ id: 'madrasah', era: 1, category: 'research', size: 1, cost: 500, upkeep: 2.5, jobs: 4, research: 2, service: { kind: 'education', radius: 6, strength: 45 },
    name: { ms: 'Madrasah', en: 'Madrasah' },
    desc: { ms: 'Pusat ilmu: bahasa, falak dan undang-undang.', en: 'A centre of learning: language, astronomy and law.' } }),
  B({ id: 'balai', era: 1, category: 'service', size: 1, cost: 200, upkeep: 1.5, jobs: 3, service: { kind: 'safety', radius: 6, strength: 45 },
    name: { ms: 'Balai Penghulu', en: 'Headman’s Hall' },
    desc: { ms: 'Ketua kampung menjaga keamanan dan adat.', en: 'The village headman keeps order and custom.' } }),
  B({ id: 'menara_tinjau', era: 1, category: 'service', size: 1, cost: 180, upkeep: 1, jobs: 3, service: { kind: 'safety', radius: 7, strength: 40 },
    name: { ms: 'Menara Tinjau', en: 'Watchtower' },
    desc: { ms: 'Pengawal kuala memerhati lanun dan kapal yang tiba. Mengurangkan serangan lanun.', en: 'Guards watch the river mouth for pirates and arriving ships. Reduces pirate raids.' } }),
  B({ id: 'taman', era: 1, category: 'service', size: 1, cost: 60, upkeep: 0.2, service: { kind: 'leisure', radius: 4, strength: 30 },
    name: { ms: 'Padang / Taman', en: 'Green / Park' },
    desc: { ms: 'Ruang lapang untuk rekreasi dan sukan rakyat.', en: 'Open space for recreation and folk games.' } }),
  B({ id: 'candi', era: 1, category: 'culture', size: 2, cost: 600, upkeep: 1.5, culture: 3, research: 0.5,
    name: { ms: 'Candi Warisan', en: 'Heritage Candi' },
    desc: { ms: 'Struktur bata seperti candi Lembah Bujang, warisan Kedah Tua.', en: 'Brick shrine like the Bujang Valley candi, heritage of Old Kedah.' },
    entry: 'lembah_bujang' }),
  B({ id: 'syahbandar', era: 1, category: 'trade', size: 1, cost: 700, upkeep: 3, jobs: 6, exportCapacity: 15, culture: 0.5,
    name: { ms: 'Pejabat Syahbandar', en: 'Harbour Master’s Office' },
    desc: { ms: 'Syahbandar mengurus pedagang asing dan cukai pelabuhan.', en: 'The shahbandar manages foreign traders and port duties.' },
    entry: 'syahbandar' }),
  B({ id: 'istana', era: 1, category: 'landmark', size: 3, cost: 4000, upkeep: 8, jobs: 20, culture: 6, happiness: 5, landmark: true,
    name: { ms: 'Istana Kesultanan', en: 'Sultanate Palace' },
    desc: { ms: 'Istana kayu berukir, pusat pemerintahan kesultanan. Mercu tanda Era 1.', en: 'A carved timber palace, seat of the sultanate. Era 1 landmark.' },
    entry: 'kesultanan_melaka' }),

  // ---------------- Era 2: Tin, Rubber & Rail ----------------
  B({ id: 'lombong', era: 2, category: 'production', size: 2, cost: 900, upkeep: 4, jobs: 30, produces: { timah: 6 }, placement: 'tin', pollution: 60,
    name: { ms: 'Lombong Bijih Timah', en: 'Open-cast Tin Mine' },
    desc: { ms: 'Lombong dedah yang dikendalikan kongsi pelombong.', en: 'An open-cast mine run by mining kongsi.' },
    entry: 'timah' }),
  B({ id: 'kapal_korek', era: 2, category: 'production', size: 3, cost: 4000, upkeep: 14, jobs: 25, produces: { timah: 16 }, placement: 'tin', pollution: 75,
    name: { ms: 'Kapal Korek', en: 'Tin Dredge' },
    desc: { ms: 'Kapal korek baldi raksasa yang mengorek bijih dari kolam lombong.', en: 'A giant bucket dredge scooping ore from a mining pond.' },
    entry: 'kapal_korek' }),
  B({ id: 'estet_getah', era: 2, category: 'production', size: 3, cost: 1500, upkeep: 4, jobs: 40, produces: { getah: 12 },
    name: { ms: 'Estet Getah', en: 'Rubber Estate' },
    desc: { ms: 'Barisan pokok getah Hevea yang ditoreh setiap pagi.', en: 'Rows of Hevea trees tapped every dawn.' },
    entry: 'getah' }),
  B({ id: 'stesen', era: 2, category: 'trade', size: 2, cost: 1600, upkeep: 5, jobs: 15, transfer: true, exportCapacity: 25, storage: 300, placement: 'rail',
    name: { ms: 'Stesen Kereta Api', en: 'Railway Station' },
    desc: { ms: 'Menghubungkan landasan kereta api dengan jalan raya. Mesti bersebelahan landasan.', en: 'Links the railway with roads. Must touch a rail line.' },
    entry: 'kereta_api' }),
  B({ id: 'pelabuhan_dagang', era: 2, category: 'trade', size: 3, cost: 5000, upkeep: 15, jobs: 60, exportHub: true, transfer: true, exportCapacity: 120, storage: 1200, placement: 'coast',
    name: { ms: 'Pelabuhan Kapal Wap', en: 'Steamship Port' },
    desc: { ms: 'Dermaga berbumbung zink dan kren untuk kapal wap.', en: 'Zinc-roofed wharves and cranes for steamships.' } }),
  B({ id: 'sekolah', era: 2, category: 'research', size: 1, cost: 700, upkeep: 3.5, jobs: 8, research: 3, service: { kind: 'education', radius: 8, strength: 55 },
    name: { ms: 'Sekolah', en: 'School' },
    desc: { ms: 'Sekolah vernakular dan Inggeris.', en: 'Vernacular and English-medium schools.' } }),
  B({ id: 'hospital', era: 2, category: 'service', size: 2, cost: 1500, upkeep: 7, jobs: 25, service: { kind: 'health', radius: 11, strength: 65 },
    name: { ms: 'Hospital', en: 'Hospital' },
    desc: { ms: 'Rawatan perubatan moden dan kawalan wabak.', en: 'Modern medical care and epidemic control.' } }),
  B({ id: 'balai_polis', era: 2, category: 'service', size: 1, cost: 500, upkeep: 3, jobs: 8, service: { kind: 'safety', radius: 9, strength: 60 },
    name: { ms: 'Balai Polis', en: 'Police Station' },
    desc: { ms: 'Menjaga keamanan bandar perlombongan yang pesat.', en: 'Keeps order in booming mining towns.' } }),
  B({ id: 'pejabat_pos', era: 2, category: 'research', size: 1, cost: 600, upkeep: 2.5, jobs: 6, research: 1, happiness: 1,
    name: { ms: 'Pejabat Pos & Telegraf', en: 'Post & Telegraph Office' },
    desc: { ms: 'Surat dan kawat telegraf menghubungkan bandar dengan dunia.', en: 'Letters and telegrams connect the town to the world.' } }),
  B({ id: 'bangunan_moorish', era: 2, category: 'landmark', size: 3, cost: 9000, upkeep: 12, jobs: 30, culture: 8, exportCapacity: 30, happiness: 4, landmark: true,
    name: { ms: 'Bangunan Stesen Besar Moorish', en: 'Grand Moorish Station' },
    desc: { ms: 'Kubah dan gerbang gaya Indo-Saracenic. Mercu tanda Era 2.', en: 'Domes and arches in the Indo-Saracenic style. Era 2 landmark.' },
    entry: 'seni_bina_moorish' }),

  // ---------------- Era 3: Post-Merdeka Industrialisation ----------------
  B({ id: 'janakuasa', era: 3, category: 'utility', size: 2, cost: 6000, upkeep: 18, jobs: 20, power: 600, pollution: 90,
    name: { ms: 'Stesen Janakuasa', en: 'Power Station' },
    desc: { ms: 'Janakuasa haba yang membekalkan grid nasional.', en: 'A thermal power station feeding the national grid.' } }),
  B({ id: 'empangan', era: 3, category: 'utility', size: 2, cost: 12000, upkeep: 12, jobs: 10, power: 900, water: 200, placement: 'river',
    name: { ms: 'Empangan Hidroelektrik', en: 'Hydroelectric Dam' },
    desc: { ms: 'Tenaga bersih dari sungai. Mesti di tebing sungai.', en: 'Clean power from the river. Must be on a riverbank.' } }),
  B({ id: 'loji_air', era: 3, category: 'utility', size: 2, cost: 4000, upkeep: 9, jobs: 12, water: 700,
    name: { ms: 'Loji Rawatan Air', en: 'Water Treatment Plant' },
    desc: { ms: 'Air paip bersih untuk rumah dan kilang.', en: 'Clean piped water for homes and factories.' } }),
  B({ id: 'ladang_sawit', era: 3, category: 'production', size: 3, cost: 3000, upkeep: 5, jobs: 35, produces: { sawit: 14 },
    name: { ms: 'Ladang Sawit Tanah Rancangan', en: 'Land Scheme Oil Palm Estate' },
    desc: { ms: 'Peneroka tanah rancangan menanam kelapa sawit.', en: 'Land scheme settlers plant oil palm.' },
    entry: 'felda' }),
  B({ id: 'ftz', era: 3, category: 'production', size: 3, cost: 15000, upkeep: 18, jobs: 220, produces: { elektronik: 12 }, power: -150, water: -80, pollution: 25,
    name: { ms: 'Zon Perdagangan Bebas', en: 'Free Trade Zone' },
    desc: { ms: 'Kilang pemasangan semikonduktor untuk eksport.', en: 'Semiconductor assembly plants for export.' },
    entry: 'bayan_lepas' }),
  B({ id: 'kilang_kereta', era: 3, category: 'production', size: 3, cost: 20000, upkeep: 22, jobs: 250, produces: { barang: 18 }, consumes: { besi: 4, getah: 2 }, power: -200, water: -60, pollution: 50,
    name: { ms: 'Kilang Kereta Nasional', en: 'National Car Plant' },
    desc: { ms: 'Kilang automotif yang menghasilkan kereta buatan tempatan.', en: 'An automotive plant building locally made cars.' },
    entry: 'kereta_nasional' }),
  B({ id: 'pelabuhan_kontena', era: 3, category: 'trade', size: 3, cost: 18000, upkeep: 30, jobs: 120, exportHub: true, transfer: true, exportCapacity: 420, storage: 4000, placement: 'coast', power: -60,
    name: { ms: 'Pelabuhan Kontena', en: 'Container Port' },
    desc: { ms: 'Kren gantri raksasa memunggah kontena.', en: 'Giant gantry cranes handling containers.' } }),
  B({ id: 'universiti', era: 3, category: 'research', size: 3, cost: 12000, upkeep: 28, jobs: 80, research: 15, culture: 2, service: { kind: 'education', radius: 15, strength: 75 }, power: -40,
    name: { ms: 'Universiti', en: 'University' },
    desc: { ms: 'Melatih jurutera, doktor dan saintis negara.', en: 'Trains the nation’s engineers, doctors and scientists.' } }),
  B({ id: 'klinik_desa', era: 3, category: 'service', size: 1, cost: 900, upkeep: 3, jobs: 6, service: { kind: 'health', radius: 7, strength: 50 },
    name: { ms: 'Klinik Desa', en: 'Rural Clinic' },
    desc: { ms: 'Rawatan kesihatan asas dekat dengan rakyat.', en: 'Basic healthcare close to the people.' } }),
  B({ id: 'tebatan_banjir', era: 3, category: 'utility', size: 2, cost: 7000, upkeep: 8, jobs: 8, floodGuard: 12, placement: 'river',
    name: { ms: 'Tebatan Banjir', en: 'Flood Mitigation Barrage' },
    desc: { ms: 'Pintu air dan benteng sungai melindungi kawasan rendah daripada banjir monsun. Mesti di tebing sungai.', en: 'Sluice gates and river walls protect low ground from monsoon floods. Must be on a riverbank.' },
    entry: 'monsun' }),
  B({ id: 'parlimen', era: 3, category: 'culture', size: 3, cost: 18000, upkeep: 16, jobs: 60, culture: 6, research: 2, happiness: 4, service: { kind: 'safety', radius: 12, strength: 50 },
    name: { ms: 'Bangunan Parlimen', en: 'Parliament House' },
    desc: { ms: 'Menara moden dan dewan berbumbung runcing, lambang demokrasi berparlimen.', en: 'A modernist tower and pointed-roof hall, symbol of parliamentary democracy.' },
    entry: 'malaysia_1963' }),
  B({ id: 'stadium', era: 3, category: 'landmark', size: 3, cost: 25000, upkeep: 20, jobs: 30, culture: 15, happiness: 8, landmark: true, service: { kind: 'leisure', radius: 14, strength: 60 },
    name: { ms: 'Stadium Kemerdekaan', en: 'Independence Stadium' },
    desc: { ms: 'Stadium terbuka tempat laungan "Merdeka!". Mercu tanda Era 3.', en: 'Open-air stadium where "Merdeka!" was proclaimed. Era 3 landmark.' },
    entry: 'merdeka' }),

  // ---------------- Era 4: Digital Smart City ----------------
  B({ id: 'pusat_data', era: 4, category: 'production', size: 2, cost: 30000, upkeep: 52.5, jobs: 40, produces: { digital: 10 }, power: -400, water: -120,
    name: { ms: 'Pusat Data', en: 'Data Centre' },
    desc: { ms: 'Pelayan awan yang menjana perkhidmatan digital.', en: 'Cloud servers producing digital services.' } }),
  B({ id: 'hab_inovasi', era: 4, category: 'research', size: 3, cost: 40000, upkeep: 60, jobs: 300, research: 25, produces: { digital: 6 }, power: -250, water: -60,
    name: { ms: 'Hab Inovasi', en: 'Innovation Hub' },
    desc: { ms: 'Kampus teknologi untuk syarikat pemula dan R&D.', en: 'A tech campus for start-ups and R&D.' },
    entry: 'msc' }),
  B({ id: 'ladang_solar', era: 4, category: 'utility', size: 3, cost: 20000, upkeep: 12, jobs: 6, power: 800,
    name: { ms: 'Ladang Solar', en: 'Solar Farm' },
    desc: { ms: 'Panel fotovolta menukar cahaya khatulistiwa kepada tenaga.', en: 'PV panels turning equatorial sunshine into power.' } }),
  B({ id: 'stesen_mrt', era: 4, category: 'trade', size: 1, cost: 8000, upkeep: 12, jobs: 10, transfer: true, happiness: 1, service: { kind: 'leisure', radius: 6, strength: 30 },
    name: { ms: 'Stesen MRT', en: 'MRT Station' },
    desc: { ms: 'Menghubungkan laluan MRT dengan jalan dan kereta api.', en: 'Links MRT lines with roads and rail.' },
    entry: 'mrt' }),
  B({ id: 'lapangan_terbang', era: 4, category: 'trade', size: 3, cost: 60000, upkeep: 75, jobs: 200, exportHub: true, transfer: true, exportCapacity: 500, power: -150, pollution: 40,
    name: { ms: 'Lapangan Terbang Antarabangsa', en: 'International Airport' },
    desc: { ms: 'Hab kargo udara untuk barangan bernilai tinggi.', en: 'An air-cargo hub for high-value goods.' },
    entry: 'klia' }),
  B({ id: 'menara_telekom', era: 4, category: 'research', size: 1, cost: 15000, upkeep: 15, jobs: 10, research: 5, produces: { digital: 3 }, happiness: 2, power: -60,
    name: { ms: 'Menara Telekomunikasi', en: 'Telecom Tower' },
    desc: { ms: 'Menara jalur lebar dan rangkaian mudah alih.', en: 'A broadband and mobile network tower.' } }),
  B({ id: 'kitar_semula', era: 4, category: 'utility', size: 2, cost: 10000, upkeep: 18, jobs: 30, pollution: -80, power: -50,
    name: { ms: 'Pusat Kitar Semula', en: 'Recycling Centre' },
    desc: { ms: 'Mengurangkan pencemaran di kawasan sekitar.', en: 'Reduces pollution in the surrounding area.' } }),
  B({ id: 'menara_118', era: 4, category: 'landmark', size: 3, cost: 300000, upkeep: 100, jobs: 600, culture: 20, research: 8, happiness: 6, landmark: true, power: -350,
    name: { ms: 'Menara Mega 118', en: 'Megatower 118' },
    desc: { ms: 'Pencakar langit bersegi berlian dengan menara puncak, bermotif corak songket.', en: 'A faceted, diamond-patterned skyscraper with a spire, inspired by songket weaving.' } }),
  B({ id: 'menara_berkembar', era: 4, category: 'landmark', size: 3, cost: 400000, upkeep: 120, jobs: 400, culture: 30, research: 10, happiness: 10, landmark: true, power: -300,
    name: { ms: 'Menara Berkembar', en: 'Twin Towers' },
    desc: { ms: 'Pencakar langit berkembar bermotif geometri Islam. Mercu tanda kemenangan.', en: 'Twin skyscrapers with Islamic geometric motifs. Victory landmark.' },
    entry: 'menara_berkembar' }),
];

export const BUILDING_MAP: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export interface TransportDef {
  key: TransportKey;
  id: number;
  name: Bilingual;
  cost: number;
  upkeep: number;
  /** traversal cost per tile for logistics */
  step: number;
  era: EraId;
  bridge: boolean;
}

export const TRANSPORTS: TransportDef[] = [
  { key: 'road', id: 1, name: { ms: 'Jalan', en: 'Road' }, cost: 8, upkeep: 0.03, step: 2, era: 1, bridge: true },
  { key: 'rail', id: 2, name: { ms: 'Landasan Kereta Api', en: 'Railway' }, cost: 40, upkeep: 0.12, step: 0.6, era: 2, bridge: true },
  { key: 'highway', id: 3, name: { ms: 'Lebuhraya', en: 'Expressway' }, cost: 90, upkeep: 0.25, step: 0.8, era: 3, bridge: true },
  { key: 'mrt', id: 4, name: { ms: 'Landasan MRT', en: 'MRT Line' }, cost: 160, upkeep: 0.6, step: 0.4, era: 4, bridge: true },
];
export const TRANSPORT_BY_ID: Record<number, TransportDef> = Object.fromEntries(TRANSPORTS.map((t) => [t.id, t]));
export const TRANSPORT_BY_KEY: Record<TransportKey, TransportDef> = Object.fromEntries(TRANSPORTS.map((t) => [t.key, t])) as Record<TransportKey, TransportDef>;

/** Per-zone, per-density capacity: residents (R) or jobs (C, I). Index = density level. */
export const ZONE_CAPACITY = {
  R: [0, 6, 18, 50, 120],
  C: [0, 3, 8, 22, 55],
  I: [0, 4, 12, 30, 70],
} as const;

export const ZONE_COST = 5;
export const CLEAR_JUNGLE_COST = 15;

export const ZONE_NAMES: Record<'R' | 'C' | 'I', { era: Bilingual[] }> = {
  R: {
    era: [
      { ms: 'Kampung', en: 'Kampung' },
      { ms: 'Kampung & Rumah Kedai', en: 'Kampung & Shophouses' },
      { ms: 'Taman Perumahan', en: 'Housing Taman' },
      { ms: 'Kondominium & Taman', en: 'Condominiums & Taman' },
    ],
  },
  C: {
    era: [
      { ms: 'Bazar', en: 'Bazaar' },
      { ms: 'Rumah Kedai', en: 'Shophouses' },
      { ms: 'Pusat Beli-belah', en: 'Shopping Centres' },
      { ms: 'Menara Pejabat', en: 'Office Towers' },
    ],
  },
  I: {
    era: [
      { ms: 'Bengkel Tukang', en: 'Craft Workshops' },
      { ms: 'Bengkel & Kilang Kecil', en: 'Workshops & Small Mills' },
      { ms: 'Kilang', en: 'Factories' },
      { ms: 'Industri Teknologi Tinggi', en: 'High-tech Industry' },
    ],
  },
};
