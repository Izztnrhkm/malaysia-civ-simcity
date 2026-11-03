import { BUILDING_MAP } from '../../core/data/buildings';
import { Rng, hashString } from '../../core/rng';
import { CanvasFactory, Sprite, makeSprite } from './canvas';
import {
  Ctx,
  Foot,
  blob,
  boat,
  box,
  diamond,
  dome,
  flag,
  gableRoof,
  inset,
  poly,
  pyramidRoof,
  shade,
  speckle,
  stilts,
  stall,
  tieredRoof,
  tree,
  wallColors,
  windows,
} from './primitives';
import { STOREY, chimney, glassTower, kampungHouse, shed, shophouses, subFoot } from './zones';

type Draw = (ctx: Ctx, f: Foot, rng: Rng) => void;

const TIMBER = '#9a6a3c';
const ATTAP = '#b9995a';
const ZINC = '#a3acb2';
const CLAY = '#b5562f';
const WHITE = '#f1ede2';

function ground(ctx: Ctx, f: Foot, color: string, rng: Rng) {
  diamond(ctx, inset(f, 0.97), color);
  speckle(ctx, f, [shade(color, 0.08), shade(color, -0.1)], 20 * Math.round(f.hw / 64), rng, 2);
}

function water(ctx: Ctx, f: Foot) {
  diamond(ctx, f, '#3b8db0');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(f.cx - f.hw * 0.4 + k * 8, f.cy + k * 4);
    ctx.lineTo(f.cx - f.hw * 0.2 + k * 8, f.cy + k * 4 + 2);
    ctx.stroke();
  }
}

function treeGrid(ctx: Ctx, f: Foot, n: number, kind: 'rubber' | 'oilpalm', rng: Rng, s: number) {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pts.push([subFoot(f, i, j, n).cx, subFoot(f, i, j, n).cy]);
  pts.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of pts) tree(ctx, x + rng.range(-2, 2), y + 2, s, kind, rng);
}

function crane(ctx: Ctx, x: number, y: number, h: number, color = '#e0a020') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + h * 0.6, y - h + 6);
  ctx.moveTo(x, y - h);
  ctx.lineTo(x - h * 0.2, y - h + 4);
  ctx.stroke();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + h * 0.5, y - h + 6);
  ctx.lineTo(x + h * 0.5, y - h * 0.4);
  ctx.stroke();
}

function containers(ctx: Ctx, f: Foot, rng: Rng) {
  const cols = ['#c0392b', '#2e86c1', '#27ae60', '#e67e22', '#8e44ad', '#7f8c8d'];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const sf = subFoot(f, i, j, 3);
      let top = box(ctx, inset(sf, 0.7), 7, wallColors(cols[rng.int(0, 5)]));
      if (rng.chance(0.5)) top = box(ctx, inset(sf, 0.7), 7, wallColors(cols[rng.int(0, 5)]), 7);
      void top;
    }
}

