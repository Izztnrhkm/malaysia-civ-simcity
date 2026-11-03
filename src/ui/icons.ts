import { SpriteCache } from '../render/sprites/canvas';
import { buildingSprite } from '../render/sprites/buildings';
import { zoneSprite } from '../render/sprites/zones';
import { transportSprite } from '../render/sprites/terrain';

/** Building / zone / transport thumbnails generated from the procedural sprites. */
const cache = new SpriteCache();
const urls = new Map<string, string>();

function toUrl(key: string, make: () => HTMLCanvasElement): string {
  const hit = urls.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    if (typeof document !== 'undefined' && !navigator.userAgent.includes('jsdom')) url = make().toDataURL('image/png');
  } catch {
    url = '';
  }
  urls.set(key, url);
  return url;
}

export function buildingIcon(id: string): string {
  return toUrl(`b:${id}`, () => cache.get(`b:${id}`, () => buildingSprite(cache.factory, id)).canvas);
}

export function zoneIcon(zone: number, era: number): string {
  return toUrl(`z:${zone}:${era}`, () => cache.get(`z:${zone}:2:${era}`, () => zoneSprite(cache.factory, zone, 2, era, 1)).canvas);
}

export function transportIcon(kind: number, era: number): string {
  return toUrl(`r:${kind}:${era}`, () => cache.get(`r:${kind}:3:${era}`, () => transportSprite(cache.factory, kind, 3, era, false)).canvas);
}
