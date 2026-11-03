import { Ctx, SCALE, STH, STW } from './primitives';

/** An offscreen sprite: canvas plus the anchor (footprint-centre) in sprite pixels. */
export interface Sprite {
  canvas: HTMLCanvasElement;
  ax: number;
  ay: number;
  w: number;
  h: number;
}

export type CanvasFactory = (w: number, h: number) => HTMLCanvasElement;

export const domCanvasFactory: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
};

/**
 * Create a sprite for an n x n footprint with `extra` pixels of headroom.
 * The draw callback receives the context and the footprint geometry.
 */
export function makeSprite(
  factory: CanvasFactory,
  n: number,
  extra: number,
  draw: (ctx: Ctx, f: { cx: number; cy: number; hw: number; hh: number }) => void,
): Sprite {
  const pad = 6 * SCALE;
  const w = n * STW + pad * 2;
  const h = n * STH + extra + pad * 2;
  const canvas = factory(w, h);
  const ctx = canvas.getContext('2d') as Ctx | null;
  const f = { cx: w / 2, cy: pad + extra + (n * STH) / 2, hw: (n * STW) / 2, hh: (n * STH) / 2 };
  if (ctx) {
    ctx.lineJoin = 'round';
    draw(ctx, f);
  }
  return { canvas, ax: f.cx, ay: f.cy, w, h };
}

export class SpriteCache {
  private map = new Map<string, Sprite>();
  constructor(public factory: CanvasFactory = domCanvasFactory) {}
  get(key: string, build: () => Sprite): Sprite {
    let s = this.map.get(key);
    if (!s) {
      s = build();
      this.map.set(key, s);
    }
    return s;
  }
  get size() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
}