function arches(ctx: Ctx, f: Foot, h: number, n: number, color: string) {
  // horseshoe arches along the front-left wall
  const x0 = f.cx - f.hw;
  const y0 = f.cy;
  const dx = f.hw / n;
  const dy = f.hh / n;
  ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const x = x0 + dx * (k + 0.5);
    const y = y0 + dy * (k + 0.5);
    ctx.beginPath();
    ctx.moveTo(x - dx * 0.3, y - dy * 0.3);
    ctx.lineTo(x - dx * 0.3, y - dy * 0.3 - h * 0.45);
    ctx.quadraticCurveTo(x, y - h * 0.85, x + dx * 0.3, y + dy * 0.3 - h * 0.45);
    ctx.lineTo(x + dx * 0.3, y + dy * 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

function solarPanels(ctx: Ctx, f: Foot) {
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const sf = subFoot(f, i, j, 4);
      poly(ctx, [sf.cx - sf.hw * 0.8, sf.cy, sf.cx, sf.cy + sf.hh * 0.8, sf.cx + sf.hw * 0.8, sf.cy - 5, sf.cx, sf.cy - sf.hh * 0.8 - 5], '#22406a', '#8aa6c8', 0.6);
    }
}

export const BUILDING_DRAW: Record<string, Draw> = {
  // ---------------- Era 1 ----------------
  pasar: (ctx, f, rng) => {
    ground(ctx, f, '#c2a874', rng);
    const cloth = ['#c0392b', '#d4ac0d', '#1f8a70', '#8e44ad'];
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) pts.push([i, j]);
    for (const [i, j] of pts) {
      const sf = subFoot(f, i, j, 3);
      if (i === 1 && j === 1) {
        const top = box(ctx, inset(sf, 1.3), 10, wallColors(TIMBER));
        pyramidRoof(ctx, top, 14, ATTAP, 1.2);
      } else stall(ctx, sf.cx, sf.cy, 24, cloth[(i + j) % 4]);
    }
  },
  jeti: (ctx, f, rng) => {
    void rng;
    const deck = inset(f, 0.9);
    // piles
    ctx.fillStyle = '#4a3020';
    for (const [u, v] of [[-0.6, 0], [0, 0.6], [0.6, 0], [0, -0.6]]) ctx.fillRect(deck.cx + u * deck.hw - 1.5, deck.cy + v * deck.hh - 4, 3, 10);
    box(ctx, deck, 3, wallColors('#8a6a42'), 4);
    boat(ctx, f.cx + f.hw * 0.45, f.cy + f.hh * 0.45, 12, '#7a4a2a', '#e8dcc0');
  },
  pelabuhan: (ctx, f, rng) => {
    ground(ctx, f, '#b49d70', rng);
    const wh = subFoot(f, 0, 0, 2);
    const t1 = box(ctx, inset(wh, 0.85), 18, wallColors(TIMBER));
    gableRoof(ctx, t1, 16, ATTAP, true, 0, 1.15);
    const wh2 = subFoot(f, 1, 0, 2);
    const t2 = box(ctx, inset(wh2, 0.8), 14, wallColors(shade(TIMBER, 0.1)));
    gableRoof(ctx, t2, 13, ATTAP, false, 0, 1.15);
    // quay with jong ships
    const q = subFoot(f, 0, 1, 2);
    box(ctx, inset(q, 0.9), 3, wallColors('#8a6a42'));
    boat(ctx, subFoot(f, 0, 1, 2).cx - 10, subFoot(f, 0, 1, 2).cy + 8, 20, '#6b3e22', '#d9c79a');
    boat(ctx, subFoot(f, 1, 1, 2).cx, subFoot(f, 1, 1, 2).cy + 6, 16, '#5a3a22', '#c0392b');
    flag(ctx, f.cx + f.hw * 0.55, f.cy - 2, 34, ['#d4ac0d', '#c0392b']);
  },
  gudang: (ctx, f, rng) => {
    ground(ctx, f, '#b49d70', rng);
    const top = box(ctx, inset(f, 0.78), 20, wallColors(TIMBER));
    windows(ctx, inset(f, 0.78), 20, 1, 1, 1, '#2a1a0a');
    gableRoof(ctx, top, 16, ATTAP, true, 0, 1.12);
    for (let k = 0; k < 3; k++) box(ctx, { cx: f.cx - f.hw * 0.6 + k * 7, cy: f.cy + f.hh * 0.45, hw: 4, hh: 2 }, 5, wallColors('#c9a46a'));
  },
  sawah: (ctx, f, rng) => {
    void rng;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const sf = subFoot(f, i, j, 2);
        diamond(ctx, inset(sf, 0.96), '#5c7f3a');
        diamond(ctx, inset(sf, 0.82), (i + j) % 2 ? '#7fae3e' : '#9bbf4a');
        // flooded glint
        ctx.fillStyle = 'rgba(160,210,230,0.35)';
        ctx.beginPath();
        ctx.ellipse(sf.cx - 6, sf.cy, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    // pondok (hut)
    const h = subFoot(f, 1, 0, 4);
    const t = box(ctx, inset(h, 0.6), 7, wallColors(TIMBER), 4);
    pyramidRoof(ctx, t, 7, ATTAP, 1.4);
  },
  nelayan: (ctx, f, rng) => {
    ground(ctx, f, '#d9c48c', rng);
    kampungHouse(ctx, subFoot(f, 0, 0, 2), rng);
    // fish drying racks
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#c8b27a';
      ctx.fillRect(subFoot(f, 1, 0, 2).cx - 8 + k * 6, subFoot(f, 1, 0, 2).cy - 4, 4, 2);
    }
    boat(ctx, subFoot(f, 0, 1, 2).cx, subFoot(f, 0, 1, 2).cy + 4, 11, '#2e6f8e');
    boat(ctx, subFoot(f, 1, 1, 2).cx, subFoot(f, 1, 1, 2).cy + 4, 10, '#b03a2e');
  },
  pembalakan: (ctx, f, rng) => {
    ground(ctx, f, '#6f6a3e', rng);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#8a5a2b';
      ctx.beginPath();
      ctx.ellipse(f.cx - 14 + k * 8, f.cy + 8, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(f.cx - 14 + k * 8, f.cy + 5, 16, 6);
    }
    const t = box(ctx, inset(subFoot(f, 0, 0, 2), 0.8), 9, wallColors(TIMBER));
    gableRoof(ctx, t, 8, ATTAP, true);
    tree(ctx, f.cx + f.hw * 0.5, f.cy, 26, 'rain', rng);
  },
  pendulang: (ctx, f, rng) => {
    ground(ctx, f, '#a49272', rng);
    water(ctx, inset(subFoot(f, 1, 1, 2), 1.2));
    // panners with dulang
    for (const [i, j] of [[1, 1], [0, 1]]) {
      const sf = subFoot(f, i, j, 2);
      ctx.fillStyle = '#5b3b22';
      ctx.fillRect(sf.cx - 1, sf.cy - 8, 2, 7);
      ctx.fillStyle = '#c9a46a';
      ctx.beginPath();
      ctx.ellipse(sf.cx, sf.cy - 2, 6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = box(ctx, inset(subFoot(f, 0, 0, 2), 0.7), 8, wallColors(TIMBER), 4);
    pyramidRoof(ctx, t, 8, ATTAP, 1.3);
    speckle(ctx, f, ['#e0e4ea', '#b8bcc4'], 12, rng, 2);
  },
  kebun_lada: (ctx, f, rng) => {
    ground(ctx, f, '#6f5a3a', rng);
    // pepper vines on poles
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) pts.push([subFoot(f, i, j, 4).cx, subFoot(f, i, j, 4).cy]);
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of pts) {
      ctx.fillStyle = '#5b3b22';
      ctx.fillRect(x - 1, y - 18, 2, 18);
      blob(ctx, x, y - 12, 5, 9, '#3f7f2f');
      ctx.fillStyle = '#b5402a';
      ctx.fillRect(x + 1, y - 10, 2, 2);
    }
  },
  relau_besi: (ctx, f, rng) => {
    ground(ctx, f, '#7f6a52', rng);
    // brick furnace cone
    const b = inset(f, 0.45);
    box(ctx, b, 10, wallColors('#9a4a2a'));
    poly(ctx, [b.cx - b.hw, b.cy - 10, b.cx - b.hw * 0.35, b.cy - 30, b.cx + b.hw * 0.35, b.cy - 30, b.cx + b.hw, b.cy - 10, b.cx, b.cy + b.hh - 10], '#8a3e22', '#4a1e10');
    ctx.fillStyle = '#ffb030';
    ctx.beginPath();
    ctx.ellipse(b.cx, b.cy - 4, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    chimney(ctx, b.cx, b.cy - 26, 2, rng, '#5a2a1a');
    for (let k = 0; k < 4; k++) blob(ctx, f.cx + f.hw * 0.5 - k * 4, f.cy + f.hh * 0.4, 3, 2, '#2a2a2a');
  },
  limbungan: (ctx, f, rng) => {
    ground(ctx, f, '#a8916a', rng);
    // slipway with a jong under construction
    const s = subFoot(f, 0, 1, 2);
    poly(ctx, [s.cx - s.hw, s.cy, s.cx, s.cy + s.hh, s.cx + s.hw, s.cy, s.cx, s.cy - s.hh], '#8a6a42');
    boat(ctx, f.cx - 4, f.cy + 6, 30, '#7a4a2a');
    ctx.strokeStyle = '#c9a46a';
    ctx.lineWidth = 1;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(f.cx - 4 + k * 8, f.cy + 2);
      ctx.lineTo(f.cx - 4 + k * 8, f.cy - 14);
      ctx.stroke();
    }
    const t = box(ctx, inset(subFoot(f, 1, 0, 2), 0.8), 14, wallColors(TIMBER));
    gableRoof(ctx, t, 12, ATTAP, false);
  },
  surau: (ctx, f, rng) => {
    ground(ctx, f, '#a8b880', rng);
    const body = inset(f, 0.55);
    const top = box(ctx, body, 13, wallColors(WHITE), 6);
    windows(ctx, { ...body, cy: body.cy - 6 }, 13, -1, 1, 2, '#2f6f4f');
    tieredRoof(ctx, top, '#7a4a2a', 2, 10);
    tree(ctx, f.cx + f.hw * 0.5, f.cy + 4, 14, 'palm', rng);
  },
  masjid: (ctx, f, rng) => {
    ground(ctx, f, '#b8c08a', rng);
    const body = inset(f, 0.62);
    const top = box(ctx, body, 22, wallColors(WHITE), 0);
    windows(ctx, body, 22, -1, 1, 4, '#2f6f4f');
    windows(ctx, body, 22, 1, 1, 4, '#2f6f4f');
    tieredRoof(ctx, top, '#6b3a22', 3, 16);
    // pagoda-like minaret (Melaka style)
    const mf = { cx: f.cx + f.hw * 0.62, cy: f.cy - f.hh * 0.05, hw: 8, hh: 4 };
    let mt = mf;
    for (let k = 0; k < 4; k++) {
      mt = box(ctx, inset(mt, 0.9), 12, wallColors(WHITE));
      pyramidRoof(ctx, mt, 4, '#6b3a22', 1.4);
    }
  },
  madrasah: (ctx, f, rng) => {
    ground(ctx, f, '#b4a77a', rng);
    stiltsHouse(ctx, inset(f, 0.85), '#a8743e', ATTAP, rng, 14);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = ['#2e86c1', '#f4f4f4', '#27ae60'][k];
      ctx.fillRect(f.cx - f.hw * 0.55 + k * 7, f.cy + f.hh * 0.4, 4, 6);
    }
  },
  balai: (ctx, f, rng) => {
    ground(ctx, f, '#a8b880', rng);
    stiltsHouse(ctx, inset(f, 0.75), '#8a5a2b', '#7a5a3a', rng, 12, true);
    // beduk drum
    ctx.fillStyle = '#6b3a1a';
    ctx.beginPath();
    ctx.ellipse(f.cx + f.hw * 0.5, f.cy + 4, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  taman: (ctx, f, rng) => {
    diamond(ctx, inset(f, 0.97), '#5fae4a');
    speckle(ctx, f, ['#7cc65a', '#4f963c', '#f0d36a', '#e07aa0'], 30, rng, 2);
    poly(ctx, [f.cx - 20, f.cy, f.cx, f.cy + 10, f.cx + 20, f.cy, f.cx, f.cy - 10], '#d9c48c');
    tree(ctx, f.cx - f.hw * 0.45, f.cy - 2, 18, 'shade', rng);
    tree(ctx, f.cx + f.hw * 0.45, f.cy + 2, 16, 'palm', rng);
  },
  candi: (ctx, f, rng) => {
    ground(ctx, f, '#9aa070', rng);
    // laterite/brick plinth, square sanctuary and stepped roof
    let t = box(ctx, inset(f, 0.75), 10, wallColors('#b0603a'));
    t = box(ctx, inset(t, 0.85), 6, wallColors('#a0552f'));
    t = box(ctx, inset(t, 0.6), 18, wallColors('#b8683f'));
    for (let k = 0; k < 3; k++) t = box(ctx, inset(t, 0.75), 6, wallColors(shade('#a0552f', k * 0.05)));
    ctx.fillStyle = '#a0552f';
    ctx.beginPath();
    ctx.arc(t.cx, t.cy - 4, 5, Math.PI, 0);
    ctx.fill();
    // stair
    poly(ctx, [f.cx - 10, f.cy + f.hh * 0.6, f.cx + 2, f.cy + f.hh * 0.66, f.cx + 2, f.cy + f.hh * 0.66 - 16, f.cx - 10, f.cy + f.hh * 0.6 - 16], '#c8784a');
    tree(ctx, f.cx + f.hw * 0.7, f.cy, 20, 'rain', rng);
  },
  syahbandar: (ctx, f, rng) => {
    ground(ctx, f, '#b49d70', rng);
    stiltsHouse(ctx, inset(f, 0.8), '#7a4a26', '#6b4a2a', rng, 14, true);
    flag(ctx, f.cx + f.hw * 0.55, f.cy + 2, 30, ['#d4ac0d', '#ffffff']);
    // scales
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f.cx - f.hw * 0.55, f.cy + 6);
    ctx.lineTo(f.cx - f.hw * 0.55, f.cy - 6);
    ctx.moveTo(f.cx - f.hw * 0.7, f.cy - 6);
    ctx.lineTo(f.cx - f.hw * 0.4, f.cy - 6);
    ctx.stroke();
  },
  istana: (ctx, f, rng) => {
    ground(ctx, f, '#a8b880', rng);
    // fence
    diamond(ctx, inset(f, 0.95), 'rgba(0,0,0,0)', '#6b4a2a');
    const main = inset(f, 0.62);
    // stilted carved timber palace with long gable roofs (Istana Kesultanan reconstructions)
    for (let k = 0; k < 9; k++) {
      const u = (k % 3) - 1;
      const v = Math.floor(k / 3) - 1;
      ctx.fillStyle = '#4a2a14';
      ctx.fillRect(main.cx + (u - v) * main.hw * 0.45 - 1.5, main.cy + (u + v) * main.hh * 0.45 - 12, 3, 12);
    }
    const raised = { ...main, cy: main.cy - 12 };
    const body = box(ctx, raised, 22, wallColors('#8a4f22'));
    windows(ctx, raised, 22, -1, 1, 6, '#d4ac0d', 0, '#3a1a0a');
    windows(ctx, raised, 22, 1, 1, 5, '#d4ac0d', 0, '#3a1a0a');
    gableRoof(ctx, body, 30, '#5a3418', true, 8, 1.15);
    const wing = { cx: body.cx - body.hw * 0.55, cy: body.cy + body.hh * 0.55 + 22, hw: body.hw * 0.4, hh: body.hh * 0.4 };
    const wt = box(ctx, wing, 14, wallColors('#8a4f22'), 22);
    gableRoof(ctx, wt, 16, '#5a3418', false, 0, 1.2);
    flag(ctx, f.cx + f.hw * 0.75, f.cy, 46, ['#d4ac0d', '#d4ac0d', '#ffffff']);
    tree(ctx, f.cx - f.hw * 0.75, f.cy + 4, 22, 'palm', rng);
  },

  // ---------------- Era 2 ----------------
  lombong: (ctx, f, rng) => {
    // terraced open-cast pit with water and a palong (sluice)
    diamond(ctx, inset(f, 0.97), '#c49a6a');
    diamond(ctx, inset(f, 0.75), '#b0855a');
    diamond(ctx, inset(f, 0.52), '#9a7350');
    diamond(ctx, inset(f, 0.3), '#4f8fa8');
    speckle(ctx, f, ['#e0e4ea', '#d9b98a'], 30, rng, 2);
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.cx - f.hw * 0.8, f.cy - 10);
    ctx.lineTo(f.cx + f.hw * 0.1, f.cy + f.hh * 0.6 - 18);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = '#5b3b22';
      ctx.fillRect(f.cx - f.hw * 0.8 + k * 0.23 * f.hw, f.cy - 10 + k * 0.17 * f.hh * 1.2, 2, 10);
    }
    const t = box(ctx, inset(subFoot(f, 1, 0, 2), 0.6), 10, wallColors(TIMBER));
    gableRoof(ctx, t, 9, ZINC, true);
  },
  kapal_korek: (ctx, f, rng) => {
    diamond(ctx, inset(f, 0.97), '#b8956a');
    diamond(ctx, inset(f, 0.8), '#5a8f9a');
    speckle(ctx, inset(f, 0.8), ['#7fb0b8'], 30, rng, 2);
    // pontoon with multi-storey zinc superstructure and bucket ladder
    const hull = { cx: f.cx, cy: f.cy, hw: f.hw * 0.45, hh: f.hh * 0.45 };
    box(ctx, hull, 8, wallColors('#4a4a4a'));
    let t = box(ctx, inset(hull, 0.85), 22, wallColors('#9aa3a8'), 8);
    windows(ctx, { ...inset(hull, 0.85), cy: inset(hull, 0.85).cy - 8 }, 22, -1, 2, 5, '#2a3a44');
    t = box(ctx, inset(t, 0.7), 14, wallColors('#a8b0b4'));
    gableRoof(ctx, t, 10, '#8a9296', true);
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hull.cx - hull.hw * 0.9, hull.cy - 20);
    ctx.lineTo(hull.cx - hull.hw * 1.9, hull.cy + hull.hh * 0.9);
    ctx.stroke();
    ctx.strokeStyle = '#7a7a7a';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      const x = hull.cx - hull.hw * 0.9 - k * hull.hw * 0.17;
      const y = hull.cy - 20 + k * (hull.hh * 0.9 + 20) / 6;
      ctx.strokeRect(x - 2, y - 2, 4, 4);
    }
    // tailings chute at the back
    poly(ctx, [hull.cx + hull.hw * 0.6, hull.cy - 14, hull.cx + hull.hw * 1.6, hull.cy - hull.hh * 0.8, hull.cx + hull.hw * 1.6, hull.cy - hull.hh * 0.8 + 4, hull.cx + hull.hw * 0.6, hull.cy - 10], '#6a6a6a');
  },
  estet_getah: (ctx, f, rng) => {
    diamond(ctx, inset(f, 0.98), '#4f7a33');
    treeGrid(ctx, f, 4, 'rubber', rng, 22);
    // smokehouse and line-site
    const t = box(ctx, inset(subFoot(f, 0, 0, 3), 0.8), 12, wallColors('#7a5a3a'));
    gableRoof(ctx, t, 10, ZINC, true);
  },
  stesen: (ctx, f, rng) => {
    ground(ctx, f, '#a39a86', rng);
    const body = inset(subFoot(f, 0, 0, 2), 1.4);
    const top = box(ctx, body, 18, wallColors('#efe4c8'));
    arches(ctx, body, 18, 4, 'rgba(60,40,20,0.55)');
    gableRoof(ctx, top, 12, CLAY, true, 0, 1.1);
    // platform canopy
    const pl = subFoot(f, 1, 1, 2);
    box(ctx, inset(pl, 1.1), 2, wallColors('#c8c0aa'));
    gableRoof(ctx, { ...inset(pl, 1.0), cy: pl.cy - 12 }, 5, ZINC, false);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(pl.cx - 1, pl.cy - 12, 2, 12);
  },
  pelabuhan_dagang: (ctx, f, rng) => {
    ground(ctx, f, '#9a9282', rng);
    for (let k = 0; k < 3; k++) {
      const sf = subFoot(f, k, 0, 3);
      const t = box(ctx, inset(sf, 0.85), 16, wallColors('#d9cdb0'));
      windows(ctx, inset(sf, 0.85), 16, 1, 1, 2, '#3a3a3a');
      gableRoof(ctx, t, 10, ZINC, false);
    }
    crane(ctx, subFoot(f, 1, 2, 3).cx, subFoot(f, 1, 2, 3).cy, 34, '#3a3a3a');
    boat(ctx, subFoot(f, 0, 2, 3).cx, subFoot(f, 0, 2, 3).cy + 10, 26, '#2a2a2a');
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(subFoot(f, 0, 2, 3).cx - 3, subFoot(f, 0, 2, 3).cy - 18, 6, 12);
    flag(ctx, f.cx + f.hw * 0.6, f.cy, 40, ['#1f4e79', '#ffffff', '#c0392b']);
  },
  sekolah: (ctx, f, rng) => {
    ground(ctx, f, '#a8b880', rng);
    const body = inset(f, 0.75);
    const top = box(ctx, body, 2 * STOREY, wallColors('#f0e8d0'));
    windows(ctx, body, 2 * STOREY, -1, 2, 4, '#3d6b8a');
    windows(ctx, body, 2 * STOREY, 1, 2, 3, '#3d6b8a');
    gableRoof(ctx, top, 12, CLAY, true);
    flag(ctx, f.cx + f.hw * 0.7, f.cy + 4, 30, ['#c0392b', '#ffffff']);
  },
  hospital: (ctx, f, rng) => {
    ground(ctx, f, '#a8b880', rng);
    const body = inset(f, 0.72);
    const top = box(ctx, body, 2 * STOREY, wallColors('#f4f2ea'));
    windows(ctx, body, 2 * STOREY, -1, 2, 6, '#4a8aa8');
    windows(ctx, body, 2 * STOREY, 1, 2, 5, '#4a8aa8');
    gableRoof(ctx, top, 14, CLAY, true);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(f.cx - 3, f.cy - 2 * STOREY - 12, 6, 16);
    ctx.fillRect(f.cx - 8, f.cy - 2 * STOREY - 7, 16, 6);
    tree(ctx, f.cx + f.hw * 0.75, f.cy, 20, 'shade', rng);
  },
  balai_polis: (ctx, f, rng) => {
    ground(ctx, f, '#a39a86', rng);
    const body = inset(f, 0.7);
    const top = box(ctx, body, 18, wallColors('#e8e2d0'));
    windows(ctx, body, 18, -1, 1, 3, '#2a4a6a');
    pyramidRoof(ctx, top, 10, '#2a4a6a');
    flag(ctx, f.cx + f.hw * 0.6, f.cy, 26, ['#1f4e79', '#ffffff']);
  },
  pejabat_pos: (ctx, f, rng) => {
    ground(ctx, f, '#a39a86', rng);
    const body = inset(f, 0.72);
    const top = box(ctx, body, 18, wallColors('#efe2c0'));
    arches(ctx, body, 18, 3, 'rgba(60,40,20,0.5)');
    gableRoof(ctx, top, 10, CLAY, false);
    // telegraph pole
    ctx.strokeStyle = '#5b3b22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f.cx + f.hw * 0.6, f.cy + 4);
    ctx.lineTo(f.cx + f.hw * 0.6, f.cy - 30);
    ctx.moveTo(f.cx + f.hw * 0.5, f.cy - 26);
    ctx.lineTo(f.cx + f.hw * 0.7, f.cy - 26);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(f.cx - f.hw * 0.6, f.cy + 2, 4, 7);
  },
  bangunan_moorish: (ctx, f, rng) => {
    ground(ctx, f, '#a8a090', rng);
    const body = inset(f, 0.7);
    const top = box(ctx, body, 2.5 * STOREY, wallColors('#f2ead6'));
    arches(ctx, body, 22, 7, 'rgba(70,50,30,0.55)');
    windows(ctx, body, 2.5 * STOREY, 1, 2, 6, '#5a4a3a', 0, '#8a7a5a');
    // chhatri domes on corners and a central onion dome
    const corners: Array<[number, number]> = [
      [top.cx - top.hw, top.cy],
      [top.cx, top.cy - top.hh],
      [top.cx + top.hw, top.cy],
      [top.cx, top.cy + top.hh],
    ];
    for (const [x, y] of corners) {
      box(ctx, { cx: x, cy: y, hw: 7, hh: 3.5 }, 12, wallColors('#f2ead6'));
      dome(ctx, x, y - 12, 6, '#f2ead6');
    }
    const drum = box(ctx, inset(top, 0.35), 12, wallColors('#f2ead6'));
    dome(ctx, drum.cx, drum.cy, 14, '#f4ecd8');
    tree(ctx, f.cx - f.hw * 0.8, f.cy + 4, 20, 'palm', rng);
    tree(ctx, f.cx + f.hw * 0.8, f.cy + 4, 20, 'palm', rng);
  },

  // ---------------- Era 3 ----------------
  janakuasa: (ctx, f, rng) => {
    ground(ctx, f, '#8a8a84', rng);
    const t = shed(ctx, subFoot(f, 0, 0, 2), '#c8c2b4', '#7f878c', 26);
    void t;
    for (let k = 0; k < 2; k++) chimney(ctx, subFoot(f, 1, k, 2).cx, subFoot(f, 1, k, 2).cy, 50, rng, '#b0b0b0');
    // cooling tower
    const c = subFoot(f, 0, 1, 2);
    ctx.fillStyle = '#c8c8c0';
    ctx.beginPath();
    ctx.moveTo(c.cx - 14, c.cy);
    ctx.quadraticCurveTo(c.cx - 8, c.cy - 20, c.cx - 11, c.cy - 34);
    ctx.lineTo(c.cx + 11, c.cy - 34);
    ctx.quadraticCurveTo(c.cx + 8, c.cy - 20, c.cx + 14, c.cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9a9a92';
    ctx.beginPath();
    ctx.ellipse(c.cx, c.cy - 34, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  empangan: (ctx, f, rng) => {
    water(ctx, inset(subFoot(f, 0, 0, 2), 1.6));
    // curved concrete dam wall
    const w = { cx: f.cx + f.hw * 0.1, cy: f.cy + f.hh * 0.1, hw: f.hw * 0.75, hh: f.hh * 0.18 };
    box(ctx, w, 24, wallColors('#cfcfc8'));
    // spillway
    poly(ctx, [w.cx - 6, w.cy + 4, w.cx + 6, w.cy + 8, w.cx + 6, w.cy + 28, w.cx - 6, w.cy + 24], 'rgba(220,240,255,0.85)');
    const ph = box(ctx, inset(subFoot(f, 1, 1, 2), 0.6), 12, wallColors('#e6e2d6'));
    void ph;
    speckle(ctx, f, ['#6aa84f'], 10, rng, 3);
  },
  loji_air: (ctx, f, rng) => {
    ground(ctx, f, '#9aa09a', rng);
    for (let k = 0; k < 2; k++) {
      const sf = subFoot(f, k, 1, 2);
      ctx.fillStyle = '#c8ccc8';
      ctx.beginPath();
      ctx.ellipse(sf.cx, sf.cy, sf.hw * 0.8, sf.hh * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a9ac0';
      ctx.beginPath();
      ctx.ellipse(sf.cx, sf.cy, sf.hw * 0.66, sf.hh * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = box(ctx, inset(subFoot(f, 0, 0, 2), 0.8), 18, wallColors('#e8e6de'));
    windows(ctx, inset(subFoot(f, 0, 0, 2), 0.8), 18, -1, 1, 3, '#3a6a8a');
    gableRoof(ctx, t, 6, '#4a7a9a', true);
    box(ctx, { ...inset(subFoot(f, 1, 0, 2), 0.35) }, 34, wallColors('#4a90b8'));
  },
  ladang_sawit: (ctx, f, rng) => {
    diamond(ctx, inset(f, 0.98), '#5a7a32');
    treeGrid(ctx, f, 4, 'oilpalm', rng, 22);
    const t = box(ctx, inset(subFoot(f, 0, 0, 3), 0.7), 9, wallColors('#e6dcc0'));
    gableRoof(ctx, t, 8, ZINC, true);
  },
  ftz: (ctx, f, rng) => {
    ground(ctx, f, '#9a9a94', rng);
    for (let k = 0; k < 3; k++) {
      const sf = subFoot(f, k, k === 1 ? 0 : 1, 3);
      const body = inset(sf, 1.1);
      const t = box(ctx, body, 22, wallColors('#f0f0ec'));
      poly(ctx, [body.cx - body.hw, body.cy - 10, body.cx, body.cy + body.hh - 10, body.cx, body.cy + body.hh - 15, body.cx - body.hw, body.cy - 15], '#2e6fa8');
      box(ctx, inset(t, 0.4), 5, wallColors('#c8c8c8'));
    }
    flag(ctx, subFoot(f, 2, 2, 3).cx, subFoot(f, 2, 2, 3).cy, 34, ['#c0392b', '#ffffff', '#1f4e79', '#d4ac0d']);
    tree(ctx, subFoot(f, 0, 2, 3).cx, subFoot(f, 0, 2, 3).cy, 16, 'palm', rng);
  },
  kilang_kereta: (ctx, f, rng) => {
    ground(ctx, f, '#8f8f8a', rng);
    const big = inset(f, 0.72);
    const t = shed(ctx, big, '#e2ded4', '#8a949a', 26, true);
    void t;
    windows(ctx, big, 26, -1, 1, 8, '#4a7a9a');
    for (let k = 0; k < 6; k++) {
      const sf = subFoot(f, k % 3, 2 + Math.floor(k / 3) * 0, 3);
      const x = sf.cx - 10 + (k > 2 ? 12 : 0);
      ctx.fillStyle = ['#c0392b', '#f4f4f4', '#2e86c1'][k % 3];
      ctx.fillRect(x, sf.cy + 2, 8, 4);
    }
  },
  pelabuhan_kontena: (ctx, f, rng) => {
    ground(ctx, f, '#8a8a86', rng);
    containers(ctx, f, rng);
    for (let k = 0; k < 2; k++) {
      const sf = subFoot(f, 2, k, 3);
      // gantry crane
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sf.cx - 10, sf.cy);
      ctx.lineTo(sf.cx - 10, sf.cy - 50);
      ctx.moveTo(sf.cx + 10, sf.cy + 5);
      ctx.lineTo(sf.cx + 10, sf.cy - 45);
      ctx.moveTo(sf.cx - 24, sf.cy - 48);
      ctx.lineTo(sf.cx + 30, sf.cy - 40);
      ctx.stroke();
    }
    boat(ctx, subFoot(f, 2, 2, 3).cx + 6, subFoot(f, 2, 2, 3).cy + 12, 34, '#1f3a5a');
  },
  universiti: (ctx, f, rng) => {
    ground(ctx, f, '#7fae5a', rng);
    const body = inset(subFoot(f, 0, 0, 2), 1.3);
    const t = box(ctx, body, 3 * STOREY, wallColors('#efe6d2'));
    windows(ctx, body, 3 * STOREY, -1, 3, 5, '#3a5a7a');
    windows(ctx, body, 3 * STOREY, 1, 3, 4, '#3a5a7a');
    pyramidRoof(ctx, t, 16, '#3f6f8f');
    // clock tower
    const ct = box(ctx, { cx: f.cx + f.hw * 0.35, cy: f.cy + f.hh * 0.2, hw: 9, hh: 4.5 }, 60, wallColors('#e8dcc0'));
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ct.cx - 4, ct.cy + 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
    pyramidRoof(ctx, ct, 14, '#3f6f8f', 1.3);
    tree(ctx, f.cx - f.hw * 0.6, f.cy + 10, 20, 'shade', rng);
    tree(ctx, f.cx + f.hw * 0.7, f.cy + 4, 20, 'shade', rng);
  },
  klinik_desa: (ctx, f, rng) => {
    ground(ctx, f, '#a8b880', rng);
    const body = inset(f, 0.66);
    const t = box(ctx, body, 14, wallColors('#f4f2ea'));
    windows(ctx, body, 14, -1, 1, 3, '#4a8aa8');
    gableRoof(ctx, t, 9, '#4a8aa8', true);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(f.cx - 2, f.cy - 30, 4, 10);
    ctx.fillRect(f.cx - 5, f.cy - 27, 10, 4);
  },
  stadium: (ctx, f, rng) => {
    ground(ctx, f, '#8a8a84', rng);
    // oval stands
    ctx.fillStyle = '#d8d4c8';
    ctx.beginPath();
    ctx.ellipse(f.cx, f.cy - 6, f.hw * 0.85, f.hh * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8b2a2';
    ctx.beginPath();
    ctx.ellipse(f.cx, f.cy - 14, f.hw * 0.82, f.hh * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4f9a3f';
    ctx.beginPath();
    ctx.ellipse(f.cx, f.cy - 12, f.hw * 0.55, f.hh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(f.cx, f.cy - 12, f.hw * 0.4, f.hh * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    // cantilever roof on the main stand
    poly(ctx, [f.cx - f.hw * 0.7, f.cy - 30, f.cx - f.hw * 0.05, f.cy - f.hh * 0.6 - 32, f.cx + f.hw * 0.05, f.cy - f.hh * 0.6 - 22, f.cx - f.hw * 0.6, f.cy - 20], '#e8e6e0', '#8a8a84');
    // floodlights
    for (const [u, v] of [[-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]]) {
      const x = f.cx + u * f.hw;
      const y = f.cy + v * f.hh - 6;
      ctx.strokeStyle = '#6a6a6a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 46);
      ctx.stroke();
      ctx.fillStyle = '#fffbe0';
      ctx.fillRect(x - 4, y - 50, 8, 5);
    }
    flag(ctx, f.cx, f.cy - f.hh * 0.6 - 30, 26, ['#c0392b', '#ffffff', '#c0392b', '#ffffff']);
  },

  // ---------------- Era 4 ----------------
  pusat_data: (ctx, f, rng) => {
    ground(ctx, f, '#9aa29a', rng);
    const body = inset(f, 0.78);
    const t = box(ctx, body, 30, wallColors('#e8ecee'));
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#3fd0a0' : '#2e86c1';
      const x = body.cx - body.hw + (k + 0.5) * (body.hw / 6);
      const y = body.cy + (k + 0.5) * (body.hh / 6) - 18;
      ctx.fillRect(x - 1, y, 2, 10);
    }
    for (let k = 0; k < 4; k++) diamond(ctx, { cx: t.cx - t.hw * 0.5 + k * t.hw * 0.33, cy: t.cy, hw: 7, hh: 3.5 }, '#9aa6ae', '#6a767e');
  },
  hab_inovasi: (ctx, f, rng) => {
    ground(ctx, f, '#7fae6a', rng);
    glassTower(ctx, subFoot(f, 0, 0, 2), 70, '#56b0c8', rng);
    const low = inset(subFoot(f, 1, 1, 2), 1.3);
    const t = box(ctx, low, 22, wallColors('#f2f4f4'));
    windows(ctx, low, 22, -1, 2, 6, '#5ab0d8');
    diamond(ctx, inset(t, 0.8), '#6fbf5a');
    tree(ctx, f.cx + f.hw * 0.6, f.cy - 4, 16, 'palm', rng);
  },
  ladang_solar: (ctx, f, rng) => {
    diamond(ctx, inset(f, 0.98), '#8fae6a');
    speckle(ctx, f, ['#7c9a5a'], 30, rng, 2);
    solarPanels(ctx, inset(f, 0.92));
  },
  stesen_mrt: (ctx, f, rng) => {
    ground(ctx, f, '#9a9a96', rng);
    const body = inset(f, 0.7);
    box(ctx, body, 6, wallColors('#d8d8d2'));
    const deck = box(ctx, body, 6, wallColors('#c8c8c2'), 36);
    ctx.fillStyle = '#b0b0aa';
    ctx.fillRect(body.cx - 4, body.cy - 36, 8, 36);
    // curved roof
    ctx.fillStyle = '#e6eef2';
    ctx.beginPath();
    ctx.moveTo(deck.cx - deck.hw, deck.cy);
    ctx.quadraticCurveTo(deck.cx, deck.cy - 26, deck.cx + deck.hw, deck.cy);
    ctx.lineTo(deck.cx, deck.cy + deck.hh);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8aa';
    ctx.stroke();
    ctx.fillStyle = '#2e8b57';
    ctx.fillRect(f.cx + f.hw * 0.4, f.cy - 20, 10, 8);
  },
  lapangan_terbang: (ctx, f, rng) => {
    ground(ctx, f, '#8f948e', rng);
    // runway
    poly(ctx, [f.cx - f.hw * 0.9, f.cy + f.hh * 0.05, f.cx - f.hw * 0.75, f.cy - f.hh * 0.05, f.cx + f.hw * 0.05, f.cy + f.hh * 0.75, f.cx - f.hw * 0.1, f.cy + f.hh * 0.88], '#3a3a40');
    // terminal with hyperbolic-paraboloid roof modules
    const term = inset(subFoot(f, 1, 0, 2), 1.3);
    box(ctx, term, 20, wallColors('#dfe6ea'));
    for (let k = 0; k < 4; k++) {
      const sf = subFoot(term, k % 2, Math.floor(k / 2), 2);
      pyramidRoof(ctx, { ...sf, cy: sf.cy - 20 }, -6, '#eaeaea', 1.05);
    }
    box(ctx, { cx: f.cx + f.hw * 0.62, cy: f.cy + f.hh * 0.1, hw: 6, hh: 3 }, 50, wallColors('#e8ecee'));
    // plane
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(f.cx - f.hw * 0.35, f.cy + f.hh * 0.32, 16, 3.5, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(f.cx - f.hw * 0.35 - 2, f.cy + f.hh * 0.32 - 12, 4, 24);
  },
  menara_telekom: (ctx, f, rng) => {
    ground(ctx, f, '#8fae6a', rng);
    const sh = box(ctx, { cx: f.cx, cy: f.cy, hw: 6, hh: 3 }, 110, wallColors('#e6e6e0'));
    // pod
    ctx.fillStyle = '#5aa0c8';
    ctx.beginPath();
    ctx.ellipse(sh.cx, sh.cy + 18, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(sh.cx - 14, sh.cy + 16, 28, 3);
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sh.cx, sh.cy);
    ctx.lineTo(sh.cx, sh.cy - 30);
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(sh.cx - 1.5, sh.cy - 32, 3, 3);
  },
  kitar_semula: (ctx, f, rng) => {
    ground(ctx, f, '#8fae6a', rng);
    const t = shed(ctx, inset(f, 0.9), '#e6efe6', '#3f8f5a', 18);
    void t;
    const cols = ['#2e86c1', '#27ae60', '#f1c40f'];
    for (let k = 0; k < 3; k++) box(ctx, { cx: f.cx - f.hw * 0.55 + k * 10, cy: f.cy + f.hh * 0.45, hw: 4, hh: 2 }, 7, wallColors(cols[k]));
  },
  menara_tinjau: (ctx, f, rng) => {
    ground(ctx, f, '#9a8a62', rng);
    const post = inset(f, 0.32);
    stilts(ctx, { ...post, cy: post.cy }, 44, '#5a3a1e');
    const deck = box(ctx, { ...inset(f, 0.42), cy: f.cy - 44 }, 10, wallColors(TIMBER));
    pyramidRoof(ctx, deck, 16, ATTAP, 1.35);
  },
  tebatan_banjir: (ctx, f, rng) => {
    water(ctx, inset(f, 0.95));
    for (let k = -2; k <= 2; k++) {
      const pier = { cx: f.cx + k * f.hw * 0.32, cy: f.cy + k * f.hh * 0.32, hw: 5, hh: 2.5 };
      box(ctx, pier, 22, wallColors('#cfcfc8'));
    }
    poly(ctx, [f.cx - f.hw * 0.7, f.cy - f.hh * 0.7 - 20, f.cx + f.hw * 0.7, f.cy + f.hh * 0.7 - 20, f.cx + f.hw * 0.7, f.cy + f.hh * 0.7 - 26, f.cx - f.hw * 0.7, f.cy - f.hh * 0.7 - 26], '#d8d8d0', '#8a8a84', 0.8);
    const ch = box(ctx, inset(subFoot(f, 1, 0, 2), 0.6), 14, wallColors('#e6e2d6'));
    pyramidRoof(ctx, ch, 6, '#3d5f8a');
    speckle(ctx, f, ['#6aa84f'], 6, rng, 3);
  },
  parlimen: (ctx, f, rng) => {
    ground(ctx, f, '#7fae5a', rng);
    const hall = inset(subFoot(f, 1, 1, 2), 1.4);
    const ht = box(ctx, hall, 20, wallColors('#f2f0ea'));
    for (let k = 0; k < 6; k++) {
      const pf = { cx: ht.cx - ht.hw * 0.7 + k * ht.hw * 0.28, cy: ht.cy - ht.hh * 0.7 + k * ht.hh * 0.28, hw: ht.hw * 0.16, hh: ht.hh * 0.16 };
      pyramidRoof(ctx, pf, 18, '#cfcfc8', 1);
    }
    const tw = { ...inset(subFoot(f, 0, 0, 2), 0.7) };
    const tt = box(ctx, tw, 110, wallColors('#f4f2ec'));
    windows(ctx, tw, 110, -1, 14, 3, '#3a5a7a');
    windows(ctx, tw, 110, 1, 14, 3, '#3a5a7a');
    void tt;
    flag(ctx, f.cx + f.hw * 0.7, f.cy + 4, 34, ['#cc0001', '#ffffff', '#010066']);
  },
  menara_118: (ctx, f, rng) => {
    ground(ctx, f, '#9aa29a', rng);
    let cur = inset(f, 0.62);
    const glass = { top: '#cfe6f2', left: '#8fb6cc', right: '#5f88a2', outline: '#3e5a6c' };
    for (const h of [140, 110, 80, 45, 28]) {
      cur = box(ctx, cur, h, glass);
      ctx.strokeStyle = 'rgba(230,240,250,0.45)';
      ctx.lineWidth = 0.6;
      for (let y = 8; y < h; y += 10) {
        ctx.beginPath();
        ctx.moveTo(cur.cx - cur.hw, cur.cy + h - y);
        ctx.lineTo(cur.cx, cur.cy + cur.hh + h - y - 5);
        ctx.lineTo(cur.cx + cur.hw, cur.cy + h - y);
        ctx.stroke();
      }
      cur = inset(cur, 0.8);
    }
    ctx.strokeStyle = '#e0e6ea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cur.cx, cur.cy);
    ctx.lineTo(cur.cx, cur.cy - 90);
    ctx.stroke();
  },
  menara_berkembar: (ctx, f, rng) => {
    ground(ctx, f, '#7fa96a', rng);
    // two stepped steel towers with a skybridge, 8-point-star plan suggested by facets
    const towers = [subFoot(f, 0, 1, 2), subFoot(f, 1, 0, 2)];
    for (const tf of towers.sort((a, b) => a.cy - b.cy)) {
      let cur = { cx: tf.cx, cy: tf.cy, hw: tf.hw * 0.55, hh: tf.hh * 0.55 };
      const steel = { top: '#eef2f4', left: '#c8d0d6', right: '#98a4ae', outline: '#6a747c' };
      const tiers = [150, 40, 26, 18, 12];
      for (const h of tiers) {
        cur = box(ctx, cur, h, steel);
        ctx.strokeStyle = 'rgba(80,100,120,0.35)';
        ctx.lineWidth = 0.6;
        for (let y = 6; y < h; y += 6) {
          ctx.beginPath();
          ctx.moveTo(cur.cx - cur.hw, cur.cy + h - y);
          ctx.lineTo(cur.cx, cur.cy + cur.hh + h - y);
          ctx.lineTo(cur.cx + cur.hw, cur.cy + h - y);
          ctx.stroke();
        }
        cur = inset(cur, 0.82);
      }
      ctx.strokeStyle = '#d8dde0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cur.cx, cur.cy);
      ctx.lineTo(cur.cx, cur.cy - 60);
      ctx.stroke();
    }
    // skybridge
    const a = towers[0];
    const b = towers[1];
    ctx.fillStyle = '#9aa4ac';
    poly(ctx, [a.cx, a.cy - 120, b.cx, b.cy - 120, b.cx, b.cy - 126, a.cx, a.cy - 126], '#aab4bc', '#6a747c', 0.8);
    tree(ctx, f.cx - f.hw * 0.75, f.cy + 6, 18, 'palm', rng);
    tree(ctx, f.cx + f.hw * 0.75, f.cy + 6, 18, 'palm', rng);
  },
};

/** Raised timber building on stilts (balai, madrasah, syahbandar). */
function stiltsHouse(ctx: Ctx, f: Foot, wall: string, roof: string, rng: Rng, h: number, gonjong = false) {
  ctx.strokeStyle = '#4a2a14';
  ctx.lineWidth = 2;
  for (const [u, v] of [[-0.85, 0], [0, 0.85], [0.85, 0], [-0.3, 0.55], [0.3, 0.55]]) {
    ctx.beginPath();
    ctx.moveTo(f.cx + u * f.hw, f.cy + v * f.hh);
    ctx.lineTo(f.cx + u * f.hw, f.cy + v * f.hh - 9);
    ctx.stroke();
  }
  const raised = { ...f, cy: f.cy - 9 };
  const top = box(ctx, raised, h, wallColors(shade(wall, rng.range(-0.05, 0.05))));
  windows(ctx, raised, h, -1, 1, 3, '#2a1608');
  windows(ctx, raised, h, 1, 1, 2, '#2a1608');
  gableRoof(ctx, top, h, roof, true, gonjong ? 8 : 0, 1.2);
}

/** Headroom needed above the footprint for each building sprite. */
function headroom(id: string, size: number): number {
  const tall: Record<string, number> = {
    menara_berkembar: 420,
    menara_118: 520,
    parlimen: 150,
    menara_tinjau: 100,
    menara_telekom: 170,
    hab_inovasi: 140,
    janakuasa: 120,
    universiti: 140,
    lapangan_terbang: 110,
    pelabuhan_kontena: 110,
    bangunan_moorish: 110,
    istana: 120,
    masjid: 120,
    stadium: 110,
    candi: 110,
  };
  return tall[id] ?? 60 + size * 22;
}

export function buildingSprite(factory: CanvasFactory, id: string): Sprite {
  const def = BUILDING_MAP[id];
  const size = def?.size ?? 1;
  return makeSprite(factory, size, headroom(id, size), (ctx, f) => {
    const rng = new Rng(hashString(id));
    const draw = BUILDING_DRAW[id];
    if (draw) draw(ctx, f, rng);
    else {
      // generic fallback: a box in the category colour
      const top = box(ctx, inset(f, 0.7), 20, wallColors('#c8b89a'));
      gableRoof(ctx, top, 10, CLAY, true);
    }
  });
}

export { shophouses };
