import { Bilingual, EraId, Good } from '../types';

export interface GoodDef {
  id: Good;
  name: Bilingual;
  icon: string;
  color: string;
  /** base world price per unit in each era (null = not traded yet) */
  price: [number, number | null, number | null, number | null] | [number | null, number | null, number | null, number | null];
  food?: boolean;
}

export const GOOD_DEFS: Record<Good, GoodDef> = {
  padi: { id: 'padi', name: { ms: 'Padi', en: 'Rice' }, icon: '🌾', color: '#d9c45a', price: [2, 3, 6, 9], food: true },
  ikan: { id: 'ikan', name: { ms: 'Ikan', en: 'Fish' }, icon: '🐟', color: '#5aa6c9', price: [2, 3, 6, 9], food: true },
  kayu: { id: 'kayu', name: { ms: 'Kayu', en: 'Timber' }, icon: '🪵', color: '#8a5a2b', price: [3, 4, 8, 11] },
  rempah: { id: 'rempah', name: { ms: 'Rempah & Lada', en: 'Spices & Pepper' }, icon: '🌶️', color: '#b5402a', price: [12, 9, 10, 13] },
  besi: { id: 'besi', name: { ms: 'Besi', en: 'Iron' }, icon: '⛓️', color: '#6f6f7a', price: [9, 10, 15, 18] },
  timah: { id: 'timah', name: { ms: 'Bijih Timah', en: 'Tin' }, icon: '🔩', color: '#b8bcc4', price: [10, 14, 18, 22] },
  getah: { id: 'getah', name: { ms: 'Getah', en: 'Rubber' }, icon: '🌳', color: '#e8e0c8', price: [null, 12, 14, 16] },
  sawit: { id: 'sawit', name: { ms: 'Minyak Sawit', en: 'Palm Oil' }, icon: '🌴', color: '#e07b1f', price: [null, null, 16, 21] },
  barang: { id: 'barang', name: { ms: 'Barangan Buatan', en: 'Manufactured Goods' }, icon: '📦', color: '#a77b4f', price: [6, 9, 15, 20] },
  elektronik: { id: 'elektronik', name: { ms: 'Elektronik', en: 'Electronics' }, icon: '💾', color: '#3e8e7e', price: [null, null, 26, 30] },
  digital: { id: 'digital', name: { ms: 'Perkhidmatan Digital', en: 'Digital Services' }, icon: '🛰️', color: '#7a5af5', price: [null, null, null, 40] },
};

export function basePrice(good: Good, era: EraId): number {
  const p = GOOD_DEFS[good].price[era - 1];
  return p ?? 0;
}

export function isTradable(good: Good, era: EraId): boolean {
  return GOOD_DEFS[good].price[era - 1] != null;
}
