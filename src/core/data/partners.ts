import { Bilingual, EraId, Good } from '../types';

export interface PartnerDef {
  id: string;
  name: Bilingual;
  desc: Bilingual;
  eras: EraId[];
  color: string;
  /** goods this partner buys and the price multiplier it pays */
  buys: Partial<Record<Good, number>>;
  baseRelation: number;
  /** partner only appears after this historical event fired */
  requiresEvent?: string;
  /** research exchange yield per tick when relation is high */
  knowledge: number;
  entry?: string;
}

export const PARTNERS: PartnerDef[] = [
  // Era 1
  { id: 'ming', eras: [1], color: '#c0392b', baseRelation: 10, knowledge: 1.5, buys: { rempah: 1.3, timah: 1.2, kayu: 1.1 },
    name: { ms: 'Dinasti Ming', en: 'Ming China' },
    desc: { ms: 'Kuasa besar yang mengiktiraf Melaka. Membeli lada, timah dan kayu wangi.', en: 'The great power that recognised Melaka. Buys pepper, tin and aromatic wood.' },
    entry: 'zheng_he' },
  { id: 'gujerat', eras: [1], color: '#e67e22', baseRelation: 15, knowledge: 1, buys: { rempah: 1.35, timah: 1.1, besi: 1.1 },
    name: { ms: 'Pedagang Gujerat', en: 'Gujarati Merchants' },
    desc: { ms: 'Saudagar kain dari Cambay, rakan dagang terpenting.', en: 'Cloth merchants from Cambay, the most important trading partners.' },
    entry: 'syahbandar' },
  { id: 'jawa', eras: [1], color: '#16a085', baseRelation: 5, knowledge: 0.6, buys: { besi: 1.2, barang: 1.2, ikan: 1.1 },
    name: { ms: 'Pedagang Jawa', en: 'Javanese Traders' },
    desc: { ms: 'Membekalkan beras dan membeli barangan logam.', en: 'Supply rice and buy metal goods.' } },
  { id: 'ryukyu', eras: [1], color: '#8e44ad', baseRelation: 5, knowledge: 0.6, buys: { rempah: 1.2, kayu: 1.25 },
    name: { ms: 'Kerajaan Ryukyu', en: 'Ryukyu Kingdom' },
    desc: { ms: 'Pelaut dari Okinawa yang menghubungkan Asia Timur.', en: 'Seafarers from Okinawa linking East Asia.' } },
  { id: 'ayutthaya', eras: [1], color: '#d4ac0d', baseRelation: -10, knowledge: 0.6, buys: { barang: 1.15, timah: 1.1 },
    name: { ms: 'Ayutthaya', en: 'Ayutthaya' },
    desc: { ms: 'Kerajaan Siam di utara; hubungan sering tegang.', en: 'The Siamese kingdom to the north; relations often tense.' } },
  { id: 'arab_parsi', eras: [1], color: '#27ae60', baseRelation: 10, knowledge: 1.2, buys: { rempah: 1.4, kayu: 1.1 },
    name: { ms: 'Pedagang Arab & Parsi', en: 'Arab & Persian Merchants' },
    desc: { ms: 'Membawa ilmu, kitab dan permintaan rempah.', en: 'Bring scholarship, books and demand for spices.' } },
  { id: 'portugis', eras: [1], color: '#2c3e50', baseRelation: -30, knowledge: 1, buys: { rempah: 1.5 }, requiresEvent: 'kejatuhan_melaka',
    name: { ms: 'Portugis', en: 'Portuguese' },
    desc: { ms: 'Menawan Melaka pada 1511 dan cuba memonopoli rempah.', en: 'Captured Melaka in 1511 and sought a spice monopoly.' },
    entry: 'melaka_1511' },
  // Era 2
  { id: 'negeri_selat', eras: [2], color: '#1f4e79', baseRelation: 10, knowledge: 1.5, buys: { timah: 1.25, getah: 1.2 },
    name: { ms: 'Negeri-Negeri Selat', en: 'Straits Settlements' },
    desc: { ms: 'Pulau Pinang, Melaka dan Singapura di bawah British sejak 1826.', en: 'Penang, Melaka and Singapore under the British from 1826.' },
    entry: 'perjanjian_1824' },
  { id: 'hindia_belanda', eras: [2], color: '#e67e22', baseRelation: 0, knowledge: 0.8, buys: { barang: 1.2, padi: 1.2 },
    name: { ms: 'Hindia Timur Belanda', en: 'Dutch East Indies' },
    desc: { ms: 'Pesaing dalam timah dan getah di seberang Selat.', en: 'A rival in tin and rubber across the Straits.' } },
  { id: 'amerika', eras: [2, 3, 4], color: '#2e86c1', baseRelation: 5, knowledge: 1.5, buys: { getah: 1.35, timah: 1.2, elektronik: 1.25, digital: 1.2 },
    name: { ms: 'Amerika Syarikat', en: 'United States' },
    desc: { ms: 'Industri kereta dan elektronik memerlukan getah, timah dan cip.', en: 'Car and electronics industries need rubber, tin and chips.' } },
  { id: 'china', eras: [2, 3, 4], color: '#c0392b', baseRelation: 5, knowledge: 1, buys: { getah: 1.1, sawit: 1.2, kayu: 1.25, elektronik: 1.1, digital: 1.1 },
    name: { ms: 'China', en: 'China' },
    desc: { ms: 'Rakan dagang lama dengan permintaan bahan mentah yang besar.', en: 'An old trading partner with huge demand for raw materials.' } },
  { id: 'india', eras: [2, 4], color: '#f39c12', baseRelation: 5, knowledge: 1, buys: { barang: 1.15, sawit: 1.35, kayu: 1.1, digital: 1.1 },
    name: { ms: 'India', en: 'India' },
    desc: { ms: 'Sumber pekerja estet dan pasaran minyak sawit.', en: 'Source of estate workers and a market for palm oil.' } },
  // Era 3
  { id: 'komanwel', eras: [3], color: '#1f4e79', baseRelation: 15, knowledge: 1.5, buys: { timah: 1.15, getah: 1.15, sawit: 1.1 },
    name: { ms: 'United Kingdom & Komanwel', en: 'UK & Commonwealth' },
    desc: { ms: 'Bekas kuasa penjajah dan rakan Komanwel.', en: 'Former colonial power and Commonwealth partner.' } },
  { id: 'jepun', eras: [3, 4], color: '#e74c3c', baseRelation: 10, knowledge: 2, buys: { timah: 1.2, kayu: 1.3, elektronik: 1.1, sawit: 1.1 },
    name: { ms: 'Jepun', en: 'Japan' },
    desc: { ms: 'Pelabur utama dan model Dasar Pandang ke Timur.', en: 'A key investor and model for the Look East Policy.' },
    entry: 'pandang_timur' },
  { id: 'asean', eras: [3, 4], color: '#2874a6', baseRelation: 20, knowledge: 1, buys: { barang: 1.2, padi: 1.15, sawit: 1.1, elektronik: 1.05 },
    name: { ms: 'Negara ASEAN', en: 'ASEAN Members' },
    desc: { ms: 'Jiran serantau dalam pasaran bersama.', en: 'Regional neighbours in a common market.' },
    entry: 'asean' },
  // Era 4
  { id: 'kesatuan_eropah', eras: [4], color: '#1a5276', baseRelation: 5, knowledge: 1.8, buys: { elektronik: 1.2, sawit: 0.95, digital: 1.25 },
    name: { ms: 'Kesatuan Eropah', en: 'European Union' },
    desc: { ms: 'Pasaran besar yang menuntut standard kemampanan.', en: 'A large market demanding sustainability standards.' } },
  { id: 'korea', eras: [4], color: '#5d6d7e', baseRelation: 10, knowledge: 1.8, buys: { elektronik: 1.15, digital: 1.15, barang: 1.1 },
    name: { ms: 'Korea Selatan', en: 'South Korea' },
    desc: { ms: 'Rakan teknologi dan pembinaan.', en: 'A technology and construction partner.' } },
  { id: 'teluk', eras: [4], color: '#117a65', baseRelation: 10, knowledge: 0.8, buys: { padi: 1.3, sawit: 1.2, barang: 1.15 },
    name: { ms: 'Negara Teluk', en: 'Gulf States' },
    desc: { ms: 'Pelabur dan pengimport makanan halal.', en: 'Investors and importers of halal food.' } },
];

export const PARTNER_MAP: Record<string, PartnerDef> = Object.fromEntries(PARTNERS.map((p) => [p.id, p]));
