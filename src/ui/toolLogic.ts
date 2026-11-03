import { GameEngine } from '../core/engine';
import { BUILDING_MAP, ZONE_COST } from '../core/data/buildings';
import { linePath, rectTiles, transportTileCost } from '../core/sim/placement';
import { CommandResult } from '../core/types';
import { formatMoney } from '../i18n/i18n';
import { Preview } from '../render/renderer';
import { Tool } from './types';

type Tile = { x: number; y: number };

export interface ToolPreview {
  preview: Preview | null;
  label: { text: string; ok: boolean } | null;
}

/** Top-left tile of a building centred under the cursor. */
export function buildingOrigin(defId: string, tile: Tile): Tile {
  const def = BUILDING_MAP[defId];
  const o = Math.floor((def.size - 1) / 2);
  return { x: tile.x - o, y: tile.y - o };
}

/** Preview tiles, validity and cost of the active tool between tiles a and b (shared by 2D and 3D views). */
export function computeToolPreview(engine: GameEngine, tool: Tool, a: Tile, b: Tile, t: (k: string) => string): ToolPreview {
  const s = engine.state;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < s.map.width && y < s.map.height;
  let tiles: Array<[number, number]> = [];
  let cost = 0;
  let ok = true;
  let building: Preview['building'];
  if (tool.kind === 'zone' || tool.kind === 'bulldoze') {
    tiles = rectTiles(a.x, a.y, b.x, b.y).filter(([x, y]) => inMap(x, y));
    cost = tool.kind === 'zone' ? tiles.length * ZONE_COST : 0;
  } else if (tool.kind === 'transport') {
    tiles = linePath(a.x, a.y, b.x, b.y).filter(([x, y]) => inMap(x, y));
    for (const [x, y] of tiles) {
      const c = transportTileCost(s, engine.ctx, tool.key, x, y);
      if (c == null) ok = false;
      else cost += c;
    }
  } else if (tool.kind === 'building') {
    const def = BUILDING_MAP[tool.id];
    const o = buildingOrigin(tool.id, b);
    tiles = rectTiles(o.x, o.y, o.x + def.size - 1, o.y + def.size - 1);
    const chk = engine.checkBuilding(tool.id, o.x, o.y);
    ok = chk.ok;
    cost = chk.cost ?? def.cost;
    building = { id: tool.id, x: o.x, y: o.y };
    if (!chk.ok && chk.reason) return { preview: { tiles, ok, building }, label: { text: t(chk.reason), ok: false } };
  } else return { preview: null, label: null };
  if (cost > s.money) ok = false;
  return {
    preview: tiles.length ? { tiles, ok, building, color: tool.kind === 'bulldoze' ? 'rgba(240,120,40,0.4)' : undefined } : null,
    label: tiles.length && tool.kind !== 'bulldoze' ? { text: `${t('common.cost')}: ${formatMoney(cost)}`, ok } : null,
  };
}

/** Apply the active tool. */
export function commitTool(engine: GameEngine, tool: Tool, a: Tile, b: Tile): CommandResult | null {
  if (tool.kind === 'zone') return engine.zone(tool.zone, a.x, a.y, b.x, b.y);
  if (tool.kind === 'bulldoze') return engine.bulldoze(a.x, a.y, b.x, b.y);
  if (tool.kind === 'transport') return engine.buildTransport(tool.key, a.x, a.y, b.x, b.y);
  if (tool.kind === 'building') {
    const o = buildingOrigin(tool.id, b);
    return engine.placeBuilding(tool.id, o.x, o.y);
  }
  return null;
}
