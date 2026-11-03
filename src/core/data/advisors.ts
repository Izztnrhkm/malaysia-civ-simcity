import { Bilingual, EraId } from '../types';
import { Effects } from './effects';

/**
 * Historical advisors (Tokoh Sejarah). Recruiting one costs money up front and
 * per turn and grants a passive buff while they serve. Advisors only serve in
 * the eras listed and retire automatically when the city moves beyond them.
 * Bios were checked against the sources listed; disputed points are marked.
 */
export interface AdvisorDef {
  id: string;
  name: string;
  title: Bilingual;
  life: string;
  eras: EraId[];
  cost: number;
  upkeep: number;
  effects: Effects;
  bonus: Bilingual;
  bio: Bilingual;
  sources: string[];
  icon: string;
}

/** Advisor slots available in each era. */
export const ADVISOR_SLOTS = [0, 1, 2, 2, 3];

const A = (d: AdvisorDef) => d;

export const ADVISORS: AdvisorDef[] = [
  A({
    id: 'tun_perak',
    name: 'Tun Perak',
    icon: '⚖️',
    title: { ms: 'Bendahara Melaka', en: 'Bendahara (chief minister) of Melaka' },
    life: 'd. 1498',
    eras: [1],
    cost: 600,
    upkeep: 2,
    effects: { tax: 0.1, happiness: 2, relationGain: 0.05 },
    bonus: { ms: '+10% cukai, +2 kebahagiaan, hubungan dagang lebih cepat', en: '+10% taxes, +2 happiness, faster trade relations' },
    bio: {
      ms: 'Bendahara Kesultanan Melaka dari 1456 hingga wafat pada 1498, berkhidmat di bawah empat sultan. Beliau memimpin pertahanan menentang Siam dan dianggap pembina kemuncak kuasa Melaka; kematiannya sering dilihat sebagai permulaan kemerosotan kesultanan.',
      en: 'Bendahara of the Melaka Sultanate from 1456 until his death in 1498, serving four sultans. He led the defence against Siam and is seen as the architect of Melaka at its height; his death is often taken as the start of the sultanate’s decline.',
    },
    sources: ['https://www.britannica.com/biography/Tun-Perak', 'https://en.wikipedia.org/wiki/Tun_Perak'],
  }),
  A({
    id: 'tun_sri_lanang',
    name: 'Tun Sri Lanang',
    icon: '📜',
    title: { ms: 'Bendahara Johor, penyusun Sulalatus Salatin', en: 'Bendahara of Johor, compiler of the Sulalatus Salatin' },
    life: '16th–17th c.',
    eras: [1, 2],
    cost: 700,
    upkeep: 2,
    effects: { culture: 0.25, research: 0.05 },
    bonus: { ms: '+25% budaya, +5% ilmu', en: '+25% culture, +5% research' },
    bio: {
      ms: 'Bendahara Johor yang dikaitkan dengan penyusunan Sulalatus Salatin (Sejarah Melayu), riwayat kesultanan Melaka. Tarikh dan peranannya dipertikaikan: ada sumber menyebut 1612, ada yang menyebut beliau menyiapkannya ketika ditawan di Aceh (1614–1615), dan sesetengah sarjana melihatnya sebagai penyunting naskhah yang lebih awal.',
      en: 'Bendahara of Johor associated with the Sulalatus Salatin (Malay Annals), the chronicle of the Melaka sultanate. Dates and role are disputed: some sources give 1612, others say he finished it in captivity in Aceh (1614–1615), and some scholars see him as the editor of earlier texts.',
    },
    sources: ['https://eresources.nlb.gov.sg/infopedia/articles/SIP_1086_2006-08-03.html'],
  }),
  A({
    id: 'long_jaafar',
    name: 'Long Jaafar',
    icon: '⛏️',
    title: { ms: 'Pembesar Larut', en: 'Malay chief of Larut' },
    life: 'd. 1857',
    eras: [2],
    cost: 2200,
    upkeep: 5,
    effects: { production: { timah: 0.3 } },
    bonus: { ms: '+30% pengeluaran bijih timah', en: '+30% tin output' },
    bio: {
      ms: 'Pembesar Melayu yang dikreditkan dengan penemuan bijih timah di Larut pada 1848 (walaupun orang Melayu telah lama mendulang timah aluvium di situ). Beliau membawa pelombong Cina dari Pulau Pinang, mencetuskan ledakan perlombongan Larut.',
      en: 'Malay chief credited with finding tin in Larut in 1848 (though Malays had long panned alluvial tin there). He brought Chinese miners from Penang, sparking the Larut mining boom.',
    },
    sources: ['https://en.wikipedia.org/wiki/Long_Jaafar'],
  }),
  A({
    id: 'yap_ah_loy',
    name: 'Yap Ah Loy',
    icon: '🏗️',
    title: { ms: 'Kapitan Cina Kuala Lumpur', en: 'Kapitan Cina of Kuala Lumpur' },
    life: '1837–1885',
    eras: [2],
    cost: 2500,
    upkeep: 6,
    effects: { growth: 0.15, construction: -0.15, production: { timah: 0.1 } },
    bonus: { ms: '+15% pertumbuhan, -15% kos pembinaan, +10% timah', en: '+15% growth, -15% construction cost, +10% tin' },
    bio: {
      ms: 'Pemimpin masyarakat Cina Kuala Lumpur yang banyak membangunkannya sebagai pusat perdagangan dan perlombongan. Beliau terkenal kerana membina semula bandar itu selepas musnah dalam Perang Klang. Meninggal dunia pada April 1885.',
      en: 'Leader of Kuala Lumpur’s Chinese community, largely responsible for developing it as a commercial and mining centre, and remembered for rebuilding the town after the Klang War. Died April 1885.',
    },
    sources: ['https://www.britannica.com/biography/Yap-Ah-Loy'],
  }),
  A({
    id: 'ridley',
    name: 'H. N. Ridley',
    icon: '🌳',
    title: { ms: 'Pengarah Taman Botani Singapura', en: 'Director, Singapore Botanic Gardens' },
    life: '1855–1956',
    eras: [2],
    cost: 2400,
    upkeep: 5,
    effects: { production: { getah: 0.35 } },
    bonus: { ms: '+35% pengeluaran getah', en: '+35% rubber output' },
    bio: {
      ms: 'Pengarah pertama Taman Botani Singapura (1888–1912), digelar "Mad Ridley" atau "Rubber Ridley" kerana gigih memujuk peladang menanam getah. Beliau memperhalusi kaedah torehan "tulang ikan" (herringbone) pada 1890-an yang menuai susu getah tanpa merosakkan pokok.',
      en: 'First director of the Singapore Botanic Gardens (1888–1912), nicknamed "Mad Ridley" or "Rubber Ridley" for urging planters to grow rubber. In the 1890s he refined the herringbone tapping method that harvests latex without killing the tree.',
    },
    sources: ['https://eresources.nlb.gov.sg/infopedia/articles/SIP_518_2004-12-28.html', 'https://www.nparks.gov.sg/sbg/about/our-history/1888-ridley-and-the-malayan-rubber-industry-from-1896'],
  }),
  A({
    id: 'zaba',
    name: 'Za’ba',
    icon: '✒️',
    title: { ms: 'Pendeta bahasa Melayu', en: 'Malay language scholar' },
    life: '1895–1973',
    eras: [2, 3],
    cost: 3000,
    upkeep: 8,
    effects: { research: 0.15, culture: 0.15 },
    bonus: { ms: '+15% ilmu, +15% budaya', en: '+15% research, +15% culture' },
    bio: {
      ms: 'Zainal Abidin bin Ahmad, penulis dan ahli bahasa yang karya tatabahasanya Pelita Bahasa Melayu menjadi rujukan utama pembelajaran bahasa Melayu. Tarikh terbitan awalnya berbeza antara sumber (1936 atau 1948).',
      en: 'Zainal Abidin bin Ahmad, writer and linguist whose grammar Pelita Bahasa Melayu became the standard reference for learning Malay. Sources differ on its first publication date (1936 or 1948).',
    },
    sources: ['https://umlibguides.um.edu.my/zaaba', 'https://en.wikipedia.org/wiki/Zainal_Abidin_Ahmad_(writer)'],
  }),
  A({
    id: 'tun_razak',
    name: 'Tun Abdul Razak',
    icon: '🌴',
    title: { ms: 'Perdana Menteri kedua, bapa pembangunan luar bandar', en: 'Second Prime Minister, father of rural development' },
    life: '1922–1976',
    eras: [3],
    cost: 9000,
    upkeep: 18,
    effects: { production: { sawit: 0.25, padi: 0.15 }, growth: 0.1 },
    bonus: { ms: '+25% sawit, +15% padi, +10% pertumbuhan', en: '+25% palm oil, +15% rice, +10% growth' },
    bio: {
      ms: 'Sebagai Timbalan Perdana Menteri dan Menteri Pembangunan Luar Bandar beliau memacu tanah rancangan FELDA (ditubuhkan 1956); sebagai Perdana Menteri (1970–1976) beliau melancarkan Dasar Ekonomi Baru.',
      en: 'As Deputy Prime Minister and Minister of Rural Development he drove the FELDA land schemes (founded 1956); as Prime Minister (1970–1976) he launched the New Economic Policy.',
    },
    sources: ['https://en.wikipedia.org/wiki/Abdul_Razak_Hussein'],
  }),
  A({
    id: 'lim_chong_eu',
    name: 'Lim Chong Eu',
    icon: '💡',
    title: { ms: 'Ketua Menteri Pulau Pinang', en: 'Chief Minister of Penang' },
    life: '1919–2010',
    eras: [3, 4],
    cost: 11000,
    upkeep: 22,
    effects: { production: { elektronik: 0.25 }, exportCap: 0.1 },
    bonus: { ms: '+25% elektronik, +10% kapasiti eksport', en: '+25% electronics, +10% export capacity' },
    bio: {
      ms: 'Ketua Menteri Pulau Pinang 1969–1990. Beliau membuka Zon Perindustrian Bebas Bayan Lepas pada 1972, yang menarik kilang semikonduktor antarabangsa dan menjadikan Pulau Pinang hab elektronik.',
      en: 'Chief Minister of Penang 1969–1990. He opened the Bayan Lepas Free Industrial Zone in 1972, drawing international semiconductor plants and turning Penang into an electronics hub.',
    },
    sources: ['https://en.wikipedia.org/wiki/Lim_Chong_Eu', 'https://en.wikipedia.org/wiki/Bayan_Lepas_Free_Industrial_Zone'],
  }),
  A({
    id: 'ungku_aziz',
    name: 'Ungku Aziz',
    icon: '🤝',
    title: { ms: 'Profesor Diraja ekonomi, pejuang koperasi', en: 'Royal Professor of economics, co-operative pioneer' },
    life: '1922–2020',
    eras: [3, 4],
    cost: 10000,
    upkeep: 20,
    effects: { happiness: 3, tax: 0.05, production: { padi: 0.15 } },
    bonus: { ms: '+3 kebahagiaan, +5% cukai, +15% padi', en: '+3 happiness, +5% taxes, +15% rice' },
    bio: {
      ms: 'Ahli ekonomi yang mengkaji kemiskinan luar bandar, Naib Canselor Universiti Malaya dan presiden ANGKASA (gerakan koperasi) sejak 1971. Cadangannya membawa kepada tabung simpanan bakal haji yang kemudian menjadi Tabung Haji (tarikh berbeza antara sumber: 1959, 1962 atau 1969).',
      en: 'Economist of rural poverty, Vice-Chancellor of the University of Malaya and president of ANGKASA (the co-operative movement) from 1971. His proposal led to the pilgrims’ savings fund that became Tabung Haji (sources differ on the date: 1959, 1962 or 1969).',
    },
    sources: ['https://www.merdekaaward.my/past-recipients/for-the-awards/2008/allahyarham-royal-professor-ungku-abdul-aziz-bin-ungku-abdul-hamid', 'https://www.thenews.coop/obituary-ungku-a-aziz-leading-light-of-the-malaysian-co-op-movement/'],
  }),
  A({
    id: 'p_ramlee',
    name: 'P. Ramlee',
    icon: '🎬',
    title: { ms: 'Seniman Agung', en: 'Film-maker, actor and composer' },
    life: '1929–1973',
    eras: [3, 4],
    cost: 8000,
    upkeep: 16,
    effects: { culture: 0.35, happiness: 3 },
    bonus: { ms: '+35% budaya, +3 kebahagiaan', en: '+35% culture, +3 happiness' },
    bio: {
      ms: 'Pelakon, pengarah, penyanyi dan komposer yang filem dan lagunya menjadi warisan budaya popular Malaysia dan Singapura.',
      en: 'Actor, director, singer and composer whose films and songs became a shared popular-culture heritage of Malaysia and Singapore.',
    },
    sources: ['https://en.wikipedia.org/wiki/P._Ramlee'],
  }),
];

export const ADVISOR_MAP: Record<string, AdvisorDef> = Object.fromEntries(ADVISORS.map((a) => [a.id, a]));
