/**
 * Procedural 3D architecture for every building in `core/data/buildings.ts`.
 * Each model fills a size x size footprint centred on the origin; +Z is the
 * front (and, for waterside buildings, the side that faces the water).
 */
import {
  Builder,
  STOREY,
  archWindow,
  chimney,
  gantryCrane,
  kampungHouse,
  oilPalm,
  pad,
  palmTree,
  roundTree,
  rubberTree,
  stairs,
  stilts,
  tank,
  tieredRoof,
  windowBands,
} from './builder';
import type { MatId } from './materials';

type Draw = (b: Builder) => void;

// ---------------------------------------------------------------- shared bits

function jettyDeck(b: Builder, x: number, z: number, w: number, len: number, y = 0.06) {
  b.box(x, y, z + len / 2, w, 0.025, len, 'timber');
  for (let k = 0; k <= len / 0.18; k++)
    for (const sx of [-1, 1]) b.cyl(x + sx * (w / 2 - 0.015), -0.35, z + k * 0.18, 0.016, 0.016, y + 0.35, 'timber_dark', 5);
}

/** Malay trading ship (jong) with two tanja / lug sails. */
export function jongShip(b: Builder, x: number, y: number, z: number, s = 1, ry = 0) {
  b.group(x, y, z, ry, (g) => {
    g.frustum(0, -0.04 * s, 0, 0.12 * s, 0.5 * s, 0.2 * s, 0.72 * s, 0.09 * s, 'timber_dark');
    g.box(0, 0.05 * s, 0, 0.18 * s, 0.015 * s, 0.6 * s, 'timber');
    g.box(0, 0.065 * s, -0.2 * s, 0.14 * s, 0.07 * s, 0.16 * s, 'timber');
    for (const [mz, mh] of [[0.06, 0.55], [-0.12, 0.42]] as const) {
      g.cyl(0, 0.05 * s, mz * s, 0.008 * s, 0.006 * s, mh * s, 'timber_dark', 5);
      g.tilted(0, 0.14 * s, mz * s + 0.02 * s, 0.01 * s, mh * 0.62 * s, 0.24 * s, 'sail', -0.12);
    }
  });
}

/** Chinese junk with battened red sails and a high stern. */
export function junkShip(b: Builder, x: number, y: number, z: number, s = 1, ry = 0) {
  b.group(x, y, z, ry, (g) => {
    g.frustum(0, -0.04 * s, 0, 0.14 * s, 0.48 * s, 0.22 * s, 0.7 * s, 0.1 * s, 'timber_dark');
    g.box(0, 0.06 * s, -0.25 * s, 0.2 * s, 0.1 * s, 0.14 * s, 'paint_red');
    for (const [mz, mh] of [[0.12, 0.5], [-0.06, 0.6]] as const) {
      g.cyl(0, 0.06 * s, mz * s, 0.008 * s, 0.006 * s, mh * s, 'timber_dark', 5);
      g.box(0, 0.16 * s, mz * s, 0.012 * s, mh * 0.75 * s, 0.22 * s, 'sail_red');
      for (let k = 0; k < 4; k++) g.box(0, (0.2 + k * 0.1) * mh * s * 1.6, mz * s, 0.016 * s, 0.008 * s, 0.23 * s, 'timber_dark');
    }
  });
}

function crates(b: Builder, x: number, z: number, n: number, m: MatId = 'timber_light') {
  for (let i = 0; i < n; i++) b.box(x + (i % 3) * 0.07, Math.floor(i / 3) * 0.06, z + ((i * 7) % 3) * 0.02, 0.06, 0.06, 0.06, m);
}

function containerStack(b: Builder, x: number, z: number, cols: number, rows: number, levels: number) {
  const mats: MatId[] = ['paint_red', 'paint_blue', 'paint_green', 'paint_orange', 'steel', 'paint_yellow'];
  let k = 0;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      for (let l = 0; l < levels - ((i + j) % 2); l++) b.box(x + i * 0.17, l * 0.07, z + j * 0.09, 0.16, 0.07, 0.08, mats[k++ % mats.length]);
}

/** Simple modern block with storey window bands and a roof slab. */
function block(b: Builder, x: number, z: number, w: number, d: number, floors: number, wall: MatId, win: MatId = 'window', y = 0) {
  b.box(x, y, z, w, floors * STOREY, d, wall);
  windowBands(b, x, z, w, d, y, floors, win);
  b.box(x, y + floors * STOREY, z, w + 0.02, 0.02, d + 0.02, 'concrete_dark');
}

function paddyPlots(b: Builder, size: number) {
  const n = size * 2;
  const cell = (size - 0.08) / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = -size / 2 + 0.04 + cell * (i + 0.5);
      const z = -size / 2 + 0.04 + cell * (j + 0.5);
      b.box(x, 0, z, cell, 0.012, cell, 'mud');
      b.box(x, 0.012, z, cell - 0.04, 0.025, cell - 0.04, (i + j) % 3 === 0 ? 'foliage_light' : 'paddy');
    }
}

// ---------------------------------------------------------------- Era 1

