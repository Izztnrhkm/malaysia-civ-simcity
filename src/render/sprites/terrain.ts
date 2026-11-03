import { Rng } from '../../core/rng';
import { T } from '../../core/types';
import { CanvasFactory, Sprite, makeSprite } from './canvas';
import { Ctx, Foot, diamond, mix, poly, shade, speckle, tree } from './primitives';

export const TERRAIN_BASE: Record<number, string> = {
  [T.DEEP]: '#17476b',
  [T.SEA]: '#1f6390',
  [T.SHALLOW]: '#3b93b5',
  [T.BEACH]: '#e2cf9b',
  [T.MANGROVE]: '#5b6a3a',
  [T.RIVER]: '#4d7f74',
  [T.PLAIN]: '#6aa84f',
  [T.JUNGLE]: '#356f34',
  [T.HILL]: '#8c9a58',
  [T.MOUNTAIN]: '#6f775f',
};

const WATER = new Set<number>([T.DEEP, T.SEA, T.SHALLOW, T.RIVER]);

function waves(ctx: Ctx, f: Foot, color: string, rng: Rng, frame: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const u = rng.range(-0.55, 0.55);
    const v = rng.range(-0.45, 0.45) + ((frame * 0.12) % 0.24);
    const x = f.cx + u * f.hw;
    const y = f.cy + v * f.hh;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.quadraticCurveTo(x - 3.5, y - 2.2, x, y);
    ctx.quadraticCurveTo(x + 3.5, y + 2.2, x + 7, y);
    ctx.stroke();
  }
}

/**
 * Terrain tile sprite. `variant` (0..3) adds natural variety; `frame` animates
 * water; `fert` (0..255) tints plains; `tin` adds ore specks.
 */
