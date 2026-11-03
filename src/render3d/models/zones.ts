/**
 * Zoned lots: one 1x1 model per (zone, density, architectural era style).
 * Lots keep the style of the era in which they last grew, so a 1890s
 * shophouse can stand beside a 2010s condominium.
 */
import { Builder, STOREY, chimney, fence, kampungHouse, palmTree, roundTree, shophouseRow, stilts, tank, windowBands } from './builder';
import type { MatId } from './materials';

export type ZoneLetter = 'R' | 'C' | 'I';
type Draw = (b: Builder) => void;

/** Highest density a lot can reach in a given style era (era max density). */
export const STYLE_MAX_DENSITY = [0, 2, 3, 4, 4];

export function zoneModelId(z: ZoneLetter, density: number, style: number): string {
  const st = Math.max(1, Math.min(4, style || 1));
  const d = Math.max(1, Math.min(STYLE_MAX_DENSITY[st], density));
  return `zone_${z}_d${d}_e${st}`;
}

const lot = (b: Builder, m: MatId) => b.box(0, 0, 0, 0.96, 0.015, 0.96, m);

function tower(b: Builder, x: number, z: number, w: number, d: number, floors: number, wall: MatId, win: MatId, crown: MatId = 'concrete_dark') {
  b.box(x, 0.015, z, w, floors * STOREY, d, wall);
  windowBands(b, x, z, w, d, 0.015, floors, win, STOREY, 0.55);
  b.box(x, 0.015 + floors * STOREY, z, w * 0.7, 0.08, d * 0.7, crown);
}

function glassTower(b: Builder, x: number, z: number, w: number, d: number, floors: number, glass: MatId = 'glass') {
  b.box(x, 0.015, z, w, floors * STOREY, d, glass);
  for (let f = 3; f < floors; f += 3) b.box(x, 0.015 + f * STOREY, z, w + 0.012, 0.015, d + 0.012, 'steel');
  b.box(x, 0.015 + floors * STOREY, z, w * 0.8, 0.1, d * 0.8, 'steel');
  b.cyl(x, 0.115 + floors * STOREY, z, 0.008, 0.004, 0.25, 'steel', 4);
}

function car(b: Builder, x: number, z: number, m: MatId, ry = 0) {
  b.group(x, 0.015, z, ry, (g) => {
    g.box(0, 0, 0, 0.07, 0.03, 0.14, m);
    g.box(0, 0.03, -0.01, 0.06, 0.025, 0.07, 'glass_dark');
  });
}