const ERA1: Record<string, Draw> = {
  pasar: (b) => {
    pad(b, 2, 'dirt', 0.015);
    for (const [x, z, r] of [[-0.5, -0.45, 0], [0.45, -0.5, 0], [-0.45, 0.45, 1], [0.5, 0.4, 1], [0, 0, 0]] as const) {
      b.group(x, 0, z, r * (Math.PI / 2), (g) => {
        for (const sx of [-0.2, 0.2]) for (const sz of [-0.14, 0.14]) g.cyl(sx, 0, sz, 0.012, 0.012, 0.14, 'bamboo', 5);
        g.box(0, 0.05, 0, 0.36, 0.02, 0.26, 'timber');
        g.gable(0, 0.14, 0, 0.5, 0.12, 0.34, 'attap', Math.PI / 2);
        crates(g, -0.1, -0.05, 4, 'bamboo');
      });
    }
    b.sphere(0.2, 0.02, 0.15, 0.05, 0.04, 0.05, 'paint_yellow', 6, 3);
    palmTree(b, -0.85, -0.85, 0.55);
    palmTree(b, 0.85, 0.82, 0.48);
  },
  jeti: (b) => {
    b.box(0, 0, -0.25, 0.9, 0.04, 0.4, 'dirt');
    jettyDeck(b, 0, -0.1, 0.18, 0.9);
    b.box(0, 0.085, 0.75, 0.4, 0.025, 0.1, 'timber');
    crates(b, -0.3, -0.35, 5);
    b.cyl(0.07, 0.08, 0.7, 0.012, 0.012, 0.06, 'timber_dark', 5);
  },
  pelabuhan: (b) => {
    pad(b, 2, 'gravel', 0.02);
    // long timber wharf reaching into the Straits
    jettyDeck(b, -0.5, 0.2, 0.22, 1.2);
    jettyDeck(b, 0.45, 0.4, 0.22, 1.0);
    b.box(0, 0.06, 0.75, 1.3, 0.025, 0.18, 'timber');
    // godowns
    for (const x of [-0.55, 0.05]) {
      b.box(x, 0, -0.5, 0.5, 0.18, 0.4, 'timber');
      b.gable(x, 0.18, -0.5, 0.48, 0.14, 0.6, 'attap', Math.PI / 2);
    }
    // syahbandar watchtower
    stilts(b, 0.7, -0.55, 0.16, 0.16, 0.38);
    b.box(0.7, 0.38, -0.55, 0.2, 0.1, 0.2, 'timber');
    b.frustum(0.7, 0.48, -0.55, 0.28, 0.28, 0, 0, 0.14, 'attap');
    crates(b, -0.2, 0.0, 6);
    jongShip(b, -0.15, -0.02, 1.25, 1.1, Math.PI / 2);
  },
  gudang: (b) => {
    pad(b, 1, 'dirt', 0.015);
    stilts(b, 0, 0, 0.7, 0.55, 0.08);
    b.box(0, 0.08, 0, 0.7, 0.24, 0.55, 'timber');
    b.box(0, 0.12, 0.28, 0.2, 0.17, 0.01, 'timber_dark');
    b.gable(0, 0.32, 0, 0.66, 0.2, 0.86, 'attap', Math.PI / 2);
    crates(b, -0.35, 0.3, 3);
  },
  sawah: (b) => {
    paddyPlots(b, 2);
    // a raised pondok (hut) on the bund
    stilts(b, 0.7, -0.7, 0.2, 0.2, 0.1);
    b.box(0.7, 0.1, -0.7, 0.2, 0.08, 0.2, 'bamboo');
    b.gable(0.7, 0.18, -0.7, 0.28, 0.1, 0.26, 'attap');
    palmTree(b, -0.88, 0.88, 0.5);
  },
  nelayan: (b) => {
    b.box(0, 0, -0.25, 0.9, 0.03, 0.45, 'sand');
    kampungHouse(b, -0.15, -0.2, { w: 0.3, d: 0.36, roof: 'attap', lift: 0.14 });
    jettyDeck(b, 0.28, 0.0, 0.1, 0.45);
    // racks for drying fish
    for (const x of [0.2, 0.35]) b.box(x, 0.06, -0.3, 0.01, 0.01, 0.2, 'bamboo');
    b.group(0.0, 0.0, 0.62, 0, (g) => {
      g.frustum(0, 0, 0, 0.06, 0.26, 0.1, 0.34, 0.04, 'timber_dark');
      g.box(0, 0.04, 0.0, 0.004, 0.12, 0.12, 'sail');
    });
  },
  pembalakan: (b) => {
    pad(b, 1, 'dirt', 0.015);
    for (let i = 0; i < 4; i++) b.hcyl(-0.15, 0.04 + (i % 2) * 0.07, -0.25 + i * 0.03 + Math.floor(i / 2) * 0.12, 0.035, 0.5, 'trunk', 'x', 6);
    b.box(0.25, 0, 0.15, 0.3, 0.12, 0.25, 'timber');
    b.gable(0.25, 0.12, 0.15, 0.34, 0.1, 0.3, 'attap');
    for (const [x, z] of [[-0.35, 0.3], [0.38, -0.35], [-0.38, -0.38]] as const) roundTree(b, x, z, 1.3, 'foliage_dark');
  },
  pendulang: (b) => {
    b.box(0, 0, 0, 0.9, 0.012, 0.9, 'mud');
    b.box(-0.1, 0.012, 0.05, 0.6, 0.01, 0.5, 'pond');
    for (const [x, z] of [[-0.25, 0.1], [0.05, -0.05], [0.15, 0.2]] as const) {
      b.cyl(x, 0.02, z, 0.025, 0.025, 0.05, 'fabric_blue', 5);
      b.sphere(x, 0.07, z, 0.02, 0.02, 0.02, 'timber_light', 5, 3);
      b.cyl(x + 0.04, 0.02, z, 0.06, 0.05, 0.012, 'timber', 8);
    }
    b.box(0.32, 0, -0.3, 0.2, 0.12, 0.16, 'bamboo');
    b.gable(0.32, 0.12, -0.3, 0.26, 0.08, 0.22, 'attap');
  },
  kebun_lada: (b) => {
    pad(b, 2, 'soil', 0.015);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        const x = -0.78 + i * 0.31;
        const z = -0.78 + j * 0.31;
        b.cyl(x, 0.015, z, 0.012, 0.012, 0.2, 'timber_dark', 4);
        b.cyl(x, 0.03, z, 0.05, 0.035, 0.18, 'foliage_dark', 6);
      }
    stilts(b, 0.75, 0.75, 0.22, 0.22, 0.1);
    b.box(0.75, 0.1, 0.75, 0.24, 0.1, 0.24, 'timber');
    b.gable(0.75, 0.2, 0.75, 0.32, 0.12, 0.3, 'attap');
  },
  relau_besi: (b) => {
    pad(b, 1, 'laterite', 0.02);
    // clay shaft furnace like the Sungai Batu tuyere furnaces
    b.cyl(-0.1, 0.02, 0, 0.16, 0.1, 0.3, 'laterite', 10);
    b.cyl(-0.1, 0.32, 0, 0.1, 0.08, 0.04, 'brick', 10);
    b.hcyl(0.1, 0.08, 0, 0.025, 0.2, 'brick', 'x', 6);
    b.box(0.3, 0, -0.2, 0.25, 0.14, 0.25, 'timber');
    b.gable(0.3, 0.14, -0.2, 0.3, 0.1, 0.3, 'attap');
    for (let i = 0; i < 3; i++) b.box(0.25 + i * 0.06, 0.02, 0.28, 0.05, 0.03, 0.1, 'iron_black');
  },
  limbungan: (b) => {
    pad(b, 2, 'sand', 0.02);
    // slipway with a jong under construction
    b.tilted(0, 0, 0.45, 0.4, 0.03, 1.1, 'timber', 0.05);
    b.group(0, 0.08, 0.35, 0, (g) => {
      g.frustum(0, 0, 0, 0.14, 0.6, 0.24, 0.85, 0.12, 'timber_dark');
      for (let k = -3; k <= 3; k++) g.box(0, 0.12, k * 0.12, 0.3, 0.02, 0.02, 'timber_light');
    });
    for (const sx of [-0.25, 0.25]) for (const sz of [0.0, 0.4, 0.8]) b.cyl(sx, 0, sz, 0.014, 0.014, 0.35, 'bamboo', 4);
    b.box(-0.55, 0, -0.55, 0.6, 0.18, 0.5, 'timber');
    b.gable(-0.55, 0.18, -0.55, 0.66, 0.16, 0.7, 'attap', Math.PI / 2);
    for (let i = 0; i < 4; i++) b.hcyl(0.55, 0.035 + (i % 2) * 0.06, -0.6 + i * 0.1, 0.03, 0.5, 'trunk', 'x', 6);
  },
  surau: (b) => {
    pad(b, 1, 'grass', 0.01);
    stilts(b, 0, 0, 0.5, 0.5, 0.1);
    b.box(0, 0.1, 0, 0.5, 0.18, 0.5, 'timber_light');
    b.box(0, 0.16, 0.253, 0.3, 0.08, 0.006, 'window');
    tieredRoof(b, 0, 0.28, 0, 0.66, 0.66, 2, 'attap');
    stairs(b, 0, 0.27, 0.1);
    b.cyl(0.38, 0, 0.35, 0.06, 0.06, 0.04, 'stone', 8);
  },
  masjid: (b) => {
    pad(b, 2, 'stone', 0.03);
    b.box(0, 0.03, 0, 1.2, 0.08, 1.2, 'stone');
    b.box(0, 0.11, 0, 1.0, 0.26, 1.0, 'plaster_white');
    for (const [x, z] of [[0, 0.505], [0, -0.505]] as const) for (const o of [-0.3, 0, 0.3]) archWindow(b, x + o, 0.15, z, 0.08, 0.1);
    for (const o of [-0.3, 0, 0.3]) {
      archWindow(b, 0.505, 0.15, o, 0.08, 0.1, 'window', 'x');
      archWindow(b, -0.505, 0.15, o, 0.08, 0.1, 'window', 'x');
    }
    // three-tiered Nusantara roof (as on Masjid Kampung Hulu, Melaka)
    tieredRoof(b, 0, 0.37, 0, 1.35, 1.35, 3, 'terracotta');
    // pagoda-like minaret
    b.group(0.75, 0, 0.75, 0, (g) => {
      g.box(0, 0, 0, 0.22, 0.6, 0.22, 'plaster_white');
      g.box(0, 0.6, 0, 0.26, 0.04, 0.26, 'plaster_white');
      g.box(0, 0.64, 0, 0.18, 0.18, 0.18, 'plaster_white');
      g.frustum(0, 0.82, 0, 0.3, 0.3, 0.02, 0.02, 0.2, 'terracotta');
    });
    palmTree(b, -0.82, 0.82, 0.5);
  },
  madrasah: (b) => {
    pad(b, 1, 'grass', 0.01);
    stilts(b, 0, -0.05, 0.62, 0.42, 0.1);
    b.box(0, 0.1, -0.05, 0.62, 0.18, 0.42, 'timber');
    for (const o of [-0.2, 0, 0.2]) b.box(o, 0.15, 0.163, 0.1, 0.08, 0.006, 'window');
    b.gable(0, 0.28, -0.05, 0.56, 0.2, 0.8, 'attap', Math.PI / 2);
    b.gable(0, 0.28, 0.16, 0.2, 0.14, 0.12, 'attap');
    stairs(b, 0, 0.18, 0.1);
  },
  balai: (b) => {
    pad(b, 1, 'grass', 0.01);
    kampungHouse(b, 0, -0.08, { w: 0.5, d: 0.5, roof: 'attap', wall: 'timber_dark', anjung: true });
    b.cyl(-0.38, 0, 0.38, 0.008, 0.008, 0.4, 'timber_dark', 4);
    b.box(-0.35, 0.33, 0.38, 0.06, 0.04, 0.004, 'paint_yellow');
  },
  menara_tinjau: (b) => {
    pad(b, 1, 'dirt', 0.015);
    for (const sx of [-0.12, 0.12]) for (const sz of [-0.12, 0.12]) b.cyl(sx, 0, sz, 0.02, 0.014, 0.72, 'timber_dark', 5);
    for (const y of [0.2, 0.45]) {
      b.box(0, y, -0.12, 0.26, 0.015, 0.015, 'timber');
      b.box(0, y, 0.12, 0.26, 0.015, 0.015, 'timber');
    }
    b.box(0, 0.72, 0, 0.36, 0.025, 0.36, 'timber');
    b.box(0, 0.745, 0.17, 0.36, 0.06, 0.015, 'timber');
    b.box(0, 0.745, -0.17, 0.36, 0.06, 0.015, 'timber');
    b.frustum(0, 0.85, 0, 0.44, 0.44, 0, 0, 0.2, 'attap');
    for (const sx of [-0.15, 0.15]) b.cyl(sx, 0.745, 0.15, 0.01, 0.01, 0.11, 'timber_dark', 4);
    b.cyl(0.05, 0.78, 0, 0.04, 0.04, 0.06, 'gold', 8);
    b.cyl(-0.3, 0, -0.32, 0.03, 0.03, 0.02, 'stone', 6);
  },
  taman: (b) => {
    pad(b, 1, 'grass', 0.015);
    for (const [x, z, s] of [[-0.25, -0.25, 1.2], [0.28, -0.2, 1], [-0.2, 0.3, 0.9]] as const) roundTree(b, x, z, s, 'foliage_light');
    b.box(0.2, 0.015, 0.25, 0.18, 0.03, 0.06, 'timber');
    b.cyl(0.05, 0.015, 0.0, 0.08, 0.08, 0.01, 'sand', 10);
  },
  candi: (b) => {
    pad(b, 2, 'grass', 0.015);
    // stepped laterite and brick base (Candi Bukit Batu Pahat style)
    b.box(0, 0.015, 0, 1.3, 0.12, 1.3, 'laterite');
    b.box(0, 0.135, 0, 1.0, 0.1, 1.0, 'brick');
    b.box(0, 0.235, 0, 0.62, 0.32, 0.62, 'brick');
    b.box(0, 0.12, 0.65, 0.22, 0.08, 0.3, 'laterite');
    b.box(0, 0.32, 0.315, 0.16, 0.18, 0.01, 'window');
    let y = 0.555;
    for (let k = 0; k < 4; k++) {
      const s = 0.6 - k * 0.12;
      b.box(0, y, 0, s, 0.08, s, k % 2 ? 'stone' : 'brick');
      y += 0.08;
    }
    b.cyl(0, y, 0, 0.06, 0.01, 0.2, 'stone', 8);
    for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]] as const) b.box(x, 0.135, z, 0.08, 0.14, 0.08, 'stone');
    roundTree(b, -0.85, 0.8, 1.4);
  },
  syahbandar: (b) => {
    pad(b, 1, 'stone', 0.02);
    b.box(0, 0.02, 0, 0.62, 0.08, 0.5, 'stone');
    b.box(0, 0.1, 0, 0.56, 0.2, 0.44, 'timber');
    b.box(0, 0.15, 0.223, 0.36, 0.08, 0.006, 'window');
    tieredRoof(b, 0, 0.3, 0, 0.72, 0.6, 2, 'terracotta');
    b.cyl(0.38, 0, 0.3, 0.008, 0.008, 0.5, 'timber_dark', 4);
    b.box(0.41, 0.42, 0.3, 0.06, 0.05, 0.004, 'fabric_red');
  },
  istana: (b) => {
    pad(b, 3, 'grass', 0.015);
    // the carved timber palace on tall posts (after the Istana Kesultanan Melaka reconstruction)
    b.box(0, 0.015, 0.1, 2.3, 0.04, 1.4, 'stone');
    const lift = 0.3;
    for (let i = -5; i <= 5; i++) for (const sz of [-0.55, 0.0, 0.55]) b.cyl(i * 0.2, 0.055, 0.1 + sz, 0.025, 0.025, lift, 'timber_dark', 6);
    b.box(0, 0.055 + lift, 0.1, 2.3, 0.04, 1.3, 'timber_dark');
    b.box(0, 0.095 + lift, 0.1, 2.1, 0.26, 1.1, 'timber');
    for (let i = -4; i <= 4; i++) b.box(i * 0.22, 0.15 + lift, 0.655, 0.1, 0.12, 0.008, 'window');
    // three stacked roof sections: central hall and two wings
    tieredRoof(b, 0, 0.35 + lift, 0.1, 1.2, 1.3, 3, 'timber_dark');
    for (const sx of [-0.8, 0.8]) {
      b.gable(sx, 0.35 + lift, 0.1, 1.25, 0.38, 0.65, 'timber_dark');
      b.gable(sx, 0.35 + lift, 0.1 + 0.62, 0.5, 0.32, 0.02, 'gold');
    }
    // grand stair and gate
    for (let k = 0; k < 6; k++) b.box(0, 0.055 + k * 0.05, 0.85 + k * -0.04 + 0.25, 0.4, 0.05, 0.06, 'timber');
    b.box(0, 0.015, 1.35, 0.5, 0.25, 0.08, 'plaster_white');
    b.box(0, 0.265, 1.35, 0.6, 0.06, 0.12, 'timber_dark');
    for (const x of [-1.2, 1.2]) palmTree(b, x, 1.2, 0.7);
    roundTree(b, -1.25, -1.2, 1.5);
    roundTree(b, 1.2, -1.25, 1.4);
  },
};