export function terrainSprite(factory: CanvasFactory, terrain: number, variant: number, frame: number, fert: number, tin: boolean): Sprite {
  const tall = terrain === T.JUNGLE || terrain === T.MOUNTAIN || terrain === T.MANGROVE || terrain === T.HILL;
  return makeSprite(factory, 1, tall ? 70 : 4, (ctx, f) => {
    const rng = new Rng(terrain * 1000 + variant * 31 + 7);
    let base = TERRAIN_BASE[terrain];
    if (terrain === T.PLAIN) base = mix('#8fb35a', '#4f9b3f', fert / 255);
    diamond(ctx, f, shade(base, rng.range(-0.04, 0.04)));
    if (WATER.has(terrain)) {
      const wrng = new Rng(variant * 13 + frame * 101 + terrain);
      if (terrain === T.SHALLOW) speckle(ctx, f, [shade(base, 0.15)], 10, wrng, 2);
      waves(ctx, f, shade(base, terrain === T.RIVER ? 0.18 : 0.28), wrng, frame);
      if (terrain === T.RIVER) speckle(ctx, f, ['#7a6a48', '#6b8a70'], 8, wrng, 1.4);
      return;
    }
    switch (terrain) {
      case T.BEACH:
        speckle(ctx, f, ['#f2e3b8', '#c9b27a', '#d9c48c'], 40, rng, 1.6);
        break;
      case T.PLAIN:
        speckle(ctx, f, [shade(base, 0.12), shade(base, -0.12), '#8bbf5a'], 26, rng, 1.8);
        if (variant === 3) tree(ctx, f.cx + f.hw * 0.35, f.cy + 2, 10, 'shade', rng);
        break;
      case T.MANGROVE: {
        // tidal mud and water pools
        speckle(ctx, f, ['#4a5530', '#6f6a45'], 26, rng, 2);
        ctx.fillStyle = 'rgba(70,120,120,0.55)';
        ctx.beginPath();
        ctx.ellipse(f.cx + rng.range(-12, 12), f.cy + rng.range(-4, 4), 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let k = 0; k < 4; k++) tree(ctx, f.cx + rng.range(-f.hw * 0.55, f.hw * 0.55), f.cy + rng.range(-f.hh * 0.4, f.hh * 0.5), rng.range(16, 22), 'mangrove', rng);
        break;
      }
      case T.JUNGLE: {
        speckle(ctx, f, ['#2b5a2a', '#4a7f3a'], 30, rng, 2);
        const n = 4 + (variant % 2);
        const pts: Array<[number, number]> = [];
        for (let k = 0; k < n; k++) pts.push([f.cx + rng.range(-f.hw * 0.55, f.hw * 0.55), f.cy + rng.range(-f.hh * 0.5, f.hh * 0.55)]);
        pts.sort((a, b) => a[1] - b[1]);
        for (const [x, y] of pts) tree(ctx, x, y, rng.range(22, 34), rng.chance(0.15) ? 'palm' : 'rain', rng);
        break;
      }
      case T.HILL: {
        speckle(ctx, f, ['#7a8648', '#a2ab6c', '#8f8f7a'], 30, rng, 2);
        // a gentle mound
        poly(ctx, [f.cx - f.hw * 0.7, f.cy + 2, f.cx - f.hw * 0.1, f.cy - 16 - variant * 2, f.cx + f.hw * 0.6, f.cy + 3], shade(base, 0.08));
        poly(ctx, [f.cx - f.hw * 0.1, f.cy - 16 - variant * 2, f.cx + f.hw * 0.6, f.cy + 3, f.cx + f.hw * 0.1, f.cy + 6], shade(base, -0.15));
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = '#9a9a8c';
          ctx.beginPath();
          ctx.ellipse(f.cx + rng.range(-25, 25), f.cy + rng.range(-6, 10), 3.5, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (rng.chance(0.6)) tree(ctx, f.cx + rng.range(-30, 30), f.cy + rng.range(0, 10), 18, 'rain', rng);
        break;
      }
      case T.MOUNTAIN: {
        const peak = f.cy - 48 - variant * 5;
        poly(ctx, [f.cx - f.hw * 0.95, f.cy, f.cx - f.hw * 0.05, peak, f.cx + f.hw * 0.95, f.cy, f.cx, f.cy + f.hh * 0.9], shade(base, -0.05));
        poly(ctx, [f.cx - f.hw * 0.05, peak, f.cx + f.hw * 0.95, f.cy, f.cx, f.cy + f.hh * 0.9], shade(base, -0.25));
        // forested lower slopes (granite range is jungle-clad)
        for (let k = 0; k < 4; k++) tree(ctx, f.cx + rng.range(-f.hw * 0.6, f.hw * 0.6), f.cy + rng.range(-4, f.hh * 0.6), rng.range(16, 22), 'rain', rng);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(f.cx - f.hw * 0.05, peak + 10, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    if (tin) speckle(ctx, f, ['#d9dde3', '#9aa0aa', '#ffffff'], 14, new Rng(variant + 99), 2.2);
  });
}

const ROAD_STYLE: Record<number, { surface: string; edge: string; line?: string }> = {
  1: { surface: '#b08a5a', edge: '#8a6a42' },
  2: { surface: '#a8653f', edge: '#7f4a2c' },
  3: { surface: '#55555c', edge: '#3a3a40', line: '#f0f0e8' },
  4: { surface: '#4d4d55', edge: '#34343a', line: '#ffffff' },
};

/**
 * Transport sprite for a tile. `mask` bits: 1=+x, 2=-x, 4=+y, 8=-y.
 * `kind`: 1 road, 2 rail, 3 highway, 4 mrt.
 */
export function transportSprite(factory: CanvasFactory, kind: number, mask: number, era: number, water: boolean): Sprite {
  return makeSprite(factory, 1, kind === 4 ? 60 : 12, (ctx, f) => {
    const ex = [f.hw / 2, f.hh / 2];
    const ey = [-f.hw / 2, f.hh / 2];
    const dirs: Array<[number, number[]]> = [
      [1, ex],
      [2, [-ex[0], -ex[1]]],
      [4, ey],
      [8, [-ey[0], -ey[1]]],
    ];
    const z = kind === 4 ? 40 : water ? 6 : 0;
    const C = [f.cx, f.cy - z];
    const band = (r: number, color: string, perpOf: (d: number[]) => number[]) => {
      ctx.fillStyle = color;
      // centre joint
      poly(ctx, [C[0] + r * ex[0] + r * ey[0], C[1] + r * ex[1] + r * ey[1], C[0] + r * ex[0] - r * ey[0], C[1] + r * ex[1] - r * ey[1], C[0] - r * ex[0] - r * ey[0], C[1] - r * ex[1] - r * ey[1], C[0] - r * ex[0] + r * ey[0], C[1] - r * ex[1] + r * ey[1]], color);
      for (const [bit, d] of dirs) {
        if (!(mask & bit)) continue;
        const p = perpOf(d);
        poly(ctx, [C[0] + p[0] * r, C[1] + p[1] * r, C[0] - p[0] * r, C[1] - p[1] * r, C[0] + d[0] - p[0] * r, C[1] + d[1] - p[1] * r, C[0] + d[0] + p[0] * r, C[1] + d[1] + p[1] * r], color);
      }
    };
    // segments along the x axis (±ex) have same-signed components; their perpendicular is ey
    const perp = (d: number[]) => (d[0] * d[1] > 0 ? ey : ex);
    if (water || kind === 4) {
      // pillars
      ctx.fillStyle = kind === 4 ? '#bdbdb8' : '#7a6a58';
      ctx.fillRect(f.cx - 3, f.cy - z, 6, z + 4);
    }
    if (kind === 1 || kind === 3) {
      const st = ROAD_STYLE[kind === 3 ? 4 : Math.min(era, 3)];
      const r = kind === 3 ? 0.62 : 0.42;
      band(r + 0.06, st.edge, perp);
      band(r, st.surface, perp);
      if (st.line) {
        ctx.strokeStyle = kind === 3 ? '#e9c440' : st.line;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        for (const [bit, d] of dirs) {
          if (!(mask & bit)) continue;
          ctx.beginPath();
          ctx.moveTo(C[0], C[1]);
          ctx.lineTo(C[0] + d[0], C[1] + d[1]);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    } else if (kind === 2) {
      band(0.4, '#8a8478', perp);
      ctx.strokeStyle = '#5a3b22';
      ctx.lineWidth = 2;
      for (const [bit, d] of dirs) {
        if (!(mask & bit)) continue;
        const p = perp(d);
        for (let k = 0.15; k <= 1; k += 0.28) {
          ctx.beginPath();
          ctx.moveTo(C[0] + d[0] * k + p[0] * 0.32, C[1] + d[1] * k + p[1] * 0.32);
          ctx.lineTo(C[0] + d[0] * k - p[0] * 0.32, C[1] + d[1] * k - p[1] * 0.32);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = '#c8c8cc';
      ctx.lineWidth = 1.2;
      for (const [bit, d] of dirs) {
        if (!(mask & bit)) continue;
        const p = perp(d);
        for (const s of [0.18, -0.18]) {
          ctx.beginPath();
          ctx.moveTo(C[0] + p[0] * s, C[1] + p[1] * s);
          ctx.lineTo(C[0] + d[0] + p[0] * s, C[1] + d[1] + p[1] * s);
          ctx.stroke();
        }
      }
    } else if (kind === 4) {
      band(0.36, '#d8d8d2', perp);
      band(0.22, '#a9a9a2', perp);
    }
    if (water && kind !== 4) {
      // bridge railings along each deck segment
      ctx.strokeStyle = '#5a3f28';
      ctx.lineWidth = 1.4;
      for (const [bit, d] of dirs) {
        if (!(mask & bit)) continue;
        const p = perp(d);
        for (const side of [0.5, -0.5]) {
          ctx.beginPath();
          ctx.moveTo(C[0] + p[0] * side, C[1] + p[1] * side - 2);
          ctx.lineTo(C[0] + d[0] + p[0] * side, C[1] + d[1] + p[1] * side - 2);
          ctx.stroke();
        }
      }
    }
  });
}
