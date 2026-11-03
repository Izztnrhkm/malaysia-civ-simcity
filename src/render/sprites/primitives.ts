/**
 * Drawing primitives for procedural isometric sprites. Every sprite is drawn
 * at SCALE x the base tile size into an offscreen canvas whose anchor (the
 * centre of the footprint's bottom diamond) is at (ax, ay).
 */
import { Rng } from '../../core/rng';

export type Ctx = CanvasRenderingContext2D;

export const SCALE = 2;
export const STW = 64 * SCALE; // sprite tile width
export const STH = 32 * SCALE; // sprite tile height

// ---------------- colour helpers ----------------

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Lighten (amt > 0) or darken (amt < 0) a colour by a fraction. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function jitter(hex: string, rng: Rng, amt = 0.06): string {
  return shade(hex, rng.range(-amt, amt));
}

// ---------------- geometry ----------------

/** Footprint geometry in sprite space. `cx, cy` is the centre of the ground
 *  diamond; `hw, hh` are half width/height of the diamond. */
export interface Foot {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

export function poly(ctx: Ctx, pts: number[], fill?: string, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function diamond(ctx: Ctx, f: Foot, fill: string, stroke?: string) {
  poly(ctx, [f.cx, f.cy - f.hh, f.cx + f.hw, f.cy, f.cx, f.cy + f.hh, f.cx - f.hw, f.cy], fill, stroke);
}

/** Shrink a footprint by a fraction (0..1) around its centre. */
export function inset(f: Foot, k: number): Foot {
  return { cx: f.cx, cy: f.cy, hw: f.hw * k, hh: f.hh * k };
}

export interface BoxColors {
  top: string;
  left: string;
  right: string;
  outline?: string;
}

export function wallColors(base: string): BoxColors {
  return { top: shade(base, 0.18), left: shade(base, -0.08), right: shade(base, -0.28), outline: shade(base, -0.5) };
}

/**
 * An isometric box standing on footprint `f`, `h` pixels tall, optionally
 * raised by `z`. Returns the footprint of its top face.
 */
export function box(ctx: Ctx, f: Foot, h: number, c: BoxColors, z = 0): Foot {
  const { cx, hw, hh } = f;
  const cy = f.cy - z;
  // left wall
  poly(ctx, [cx - hw, cy, cx, cy + hh, cx, cy + hh - h, cx - hw, cy - h], c.left, c.outline, 0.8);
  // right wall
  poly(ctx, [cx, cy + hh, cx + hw, cy, cx + hw, cy - h, cx, cy + hh - h], c.right, c.outline, 0.8);
  // top
  poly(ctx, [cx, cy - hh - h, cx + hw, cy - h, cx, cy + hh - h, cx - hw, cy - h], c.top, c.outline, 0.8);
  return { cx, cy: cy - h, hw, hh };
}

/** Pyramid/hip roof on footprint `f` with apex height `h`. */
export function pyramidRoof(ctx: Ctx, f: Foot, h: number, color: string, overhang = 1.12) {
  const o = inset(f, overhang);
  const { cx, cy, hw, hh } = o;
  const apex = [cx, cy - h];
  poly(ctx, [cx - hw, cy, cx, cy + hh, ...apex], shade(color, -0.05), shade(color, -0.5), 0.8);
  poly(ctx, [cx, cy + hh, cx + hw, cy, ...apex], shade(color, -0.3), shade(color, -0.5), 0.8);
  poly(ctx, [cx - hw, cy, cx, cy - hh, ...apex], shade(color, 0.12));
  poly(ctx, [cx, cy - hh, cx + hw, cy, ...apex], shade(color, -0.15));
}

/**
 * Gable roof whose ridge runs along the tile's x axis (towards screen right-down)
 * when `alongX`, otherwise along y. `lift` raises the ridge ends (gonjong-like).
 */
export function gableRoof(ctx: Ctx, f: Foot, h: number, color: string, alongX = true, lift = 0, overhang = 1.12) {
  const o = inset(f, overhang);
  const { cx, cy, hw, hh } = o;
  const T = [cx, cy - hh];
  const R = [cx + hw, cy];
  const B = [cx, cy + hh];
  const L = [cx - hw, cy];
  const dark = shade(color, -0.32);
  const light = shade(color, 0.05);
  const edge = shade(color, -0.55);
  if (alongX) {
    // ridge from mid(T,L) to mid(R,B)
    const r1 = [(T[0] + L[0]) / 2, (T[1] + L[1]) / 2 - h - lift];
    const r2 = [(R[0] + B[0]) / 2, (R[1] + B[1]) / 2 - h - lift];
    const r1m = [r1[0], r1[1] + lift];
    const r2m = [r2[0], r2[1] + lift];
    // back slope (top-right) then front slope (bottom-left)
    poly(ctx, [...T, ...R, ...r2m, ...r1m], shade(color, -0.12), edge, 0.8);
    poly(ctx, [...L, ...B, ...r2m, ...r1m], light, edge, 0.8);
    // gable end triangle at right
    poly(ctx, [...B, ...R, ...r2m], dark, edge, 0.8);
    if (lift) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r1m[0], r1m[1]);
      ctx.quadraticCurveTo((r1m[0] + r2m[0]) / 2, (r1m[1] + r2m[1]) / 2 + lift * 0.6, r2m[0], r2m[1]);
      ctx.moveTo(r1m[0], r1m[1]);
      ctx.lineTo(r1[0] - 3, r1[1]);
      ctx.moveTo(r2m[0], r2m[1]);
      ctx.lineTo(r2[0] + 3, r2[1]);
      ctx.stroke();
    }
  } else {
    const r1 = [(T[0] + R[0]) / 2, (T[1] + R[1]) / 2 - h];
    const r2 = [(L[0] + B[0]) / 2, (L[1] + B[1]) / 2 - h];
    poly(ctx, [...T, ...L, ...r2, ...r1], shade(color, 0.12), edge, 0.8);
    poly(ctx, [...R, ...B, ...r2, ...r1], shade(color, -0.25), edge, 0.8);
    poly(ctx, [...L, ...B, ...r2], shade(color, -0.05), edge, 0.8);
  }
}

