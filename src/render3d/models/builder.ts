import type { MatId } from './materials';
import type { Part, Vec3 } from './primitives';

/** Height of one storey in tile units (a tile is roughly 25 m across). */
export const STOREY = 0.14;

interface Xf {
  dx: number;
  dy: number;
  dz: number;
  ry: number;
}

/**
 * Fluent procedural modelling API. Coordinates are local to the model: the
 * footprint is centred on the origin, +Y is up and the front faces +Z.
 * `group()` nests a translated / Y-rotated frame for sub-assemblies.
 */
export class ModelBuilder {
  readonly parts: Part[] = [];
  private stack: Xf[] = [];

  private xf(p: Vec3, r?: Vec3): { p: Vec3; r?: Vec3 } {
    let pos: Vec3 = p;
    let rot = r;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const t = this.stack[i];
      const c = Math.cos(t.ry);
      const s = Math.sin(t.ry);
      pos = [pos[0] * c + pos[2] * s + t.dx, pos[1] + t.dy, -pos[0] * s + pos[2] * c + t.dz];
      if (t.ry) {
        if (rot && rot[2]) throw new Error('Z-rotated parts cannot be nested in a rotated group');
        rot = [rot?.[0] ?? 0, (rot?.[1] ?? 0) + t.ry, 0];
      }
    }
    return { p: pos, r: rot };
  }

  private add(part: Part) {
    const { p, r } = this.xf(part.p, part.r);
    const rr = r && (r[0] || r[1] || r[2]) ? (r.map((v) => Math.round(v * 1e6) / 1e6) as Vec3) : undefined;
    this.parts.push({ ...part, p, ...(rr ? { r: rr } : {}) } as Part);
    return this;
  }

  group(dx: number, dy: number, dz: number, ry: number, fn: (b: ModelBuilder) => void) {
    this.stack.push({ dx, dy, dz, ry });
    try {
      fn(this);
    } finally {
      this.stack.pop();
    }
    return this;
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, m: MatId, ry = 0) {
    return this.add({ t: 'box', p: [x, y, z], s: [w, h, d], r: ry ? [0, ry, 0] : undefined, m });
  }
  frustum(x: number, y: number, z: number, bw: number, bd: number, tw: number, td: number, h: number, m: MatId, ry = 0) {
    return this.add({ t: 'frustum', p: [x, y, z], s: [bw, bd, tw, td, h], r: ry ? [0, ry, 0] : undefined, m });
  }
  /** gable roof, ridge along local z (use ry = PI/2 for a ridge along x) */
  gable(x: number, y: number, z: number, w: number, h: number, d: number, m: MatId, ry = 0) {
    return this.add({ t: 'gable', p: [x, y, z], s: [w, h, d], r: ry ? [0, ry, 0] : undefined, m });
  }
  cyl(x: number, y: number, z: number, rb: number, rt: number, h: number, m: MatId, seg = 8, r?: Vec3, smooth = true) {
    return this.add({ t: 'cyl', p: [x, y, z], s: [rb, rt, h, seg], r, m, smooth });
  }
  /** horizontal cylinder along local x (axis = 'x') or z */
  hcyl(x: number, y: number, z: number, r: number, len: number, m: MatId, axis: 'x' | 'z' = 'x', seg = 8) {
    // a cylinder rotated about X lies along z; then rotate about Y for x
    const rot: Vec3 = axis === 'z' ? [Math.PI / 2, 0, 0] : [Math.PI / 2, Math.PI / 2, 0];
    const off: Vec3 = axis === 'z' ? [x, y, z - len / 2] : [x - len / 2, y, z];
    return this.add({ t: 'cyl', p: off, s: [r, r, len, seg], r: rot, m, smooth: true });
  }
  sphere(x: number, y: number, z: number, rx: number, ry: number, rz: number, m: MatId, seg = 10, rings = 5, hemi = false) {
    return this.add({ t: 'sphere', p: [x, y, z], s: [rx, ry, rz, seg, rings, hemi ? 1 : 0], m });
  }
  dome(x: number, y: number, z: number, r: number, h: number, m: MatId, seg = 12) {
    return this.sphere(x, y, z, r, h, r, m, seg, 4, true);
  }
  /** a slab rotated about X (for slanted panels, sails and ramps) */
  tilted(x: number, y: number, z: number, w: number, h: number, d: number, m: MatId, rx: number, ry = 0) {
    return this.add({ t: 'box', p: [x, y, z], s: [w, h, d], r: [rx, ry, 0], m });
  }
}