const R: Record<string, Draw> = {
  // Era 1: kampung on stilts
  zone_R_d1_e1: (b) => {
    lot(b, 'grass');
    kampungHouse(b, 0, -0.05, { w: 0.34, d: 0.46 });
    palmTree(b, 0.36, 0.34, 0.5);
    b.box(-0.32, 0.015, 0.32, 0.12, 0.06, 0.12, 'bamboo');
  },
  zone_R_d2_e1: (b) => {
    lot(b, 'grass');
    kampungHouse(b, -0.2, -0.18, { w: 0.3, d: 0.4, anjung: true });
    kampungHouse(b, 0.24, 0.2, { w: 0.28, d: 0.36, ry: Math.PI / 2 });
    palmTree(b, 0.35, -0.35, 0.55);
    palmTree(b, -0.38, 0.38, 0.45);
  },
  // Era 2: kampung houses with zinc roofs and shophouse terraces
  zone_R_d1_e2: (b) => {
    lot(b, 'grass');
    kampungHouse(b, 0, -0.05, { w: 0.36, d: 0.48, roof: 'zinc', anjung: true });
    roundTree(b, 0.35, 0.35, 1);
    fence(b, 0.94, 0.94, 'timber_dark', 0.04);
  },
  zone_R_d2_e2: (b) => {
    lot(b, 'gravel');
    shophouseRow(b, 0, 0, { units: 4, floors: 2, unitW: 0.23, depth: 0.7 });
  },
  zone_R_d3_e2: (b) => {
    lot(b, 'gravel');
    shophouseRow(b, 0, 0, { units: 4, floors: 3, unitW: 0.23, depth: 0.75, arches: true });
  },
  // Era 3: FELDA homes, taman terraces and walk-up flats
  zone_R_d1_e3: (b) => {
    lot(b, 'grass');
    stilts(b, 0, -0.08, 0.42, 0.36, 0.08, 'concrete');
    b.box(0, 0.08, -0.08, 0.42, 0.16, 0.36, 'plaster_cream');
    b.box(0, 0.12, 0.103, 0.2, 0.07, 0.006, 'window');
    b.gable(0, 0.24, -0.08, 0.5, 0.14, 0.44, 'zinc');
    roundTree(b, 0.32, 0.32, 1, 'foliage_light');
    b.box(-0.3, 0.015, 0.3, 0.08, 0.1, 0.08, 'paint_blue');
  },
  zone_R_d2_e3: (b) => {
    lot(b, 'grass');
    const cols: MatId[] = ['plaster_cream', 'plaster_white', 'plaster_mint', 'plaster_pink'];
    for (let i = 0; i < 4; i++) {
      const x = -0.36 + i * 0.24;
      b.box(x, 0.015, -0.1, 0.23, 0.28, 0.5, cols[i]);
      b.box(x, 0.06, 0.153, 0.12, 0.08, 0.006, 'window');
      b.box(x, 0.19, 0.153, 0.14, 0.06, 0.006, 'window');
      b.box(x, 0.015, 0.27, 0.22, 0.01, 0.2, 'concrete');
      car(b, x, 0.3, (['paint_red', 'paint_blue', 'paint_white', 'steel'] as const)[i]);
    }
    b.gable(0, 0.295, -0.1, 0.58, 0.14, 0.98, 'terracotta', Math.PI / 2);
  },
  zone_R_d3_e3: (b) => {
    lot(b, 'concrete');
    tower(b, 0, -0.05, 0.8, 0.5, 5, 'plaster_cream', 'window');
    for (let f = 1; f < 5; f++) b.box(0, 0.015 + f * STOREY, 0.22, 0.78, 0.015, 0.06, 'concrete');
    roundTree(b, -0.38, 0.38, 0.9);
  },
  zone_R_d4_e3: (b) => {
    lot(b, 'concrete');
    tower(b, 0, 0, 0.5, 0.7, 12, 'plaster_white', 'window');
    for (let f = 1; f < 12; f++) b.box(0.26, 0.015 + f * STOREY, 0, 0.03, 0.012, 0.66, 'concrete_dark');
    b.box(0, 0.015, 0.42, 0.9, 0.01, 0.12, 'asphalt');
  },
  // Era 4: bungalows, townhouses and condominium towers
  zone_R_d1_e4: (b) => {
    lot(b, 'grass');
    b.box(-0.05, 0.015, -0.05, 0.5, 0.3, 0.4, 'plaster_white');
    b.box(-0.05, 0.08, 0.153, 0.3, 0.14, 0.006, 'glass');
    b.box(-0.05, 0.315, -0.05, 0.56, 0.03, 0.46, 'concrete_dark');
    b.box(0.25, 0.015, 0.3, 0.3, 0.012, 0.2, 'pond');
    palmTree(b, -0.36, 0.36, 0.45);
  },
  zone_R_d2_e4: (b) => {
    lot(b, 'grass');
    for (let i = 0; i < 3; i++) {
      const x = -0.3 + i * 0.3;
      b.box(x, 0.015, -0.1, 0.28, 0.42, 0.55, i % 2 ? 'plaster_white' : 'plaster_cream');
      b.box(x, 0.06, 0.177, 0.18, 0.3, 0.006, 'glass');
      b.box(x, 0.435, -0.1, 0.3, 0.025, 0.57, 'concrete_dark');
      car(b, x, 0.32, (['paint_white', 'paint_black', 'steel'] as const)[i]);
    }
  },
  zone_R_d3_e4: (b) => {
    lot(b, 'concrete');
    tower(b, 0, -0.05, 0.75, 0.6, 9, 'plaster_white', 'glass');
    for (let f = 1; f < 9; f++) b.box(0, 0.015 + f * STOREY, 0.27, 0.72, 0.015, 0.08, 'glass_green');
    b.box(0, 0.015 + 9 * STOREY, -0.05, 0.6, 0.015, 0.4, 'grass');
  },
  zone_R_d4_e4: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, 0, 0.9, 0.2, 0.9, 'plaster_white');
    glassTower(b, -0.15, -0.12, 0.42, 0.42, 26, 'glass_green');
    for (let f = 2; f < 26; f += 2) b.box(-0.15, 0.015 + f * STOREY, 0.1, 0.42, 0.012, 0.05, 'paint_white');
    b.box(0.28, 0.2, 0.28, 0.3, 0.015, 0.3, 'pond');
  },
};