// ---------------------------------------------------------------- Era 2

const ERA2: Record<string, Draw> = {
  lombong: (b) => {
    // open-cast pit with terraced benches, a palong sluice and a kongsi house
    b.box(0, 0, 0, 1.9, 0.01, 1.9, 'laterite');
    b.frustum(-0.2, 0.01, -0.1, 1.3, 1.3, 1.0, 1.0, 0.02, 'mud');
    b.box(-0.2, 0.03, -0.1, 0.9, 0.01, 0.9, 'pond');
    // palong: an inclined timber sluice on trestles
    b.tilted(0.45, 0.25, 0.1, 0.12, 0.05, 1.5, 'timber', -0.25, 0.3);
    for (let k = 0; k < 5; k++) b.cyl(0.25 + k * 0.1, 0, -0.45 + k * 0.28, 0.012, 0.012, 0.1 + k * 0.08, 'timber_dark', 4);
    b.cyl(0.85, 0, 0.65, 0.03, 0.03, 0.15, 'steel', 6);
    b.box(-0.6, 0, 0.7, 0.5, 0.16, 0.36, 'timber');
    b.gable(-0.6, 0.16, 0.7, 0.4, 0.12, 0.56, 'tin_rust', Math.PI / 2);
    b.box(0.6, 0, -0.75, 0.3, 0.12, 0.25, 'tin_rust');
  },
  kapal_korek: (b) => {
    // mining pond with a floating bucket-ladder dredge (Tanjung Tualang type)
    b.box(0, 0, 0, 2.9, 0.03, 2.9, 'mud');
    b.box(0, 0.02, 0, 2.6, 0.015, 2.6, 'pond');
    b.group(0, 0.035, -0.1, 0, (g) => {
      g.box(0, 0, 0, 0.8, 0.12, 1.3, 'iron_black'); // pontoon
      g.box(0, 0.12, 0.05, 0.7, 0.36, 0.9, 'tin_rust');
      g.gable(0, 0.48, 0.05, 0.72, 0.18, 0.92, 'zinc');
      g.box(0, 0.48, -0.25, 0.4, 0.16, 0.3, 'tin_rust');
      g.gable(0, 0.64, -0.25, 0.42, 0.1, 0.32, 'zinc');
      // gantry and bucket ladder reaching into the pond
      g.box(-0.25, 0.48, 0.55, 0.04, 0.4, 0.04, 'steel_dark');
      g.box(0.25, 0.48, 0.55, 0.04, 0.4, 0.04, 'steel_dark');
      g.box(0, 0.86, 0.55, 0.56, 0.04, 0.05, 'steel_dark');
      g.tilted(0, -0.1, 0.95, 0.14, 0.06, 1.0, 'iron_black', -0.45);
      for (let k = 0; k < 7; k++) g.box(0, 0.05 + k * 0.06, 0.62 + k * 0.12, 0.16, 0.05, 0.06, 'tin_rust');
      // tailings stacker at the stern
      g.tilted(0, 0.3, -1.0, 0.1, 0.05, 0.9, 'steel_dark', 0.35);
      g.cyl(0.25, 0.48, -0.35, 0.04, 0.04, 0.3, 'iron_black', 6);
    });
    b.box(-0.7, 0.02, -1.05, 0.9, 0.08, 0.5, 'sand'); // tailings
  },
  estet_getah: (b) => {
    b.box(0, 0, 0, 2.9, 0.012, 2.9, 'soil');
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        if (i >= 5 && j >= 5) continue;
        rubberTree(b, -1.25 + i * 0.36, -1.25 + j * 0.36, 1.25 + ((i * 3 + j) % 3) * 0.1);
      }
    // rubber smokehouse and latex shed
    b.box(0.95, 0.012, 0.95, 0.5, 0.3, 0.4, 'timber_dark');
    b.gable(0.95, 0.31, 0.95, 0.44, 0.16, 0.56, 'tin_rust', Math.PI / 2);
    chimney(b, 1.12, 0.85, 0.035, 0.6, 'brick');
    b.box(0.6, 0.012, 1.2, 0.3, 0.12, 0.25, 'timber');
    b.gable(0.6, 0.13, 1.2, 0.34, 0.1, 0.3, 'zinc');
  },
  stesen: (b) => {
    pad(b, 2, 'gravel', 0.02);
    b.box(0, 0.02, 0.35, 1.9, 0.06, 0.3, 'concrete');
    b.box(0, 0.02, -0.25, 1.4, 0.24, 0.5, 'plaster_cream');
    for (let i = -3; i <= 3; i++) archWindow(b, i * 0.18, 0.08, 0.004, 0.07, 0.08);
    b.gable(0, 0.26, -0.25, 0.6, 0.18, 1.5, 'terracotta', Math.PI / 2);
    // platform canopy on cast iron columns
    for (let i = -4; i <= 4; i++) b.cyl(i * 0.2, 0.08, 0.42, 0.012, 0.012, 0.22, 'iron_black', 5);
    b.box(0, 0.3, 0.38, 1.85, 0.02, 0.32, 'zinc');
    // Moorish chattri on the clock tower
    b.box(0.75, 0.02, -0.25, 0.2, 0.55, 0.2, 'plaster_white');
    b.dome(0.75, 0.57, -0.25, 0.1, 0.12, 'plaster_white', 10);
    b.cyl(0.75, 0.38, -0.149, 0.05, 0.05, 0.005, 'paint_white', 10, [Math.PI / 2, 0, 0]);
  },
  pelabuhan_dagang: (b) => {
    pad(b, 3, 'concrete', 0.03);
    b.box(0, 0.03, 1.15, 2.8, 0.05, 0.5, 'concrete_dark');
    for (const x of [-0.85, 0.15]) {
      b.box(x, 0.03, -0.45, 0.85, 0.3, 0.7, 'tin_rust');
      b.gable(x, 0.33, -0.45, 0.8, 0.18, 0.92, 'zinc', Math.PI / 2);
    }
    b.box(1.0, 0.03, -0.6, 0.6, 0.45, 0.5, 'plaster_white');
    b.box(1.0, 0.48, -0.6, 0.64, 0.04, 0.54, 'terracotta');
    windowBands(b, 1.0, -0.6, 0.6, 0.5, 0.03, 3, 'window', 0.15);
    for (const x of [-1.0, 0.0, 0.9]) gantryCrane(b, x, 0.9, 0.5, 0.5, 'iron_black');
    crates(b, -0.3, 0.35, 6, 'timber');
    // steamship at the wharf
    b.group(0.1, -0.02, 1.65, Math.PI / 2, (g) => {
      g.frustum(0, -0.05, 0, 0.2, 1.2, 0.3, 1.5, 0.14, 'paint_black');
      g.box(0, 0.09, 0, 0.26, 0.02, 1.3, 'timber');
      g.box(0, 0.11, -0.1, 0.2, 0.14, 0.45, 'paint_white');
      g.cyl(0, 0.25, -0.05, 0.05, 0.05, 0.25, 'paint_red', 8);
      g.cyl(0, 0.1, 0.45, 0.01, 0.01, 0.4, 'timber_dark', 4);
    });
  },
  sekolah: (b) => {
    pad(b, 1, 'grass', 0.01);
    stilts(b, 0, -0.1, 0.74, 0.4, 0.12, 'concrete');
    b.box(0, 0.12, -0.1, 0.74, 0.2, 0.4, 'plaster_cream');
    for (let i = -2; i <= 2; i++) b.box(i * 0.14, 0.16, 0.103, 0.08, 0.1, 0.006, 'window');
    b.frustum(0, 0.32, -0.1, 0.84, 0.5, 0.5, 0.06, 0.18, 'zinc');
    b.cyl(0.3, 0, 0.3, 0.008, 0.008, 0.45, 'steel', 4);
    b.box(0.33, 0.37, 0.3, 0.06, 0.04, 0.004, 'fabric_blue');
  },
  hospital: (b) => {
    pad(b, 2, 'grass', 0.015);
    for (const [x, z, w, d] of [[0, -0.35, 1.6, 0.4], [-0.6, 0.3, 0.4, 0.8], [0.6, 0.3, 0.4, 0.8]] as const) {
      stilts(b, x, z, w, d, 0.08, 'concrete');
      b.box(x, 0.08, z, w, 0.36, d, 'plaster_white');
      windowBands(b, x, z, w, d, 0.08, 2, 'window', 0.18);
      b.frustum(x, 0.44, z, w + 0.1, d + 0.1, w * 0.6, d * 0.4, 0.18, 'terracotta');
    }
    b.box(0, 0.25, -0.12, 0.2, 0.2, 0.01, 'paint_white');
    b.box(0, 0.32, -0.11, 0.12, 0.04, 0.01, 'paint_red');
    b.box(0, 0.28, -0.11, 0.04, 0.12, 0.01, 'paint_red');
    roundTree(b, 0, 0.5, 1.3);
  },
  balai_polis: (b) => {
    pad(b, 1, 'gravel', 0.015);
    b.box(0, 0.015, -0.05, 0.7, 0.3, 0.5, 'plaster_white');
    b.box(0, 0.015, -0.05, 0.72, 0.08, 0.52, 'paint_blue');
    windowBands(b, 0, -0.05, 0.7, 0.5, 0.1, 1, 'window', 0.18);
    b.frustum(0, 0.315, -0.05, 0.8, 0.6, 0.5, 0.2, 0.16, 'roof_blue');
    b.cyl(0.35, 0.015, 0.35, 0.008, 0.008, 0.5, 'steel', 4);
    b.box(0.38, 0.43, 0.35, 0.06, 0.04, 0.004, 'paint_blue');
  },
  pejabat_pos: (b) => {
    pad(b, 1, 'stone', 0.015);
    b.box(0, 0.015, -0.05, 0.7, 0.32, 0.55, 'plaster_cream');
    for (const o of [-0.2, 0, 0.2]) archWindow(b, o, 0.07, 0.226, 0.08, 0.12);
    b.box(0, 0.335, -0.05, 0.74, 0.05, 0.59, 'plaster_white');
    b.gable(0, 0.385, -0.05, 0.55, 0.14, 0.74, 'terracotta', Math.PI / 2);
    // telegraph poles
    for (const x of [-0.4, 0.4]) {
      b.cyl(x, 0, 0.4, 0.008, 0.008, 0.5, 'timber_dark', 4);
      b.box(x, 0.45, 0.4, 0.12, 0.01, 0.01, 'timber_dark');
    }
  },
  bangunan_moorish: (b) => {
    pad(b, 3, 'stone', 0.02);
    // grand Indo-Saracenic railway station with onion domes and chattris
    b.box(0, 0.02, -0.25, 2.6, 0.5, 1.1, 'plaster_white');
    for (let i = -6; i <= 6; i++) archWindow(b, i * 0.19, 0.1, 0.305, 0.1, 0.15);
    for (let i = -6; i <= 6; i++) archWindow(b, i * 0.19, 0.32, 0.305, 0.08, 0.08);
    b.box(0, 0.52, -0.25, 2.66, 0.05, 1.16, 'plaster_cream');
    // arcade colonnade
    for (let i = -6; i <= 6; i++) b.box(i * 0.2, 0.02, 0.5, 0.04, 0.32, 0.04, 'plaster_white');
    b.box(0, 0.34, 0.45, 2.6, 0.05, 0.25, 'plaster_cream');
    // domes
    for (const [x, r, h] of [[-1.15, 0.16, 0.5], [1.15, 0.16, 0.5], [0, 0.26, 0.4]] as const) {
      b.box(x, 0.57, -0.25, r * 2, h, r * 2, 'plaster_white');
      b.cyl(x, 0.57 + h, -0.25, r * 1.05, r * 1.05, 0.04, 'plaster_cream', 12);
      b.sphere(x, 0.61 + h - r * 0.2, -0.25, r, r * 1.2, r, 'plaster_white', 12, 6);
      b.cyl(x, 0.61 + h + r * 2.1, -0.25, 0.01, 0.004, 0.12, 'gold', 4);
    }
    for (let i = -5; i <= 5; i += 2) {
      b.cyl(i * 0.2, 0.57, 0.1, 0.035, 0.035, 0.12, 'plaster_white', 8);
      b.dome(i * 0.2, 0.69, 0.1, 0.045, 0.06, 'plaster_white', 8);
    }
    // tracks and platform at the back
    b.box(0, 0.02, -1.1, 2.8, 0.03, 0.5, 'gravel');
    b.box(0, 0.05, -1.0, 2.8, 0.015, 0.05, 'steel');
    b.box(0, 0.05, -1.2, 2.8, 0.015, 0.05, 'steel');
    palmTree(b, -1.3, 1.25, 0.7);
    palmTree(b, 1.3, 1.25, 0.65);
  },
};