export type Builder = ModelBuilder;

// ---------------------------------------------------------------- helpers

/** Timber posts under a raised floor. */
export function stilts(b: Builder, x: number, z: number, w: number, d: number, h: number, m: MatId = 'timber_dark', y = 0) {
  const r = 0.018;
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) b.cyl(x + (sx * (w / 2 - r)), y, z + sz * (d / 2 - r), r, r, h, m, 5);
}

/** Small row of steps. */
export function stairs(b: Builder, x: number, z: number, h: number, m: MatId = 'timber', steps = 3) {
  for (let i = 0; i < steps; i++) b.box(x, 0, z + i * 0.03, 0.08, h * (1 - i / steps), 0.03, m);
}

/**
 * Traditional Malay house (rumah kampung) on stilts with a long gable roof
 * ("bumbung panjang"), crossed gable boards and an entrance stair.
 */
export function kampungHouse(b: Builder, x: number, z: number, opts: { w?: number; d?: number; roof?: MatId; wall?: MatId; ry?: number; lift?: number; anjung?: boolean } = {}) {
  const w = opts.w ?? 0.36;
  const d = opts.d ?? 0.5;
  const lift = opts.lift ?? 0.12;
  const roof = opts.roof ?? 'attap';
  const wall = opts.wall ?? 'timber';
  b.group(x, 0, z, opts.ry ?? 0, (g) => {
    stilts(g, 0, 0, w, d, lift);
    g.box(0, lift, 0, w + 0.02, 0.02, d + 0.02, 'timber_dark');
    g.box(0, lift + 0.02, 0, w, 0.15, d, wall);
    // windows
    g.box(0, lift + 0.07, d / 2 + 0.003, w * 0.6, 0.05, 0.006, 'window');
    g.box(w / 2 + 0.003, lift + 0.07, 0, 0.006, 0.05, d * 0.5, 'window');
    g.box(-w / 2 - 0.003, lift + 0.07, 0, 0.006, 0.05, d * 0.5, 'window');
    // bumbung panjang with overhang and gable boards (tebar layar)
    g.gable(0, lift + 0.17, 0, w + 0.14, 0.2, d + 0.1, roof);
    g.gable(0, lift + 0.17, d / 2 + 0.05, w * 0.8, 0.17, 0.012, 'timber_light');
    g.gable(0, lift + 0.17, -d / 2 - 0.05, w * 0.8, 0.17, 0.012, 'timber_light');
    // crossed finials (silang gunting)
    g.box(0, lift + 0.36, d / 2 + 0.05, 0.012, 0.05, 0.012, 'timber_dark');
    g.box(0, lift + 0.36, -d / 2 - 0.05, 0.012, 0.05, 0.012, 'timber_dark');
    if (opts.anjung) {
      // front verandah (serambi) with lower roof
      stilts(g, 0, d / 2 + 0.1, w * 0.8, 0.18, lift - 0.02);
      g.box(0, lift - 0.02, d / 2 + 0.1, w * 0.8, 0.02, 0.18, 'timber');
      g.gable(0, lift + 0.1, d / 2 + 0.1, w * 0.9, 0.1, 0.2, roof, Math.PI / 2);
      stairs(g, 0, d / 2 + 0.21, lift - 0.02);
    } else stairs(g, 0, d / 2 + 0.02, lift);
  });
}

/**
 * Nusantara multi-tiered pyramidal roof (as on Melaka palaces and the old
 * Kampung Hulu / Kampung Kling mosques), with a gold crown finial (mustaka).
 */
export function tieredRoof(b: Builder, x: number, y: number, z: number, w: number, d: number, tiers: number, m: MatId, finial: MatId = 'gold') {
  let cy = y;
  let cw = w;
  let cd = d;
  for (let i = 0; i < tiers; i++) {
    const h = 0.16 + 0.04 * (tiers - i);
    const tw = cw * 0.5;
    const td = cd * 0.5;
    b.frustum(x, cy, z, cw, cd, tw, td, h, m);
    cy += h;
    if (i < tiers - 1) {
      b.box(x, cy, z, tw * 0.9, 0.06, td * 0.9, 'timber_dark');
      cy += 0.06;
      cw = tw * 1.25;
      cd = td * 1.25;
    } else {
      b.frustum(x, cy, z, tw, td, 0, 0, 0.1, m);
      cy += 0.08;
    }
  }
  b.cyl(x, cy, z, 0.02, 0.008, 0.14, finial, 6);
  b.sphere(x, cy + 0.06, z, 0.025, 0.025, 0.025, finial, 8, 3);
  return cy + 0.14;
}

