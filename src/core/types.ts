export type Lang = 'ms' | 'en';
export interface Bilingual {
  ms: string;
  en: string;
}
export type EraId = 1 | 2 | 3 | 4;
export const ERA_IDS: EraId[] = [1, 2, 3, 4];

/** Terrain codes stored in a Uint8Array. */
export const T = {
  DEEP: 0,
  SEA: 1,
  SHALLOW: 2,
  BEACH: 3,
  MANGROVE: 4,
  RIVER: 5,
  PLAIN: 6,
  JUNGLE: 7,
  HILL: 8,
  MOUNTAIN: 9,
} as const;
export type TerrainId = (typeof T)[keyof typeof T];
export const TERRAIN_KEYS = ['deep', 'sea', 'shallow', 'beach', 'mangrove', 'river', 'plain', 'jungle', 'hill', 'mountain'] as const;

export const isWater = (t: number) => t <= T.SHALLOW || t === T.RIVER;
export const isSea = (t: number) => t <= T.SHALLOW;
export const isLand = (t: number) => !isWater(t);

export const ZONE = { NONE: 0, R: 1, C: 2, I: 3 } as const;
export type ZoneId = (typeof ZONE)[keyof typeof ZONE];
export type ZoneKey = 'R' | 'C' | 'I';
export const ZONE_KEYS: ZoneKey[] = ['R', 'C', 'I'];

export const TRANSPORT = { NONE: 0, ROAD: 1, RAIL: 2, HIGHWAY: 3, MRT: 4 } as const;
export type TransportId = (typeof TRANSPORT)[keyof typeof TRANSPORT];
export type TransportKey = 'road' | 'rail' | 'highway' | 'mrt';

export const GOODS = ['padi', 'ikan', 'kayu', 'rempah', 'besi', 'timah', 'getah', 'sawit', 'barang', 'elektronik', 'digital'] as const;
export type Good = (typeof GOODS)[number];
export type GoodMap = Record<Good, number>;
export const emptyGoods = (): GoodMap => Object.fromEntries(GOODS.map((g) => [g, 0])) as GoodMap;

export interface MapLayers {
  width: number;
  height: number;
  seed: number;
  terrain: Uint8Array;
  /** 0..255; sea level is around 77 */
  elevation: Uint8Array;
  /** 0..255 soil fertility (alluvial plains score highest) */
  fertility: Uint8Array;
  /** 0..255 tin ore richness */
  tin: Uint8Array;
  zone: Uint8Array;
  /** developed density level of a zoned tile, 0 (empty lot) .. 4 */
  density: Uint8Array;
  transport: Uint8Array;
  /** building instance id covering this tile, or -1 */
  building: Int32Array;
  // ---- derived layers (recomputed, not saved) ----
  landValue: Uint8Array;
  pollution: Uint8Array;
  /** 1 if tile is within reach of the transport network */
  access: Uint8Array;
  /** combined public-service coverage 0..255 */
  coverage: Uint8Array;
  /** delivery efficiency 0..255 to an export hub (logistics) */
  logistics: Uint8Array;
}

export interface BuildingInstance {
  id: number;
  def: string;
  x: number;
  y: number;
  w: number;
  h: number;
  built: number;
  /** last computed operating efficiency 0..1 (staffing x logistics x utilities) */
  efficiency: number;
}

export interface Deal {
  id: number;
  partner: string;
  good: Good;
  /** units per tick */
  qty: number;
  /** price per unit locked in when signed */
  price: number;
  remaining: number;
  delivered: number;
  missed: number;
}

export interface Offer {
  id: number;
  partner: string;
  kind: 'deal' | 'investment' | 'exchange';
  good?: Good;
  qty?: number;
  price?: number;
  duration?: number;
  money?: number;
  expires: number;
}

export interface PartnerState {
  relation: number;
  envoyCooldown: number;
  exchange: boolean;
}

export type NoticeKind = 'info' | 'good' | 'bad' | 'event' | 'era';
export interface Notice {
  id: number;
  tick: number;
  kind: NoticeKind;
  key: string;
  params?: Record<string, string | number>;
  entry?: string;
}

export interface ResearchTrack {
  current: string | null;
  progress: Record<string, number>;
  done: string[];
  /** unspent points (overflow and one-off grants) applied to the next pick */
  bank: number;
}

export interface ActiveEffect {
  id: string;
  ticksLeft: number;
  exportCapMult?: number;
  flood?: boolean;
  priceMult?: Partial<Record<Good, number>>;
  productionMult?: number;
  happiness?: number;
  research?: number;
}

export interface Budget {
  taxR: number;
  taxC: number;
  taxI: number;
  exports: number;
  deals: number;
  upkeepBuildings: number;
  upkeepTransport: number;
  imports: number;
  interest: number;
  /** public administration, scales with population and prosperity */
  admin: number;
}

export interface Derived {
  population: number;
  workers: number;
  jobs: number;
  employed: number;
  unemployment: number;
  happiness: number;
  demand: { R: number; C: number; I: number };
  production: GoodMap;
  consumption: GoodMap;
  exported: GoodMap;
  imported: GoodMap;
  budget: Budget;
  netIncome: number;
  researchPerTick: number;
  culturePerTick: number;
  exportCapacity: number;
  power: { supply: number; demand: number };
  water: { supply: number; demand: number };
  foodSatisfaction: number;
  storage: number;
  avgLandValue: number;
  zoneCounts: { R: number; C: number; I: number };
}

export interface HistoryPoint {
  tick: number;
  year: number;
  population: number;
  money: number;
  happiness: number;
}

export interface GameState {
  version: number;
  name: string;
  seed: number;
  tick: number;
  year: number;
  month: number;
  era: EraId;
  money: number;
  debt: number;
  tax: { R: number; C: number; I: number };
  stock: GoodMap;
  research: ResearchTrack;
  civics: ResearchTrack;
  policies: string[];
  partners: Record<string, PartnerState>;
  deals: Deal[];
  offers: Offer[];
  buildings: BuildingInstance[];
  nextId: number;
  map: MapLayers;
  firedEvents: string[];
  effects: ActiveEffect[];
  notices: Notice[];
  history: HistoryPoint[];
  rngState: number;
  victory: boolean;
  derived: Derived;
}

export interface CommandResult {
  ok: boolean;
  /** i18n key explaining a failure */
  reason?: string;
  cost?: number;
}
