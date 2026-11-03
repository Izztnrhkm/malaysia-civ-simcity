import { z } from 'zod';
import { BUILDING_MAP } from '../data/buildings';
import { ERAS } from '../data/eras';
import { RESEARCH_MAP } from '../data/research';
import { createEmptyLayers } from '../map/terrain';
import { SAVE_VERSION, emptyDerived } from '../sim/context';
import { GOODS, GameState, Good } from '../types';
import { decodeInt32Layer, decodeLayer, encodeInt32Layer, encodeLayer } from './codec';

export const SAVE_FORMAT = 'tamadun-kota-save';
const LAYERS = ['terrain', 'elevation', 'fertility', 'tin', 'zone', 'density', 'style', 'transport'] as const;

const goodMap = z.object(Object.fromEntries(GOODS.map((g) => [g, z.number().finite()])) as Record<Good, z.ZodNumber>);
const track = z.object({
  current: z.string().nullable(),
  progress: z.record(z.number().finite()),
  done: z.array(z.string()),
  bank: z.number().finite(),
});

const stateSchema = z.object({
  version: z.number().int(),
  name: z.string().max(80),
  seed: z.number().int(),
  tick: z.number().int().nonnegative(),
  year: z.number().int(),
  month: z.number().int().min(0).max(11),
  era: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  money: z.number().finite(),
  debt: z.number().finite().nonnegative(),
  tax: z.object({ R: z.number(), C: z.number(), I: z.number() }),
  stock: goodMap,
  research: track,
  civics: track,
  policies: z.array(z.string()),
  partners: z.record(z.object({ relation: z.number().finite(), envoyCooldown: z.number(), exchange: z.boolean() })),
  deals: z.array(
    z.object({
      id: z.number(),
      partner: z.string(),
      good: z.enum(GOODS),
      qty: z.number(),
      price: z.number(),
      remaining: z.number(),
      delivered: z.number(),
      missed: z.number(),
    }),
  ),
  offers: z.array(
    z.object({
      id: z.number(),
      partner: z.string(),
      kind: z.enum(['deal', 'investment', 'exchange']),
      good: z.enum(GOODS).optional(),
      qty: z.number().optional(),
      price: z.number().optional(),
      duration: z.number().optional(),
      money: z.number().optional(),
      expires: z.number(),
    }),
  ),
  buildings: z.array(
    z.object({ id: z.number().int(), def: z.string(), x: z.number().int(), y: z.number().int(), w: z.number().int(), h: z.number().int(), built: z.number(), efficiency: z.number() }),
  ),
  nextId: z.number().int(),
  firedEvents: z.array(z.string()),
  effects: z.array(
    z.object({
      id: z.string(),
      ticksLeft: z.number(),
      exportCapMult: z.number().optional(),
      flood: z.boolean().optional(),
      priceMult: z.record(z.number()).optional(),
      productionMult: z.number().optional(),
      happiness: z.number().optional(),
      research: z.number().optional(),
    }),
  ),
  notices: z.array(
    z.object({
      id: z.number(),
      tick: z.number(),
      kind: z.enum(['info', 'good', 'bad', 'event', 'era']),
      key: z.string(),
      params: z.record(z.union([z.string(), z.number()])).optional(),
      entry: z.string().optional(),
    }),
  ),
  history: z.array(z.object({ tick: z.number(), year: z.number(), population: z.number(), money: z.number(), happiness: z.number() })),
  rngState: z.number(),
  victory: z.boolean(),
  happiness: z.number().min(0).max(100).optional(),
});

const fileSchema = z.object({
  format: z.literal(SAVE_FORMAT),
  version: z.number().int().positive(),
  savedAt: z.string(),
  meta: z.object({ name: z.string(), era: z.number(), year: z.number(), population: z.number() }),
  state: stateSchema,
  map: z.object({
    width: z.number().int().min(8).max(512),
    height: z.number().int().min(8).max(512),
    seed: z.number().int(),
    layers: z.object(Object.fromEntries([...LAYERS, 'building'].map((k) => [k, z.string()])) as Record<string, z.ZodString>),
  }),
});

export type SaveFile = z.infer<typeof fileSchema>;