/** A horizontal band of window glass wrapping a box-shaped block, one per storey. */
export function windowBands(b: Builder, x: number, z: number, w: number, d: number, y0: number, floors: number, m: MatId = 'window', storey = STOREY, frac = 0.45) {
  const hh = storey * frac;
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * storey + (storey - hh) / 2;
    b.box(x, y, z + d / 2 + 0.003, w * 0.86, hh, 0.006, m);
    b.box(x, y, z - d / 2 - 0.003, w * 0.86, hh, 0.006, m);
    b.box(x + w / 2 + 0.003, y, z, 0.006, hh, d * 0.86, m);
    b.box(x - w / 2 - 0.003, y, z, 0.006, hh, d * 0.86, m);
  }
}

/** Arched window: a rectangle topped by a half-round (a cylinder sunk into the box). */
export function archWindow(b: Builder, x: number, y: number, z: number, w: number, h: number, m: MatId = 'window', axis: 'x' | 'z' = 'z') {
  if (axis === 'z') {
    b.box(x, y, z, w, h, 0.008, m);
    b.hcyl(x, y + h, z, w / 2, 0.008, m, 'z', 8);
  } else {
    b.box(x, y, z, 0.008, h, w, m);
    b.hcyl(x, y + h, z, w / 2, 0.008, m, 'x', 8);
  }
}

/**
 * Straits shophouse row ("rumah kedai"): pastel plaster facades, a recessed
 * ground-floor five-foot way behind columns, arched or shuttered upper
 * windows and a terracotta roof. Front faces +z.
 */
export function shophouseRow(b: Builder, x: number, z: number, opts: { units: number; floors: number; unitW?: number; depth?: number; colors?: MatId[]; arches?: boolean; roof?: MatId; ry?: number }) {
  const uw = opts.unitW ?? 0.22;
  const depth = opts.depth ?? 0.6;
  const fh = 0.16;
  const colors = opts.colors ?? ['plaster_cream', 'plaster_mint', 'plaster_pink', 'plaster_blue', 'plaster_yellow'];
  const total = uw * opts.units;
  b.group(x, 0, z, opts.ry ?? 0, (g) => {
    for (let u = 0; u < opts.units; u++) {
      const ux = -total / 2 + uw * (u + 0.5);
      const col = colors[u % colors.length];
      // ground floor set back for the five-foot way
      g.box(ux, 0, -0.06, uw - 0.004, fh, depth - 0.12, col);
      g.box(ux, 0.02, depth / 2 - 0.12 + 0.003, uw * 0.6, fh * 0.7, 0.006, 'timber_dark');
      // upper floors overhang the walkway
      g.box(ux, fh, 0, uw - 0.004, fh * (opts.floors - 1), depth, col);
      for (let f = 1; f < opts.floors; f++) {
        const y = fh * f + 0.03;
        if (opts.arches) {
          archWindow(g, ux - uw * 0.22, y, depth / 2 + 0.004, 0.045, 0.06);
          archWindow(g, ux + uw * 0.22, y, depth / 2 + 0.004, 0.045, 0.06);
        } else {
          g.box(ux - uw * 0.22, y, depth / 2 + 0.004, 0.05, 0.08, 0.008, 'window');
          g.box(ux + uw * 0.22, y, depth / 2 + 0.004, 0.05, 0.08, 0.008, 'window');
        }
        g.box(ux, y + 0.1, depth / 2 + 0.006, uw - 0.02, 0.012, 0.012, 'plaster_white');
      }
      // five-foot way columns
      g.box(ux - uw / 2 + 0.012, 0, depth / 2 - 0.02, 0.024, fh, 0.024, 'plaster_white');
      // decorative parapet pediment
      g.box(ux, fh * opts.floors, depth / 2 - 0.02, uw - 0.02, 0.05, 0.03, col);
    }
    g.box(total / 2 - 0.012, 0, depth / 2 - 0.02, 0.024, fh, 0.024, 'plaster_white');
    g.gable(0, fh * opts.floors, -0.02, depth - 0.04, 0.16, total, opts.roof ?? 'terracotta', Math.PI / 2);
  });
}

