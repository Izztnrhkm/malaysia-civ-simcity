import { BUILDINGS } from '../../src/core/data/buildings';
import { GameEngine } from '../../src/core/engine';
import { T } from '../../src/core/types';
import { HALF_H, HALF_W, clampCamera, screenToTile, tileCenter, visibleTileRange, worldToScreen, worldToTile, zoomAt } from '../../src/render/iso';
import { OVERLAYS, Renderer, drawMinimap } from '../../src/render/renderer';
import { BUILDING_DRAW, buildingSprite } from '../../src/render/sprites/buildings';
import { hexToRgb, mix, rgbToHex, shade } from '../../src/render/sprites/primitives';
import { terrainSprite, transportSprite } from '../../src/render/sprites/terrain';
import { zoneSprite } from '../../src/render/sprites/zones';
import { MockCtx, createMockContext, mockCanvasFactory, paintCalls } from '../helpers/mockCanvas';
import { Bot } from '../helpers/bot';

const ctxOf = (c: HTMLCanvasElement) => c.getContext('2d') as unknown as MockCtx;

describe('isometric projection', () => {
  it('tile centres round-trip through the inverse projection', () => {
    for (const [x, y] of [
      [0, 0],
      [5, 9],
      [127, 3],
      [64, 64],
    ]) {
      const c = tileCenter(x, y);
      expect(worldToTile(c.x, c.y)).toEqual({ x, y });
      // points inside the diamond map to the same tile
      expect(worldToTile(c.x + HALF_W * 0.4, c.y)).toEqual({ x, y });
      expect(worldToTile(c.x, c.y - HALF_H * 0.4)).toEqual({ x, y });
    }
  });

  it('screen/world conversions are inverse and zoom keeps the cursor point fixed', () => {
    const cam = { x: 300, y: 500, zoom: 1.3 };
    const t = screenToTile(cam, 800, 600, 400, 300);
    const s = worldToScreen(cam, 800, 600, tileCenter(t.x, t.y).x, tileCenter(t.x, t.y).y);
    expect(Math.abs(s.x - 400)).toBeLessThan(HALF_W * cam.zoom);
    const z = zoomAt(cam, 800, 600, 123, 77, 1.5);
    const before = screenToTile(cam, 800, 600, 123, 77);
    const after = screenToTile(z, 800, 600, 123, 77);
    expect(after).toEqual(before);
    expect(zoomAt(cam, 800, 600, 0, 0, 100).zoom).toBeLessThanOrEqual(2.5);
  });

  it('visible range is clamped to the map and the camera is clamped', () => {
    const r = visibleTileRange({ x: 0, y: 0, zoom: 0.1 }, 4000, 4000, 64, 64);
    expect(r.x0).toBe(0);
    expect(r.y1).toBe(63);
    const c = clampCamera({ x: 1e9, y: -1e9, zoom: 1 }, 64, 64);
    expect(c.x).toBeLessThan(1e9);
    expect(c.y).toBe(0);
  });
});