/** Three-tiered pyramidal roof typical of old Nusantara mosques. */
export function tieredRoof(ctx: Ctx, f: Foot, color: string, tiers = 3, tierH = 10) {
  let cur = inset(f, 1.15);
  for (let t = 0; t < tiers; t++) {
    const top = { ...cur, cy: cur.cy - tierH * 0.55 };
    // sloped skirt drawn as truncated pyramid
    const nextScale = 0.62;
    const nxt: Foot = { cx: cur.cx, cy: cur.cy - tierH, hw: cur.hw * nextScale, hh: cur.hh * nextScale };
    const { cx, cy, hw, hh } = cur;
    poly(ctx, [cx - hw, cy, cx, cy + hh, nxt.cx, nxt.cy + nxt.hh, nxt.cx - nxt.hw, nxt.cy], shade(color, -0.05), shade(color, -0.5), 0.8);
    poly(ctx, [cx, cy + hh, cx + hw, cy, nxt.cx + nxt.hw, nxt.cy, nxt.cx, nxt.cy + nxt.hh], shade(color, -0.3), shade(color, -0.5), 0.8);
    void top;
    if (t < tiers - 1) {
      // short wall between tiers
      box(ctx, inset(nxt, 0.8), tierH * 0.35, wallColors('#e8dcc0'));
      cur = { ...nxt, cy: nxt.cy - tierH * 0.35 };
    } else {
      pyramidRoof(ctx, nxt, tierH * 0.9, color, 1);
      // finial (mustaka)
      ctx.fillStyle = '#c9962b';
      ctx.fillRect(nxt.cx - 1.5, nxt.cy - tierH * 0.9 - 7, 3, 7);
    }
  }
}

/** Onion dome on a drum. */
export function dome(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = shade(color, -0.1);
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x - r * 1.25, y - r * 1.1, x, y - r * 2);
  ctx.quadraticCurveTo(x + r * 1.25, y - r * 1.1, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.45);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = shade(color, 0.35);
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.9, r * 0.18, r * 0.45, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9962b';
  ctx.fillRect(x - 0.8, y - r * 2 - 5, 1.6, 5);
}

/** Rows of windows on the left (`side=-1`) or right (`side=1`) wall of a box. */
export function windows(ctx: Ctx, f: Foot, h: number, side: -1 | 1, rows: number, cols: number, color: string, z = 0, frame?: string) {
  const { cx, hw, hh } = f;
  const cy = f.cy - z;
  // wall runs from (x0,y0) bottom-outer to (cx, cy+hh) bottom-inner
  const x0 = cx + side * hw;
  const y0 = cy;
  const dx = (cx - x0) / cols;
  const dy = (cy + hh - y0) / cols;
  const rowH = h / rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const bx = x0 + dx * (c + 0.22);
      const by = y0 + dy * (c + 0.22) - rowH * (r + 0.3);
      const wx = dx * 0.56;
      const wy = dy * 0.56;
      const wh = rowH * 0.45;
      poly(ctx, [bx, by, bx + wx, by + wy, bx + wx, by + wy - wh, bx, by - wh], color, frame, 0.6);
    }
}

/** Vertical posts (stilts) under a raised floor. */
export function stilts(ctx: Ctx, f: Foot, h: number, color = '#5a3a1e') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const pts = [
    [f.cx - f.hw * 0.85, f.cy],
    [f.cx, f.cy + f.hh * 0.85],
    [f.cx + f.hw * 0.85, f.cy],
    [f.cx - f.hw * 0.3, f.cy + f.hh * 0.55],
    [f.cx + f.hw * 0.3, f.cy + f.hh * 0.55],
  ];
  ctx.beginPath();
  for (const [x, y] of pts) {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
  }
  ctx.stroke();
}

// ---------------- vegetation & details ----------------

export type TreeKind = 'rain' | 'palm' | 'rubber' | 'oilpalm' | 'mangrove' | 'shade';