// ---------------------------------------------------------------- Era 3

const ERA3: Record<string, Draw> = {
  janakuasa: (b) => {
    pad(b, 2, 'concrete', 0.02);
    b.box(-0.25, 0.02, 0.1, 0.9, 0.55, 0.9, 'concrete');
    windowBands(b, -0.25, 0.1, 0.9, 0.9, 0.05, 3, 'window', 0.16, 0.3);
    b.box(-0.25, 0.57, 0.1, 0.92, 0.03, 0.92, 'concrete_dark');
    chimney(b, 0.55, -0.55, 0.09, 1.4, 'concrete');
    for (let k = 0; k < 3; k++) b.cyl(0.55, 0.3 + k * 0.4, -0.55, 0.095, 0.095, 0.05, 'paint_red', 10);
    chimney(b, 0.55, 0.0, 0.07, 1.0, 'concrete');
    tank(b, 0.55, 0.6, 0.18, 0.3, 'steel');
    // cooling tower
    b.cyl(-0.6, 0.02, -0.65, 0.3, 0.2, 0.5, 'concrete', 14);
    b.cyl(-0.6, 0.52, -0.65, 0.2, 0.24, 0.2, 'concrete', 14);
  },
  empangan: (b) => {
    // gravity dam wall across the river with a spillway and powerhouse
    b.box(0, 0, 0, 1.9, 0.02, 1.9, 'concrete_dark');
    b.frustum(0, 0.02, 0, 1.9, 0.7, 1.9, 0.18, 0.55, 'concrete');
    b.box(0, 0.57, 0, 1.9, 0.04, 0.22, 'concrete_dark');
    for (let i = -2; i <= 2; i++) b.tilted(i * 0.3, 0.1, 0.45, 0.16, 0.02, 0.5, 'pond', 0.7);
    b.box(-0.2, -0.1, -0.7, 1.7, 0.6, 0.5, 'pond');
    b.box(0.6, 0.02, 0.75, 0.5, 0.3, 0.3, 'plaster_white');
    windowBands(b, 0.6, 0.75, 0.5, 0.3, 0.05, 1, 'window', 0.2);
    for (const x of [-0.9, 0.9]) b.cyl(x, 0.57, 0, 0.012, 0.012, 0.15, 'steel', 4);
  },
  loji_air: (b) => {
    pad(b, 2, 'concrete', 0.02);
    for (const [x, z] of [[-0.5, -0.5], [0.1, -0.5], [-0.5, 0.15]] as const) {
      b.box(x, 0.02, z, 0.5, 0.08, 0.5, 'concrete');
      b.box(x, 0.06, z, 0.44, 0.02, 0.44, 'pond');
    }
    tank(b, 0.6, 0.45, 0.2, 0.4, 'paint_white');
    b.box(0.25, 0.02, 0.5, 0.5, 0.22, 0.35, 'plaster_white');
    windowBands(b, 0.25, 0.5, 0.5, 0.35, 0.05, 1, 'window', 0.18);
    b.box(0.25, 0.24, 0.5, 0.54, 0.03, 0.39, 'roof_blue');
    b.hcyl(0.2, 0.08, 0.15, 0.03, 0.8, 'steel', 'x', 6);
  },
  ladang_sawit: (b) => {
    b.box(0, 0, 0, 2.9, 0.012, 2.9, 'soil');
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        if (i >= 4 && j >= 4) continue;
        oilPalm(b, -1.2 + i * 0.44 + (j % 2) * 0.12, -1.2 + j * 0.44, 1.3);
      }
    // FELDA settler homes: timber houses on short stilts with zinc roofs
    for (const [x, z] of [[0.75, 0.75], [1.2, 0.95], [0.85, 1.25]] as const) {
      stilts(b, x, z, 0.3, 0.26, 0.08, 'concrete');
      b.box(x, 0.08, z, 0.3, 0.14, 0.26, 'plaster_cream');
      b.box(x, 0.11, z + 0.133, 0.14, 0.06, 0.006, 'window');
      b.gable(x, 0.22, z, 0.36, 0.12, 0.32, 'zinc');
    }
    b.box(1.2, 0.012, 0.55, 0.18, 0.1, 0.14, 'paint_red');
  },
  ftz: (b) => {
    pad(b, 3, 'concrete', 0.02);
    // Bayan Lepas-style semiconductor plants: long white blocks with blue glass
    for (const [x, z, w, d] of [[-0.65, -0.55, 1.4, 1.2], [0.75, -0.55, 1.1, 1.2]] as const) {
      b.box(x, 0.02, z, w, 0.4, d, 'paint_white');
      b.box(x, 0.12, z + d / 2 + 0.003, w * 0.9, 0.16, 0.006, 'glass_dark');
      b.box(x, 0.42, z, w * 0.9, 0.05, d * 0.8, 'steel');
      for (let k = 0; k < 3; k++) b.box(x - w / 3 + k * (w / 3), 0.47, z, 0.12, 0.08, 0.12, 'steel_dark');
    }
    b.box(-0.2, 0.02, 0.75, 1.2, 0.55, 0.5, 'glass_dark');
    b.box(-0.2, 0.57, 0.75, 1.24, 0.03, 0.54, 'paint_white');
    b.box(0.85, 0.02, 0.8, 0.8, 0.02, 0.6, 'asphalt');
    for (let k = 0; k < 5; k++) b.box(0.6 + k * 0.12, 0.04, 0.7, 0.07, 0.04, 0.12, (['paint_red', 'paint_blue', 'paint_white', 'steel', 'paint_black'] as const)[k]);
    b.cyl(1.2, 0.02, 1.2, 0.012, 0.012, 0.7, 'steel', 4);
  },
  kilang_kereta: (b) => {
    pad(b, 3, 'concrete', 0.02);
    // sawtooth-roofed assembly hall
    b.box(-0.2, 0.02, -0.3, 2.2, 0.4, 1.6, 'paint_white');
    for (let k = 0; k < 7; k++) b.gable(-1.15 + k * 0.32 + 0.16, 0.42, -0.3, 0.32, 0.16, 1.6, k % 2 ? 'roof_blue' : 'steel');
    b.box(-0.2, 0.08, 0.503, 2.0, 0.12, 0.006, 'glass_dark');
    b.box(1.15, 0.02, -0.6, 0.5, 0.6, 0.5, 'concrete');
    chimney(b, 1.2, 0.2, 0.06, 0.9, 'steel');
    // finished cars in the yard
    const cols: MatId[] = ['paint_red', 'paint_blue', 'paint_white', 'steel', 'paint_yellow'];
    for (let i = 0; i < 10; i++) {
      const x = -1.2 + (i % 5) * 0.2;
      const z = 0.85 + Math.floor(i / 5) * 0.28;
      b.box(x, 0.02, z, 0.09, 0.04, 0.17, cols[i % cols.length]);
      b.box(x, 0.06, z - 0.01, 0.08, 0.03, 0.09, 'glass_dark');
    }
    b.box(0.6, 0.02, 1.0, 1.2, 0.015, 0.7, 'asphalt');
  },
  pelabuhan_kontena: (b) => {
    pad(b, 3, 'asphalt', 0.03);
    b.box(0, 0.03, 1.2, 2.9, 0.04, 0.5, 'concrete');
    for (const x of [-1.0, 0.0, 1.0]) gantryCrane(b, x, 1.0, 0.9, 0.9, x === 0 ? 'paint_red' : 'paint_orange');
    containerStack(b, -1.3, -1.2, 8, 6, 4);
    containerStack(b, -1.3, -0.1, 6, 3, 3);
    b.box(1.0, 0.03, -0.9, 0.5, 0.5, 0.5, 'paint_white');
    windowBands(b, 1.0, -0.9, 0.5, 0.5, 0.05, 3, 'glass', 0.15);
    // container ship at the berth
    b.group(0.0, -0.02, 1.8, Math.PI / 2, (g) => {
      g.frustum(0, -0.06, 0, 0.36, 2.0, 0.46, 2.4, 0.16, 'paint_red');
      g.box(0, 0.1, 0, 0.44, 0.02, 2.1, 'paint_black');
      g.box(0, 0.12, -0.95, 0.4, 0.3, 0.2, 'paint_white');
      containerStack(g, -0.16, -0.7, 3, 4, 3);
      containerStack(g, -0.16, 0.0, 3, 5, 2);
    });
  },
  universiti: (b) => {
    pad(b, 3, 'grass', 0.015);
    // modernist campus with a clock tower and lecture halls
    block(b, -0.6, -0.6, 1.2, 0.6, 4, 'plaster_white', 'window', 0.015);
    block(b, 0.7, -0.3, 0.6, 1.2, 3, 'plaster_cream', 'window', 0.015);
    b.box(-0.6, 0.015, 0.6, 1.0, 0.3, 0.7, 'concrete');
    b.dome(-0.6, 0.315, 0.6, 0.35, 0.18, 'roof_blue', 14);
    b.box(0.3, 0.015, 0.75, 0.2, 1.2, 0.2, 'plaster_white');
    b.frustum(0.3, 1.215, 0.75, 0.24, 0.24, 0.02, 0.02, 0.3, 'roof_blue');
    b.cyl(0.3, 0.95, 0.851, 0.07, 0.07, 0.005, 'paint_white', 10, [Math.PI / 2, 0, 0]);
    for (const [x, z] of [[1.2, 1.1], [0.9, 1.25], [-1.25, 0.1]] as const) roundTree(b, x, z, 1.4);
  },
  klinik_desa: (b) => {
    pad(b, 1, 'grass', 0.01);
    stilts(b, 0, -0.05, 0.66, 0.46, 0.08, 'concrete');
    b.box(0, 0.08, -0.05, 0.66, 0.18, 0.46, 'plaster_white');
    b.box(0, 0.08, -0.05, 0.67, 0.05, 0.47, 'paint_blue');
    windowBands(b, 0, -0.05, 0.66, 0.46, 0.13, 1, 'window', 0.1);
    b.gable(0, 0.26, -0.05, 0.56, 0.14, 0.76, 'zinc', Math.PI / 2);
    b.box(0, 0.12, 0.19, 0.12, 0.12, 0.01, 'paint_red');
  },
  tebatan_banjir: (b) => {
    // flood mitigation barrage: concrete piers, steel radial gates and a control house
    b.box(0, 0, 0, 1.9, 0.03, 1.9, 'concrete_dark');
    b.box(0, -0.2, 0.05, 1.9, 0.18, 0.9, 'pond');
    for (let i = 0; i < 6; i++) {
      const x = -0.9 + i * 0.36;
      b.box(x, -0.2, 0.05, 0.1, 0.62, 0.6, 'concrete');
      if (i < 5) b.box(x + 0.18, 0.05, 0.12, 0.26, 0.24, 0.04, 'steel');
    }
    b.box(0, 0.42, 0.05, 1.9, 0.05, 0.4, 'concrete');
    for (let i = -4; i <= 4; i++) b.cyl(i * 0.2, 0.47, 0.24, 0.006, 0.006, 0.08, 'steel', 4);
    b.box(0.6, 0.03, -0.65, 0.5, 0.28, 0.35, 'plaster_white');
    windowBands(b, 0.6, -0.65, 0.5, 0.35, 0.06, 1, 'glass', 0.2);
    b.box(0.6, 0.31, -0.65, 0.54, 0.03, 0.39, 'roof_blue');
    for (const x of [-0.9, 0.9]) b.box(x, 0.03, -0.6, 0.15, 0.3, 0.6, 'concrete');
  },
  parlimen: (b) => {
    pad(b, 3, 'grass', 0.015);
    // modernist podium with a pointed folded-plate roof and an 18-storey tower
    b.box(-0.4, 0.015, 0.25, 1.8, 0.3, 1.1, 'paint_white');
    for (let i = -8; i <= 8; i++) b.box(-0.4 + i * 0.1, 0.015, 0.81, 0.03, 0.3, 0.03, 'concrete');
    b.box(-0.4, 0.12, 0.802, 1.7, 0.12, 0.006, 'glass_dark');
    for (let i = 0; i < 11; i++) b.frustum(-1.2 + i * 0.16, 0.315, 0.25, 0.16, 1.0, 0.02, 0.02, 0.28, 'concrete');
    b.box(0.85, 0.015, -0.65, 0.6, 18 * STOREY * 0.75, 0.45, 'plaster_white');
    for (let f = 0; f < 18; f++) b.box(0.85, 0.06 + f * STOREY * 0.75, -0.42, 0.56, 0.045, 0.01, 'glass_dark');
    for (let f = 0; f < 18; f++) b.box(0.85, 0.06 + f * STOREY * 0.75, -0.88, 0.56, 0.045, 0.01, 'glass_dark');
    b.box(0.85, 0.015 + 18 * STOREY * 0.75, -0.65, 0.64, 0.05, 0.49, 'concrete');
    for (let i = 0; i < 6; i++) b.box(0.6 + i * 0.1, 0.015, -0.4, 0.015, 18 * STOREY * 0.75, 0.015, 'paint_white');
    b.cyl(-1.25, 0.015, 1.2, 0.01, 0.01, 0.8, 'steel', 4);
    b.box(-1.18, 0.65, 1.2, 0.14, 0.08, 0.005, 'fabric_blue');
    b.box(-0.6, 0.015, -0.7, 0.8, 0.012, 0.5, 'pond');
    for (const [x, z] of [[1.25, 1.2], [0.8, 1.25], [-1.2, -1.2]] as const) roundTree(b, x, z, 1.4);
  },
  stadium: (b) => {
    pad(b, 3, 'concrete', 0.015);
    // open-air bowl with a cantilevered stand roof
    b.cyl(0, 0.015, 0, 1.4, 1.42, 0.32, 'concrete', 20);
    b.cyl(0, 0.33, 0, 1.0, 1.0, 0.005, 'grass', 20);
    b.box(0, 0.335, 0, 0.9, 0.004, 0.5, 'grass');
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      b.group(Math.cos(a) * 1.2, 0.33, Math.sin(a) * 1.2, Math.PI / 2 - a, (g) => g.tilted(0, 0, 0, 0.36, 0.03, 0.4, k % 2 ? 'paint_red' : 'paint_yellow', -0.5));
    }
    b.box(0, 0.33, -1.2, 1.2, 0.05, 0.4, 'roof_green');
    for (const x of [-0.5, 0, 0.5]) b.cyl(x, 0.33, -1.38, 0.02, 0.02, 0.4, 'steel', 6);
    b.box(0, 0.75, -1.25, 1.4, 0.03, 0.5, 'roof_green');
    for (const [x, z] of [[1.0, 1.0], [-1.0, 1.0], [1.0, -1.0], [-1.0, -1.0]] as const) {
      b.cyl(x, 0.015, z, 0.02, 0.02, 1.0, 'steel', 4);
      b.box(x, 1.0, z, 0.14, 0.08, 0.04, 'lamp');
    }
  },
};

