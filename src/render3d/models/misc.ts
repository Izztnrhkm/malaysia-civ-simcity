/** Vehicles, vegetation and transport infrastructure pieces. */
import { Builder, oilPalm, palmTree, rubberTree } from './builder';
import { jongShip, junkShip } from './buildings';
import type { MatId } from './materials';

type Draw = (b: Builder) => void;

// ---------------------------------------------------------------- vehicles (front = +z)

function carBody(b: Builder, m: MatId, len = 0.16, w = 0.08, h = 0.035) {
  b.box(0, 0.012, 0, w, h, len, m);
  b.box(0, 0.012 + h, -len * 0.08, w * 0.9, h * 0.8, len * 0.5, 'glass_dark');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.hcyl(sx * (w / 2), 0.012, sz * len * 0.32, 0.012, 0.012, 'iron_black', 'x', 6);
  b.box(0, 0.025, len / 2 + 0.002, w * 0.8, 0.008, 0.004, 'lamp');
}

export const VEHICLE_MODELS: Record<string, Draw> = {
  vehicle_jong: (b) => jongShip(b, 0, 0, 0, 1),
  vehicle_junk: (b) => junkShip(b, 0, 0, 0, 1),
  vehicle_perahu: (b) => {
    b.frustum(0, -0.02, 0, 0.05, 0.22, 0.09, 0.3, 0.04, 'timber_dark');
    b.box(0, 0.02, -0.05, 0.07, 0.04, 0.08, 'attap');
    b.sphere(0, 0.02, 0.06, 0.015, 0.02, 0.015, 'fabric_blue', 5, 3);
  },
  vehicle_steamship: (b) => {
    b.frustum(0, -0.05, 0, 0.18, 0.9, 0.26, 1.1, 0.12, 'paint_black');
    b.box(0, 0.07, 0, 0.24, 0.02, 0.95, 'timber');
    b.box(0, 0.09, -0.08, 0.18, 0.12, 0.36, 'paint_white');
    b.cyl(0, 0.21, -0.02, 0.04, 0.04, 0.2, 'paint_red', 8);
    b.cyl(0, 0.38, -0.02, 0.041, 0.041, 0.03, 'paint_black', 8);
    for (const z of [0.32, -0.38]) b.cyl(0, 0.09, z, 0.008, 0.008, 0.35, 'timber_dark', 4);
  },
  vehicle_container_ship: (b) => {
    b.frustum(0, -0.06, 0, 0.3, 1.5, 0.36, 1.8, 0.14, 'paint_red');
    b.box(0, 0.08, 0, 0.34, 0.02, 1.6, 'paint_black');
    b.box(0, 0.1, -0.7, 0.3, 0.26, 0.16, 'paint_white');
    b.box(0, 0.36, -0.7, 0.32, 0.03, 0.18, 'paint_blue');
    const mats: MatId[] = ['paint_blue', 'paint_orange', 'paint_green', 'steel', 'paint_red'];
    for (let i = 0; i < 5; i++) for (let l = 0; l < 2 + (i % 2); l++) b.box(0, 0.1 + l * 0.06, -0.45 + i * 0.22, 0.3, 0.06, 0.2, mats[(i + l) % mats.length]);
  },
  vehicle_steam_loco: (b) => {
    b.box(0, 0.03, 0, 0.12, 0.03, 0.4, 'iron_black');
    b.hcyl(0, 0.11, 0.06, 0.05, 0.26, 'paint_green', 'z', 10);
    b.box(0, 0.06, -0.13, 0.12, 0.14, 0.12, 'paint_green');
    b.box(0, 0.2, -0.13, 0.13, 0.015, 0.14, 'paint_black');
    b.cyl(0, 0.16, 0.15, 0.022, 0.03, 0.08, 'paint_black', 8);
    b.dome(0, 0.155, 0.04, 0.03, 0.03, 'gold', 8);
    for (const sz of [-0.12, 0, 0.12]) for (const sx of [-1, 1]) b.hcyl(sx * 0.06, 0.035, sz, 0.035, 0.015, 'paint_red', 'x', 8);
    b.frustum(0, 0.03, 0.2, 0.12, 0.02, 0.08, 0.06, 0.04, 'iron_black');
    b.box(0, 0.12, 0.192, 0.04, 0.03, 0.006, 'lamp');
  },
  vehicle_diesel_loco: (b) => {
    b.box(0, 0.03, 0, 0.12, 0.02, 0.42, 'iron_black');
    b.box(0, 0.05, 0, 0.12, 0.12, 0.4, 'paint_blue');
    b.box(0, 0.09, 0.201, 0.1, 0.04, 0.004, 'glass_dark');
    b.box(0, 0.08, 0, 0.122, 0.015, 0.4, 'paint_yellow');
    b.box(0, 0.06, 0.203, 0.04, 0.015, 0.004, 'lamp');
  },
  vehicle_rail_wagon: (b) => {
    b.box(0, 0.03, 0, 0.12, 0.02, 0.36, 'iron_black');
    b.box(0, 0.05, 0, 0.12, 0.08, 0.34, 'tin_rust');
    b.box(0, 0.13, 0, 0.1, 0.03, 0.3, 'gravel');
    for (const sz of [-0.12, 0.12]) for (const sx of [-1, 1]) b.hcyl(sx * 0.06, 0.03, sz, 0.025, 0.012, 'iron_black', 'x', 6);
  },
  vehicle_bullock_cart: (b) => {
    b.box(0, 0.05, -0.04, 0.08, 0.04, 0.12, 'timber');
    b.gable(0, 0.09, -0.04, 0.1, 0.05, 0.14, 'attap');
    for (const sx of [-1, 1]) b.hcyl(sx * 0.05, 0.045, -0.04, 0.045, 0.012, 'timber_dark', 'x', 8);
    b.box(0, 0.04, 0.09, 0.05, 0.05, 0.1, 'trunk_pale');
    b.box(0, 0.075, 0.15, 0.03, 0.03, 0.04, 'trunk_pale');
  },
  vehicle_vintage_car: (b) => {
    carBody(b, 'paint_black', 0.15, 0.075, 0.03);
    b.box(0, 0.075, -0.02, 0.07, 0.006, 0.08, 'paint_black');
  },
  vehicle_car: (b) => carBody(b, 'paint_red'),
  vehicle_car_white: (b) => carBody(b, 'paint_white'),
  vehicle_bus: (b) => {
    b.box(0, 0.015, 0, 0.1, 0.1, 0.32, 'paint_white');
    b.box(0, 0.05, 0, 0.102, 0.04, 0.3, 'glass_dark');
    b.box(0, 0.02, 0, 0.103, 0.02, 0.32, 'paint_red');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.hcyl(sx * 0.05, 0.015, sz * 0.1, 0.015, 0.012, 'iron_black', 'x', 6);
  },
  vehicle_mrt: (b) => {
    b.box(0, 0.02, 0, 0.13, 0.12, 0.6, 'paint_white');
    b.box(0, 0.07, 0, 0.132, 0.04, 0.56, 'glass_dark');
    b.box(0, 0.04, 0, 0.134, 0.015, 0.6, 'paint_red');
    b.frustum(0, 0.02, 0.3, 0.13, 0.04, 0.1, 0.01, 0.1, 'paint_white');
    b.box(0, 0.05, 0.31, 0.06, 0.012, 0.004, 'lamp');
  },
};

