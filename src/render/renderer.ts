import { BUILDING_MAP } from '../core/data/buildings';
import { hash2 } from '../core/rng';
import { BuildingInstance, GameState, T, TRANSPORT, ZONE, isSea, isWater } from '../core/types';
import { Camera, HALF_H, HALF_W, TH, TW, tileCenter, visibleTileRange } from './iso';
import { CanvasFactory, Sprite, SpriteCache, domCanvasFactory, makeSprite } from './sprites/canvas';
import { buildingSprite } from './sprites/buildings';
import { SCALE, boat, diamond, shade } from './sprites/primitives';
import { TERRAIN_BASE, terrainSprite, transportSprite } from './sprites/terrain';
import { zoneSprite } from './sprites/zones';

export type Overlay = 'none' | 'landValue' | 'pollution' | 'coverage' | 'logistics' | 'resources' | 'access';
export const OVERLAYS: Overlay[] = ['none', 'landValue', 'pollution', 'coverage', 'logistics', 'resources', 'access'];

export interface Preview {
  tiles: Array<[number, number]>;
  ok: boolean;
  building?: { id: string; x: number; y: number };
  color?: string;
}

export const ZONE_TINT: Record<number, string> = { 1: '#3fbf5f', 2: '#3f8fdf', 3: '#e0b030' };

/** Which neighbours connect visually for a transport kind. */
function connects(a: number, b: number): boolean {
  if (!a || !b) return false;
  const roadish = (t: number) => t === TRANSPORT.ROAD || t === TRANSPORT.HIGHWAY;
  if (roadish(a) && roadish(b)) return true;
  return a === b;
}

export class Renderer {
  sprites: SpriteCache;
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  overlay: Overlay = 'none';
  preview: Preview | null = null;
  hover: { x: number; y: number } | null = null;
  selected: { x: number; y: number } | null = null;
  /** draw counters for diagnostics/tests */
  stats = { tiles: 0, sprites: 0 };

  constructor(factory: CanvasFactory = domCanvasFactory) {
    this.sprites = new SpriteCache(factory);
  }

  centerOn(tx: number, ty: number) {
    const c = tileCenter(tx, ty);
    this.camera = { ...this.camera, x: c.x, y: c.y };
  }

  private terrain(state: GameState, i: number, frame: number): Sprite {
    const m = state.map;
    const t = m.terrain[i];
    const x = i % m.width;
    const y = (i / m.width) | 0;
    const variant = Math.floor(hash2(x, y, 7) * 4);
    const water = isWater(t);
    const f = water ? (frame + variant) % 3 : 0;
    const fert = t === T.PLAIN ? Math.round(m.fertility[i] / 64) * 64 : 0;
    const tin = m.tin[i] > 0 && !water;
    return this.sprites.get(`t:${t}:${variant}:${f}:${fert}:${tin ? 1 : 0}`, () => terrainSprite(this.sprites.factory, t, variant, f, fert, tin));
  }

  private flatGround(t: number): Sprite {
    const base = t === T.JUNGLE || t === T.MANGROVE ? TERRAIN_BASE[T.PLAIN] : TERRAIN_BASE[t];
    return this.sprites.get(`g:${t}`, () => makeSprite(this.sprites.factory, 1, 2, (ctx, f) => diamond(ctx, f, shade(base, -0.05))));
  }