// ---------------------------------------------------------------- Era 4

/** Faceted tower floor plan as stacked rotated square slabs (eight-pointed star). */
function starTower(b: Builder, x: number, z: number, w: number, h: number, tiers: Array<[number, number]>, m: MatId) {
  let y = 0.02;
  for (const [frac, scale] of tiers) {
    const th = h * frac;
    const s = w * scale;
    b.box(x, y, z, s, th, s, m);
    b.box(x, y, z, s, th, s, m, Math.PI / 4);
    for (let f = 0; f < th / 0.12; f++) {
      b.box(x, y + f * 0.12 + 0.05, z, s * 1.01, 0.02, s * 1.01, 'steel');
    }
    y += th;
  }
  return y;
}

const ERA4: Record<string, Draw> = {
  pusat_data: (b) => {
    pad(b, 2, 'concrete', 0.02);
    // Cyberjaya-style data halls: windowless shells with rooftop chillers
    for (const z of [-0.45, 0.35]) {
      b.box(-0.15, 0.02, z, 1.4, 0.32, 0.6, 'concrete');
      b.box(-0.15, 0.12, z + 0.303, 1.3, 0.04, 0.006, 'glass_green');
      for (let i = 0; i < 6; i++) b.box(-0.75 + i * 0.24, 0.34, z, 0.16, 0.08, 0.3, 'steel');
      for (let i = 0; i < 6; i++) b.cyl(-0.75 + i * 0.24, 0.42, z, 0.06, 0.06, 0.01, 'iron_black', 8);
    }
    b.box(0.75, 0.02, 0.0, 0.3, 0.24, 1.4, 'glass_green');
    tank(b, 0.8, -0.8, 0.1, 0.25, 'paint_white');
    b.cyl(0.8, 0.02, 0.8, 0.012, 0.012, 0.7, 'steel', 4);
    b.box(0.8, 0.72, 0.8, 0.03, 0.03, 0.03, 'signal_red');
  },
  hab_inovasi: (b) => {
    pad(b, 3, 'grass', 0.015);
    // glass campus with a green roof and a sculptural atrium
    for (const [x, z, w, d, f] of [[-0.7, -0.6, 1.2, 0.8, 6], [0.75, -0.4, 0.9, 1.2, 9], [-0.6, 0.75, 1.2, 0.6, 4]] as const) {
      b.box(x, 0.015, z, w, f * STOREY, d, 'glass');
      for (let k = 0; k < f; k++) b.box(x, 0.015 + k * STOREY, z, w + 0.02, 0.02, d + 0.02, 'paint_white');
      b.box(x, 0.015 + f * STOREY, z, w, 0.03, d, 'grass');
    }
    b.dome(0.4, 0.015, 0.75, 0.45, 0.4, 'glass_green', 14);
    for (const [x, z] of [[1.25, 1.2], [-1.25, 0.1], [0.0, 1.25]] as const) roundTree(b, x, z, 1.3, 'foliage_light');
  },
  ladang_solar: (b) => {
    b.box(0, 0, 0, 2.9, 0.012, 2.9, 'grass');
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 8; j++) {
        const x = -1.2 + i * 0.48;
        const z = -1.25 + j * 0.34;
        b.cyl(x, 0.012, z, 0.01, 0.01, 0.06, 'steel', 4);
        b.tilted(x, 0.07, z, 0.42, 0.012, 0.24, 'solar', -0.35);
      }
    b.box(1.15, 0.012, 1.25, 0.4, 0.2, 0.25, 'paint_white');
  },
  stesen_mrt: (b) => {
    // elevated MRT station: concourse box on columns with a curved roof
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.2, 0.2]) b.cyl(sx, 0, sz, 0.05, 0.05, 0.6, 'concrete', 8);
    b.box(0, 0.6, 0, 0.95, 0.06, 0.6, 'concrete');
    b.box(0, 0.66, 0, 0.9, 0.2, 0.55, 'glass');
    b.box(0, 0.66, 0.28, 0.9, 0.04, 0.01, 'paint_red');
    b.hcyl(0, 0.86, 0, 0.3, 0.98, 'steel', 'x', 12);
    b.box(0, 0.6, 0, 0.98, 0.26, 0.04, 'concrete');
    b.box(0.35, 0, 0.35, 0.18, 0.6, 0.12, 'glass');
  },
  lapangan_terbang: (b) => {
    pad(b, 3, 'asphalt', 0.02);
    b.box(0, 0.02, 1.0, 2.8, 0.005, 0.25, 'concrete');
    for (let i = -6; i <= 6; i++) b.box(i * 0.2, 0.026, 1.0, 0.08, 0.002, 0.02, 'paint_white');
    // terminal with a hyperbolic-paraboloid "forest" roof
    b.box(-0.3, 0.02, -0.5, 1.8, 0.28, 0.9, 'glass');
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) b.frustum(-1.05 + i * 0.3, 0.3, -0.8 + j * 0.3, 0.3, 0.3, 0.06, 0.06, 0.09, 'paint_white');
    b.box(1.0, 0.02, -0.75, 0.14, 1.0, 0.14, 'concrete');
    b.box(1.0, 1.02, -0.75, 0.3, 0.14, 0.3, 'glass_dark');
    b.box(1.0, 1.16, -0.75, 0.32, 0.03, 0.32, 'paint_white');
    // a parked airliner
    b.group(0.3, 0.06, 0.45, Math.PI / 2, (g) => {
      g.hcyl(0, 0.05, 0, 0.06, 0.9, 'paint_white', 'z', 10);
      g.box(0, 0.05, 0.05, 0.9, 0.015, 0.16, 'paint_white');
      g.box(0, 0.05, -0.4, 0.3, 0.012, 0.08, 'paint_white');
      g.box(0, 0.06, -0.42, 0.01, 0.14, 0.1, 'paint_blue');
      for (const sx of [-0.2, 0.2]) g.hcyl(sx, 0.02, 0.08, 0.025, 0.1, 'steel', 'z', 8);
    });
  },
  menara_telekom: (b) => {
    pad(b, 1, 'grass', 0.01);
    b.box(0, 0.01, 0.25, 0.5, 0.1, 0.2, 'paint_white');
    b.cyl(0, 0.01, -0.05, 0.1, 0.05, 1.5, 'concrete', 10);
    b.sphere(0, 1.25, -0.05, 0.16, 0.12, 0.16, 'glass', 12, 6);
    b.cyl(0, 1.5, -0.05, 0.03, 0.01, 0.4, 'steel', 6);
    b.box(0, 1.9, -0.05, 0.02, 0.02, 0.02, 'signal_red');
    for (const a of [0, 2.1, 4.2]) b.box(Math.cos(a) * 0.06, 1.1, -0.05 + Math.sin(a) * 0.06, 0.04, 0.08, 0.02, 'paint_white', a);
  },
  kitar_semula: (b) => {
    pad(b, 2, 'concrete', 0.02);
    b.box(-0.3, 0.02, -0.3, 1.1, 0.35, 0.8, 'paint_green');
    b.gable(-0.3, 0.37, -0.3, 0.8, 0.12, 1.1, 'steel', Math.PI / 2);
    b.box(-0.3, 0.06, 0.103, 0.3, 0.22, 0.006, 'steel_dark');
    for (const [x, m] of [[0.4, 'paint_blue'], [0.6, 'paint_orange'], [0.8, 'paint_yellow']] as const) b.box(x, 0.02, 0.6, 0.16, 0.12, 0.24, m);
    b.tilted(0.55, 0.02, -0.5, 0.12, 0.04, 0.8, 'steel_dark', -0.5);
    b.sphere(0.55, 0.02, 0.15, 0.2, 0.12, 0.2, 'gravel', 8, 3, true);
  },
  menara_118: (b) => {
    pad(b, 3, 'concrete', 0.015);
    b.box(0, 0.015, 0.75, 2.4, 0.4, 0.9, 'glass_dark');
    // faceted diamond-patterned shaft that tapers in stages, crowned by a spire
    const h = 9.5;
    let y = 0.02;
    const tiers: Array<[number, number]> = [[0.36, 1.25], [0.28, 1.05], [0.2, 0.85], [0.1, 0.65], [0.06, 0.45]];
    for (const [frac, s] of tiers) {
      const th = h * frac;
      b.frustum(0, y, -0.25, s, s, s * 0.9, s * 0.9, th, 'glass');
      b.frustum(0, y, -0.25, s * 0.95, s * 0.95, s * 0.85, s * 0.85, th, 'glass_dark', Math.PI / 4);
      for (let f = 0.5; f < th; f += 0.5) b.box(0, y + f, -0.25, s * 0.97, 0.03, s * 0.97, 'steel', Math.PI / 4);
      y += th;
    }
    b.cyl(0, y, -0.25, 0.12, 0.02, 2.4, 'chrome', 8);
    b.box(0, y + 2.4, -0.25, 0.04, 0.04, 0.04, 'signal_red');
  },
  menara_berkembar: (b) => {
    pad(b, 3, 'stone', 0.015);
    b.box(0, 0.015, 0.6, 2.6, 0.35, 0.8, 'glass_dark');
    // two stepped, eight-pointed-star towers joined by a double-deck skybridge
    const h = 8.0;
    const tiers: Array<[number, number]> = [[0.5, 0.7], [0.2, 0.62], [0.12, 0.52], [0.08, 0.42], [0.05, 0.3]];
    for (const x of [-0.65, 0.65]) {
      const top = starTower(b, x, -0.2, 0.8, h, tiers, 'chrome');
      b.cyl(x, top, -0.2, 0.08, 0.06, 0.4, 'chrome', 10);
      b.cyl(x, top + 0.4, -0.2, 0.03, 0.004, 1.3, 'chrome', 6);
      b.sphere(x, top + 0.8, -0.2, 0.04, 0.04, 0.04, 'chrome', 6, 3);
    }
    // skybridge at levels 41-42 with its supporting legs
    b.box(0, h * 0.5, -0.2, 0.7, 0.12, 0.14, 'steel');
    b.box(0, h * 0.5 + 0.02, -0.11, 0.66, 0.06, 0.01, 'glass');
    b.tilted(-0.3, h * 0.36, -0.2, 0.04, h * 0.15, 0.04, 'steel', 0, 0);
    b.tilted(0.3, h * 0.36, -0.2, 0.04, h * 0.15, 0.04, 'steel', 0, 0);
    for (const x of [-1.2, 1.2]) palmTree(b, x, 1.2, 0.6);
  },
};

export const BUILDING_MODELS: Record<string, Draw> = { ...ERA1, ...ERA2, ...ERA3, ...ERA4 };