// ---------------------------------------------------------------- vegetation

export const TREE_MODELS: Record<string, Draw> = {
  tree_rainforest: (b) => {
    // emergent dipterocarp: buttressed trunk, layered umbrella crown
    for (let k = 0; k < 4; k++) b.box(0, 0, 0, 0.012, 0.08, 0.1, 'trunk', (k * Math.PI) / 4);
    b.cyl(0, 0, 0, 0.035, 0.022, 0.62, 'trunk_pale', 6);
    b.sphere(0, 0.5, 0, 0.2, 0.09, 0.2, 'foliage_dark', 8, 4);
    b.sphere(0.05, 0.6, 0.03, 0.15, 0.08, 0.14, 'foliage', 8, 4);
  },
  tree_rainforest_small: (b) => {
    b.cyl(0, 0, 0, 0.02, 0.015, 0.25, 'trunk', 5);
    b.sphere(0, 0.18, 0, 0.13, 0.12, 0.13, 'foliage', 7, 4);
  },
  tree_mangrove: (b) => {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      b.group(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05, Math.PI / 2 - a, (g) => g.tilted(0, 0, 0, 0.012, 0.1, 0.012, 'trunk', 0.5));
    }
    b.cyl(0, 0.07, 0, 0.016, 0.012, 0.12, 'trunk', 5);
    b.sphere(0, 0.13, 0, 0.13, 0.08, 0.13, 'foliage_dark', 7, 3);
  },
  tree_coconut: (b) => palmTree(b, 0, 0, 0.45, 0, 0.08),
  tree_oilpalm: (b) => oilPalm(b, 0, 0, 1.2),
  tree_rubber: (b) => rubberTree(b, 0, 0, 1.2),
};

// ---------------------------------------------------------------- transport pieces
// "center" covers the tile middle; an "arm" runs from the centre to the +z edge
// and is rotated by the renderer for every connected neighbour.