export function roundTree(b: Builder, x: number, z: number, s = 1, m: MatId = 'foliage', y = 0) {
  b.cyl(x, y, z, 0.02 * s, 0.015 * s, 0.14 * s, 'trunk', 5);
  b.sphere(x, y + 0.1 * s, z, 0.1 * s, 0.09 * s, 0.1 * s, m, 7, 4);
}

export function palmTree(b: Builder, x: number, z: number, h = 0.5, y = 0, lean = 0.06) {
  b.cyl(x, y, z, 0.022, 0.014, h, 'trunk_pale', 5);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.group(x + Math.cos(a) * 0.02 + lean * 0.3, y + h - 0.02, z + Math.sin(a) * 0.02, Math.PI / 2 - a, (g) => g.tilted(0, 0, 0.02, 0.05, 0.012, 0.17, 'palm', 0.35));
  }
  b.sphere(x + lean * 0.3, y + h - 0.03, z, 0.035, 0.03, 0.035, 'palm', 6, 3);
}

/** Oil palm: short thick trunk with a dense, drooping crown. */
export function oilPalm(b: Builder, x: number, z: number, s = 1, y = 0) {
  b.cyl(x, y, z, 0.035 * s, 0.03 * s, 0.18 * s, 'trunk', 6);
  b.sphere(x, y + 0.14 * s, z, 0.12 * s, 0.08 * s, 0.12 * s, 'palm', 8, 3);
  b.sphere(x, y + 0.2 * s, z, 0.06 * s, 0.05 * s, 0.06 * s, 'foliage_light', 6, 3);
}

/** Hevea rubber tree: slim pale trunk, high narrow crown. */
export function rubberTree(b: Builder, x: number, z: number, s = 1, y = 0) {
  b.cyl(x, y, z, 0.016 * s, 0.012 * s, 0.26 * s, 'trunk_pale', 5);
  b.sphere(x, y + 0.24 * s, z, 0.07 * s, 0.09 * s, 0.07 * s, 'foliage_dark', 7, 4);
}

export function chimney(b: Builder, x: number, z: number, r: number, h: number, m: MatId = 'brick', y = 0) {
  b.cyl(x, y, z, r, r * 0.8, h, m, 8);
  b.cyl(x, y + h, z, r * 0.95, r * 0.95, 0.03, 'iron_black', 8);
}

export function tank(b: Builder, x: number, z: number, r: number, h: number, m: MatId = 'steel', y = 0) {
  b.cyl(x, y, z, r, r, h, m, 12);
  b.dome(x, y + h, z, r, r * 0.3, m, 12);
}

/** Lattice crane / gantry silhouette. */
export function gantryCrane(b: Builder, x: number, z: number, h: number, reach: number, m: MatId = 'paint_orange', ry = 0) {
  b.group(x, 0, z, ry, (g) => {
    for (const sx of [-0.08, 0.08]) for (const sz of [-0.12, 0.12]) g.box(sx, 0, sz, 0.025, h, 0.025, m);
    g.box(0, h, 0, 0.2, 0.04, 0.3, m);
    g.box(0, h + 0.04, reach / 2 - 0.1, 0.05, 0.04, reach + 0.3, m);
    g.box(0, h - 0.12, reach - 0.1, 0.04, 0.12, 0.04, 'steel_dark');
  });
}

/** A fenced plot boundary. */
export function fence(b: Builder, w: number, d: number, m: MatId = 'timber_dark', h = 0.05) {
  const t = 0.01;
  b.box(0, 0, -d / 2, w, h, t, m);
  b.box(0, 0, d / 2, w, h, t, m);
  b.box(-w / 2, 0, 0, t, h, d, m);
  b.box(w / 2, 0, 0, t, h, d, m);
}

/** Ground pad covering a footprint (slightly inset). */
export function pad(b: Builder, size: number, m: MatId, h = 0.02, inset = 0.04) {
  b.box(0, 0, 0, size - inset, h, size - inset, m);
}