export function tree(ctx: Ctx, x: number, y: number, s: number, kind: TreeKind, rng: Rng) {
  const trunk = kind === 'rubber' ? '#9a8f7a' : '#5b3b22';
  if (kind === 'palm' || kind === 'oilpalm') {
    ctx.strokeStyle = kind === 'palm' ? '#7a5a3a' : '#5b4630';
    ctx.lineWidth = Math.max(1.2, s * 0.12);
    const lean = rng.range(-0.25, 0.25) * s;
    const topX = x + lean;
    const topY = y - s * (kind === 'palm' ? 1.6 : 1.05);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.2, y - s * 0.8, topX, topY);
    ctx.stroke();
    const leaf = kind === 'palm' ? '#3f8f3a' : '#2f6e2a';
    ctx.strokeStyle = leaf;
    ctx.lineWidth = Math.max(1.2, s * 0.14);
    const n = kind === 'palm' ? 7 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const len = s * rng.range(0.6, 0.85);
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY + Math.sin(a) * len * 0.25 - s * 0.25, topX + Math.cos(a) * len, topY + Math.sin(a) * len * 0.45 + s * 0.15);
      ctx.stroke();
    }
    if (kind === 'oilpalm') {
      ctx.fillStyle = '#c0501f';
      ctx.beginPath();
      ctx.arc(topX, topY + s * 0.12, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (kind === 'mangrove') {
    ctx.strokeStyle = '#4a3523';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * s * 0.12, y);
      ctx.quadraticCurveTo(x + i * s * 0.2, y - s * 0.35, x, y - s * 0.45);
      ctx.stroke();
    }
    blob(ctx, x, y - s * 0.75, s * 0.5, s * 0.32, jitterRng('#2f6b3a', rng));
    return;
  }
  ctx.fillStyle = trunk;
  const th = kind === 'rain' ? s * 0.9 : s * 0.6;
  ctx.fillRect(x - s * 0.06, y - th, s * 0.12, th);
  const col = kind === 'rain' ? '#2d6a35' : kind === 'rubber' ? '#4f8a3c' : '#3f8a3f';
  const cy = y - th - s * 0.2;
  blob(ctx, x, cy, s * (kind === 'rain' ? 0.62 : 0.45), s * (kind === 'rain' ? 0.42 : 0.4), jitterRng(col, rng));
  blob(ctx, x - s * 0.22, cy + s * 0.08, s * 0.32, s * 0.24, jitterRng(shade(col, -0.12), rng));
  blob(ctx, x + s * 0.2, cy - s * 0.1, s * 0.3, s * 0.22, jitterRng(shade(col, 0.12), rng));
}

function jitterRng(c: string, rng: Rng) {
  return shade(c, rng.range(-0.08, 0.08));
}

export function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(color, 0.18);
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.45, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Speckle texture clipped to the footprint diamond. */
export function speckle(ctx: Ctx, f: Foot, colors: string[], n: number, rng: Rng, size = 1.6) {
  for (let i = 0; i < n; i++) {
    const u = rng.range(-1, 1);
    const v = rng.range(-1, 1);
    if (Math.abs(u) + Math.abs(v) > 0.95) continue;
    const x = f.cx + u * f.hw;
    const y = f.cy + v * f.hh;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, size, size * 0.7);
  }
}

/** Smoke puffs (static, drawn into the sprite). */
export function smoke(ctx: Ctx, x: number, y: number, s: number, rng: Rng) {
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(200,200,200,${0.5 - i * 0.1})`;
    ctx.beginPath();
    ctx.arc(x + i * s * 0.25 + rng.range(-1, 1), y - i * s * 0.35, s * (0.18 + i * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Little awning stall (pasar / bazaar). */
export function stall(ctx: Ctx, x: number, y: number, s: number, cloth: string) {
  const f: Foot = { cx: x, cy: y, hw: s * 0.5, hh: s * 0.25 };
  box(ctx, f, s * 0.25, wallColors('#8a5a32'));
  gableRoof(ctx, { ...f, cy: f.cy - s * 0.25 }, s * 0.22, cloth, true, 0, 1.25);
}

/** Flag on a pole. */
export function flag(ctx: Ctx, x: number, y: number, h: number, colors: string[]) {
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  const fh = h * 0.28;
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y - h + (fh / colors.length) * i, h * 0.45, fh / colors.length);
  });
}

/** A small boat for harbours and rivers. */
export function boat(ctx: Ctx, x: number, y: number, s: number, hull: string, sail?: string) {
  poly(ctx, [x - s, y - s * 0.15, x + s, y - s * 0.15, x + s * 0.7, y + s * 0.2, x - s * 0.7, y + s * 0.2], hull, shade(hull, -0.5), 0.6);
  if (sail) {
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.15);
    ctx.lineTo(x, y - s * 1.4);
    ctx.stroke();
    poly(ctx, [x + 1, y - s * 1.35, x + s * 0.85, y - s * 0.3, x + 1, y - s * 0.3], sail, shade(sail, -0.4), 0.6);
  }
}