export const ROAD_WIDTH = [0, 0.32, 0.4, 0.5, 0.56];
const ROAD_MAT: MatId[] = ['dirt', 'dirt', 'laterite', 'asphalt', 'asphalt'];

function roadCenter(era: number): Draw {
  return (b) => {
    const w = ROAD_WIDTH[era];
    b.box(0, 0, 0, w, 0.02, w, ROAD_MAT[era]);
  };
}
function roadArm(era: number): Draw {
  return (b) => {
    const w = ROAD_WIDTH[era];
    b.box(0, 0, 0.25, w, 0.02, 0.5, ROAD_MAT[era]);
    if (era >= 3) {
      b.box(0, 0.02, 0.3, 0.02, 0.003, 0.14, 'paint_white');
      for (const sx of [-1, 1]) b.box(sx * (w / 2 + 0.03), 0, 0.25, 0.06, 0.025, 0.5, 'concrete');
    }
    if (era === 2) for (const sx of [-1, 1]) b.box(sx * (w / 2 + 0.01), 0, 0.25, 0.02, 0.022, 0.5, 'gravel');
  };
}

export const INFRA_MODELS: Record<string, Draw> = {
  infra_road_center_e1: roadCenter(1),
  infra_road_center_e2: roadCenter(2),
  infra_road_center_e3: roadCenter(3),
  infra_road_center_e4: roadCenter(4),
  infra_road_arm_e1: roadArm(1),
  infra_road_arm_e2: roadArm(2),
  infra_road_arm_e3: roadArm(3),
  infra_road_arm_e4: roadArm(4),
  infra_rail_center: (b) => {
    b.box(0, 0, 0, 0.36, 0.03, 0.36, 'gravel');
  },
  infra_rail_arm: (b) => {
    b.box(0, 0, 0.25, 0.34, 0.03, 0.5, 'gravel');
    for (let k = 0; k < 4; k++) b.box(0, 0.03, 0.06 + k * 0.125, 0.28, 0.012, 0.04, 'timber_dark');
    for (const sx of [-0.07, 0.07]) b.box(sx, 0.042, 0.25, 0.016, 0.016, 0.5, 'steel');
  },
  infra_highway_center: (b) => {
    b.cyl(0, 0, 0, 0.07, 0.06, 0.42, 'concrete', 8);
    b.box(0, 0.38, 0, 0.3, 0.06, 0.2, 'concrete');
    b.box(0, 0.44, 0, 0.62, 0.05, 0.62, 'asphalt');
  },
  infra_highway_arm: (b) => {
    b.box(0, 0.42, 0.25, 0.62, 0.07, 0.5, 'concrete');
    b.box(0, 0.44, 0.25, 0.58, 0.052, 0.5, 'asphalt');
    for (const sx of [-1, 1]) b.box(sx * 0.3, 0.49, 0.25, 0.03, 0.05, 0.5, 'concrete');
    b.box(0, 0.492, 0.3, 0.02, 0.003, 0.14, 'paint_white');
    b.box(0.29, 0.54, 0.25, 0.01, 0.01, 0.5, 'steel');
  },
  infra_mrt_center: (b) => {
    b.cyl(0, 0, 0, 0.06, 0.05, 0.78, 'concrete', 8);
    b.frustum(0, 0.72, 0, 0.12, 0.12, 0.3, 0.2, 0.08, 'concrete');
    b.box(0, 0.8, 0, 0.3, 0.06, 0.3, 'concrete');
  },
  infra_mrt_arm: (b) => {
    b.box(0, 0.8, 0.25, 0.26, 0.06, 0.5, 'concrete');
    for (const sx of [-1, 1]) b.box(sx * 0.12, 0.86, 0.25, 0.02, 0.04, 0.5, 'concrete');
    for (const sx of [-0.05, 0.05]) b.box(sx, 0.86, 0.25, 0.012, 0.012, 0.5, 'steel');
  },
  infra_bridge_pier: (b) => {
    for (const sx of [-0.18, 0.18]) b.cyl(sx, -0.5, 0, 0.035, 0.035, 0.58, 'concrete', 6);
    b.box(0, 0.06, 0, 0.5, 0.03, 0.12, 'concrete_dark');
  },
  infra_streetlamp: (b) => {
    b.cyl(0, 0, 0, 0.008, 0.006, 0.22, 'steel', 4);
    b.box(0, 0.21, 0.03, 0.03, 0.012, 0.07, 'steel');
    b.box(0, 0.2, 0.05, 0.025, 0.008, 0.03, 'lamp');
  },
};