export class SaveError extends Error {
  constructor(
    message: string,
    public readonly code: 'parse' | 'format' | 'version' | 'corrupt',
  ) {
    super(message);
  }
}

export function serialize(state: GameState): SaveFile {
  const { map, derived, ...rest } = state;
  const layers: Record<string, string> = {};
  for (const k of LAYERS) layers[k] = encodeLayer(map[k]);
  layers.building = encodeInt32Layer(map.building);
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    meta: { name: state.name, era: state.era, year: state.year, population: derived.population },
    state: { ...rest, happiness: derived.happiness },
    map: { width: map.width, height: map.height, seed: map.seed, layers },
  };
}

export function toJSON(state: GameState): string {
  return JSON.stringify(serialize(state));
}

/** Upgrade older save structures to the current version. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const v = typeof raw.version === 'number' ? raw.version : 0;
  if (v > SAVE_VERSION) throw new SaveError(`Save version ${v} is newer than this game (${SAVE_VERSION})`, 'version');
  // v1 is the first public format; future migrations chain here.
  return raw;
}

export function deserialize(input: string | unknown): GameState {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new SaveError('File is not valid JSON', 'parse');
    }
  }
  if (!raw || typeof raw !== 'object') throw new SaveError('Not a save file', 'format');
  const migrated = migrate(raw as Record<string, unknown>);
  const parsed = fileSchema.safeParse(migrated);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SaveError(`Invalid save: ${issue.path.join('.')} ${issue.message}`, 'format');
  }
  const f = parsed.data;
  const { width, height, seed } = f.map;
  const n = width * height;
  const map = createEmptyLayers(width, height, seed);
  try {
    for (const k of LAYERS) map[k].set(decodeLayer(f.map.layers[k], n));
    map.building.set(decodeInt32Layer(f.map.layers.building, n));
  } catch (e) {
    throw new SaveError(`Corrupt map data: ${(e as Error).message}`, 'corrupt');
  }
  const s = f.state;
  for (const b of s.buildings) {
    if (!BUILDING_MAP[b.def]) throw new SaveError(`Unknown building "${b.def}"`, 'corrupt');
    if (b.x < 0 || b.y < 0 || b.x + b.w > width || b.y + b.h > height) throw new SaveError('Building out of bounds', 'corrupt');
  }
  for (const id of [...s.research.done, ...s.civics.done]) if (!RESEARCH_MAP[id]) throw new SaveError(`Unknown research "${id}"`, 'corrupt');
  if (!ERAS[s.era]) throw new SaveError('Unknown era', 'corrupt');
  const derived = emptyDerived();
  if (s.happiness != null) derived.happiness = s.happiness;
  const { happiness: _h, ...rest } = s;
  void _h;
  return { ...(rest as Omit<GameState, 'map' | 'derived'>), version: SAVE_VERSION, map, derived } as GameState;
}

// ---------------- browser storage ----------------

export const STORAGE_PREFIX = 'tamadun-kota:';
export const SLOT_IDS = ['autosave', 'slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOT_IDS)[number];

export interface SlotInfo {
  id: SlotId;
  empty: boolean;
  name?: string;
  era?: number;
  year?: number;
  population?: number;
  savedAt?: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveToSlot(state: GameState, slot: SlotId): void {
  const st = storage();
  if (!st) throw new SaveError('Browser storage is unavailable', 'format');
  st.setItem(STORAGE_PREFIX + slot, toJSON(state));
}

export function loadFromSlot(slot: SlotId): GameState {
  const st = storage();
  const raw = st?.getItem(STORAGE_PREFIX + slot);
  if (!raw) throw new SaveError('Slot is empty', 'format');
  return deserialize(raw);
}

export function deleteSlot(slot: SlotId): void {
  storage()?.removeItem(STORAGE_PREFIX + slot);
}

export function listSlots(): SlotInfo[] {
  const st = storage();
  return SLOT_IDS.map((id) => {
    const raw = st?.getItem(STORAGE_PREFIX + id);
    if (!raw) return { id, empty: true };
    try {
      const f = JSON.parse(raw) as SaveFile;
      return { id, empty: false, ...f.meta, savedAt: f.savedAt };
    } catch {
      return { id, empty: true };
    }
  });
}