describe('colour helpers', () => {
  it('converts, shades and mixes colours', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
    expect(rgbToHex(255, 128, 0)).toBe('#ff8000');
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', -1)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('procedural sprites', () => {
  it('every building definition has a dedicated drawing recipe', () => {
    for (const b of BUILDINGS) expect(BUILDING_DRAW[b.id], b.id).toBeTypeOf('function');
  });

  it.each(BUILDINGS.map((b) => b.id))('building sprite %s draws and is deterministic', (id) => {
    const a = buildingSprite(mockCanvasFactory, id);
    const b = buildingSprite(mockCanvasFactory, id);
    const ca = ctxOf(a.canvas);
    const cb = ctxOf(b.canvas);
    expect(paintCalls(ca)).toBeGreaterThan(5);
    expect(JSON.stringify(ca.calls)).toBe(JSON.stringify(cb.calls));
    expect(a.ax).toBeGreaterThan(0);
    expect(a.ay).toBeLessThan(a.h);
  });

  it('zone sprites exist for every zone, density and era style, and eras look different', () => {
    const signatures = new Set<string>();
    for (let zone = 1; zone <= 3; zone++)
      for (let era = 1; era <= 4; era++)
        for (let level = 1; level <= 4; level++) {
          const s = zoneSprite(mockCanvasFactory, zone, level, era, 0);
          const c = ctxOf(s.canvas);
          expect(paintCalls(c)).toBeGreaterThan(3);
          signatures.add(JSON.stringify(c.calls).slice(0, 4000));
        }
    expect(signatures.size).toBeGreaterThan(30);
  });

  it('terrain sprites cover every terrain type and animate water frames', () => {
    for (let t = 0; t <= 9; t++) {
      const s = terrainSprite(mockCanvasFactory, t, 1, 0, 128, false);
      expect(paintCalls(ctxOf(s.canvas))).toBeGreaterThan(0);
    }
    const f0 = JSON.stringify(ctxOf(terrainSprite(mockCanvasFactory, T.SEA, 0, 0, 0, false).canvas).calls);
    const f1 = JSON.stringify(ctxOf(terrainSprite(mockCanvasFactory, T.SEA, 0, 1, 0, false).canvas).calls);
    expect(f0).not.toBe(f1);
    const tin = ctxOf(terrainSprite(mockCanvasFactory, T.HILL, 0, 0, 0, true).canvas);
    const noTin = ctxOf(terrainSprite(mockCanvasFactory, T.HILL, 0, 0, 0, false).canvas);
    expect(tin.calls.length).toBeGreaterThan(noTin.calls.length);
  });

  it('transport sprites draw one segment per connected side', () => {
    const one = ctxOf(transportSprite(mockCanvasFactory, 1, 1, 1, false).canvas);
    const four = ctxOf(transportSprite(mockCanvasFactory, 1, 15, 1, false).canvas);
    expect(paintCalls(four)).toBeGreaterThan(paintCalls(one));
    for (const kind of [1, 2, 3, 4]) for (const water of [false, true]) expect(paintCalls(ctxOf(transportSprite(mockCanvasFactory, kind, 5, 3, water).canvas))).toBeGreaterThan(0);
  });
});

describe('renderer', () => {
  function city() {
    const e = GameEngine.newGame(42);
    const bot = new Bot(e);
    bot.setup();
    for (let i = 0; i < 40; i++) {
      bot.step();
      e.tick();
    }
    return e;
  }

  it('renders terrain, transport, zones and buildings in view and caches sprites', () => {
    const e = city();
    const r = new Renderer(mockCanvasFactory);
    const b = e.state.buildings[0];
    r.centerOn(b.x + 6, b.y);
    const ctx = createMockContext();
    r.render(ctx, e.state, 1280, 800, 0);
    expect(r.stats.tiles).toBeGreaterThan(500);
    expect(r.stats.sprites).toBeGreaterThan(r.stats.tiles);
    const cached = r.sprites.size;
    r.render(ctx, e.state, 1280, 800, 16);
    expect(r.sprites.size).toBe(cached);
    expect(ctx.calls.filter(([n]) => n === 'drawImage').length).toBeGreaterThan(1000);
  });

  it('draws every overlay and placement previews', () => {
    const e = city();
    const r = new Renderer(mockCanvasFactory);
    const b = e.state.buildings[0];
    r.centerOn(b.x, b.y);
    for (const o of OVERLAYS) {
      r.overlay = o;
      const ctx = createMockContext();
      r.render(ctx, e.state, 800, 600, 0);
      expect(ctx.calls.length).toBeGreaterThan(0);
    }
    r.overlay = 'landValue';
    const vals = [];
    for (let i = 0; i < 500; i++) {
      const v = r.overlayValue(e.state, i * 30);
      if (v != null) vals.push(v);
    }
    expect(vals.every((v) => v >= 0 && v <= 1)).toBe(true);
    r.preview = { tiles: [[b.x + 3, b.y + 3]], ok: true, building: { id: 'pasar', x: b.x + 3, y: b.y + 3 } };
    const ctx = createMockContext();
    r.render(ctx, e.state, 800, 600, 0);
    expect(ctx.calls.some(([n, a]) => n === 'set:globalAlpha' && a[0] === 0.7)).toBe(true);
  });

  it('draws a minimap pixel per tile', () => {
    const e = GameEngine.newGame(9, 'x', 64);
    const canvas = document.createElement('canvas');
    drawMinimap(canvas, e.state);
    expect(canvas.width).toBe(64);
    const c = canvas.getContext('2d') as unknown as MockCtx;
    expect(c.calls.some(([n]) => n === 'putImageData')).toBe(true);
  });
});