const C: Record<string, Draw> = {
  zone_C_d1_e1: (b) => {
    lot(b, 'dirt');
    for (const [x, z] of [[-0.2, -0.15], [0.2, 0.15]] as const) {
      for (const sx of [-0.12, 0.12]) for (const sz of [-0.1, 0.1]) b.cyl(x + sx, 0.015, z + sz, 0.01, 0.01, 0.12, 'bamboo', 4);
      b.box(x, 0.06, z, 0.26, 0.02, 0.22, 'timber');
      b.gable(x, 0.13, z, 0.36, 0.1, 0.3, 'attap');
      b.box(x, 0.08, z, 0.12, 0.04, 0.08, (['paint_yellow', 'paint_orange'] as const)[x < 0 ? 0 : 1]);
    }
    b.box(-0.3, 0.015, 0.3, 0.1, 0.08, 0.1, 'bamboo');
  },
  zone_C_d2_e1: (b) => {
    lot(b, 'dirt');
    stilts(b, 0, -0.1, 0.8, 0.45, 0.06);
    b.box(0, 0.06, -0.1, 0.8, 0.16, 0.45, 'timber');
    for (let i = 0; i < 4; i++) b.box(-0.3 + i * 0.2, 0.08, 0.128, 0.14, 0.1, 0.006, 'timber_light');
    b.gable(0, 0.22, -0.1, 0.62, 0.16, 0.92, 'attap', Math.PI / 2);
    b.box(0, 0.015, 0.25, 0.8, 0.012, 0.18, 'timber');
    for (let i = 0; i < 3; i++) b.box(-0.25 + i * 0.25, 0.03, 0.3, 0.08, 0.05, 0.08, 'fabric_red');
  },
  zone_C_d1_e2: (b) => {
    lot(b, 'gravel');
    b.box(0, 0.015, -0.1, 0.6, 0.22, 0.45, 'timber_light');
    b.box(0, 0.03, 0.128, 0.45, 0.14, 0.006, 'timber_dark');
    b.box(0, 0.2, 0.2, 0.62, 0.012, 0.18, 'zinc');
    b.gable(0, 0.235, -0.1, 0.5, 0.14, 0.66, 'zinc', Math.PI / 2);
    b.box(0, 0.26, 0.135, 0.4, 0.06, 0.01, 'paint_red');
  },
  zone_C_d2_e2: (b) => {
    lot(b, 'gravel');
    shophouseRow(b, 0, 0, { units: 4, floors: 2, unitW: 0.23, depth: 0.75, colors: ['plaster_yellow', 'plaster_blue', 'plaster_pink', 'plaster_mint'] });
  },
  zone_C_d3_e2: (b) => {
    lot(b, 'gravel');
    shophouseRow(b, 0, 0, { units: 3, floors: 3, unitW: 0.31, depth: 0.8, arches: true, colors: ['plaster_white', 'plaster_cream', 'plaster_mint'] });
  },
  zone_C_d1_e3: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, -0.12, 0.7, 0.2, 0.45, 'plaster_white');
    b.box(0, 0.03, 0.103, 0.6, 0.12, 0.006, 'glass');
    b.box(0, 0.17, 0.11, 0.7, 0.05, 0.02, 'paint_red');
    b.box(0, 0.215, -0.12, 0.72, 0.02, 0.47, 'concrete_dark');
    car(b, -0.2, 0.3, 'paint_blue', Math.PI / 2);
  },
  zone_C_d2_e3: (b) => {
    lot(b, 'concrete');
    for (let i = 0; i < 3; i++) {
      const x = -0.3 + i * 0.3;
      b.box(x, 0.015, -0.05, 0.29, 0.42, 0.7, i % 2 ? 'plaster_cream' : 'plaster_white');
      b.box(x, 0.03, 0.303, 0.24, 0.1, 0.006, 'glass');
      b.box(x, 0.18, 0.303, 0.24, 0.18, 0.006, 'window');
      b.box(x, 0.14, 0.31, 0.27, 0.035, 0.02, (['paint_red', 'paint_blue', 'paint_green'] as const)[i]);
    }
  },
  zone_C_d3_e3: (b) => {
    lot(b, 'asphalt');
    b.box(0, 0.015, -0.1, 0.9, 0.5, 0.7, 'plaster_white');
    b.box(0, 0.06, 0.253, 0.5, 0.3, 0.006, 'glass');
    b.box(0, 0.4, 0.26, 0.6, 0.08, 0.02, 'paint_orange');
    b.box(0, 0.515, -0.1, 0.5, 0.06, 0.4, 'steel');
  },
  zone_C_d4_e3: (b) => {
    lot(b, 'concrete');
    tower(b, 0, 0, 0.65, 0.65, 15, 'concrete', 'glass_dark');
  },
  zone_C_d1_e4: (b) => {
    lot(b, 'grass');
    b.box(0, 0.015, -0.1, 0.6, 0.2, 0.4, 'glass');
    b.box(0, 0.215, -0.1, 0.72, 0.02, 0.55, 'timber_light');
    for (let i = 0; i < 3; i++) b.cyl(-0.25 + i * 0.25, 0.015, 0.3, 0.05, 0.05, 0.05, 'timber', 8);
    b.cyl(0.3, 0.015, 0.3, 0.008, 0.008, 0.18, 'steel', 4);
    b.cyl(0.3, 0.19, 0.3, 0.12, 0.0, 0.08, 'fabric_red', 8);
  },
  zone_C_d2_e4: (b) => {
    lot(b, 'concrete');
    for (let i = 0; i < 2; i++) {
      const x = -0.22 + i * 0.45;
      b.box(x, 0.015, -0.05, 0.43, 0.6, 0.7, 'plaster_white');
      b.box(x, 0.03, 0.303, 0.38, 0.55, 0.006, 'glass');
      b.box(x, 0.615, -0.05, 0.45, 0.02, 0.72, 'steel');
    }
  },
  zone_C_d3_e4: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, 0, 0.9, 0.55, 0.9, 'glass_dark');
    b.box(0, 0.2, 0, 0.92, 0.02, 0.92, 'paint_white');
    b.box(0, 0.4, 0, 0.92, 0.02, 0.92, 'paint_white');
    b.dome(0, 0.565, 0, 0.3, 0.15, 'glass', 12);
    b.box(0.3, 0.45, 0.46, 0.25, 0.08, 0.01, 'paint_red');
  },
  zone_C_d4_e4: (b) => {
    lot(b, 'concrete');
    glassTower(b, 0, 0, 0.6, 0.6, 30, 'glass');
    b.box(0, 0.015, 0, 0.9, 0.25, 0.9, 'glass_dark');
  },
};