  private transportMask(state: GameState, x: number, y: number): number {
    const m = state.map;
    const W = m.width;
    const here = m.transport[y * W + x];
    let mask = 0;
    if (x + 1 < W && connects(here, m.transport[y * W + x + 1])) mask |= 1;
    if (x > 0 && connects(here, m.transport[y * W + x - 1])) mask |= 2;
    if (y + 1 < m.height && connects(here, m.transport[(y + 1) * W + x])) mask |= 4;
    if (y > 0 && connects(here, m.transport[(y - 1) * W + x])) mask |= 8;
    // also connect towards adjacent transfer hubs so roads visibly reach ports and stations
    const hubAt = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= W || ny >= m.height) return false;
      const bid = m.building[ny * W + nx];
      if (bid < 0) return false;
      const b = state.buildings.find((bb) => bb.id === bid);
      const d = b && BUILDING_MAP[b.def];
      return !!(d && (d.transfer || d.market));
    };
    if (hubAt(x + 1, y)) mask |= 1;
    if (hubAt(x - 1, y)) mask |= 2;
    if (hubAt(x, y + 1)) mask |= 4;
    if (hubAt(x, y - 1)) mask |= 8;
    return mask;
  }

  private drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, wx: number, wy: number, alpha = 1) {
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(s.canvas, wx - s.ax / SCALE, wy - s.ay / SCALE, s.w / SCALE, s.h / SCALE);
    if (alpha !== 1) ctx.globalAlpha = 1;
    this.stats.sprites++;
  }

  private diamondPath(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const c = tileCenter(x, y);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - HALF_H);
    ctx.lineTo(c.x + HALF_W, c.y);
    ctx.lineTo(c.x, c.y + HALF_H);
    ctx.lineTo(c.x - HALF_W, c.y);
    ctx.closePath();
  }

  overlayValue(state: GameState, i: number): number | null {
    const m = state.map;
    if (isWater(m.terrain[i]) && this.overlay !== 'logistics') return null;
    switch (this.overlay) {
      case 'landValue':
        return m.landValue[i] / 255;
      case 'pollution':
        return m.pollution[i] / 255;
      case 'coverage':
        return m.coverage[i] / 250;
      case 'logistics':
        return isSea(m.terrain[i]) ? null : m.logistics[i] / 255;
      case 'resources':
        return m.tin[i] ? 0.6 + m.tin[i] / 640 : m.terrain[i] === T.PLAIN ? (m.fertility[i] / 255) * 0.45 : null;
      case 'access':
        return m.access[i] ? 1 : 0;
      default:
        return null;
    }
  }

  overlayColor(v: number): string {
    if (this.overlay === 'pollution') return `rgba(${Math.round(120 + 135 * v)},${Math.round(90 * (1 - v))},${Math.round(40 * (1 - v))},${0.15 + v * 0.55})`;
    if (this.overlay === 'resources') return v >= 0.6 ? `rgba(220,225,235,${0.35 + (v - 0.6)})` : `rgba(90,200,60,${v})`;
    // red -> yellow -> green
    const r = v < 0.5 ? 220 : Math.round(220 - (v - 0.5) * 2 * 170);
    const g = v < 0.5 ? Math.round(60 + v * 2 * 160) : 210;
    return `rgba(${r},${g},60,0.5)`;
  }

  render(ctx: CanvasRenderingContext2D, state: GameState, vw: number, vh: number, time: number) {
    const m = state.map;
    const W = m.width;
    const cam = this.camera;
    this.stats = { tiles: 0, sprites: 0 };
    ctx.fillStyle = '#0d3550';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    ctx.imageSmoothingEnabled = true;

    const r = visibleTileRange(cam, vw, vh, W, m.height);
    const frame = Math.floor(time / 700) % 3;
    const anchors = new Map<number, BuildingInstance>();
    for (const b of state.buildings) anchors.set((b.y + b.h - 1) * W + (b.x + b.w - 1), b);

    for (let s = r.x0 + r.y0; s <= r.x1 + r.y1; s++) {
      const xa = Math.max(r.x0, s - r.y1);
      const xb = Math.min(r.x1, s - r.y0);
      for (let x = xa; x <= xb; x++) {
        const y = s - x;
        const i = y * W + x;
        const c = tileCenter(x, y);
        this.stats.tiles++;
        const t = m.terrain[i];
        const bid = m.building[i];
        const z = m.zone[i];
        const d = m.density[i];
        if (bid >= 0 || (z && d > 0)) this.drawSprite(ctx, this.flatGround(t), c.x, c.y);
        else this.drawSprite(ctx, this.terrain(state, i, frame), c.x, c.y);
        if (z && d === 0 && bid < 0) {
          this.diamondPath(ctx, x, y);
          ctx.fillStyle = ZONE_TINT[z] + '55';
          ctx.fill();
          ctx.strokeStyle = ZONE_TINT[z];
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
        const tr = m.transport[i];
        if (tr) {
          const mask = this.transportMask(state, x, y);
          const onWater = t === T.RIVER;
          const era = state.era;
          const sp = this.sprites.get(`r:${tr}:${mask}:${tr === TRANSPORT.ROAD ? era : 0}:${onWater ? 1 : 0}`, () => transportSprite(this.sprites.factory, tr, mask, era, onWater));
          this.drawSprite(ctx, sp, c.x, c.y);
        }
        if (z && d > 0 && bid < 0) {
          const style = m.style[i] || state.era;
          const variant = Math.floor(hash2(x, y, 3) * 4);
          const zs = this.sprites.get(`z:${z}:${d}:${style}:${variant}`, () => zoneSprite(this.sprites.factory, z, d, style, variant));
          this.drawSprite(ctx, zs, c.x, c.y);
        }
        const b = anchors.get(i);
        if (b) {
          const bc = tileCenter(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2);
          const bs = this.sprites.get(`b:${b.def}`, () => buildingSprite(this.sprites.factory, b.def));
          this.drawSprite(ctx, bs, bc.x, bc.y);
        }
      }
    }

    this.drawBoats(ctx, state, time);

    if (this.overlay !== 'none') {
      for (let y = r.y0; y <= r.y1; y++)
        for (let x = r.x0; x <= r.x1; x++) {
          const v = this.overlayValue(state, y * W + x);
          if (v == null) continue;
          this.diamondPath(ctx, x, y);
          ctx.fillStyle = this.overlayColor(v);
          ctx.fill();
        }
    }

    if (this.preview) {
      const p = this.preview;
      for (const [x, y] of p.tiles) {
        this.diamondPath(ctx, x, y);
        ctx.fillStyle = p.color ?? (p.ok ? 'rgba(80,220,120,0.38)' : 'rgba(230,70,60,0.42)');
        ctx.fill();
      }
      if (p.building) {
        const def = BUILDING_MAP[p.building.id];
        if (def) {
          const bc = tileCenter(p.building.x + (def.size - 1) / 2, p.building.y + (def.size - 1) / 2);
          const bs = this.sprites.get(`b:${def.id}`, () => buildingSprite(this.sprites.factory, def.id));
          this.drawSprite(ctx, bs, bc.x, bc.y, 0.7);
        }
      }
    }
    for (const [pos, col] of [
      [this.hover, 'rgba(255,255,255,0.9)'],
      [this.selected, 'rgba(255,215,64,1)'],
    ] as const) {
      if (!pos) continue;
      this.diamondPath(ctx, pos.x, pos.y);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5 / cam.zoom;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Ambient ships sailing near export hubs. */
  private drawBoats(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
    const m = state.map;
    let n = 0;
    for (const b of state.buildings) {
      const def = BUILDING_MAP[b.def];
      if (!def?.exportHub || n > 6) continue;
      n++;
      for (let k = 0; k < 2; k++) {
        const phase = time / 9000 + k * Math.PI + b.id;
        const tx = b.x - 3 - 2 * Math.cos(phase);
        const ty = b.y + 1 + 3 * Math.sin(phase);
        const ix = Math.round(tx);
        const iy = Math.round(ty);
        if (ix < 0 || iy < 0 || ix >= m.width || iy >= m.height || !isSea(m.terrain[iy * m.width + ix])) continue;
        const c = tileCenter(tx, ty);
        const era = state.era;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(1 / SCALE, 1 / SCALE);
        boat(ctx as CanvasRenderingContext2D, 0, 0, era >= 3 ? 26 : 16, era >= 3 ? '#2a3a4a' : '#6b3e22', era <= 1 ? '#e8dcc0' : era === 2 ? '#d0d0d0' : undefined);
        ctx.restore();
      }
    }
  }
}

/** Colours for the top-down minimap. */
const MINI_TERRAIN: Record<number, [number, number, number]> = {
  [T.DEEP]: [20, 60, 95],
  [T.SEA]: [30, 95, 140],
  [T.SHALLOW]: [60, 145, 180],
  [T.BEACH]: [226, 207, 155],
  [T.MANGROVE]: [80, 100, 55],
  [T.RIVER]: [70, 130, 120],
  [T.PLAIN]: [105, 165, 80],
  [T.JUNGLE]: [45, 100, 50],
  [T.HILL]: [140, 150, 90],
  [T.MOUNTAIN]: [110, 115, 95],
};

export function drawMinimap(canvas: HTMLCanvasElement, state: GameState) {
  const m = state.map;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (canvas.width !== m.width) canvas.width = m.width;
  if (canvas.height !== m.height) canvas.height = m.height;
  const img = ctx.createImageData(m.width, m.height);
  for (let i = 0; i < m.terrain.length; i++) {
    let c = MINI_TERRAIN[m.terrain[i]];
    if (m.zone[i] === ZONE.R) c = m.density[i] ? [70, 200, 90] : [120, 190, 120];
    else if (m.zone[i] === ZONE.C) c = m.density[i] ? [70, 140, 230] : [130, 170, 220];
    else if (m.zone[i] === ZONE.I) c = m.density[i] ? [230, 180, 50] : [220, 200, 120];
    if (m.transport[i]) c = [70, 70, 70];
    if (m.building[i] >= 0) c = [200, 80, 160];
    img.data[i * 4] = c[0];
    img.data[i * 4 + 1] = c[1];
    img.data[i * 4 + 2] = c[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export const TILE_W = TW;
export const TILE_H = TH;
