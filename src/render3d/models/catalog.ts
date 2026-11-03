/**
 * The 3D model catalog: every building, zoned lot tier, vehicle, tree and
 * transport piece, keyed by a stable model id that is also the `.glb` file
 * name in `public/models/`.
 */
import { BUILDINGS } from '../../core/data/buildings';
import { ModelBuilder } from './builder';
import { BUILDING_MODELS } from './buildings';
import { INFRA_MODELS, TREE_MODELS, VEHICLE_MODELS } from './misc';
import { Part } from './primitives';
import { ZONE_MODELS } from './zones';

export type ModelKind = 'building' | 'zone' | 'vehicle' | 'tree' | 'infra';

export interface CatalogEntry {
  id: string;
  kind: ModelKind;
  /** footprint in tiles (square) */
  size: number;
  /** era the model belongs to (0 = any) */
  era: number;
  build: () => Part[];
}

const make = (fn: (b: ModelBuilder) => void) => () => {
  const b = new ModelBuilder();
  fn(b);
  return b.parts;
};

export const buildingModelId = (defId: string) => `building_${defId}`;

function entries(): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const def of BUILDINGS) {
    const fn = BUILDING_MODELS[def.id];
    if (!fn) throw new Error(`No 3D model for building ${def.id}`);
    out.push({ id: buildingModelId(def.id), kind: 'building', size: def.size, era: def.era, build: make(fn) });
  }
  for (const [id, fn] of Object.entries(ZONE_MODELS)) out.push({ id, kind: 'zone', size: 1, era: Number(id.slice(-1)), build: make(fn) });
  for (const [id, fn] of Object.entries(VEHICLE_MODELS)) out.push({ id, kind: 'vehicle', size: 1, era: 0, build: make(fn) });
  for (const [id, fn] of Object.entries(TREE_MODELS)) out.push({ id, kind: 'tree', size: 1, era: 0, build: make(fn) });
  for (const [id, fn] of Object.entries(INFRA_MODELS)) out.push({ id, kind: 'infra', size: 1, era: 0, build: make(fn) });
  return out;
}

export const CATALOG: CatalogEntry[] = entries();
export const CATALOG_MAP: Record<string, CatalogEntry> = Object.fromEntries(CATALOG.map((e) => [e.id, e]));