const I: Record<string, Draw> = {
  zone_I_d1_e1: (b) => {
    lot(b, 'dirt');
    b.box(-0.1, 0.015, -0.1, 0.5, 0.16, 0.4, 'bamboo');
    b.gable(-0.1, 0.175, -0.1, 0.5, 0.14, 0.6, 'attap', Math.PI / 2);
    for (let i = 0; i < 3; i++) b.hcyl(0.15, 0.04 + i * 0.05, 0.3, 0.025, 0.4, 'trunk', 'x', 6);
    b.cyl(0.3, 0.015, -0.3, 0.06, 0.05, 0.08, 'laterite', 8);
  },
  zone_I_d2_e1: (b) => {
    lot(b, 'dirt');
    b.box(0, 0.015, -0.1, 0.7, 0.2, 0.5, 'timber');
    b.gable(0, 0.215, -0.1, 0.56, 0.16, 0.8, 'attap', Math.PI / 2);
    chimney(b, 0.28, -0.25, 0.05, 0.4, 'laterite', 0.015);
    for (let i = 0; i < 4; i++) b.box(-0.3 + i * 0.12, 0.015, 0.3, 0.08, 0.06, 0.08, 'timber_light');
  },
  zone_I_d1_e2: (b) => {
    lot(b, 'gravel');
    b.box(0, 0.015, -0.05, 0.7, 0.2, 0.55, 'tin_rust');
    b.gable(0, 0.215, -0.05, 0.6, 0.14, 0.76, 'zinc', Math.PI / 2);
    b.box(0, 0.03, 0.228, 0.3, 0.16, 0.006, 'timber_dark');
  },
  zone_I_d2_e2: (b) => {
    lot(b, 'gravel');
    b.box(-0.1, 0.015, -0.05, 0.65, 0.3, 0.6, 'brick');
    b.gable(-0.1, 0.315, -0.05, 0.65, 0.16, 0.66, 'zinc');
    chimney(b, 0.32, -0.25, 0.05, 0.65, 'brick', 0.015);
    for (let i = 0; i < 3; i++) b.box(-0.3 + i * 0.2, 0.1, 0.253, 0.1, 0.1, 0.006, 'window');
  },
  zone_I_d3_e2: (b) => {
    lot(b, 'gravel');
    b.box(0, 0.015, -0.1, 0.85, 0.42, 0.65, 'brick');
    for (let f = 0; f < 2; f++) for (let i = 0; i < 4; i++) archWindowStrip(b, -0.3 + i * 0.2, 0.08 + f * 0.18, 0.227);
    b.gable(0, 0.435, -0.1, 0.65, 0.18, 0.87, 'zinc', Math.PI / 2);
    chimney(b, 0.35, 0.3, 0.06, 0.9, 'brick', 0.015);
  },
  zone_I_d1_e3: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, -0.05, 0.75, 0.25, 0.6, 'concrete');
    b.gable(0, 0.265, -0.05, 0.75, 0.08, 0.6, 'steel');
    b.box(-0.15, 0.03, 0.253, 0.3, 0.2, 0.006, 'steel_dark');
    tank(b, 0.33, 0.33, 0.06, 0.15, 'steel', 0.015);
  },
  zone_I_d2_e3: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, -0.05, 0.9, 0.3, 0.7, 'paint_white');
    for (let k = 0; k < 4; k++) b.gable(-0.34 + k * 0.225, 0.315, -0.05, 0.225, 0.1, 0.7, k % 2 ? 'roof_blue' : 'steel');
    b.box(0, 0.06, 0.303, 0.7, 0.08, 0.006, 'window');
    chimney(b, 0.35, 0.35, 0.04, 0.5, 'steel', 0.015);
  },
  zone_I_d3_e3: (b) => {
    lot(b, 'concrete');
    b.box(-0.1, 0.015, -0.1, 0.75, 0.42, 0.75, 'concrete');
    windowBands(b, -0.1, -0.1, 0.75, 0.75, 0.05, 2, 'window', 0.18, 0.35);
    tank(b, 0.35, 0.35, 0.08, 0.3, 'paint_white', 0.015);
    chimney(b, 0.38, -0.35, 0.05, 0.8, 'concrete', 0.015);
  },
  zone_I_d4_e3: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, -0.15, 0.9, 0.5, 0.6, 'steel');
    for (let i = 0; i < 3; i++) tank(b, -0.3 + i * 0.3, 0.3, 0.1, 0.4, i === 1 ? 'paint_white' : 'steel', 0.015);
    chimney(b, 0.35, -0.3, 0.06, 1.2, 'concrete', 0.515);
    b.hcyl(0, 0.35, 0.15, 0.02, 0.9, 'steel_dark', 'x', 6);
  },
  zone_I_d1_e4: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, -0.05, 0.7, 0.24, 0.55, 'paint_white');
    b.box(0, 0.03, 0.228, 0.6, 0.08, 0.006, 'glass');
    b.tilted(0, 0.255, -0.05, 0.6, 0.012, 0.4, 'solar', -0.25);
  },
  zone_I_d2_e4: (b) => {
    lot(b, 'asphalt');
    b.box(0, 0.015, -0.1, 0.9, 0.38, 0.65, 'steel');
    for (let i = 0; i < 4; i++) b.box(-0.3 + i * 0.2, 0.015, 0.228, 0.14, 0.2, 0.006, 'steel_dark');
    b.box(0, 0.395, -0.1, 0.92, 0.02, 0.67, 'paint_white');
    b.box(0.2, 0.015, 0.38, 0.12, 0.12, 0.3, 'paint_white');
  },
  zone_I_d3_e4: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, -0.05, 0.85, 0.5, 0.75, 'paint_white');
    b.box(0, 0.12, 0.328, 0.8, 0.2, 0.006, 'glass_dark');
    for (let i = 0; i < 4; i++) b.box(-0.3 + i * 0.2, 0.515, -0.05, 0.14, 0.08, 0.3, 'steel');
  },
  zone_I_d4_e4: (b) => {
    lot(b, 'concrete');
    b.box(0, 0.015, 0, 0.92, 0.7, 0.92, 'paint_white');
    b.box(0, 0.2, 0.463, 0.86, 0.35, 0.006, 'glass_dark');
    b.box(0.463, 0.2, 0, 0.006, 0.35, 0.86, 'glass_dark');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) b.cyl(-0.3 + i * 0.3, 0.715, -0.3 + j * 0.3, 0.07, 0.07, 0.06, 'steel', 8);
  },
};

function archWindowStrip(b: Builder, x: number, y: number, z: number) {
  b.box(x, y, z, 0.08, 0.1, 0.006, 'window');
  b.hcyl(x, y + 0.1, z, 0.04, 0.006, 'window', 'z', 8);
}

export const ZONE_MODELS: Record<string, Draw> = { ...R, ...C, ...I };
