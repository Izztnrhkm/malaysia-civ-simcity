import { Rng } from '../../core/rng';
import { CanvasFactory, Sprite, makeSprite } from './canvas';
import {
  BoxColors,
  Ctx,
  Foot,
  box,
  diamond,
  gableRoof,
  inset,
  poly,
  pyramidRoof,
  shade,
  smoke,
  speckle,
  stall,
  stilts,
  tree,
  wallColors,
  windows,
} from './primitives';

export const STOREY = 16;

/** Sub-lot (i, j) of an n x n split of footprint f. */
export function subFoot(f: Foot, i: number, j: number, n: number): Foot {
  const u = (i + 0.5) / n;
  const v = (j + 0.5) / n;
  return { cx: f.cx + u * f.hw - v * f.hw, cy: f.cy - f.hh + u * f.hh + v * f.hh, hw: f.hw / n, hh: f.hh / n };
}

const PASTELS = ['#efdcae', '#cfe5d3', '#f2c9a6', '#d6e0f2', '#f0d0d8', '#e6e2c2'];
const TIMBER = '#9a6a3c';
const ATTAP = '#b9995a';
const ZINC = '#a3acb2';
const CLAY = '#b5562f';

export function kampungHouse(ctx: Ctx, f: Foot, rng: Rng, roof = ATTAP, gonjong = false) {
  const body = inset(f, 0.62);
  stilts(ctx, body, 9);
  const raised = { ...body, cy: body.cy - 9 };
  const top = box(ctx, raised, 12, wallColors(shade(TIMBER, rng.range(-0.08, 0.08))));
  windows(ctx, raised, 12, 1, 1, 2, '#3a2412');
  // front stair
  poly(ctx, [body.cx - body.hw * 0.2, body.cy + body.hh * 0.9, body.cx - body.hw * 0.05, body.cy + body.hh * 0.98, body.cx - body.hw * 0.05, body.cy + body.hh * 0.6 - 9, body.cx - body.hw * 0.2, body.cy + body.hh * 0.5 - 9], '#6b4626');
  gableRoof(ctx, top, 13, roof, rng.chance(0.5), gonjong ? 7 : 0, 1.25);
}

export function shophouses(ctx: Ctx, f: Foot, storeys: number, rng: Rng, roof = CLAY, palette = PASTELS) {
  const body = inset(f, 0.85);
  const h = storeys * STOREY;
  const wall = palette[rng.int(0, palette.length - 1)];
  const top = box(ctx, body, h, wallColors(wall));
  // five-foot way: dark arcade band along the front (left) wall
  poly(ctx, [body.cx - body.hw, body.cy, body.cx, body.cy + body.hh, body.cx, body.cy + body.hh - 9, body.cx - body.hw, body.cy - 9], 'rgba(40,25,15,0.55)');
  windows(ctx, body, h, -1, storeys, 4, '#4a6a7a', 0, shade(wall, -0.4));
  windows(ctx, body, h, 1, storeys, 3, '#4a6a7a', 0, shade(wall, -0.4));
  gableRoof(ctx, top, 10, roof, false, 0, 1.05);
}

export function terraceRow(ctx: Ctx, f: Foot, storeys: number, rng: Rng) {
  for (let k = 0; k < 2; k++) {
    const sf = subFoot(f, k, 0, 2);
    const lot = { ...sf, cy: sf.cy + sf.hh * 0.5, hw: sf.hw * 0.95, hh: sf.hh * 0.95 };
    const top = box(ctx, inset(lot, 0.9), storeys * STOREY, wallColors(PASTELS[rng.int(0, 5)]));
    windows(ctx, inset(lot, 0.9), storeys * STOREY, -1, storeys, 2, '#3d5866');
    gableRoof(ctx, top, 9, '#c4622f', false, 0, 1.08);
  }
  // front yards with a car
  const yard = subFoot(f, 0, 1, 2);
  diamond(ctx, inset(yard, 0.7), '#9a9a92');
  car(ctx, yard.cx, yard.cy, rng);
  tree(ctx, subFoot(f, 1, 1, 2).cx, subFoot(f, 1, 1, 2).cy + 4, 12, 'shade', rng);
}

export function car(ctx: Ctx, x: number, y: number, rng: Rng) {
  const c = ['#c0392b', '#2e86c1', '#f4f4f4', '#27ae60', '#7f8c8d', '#f1c40f'][rng.int(0, 5)];
  const f = { cx: x, cy: y, hw: 7, hh: 3.5 };
  box(ctx, f, 3, wallColors(c));
  box(ctx, inset({ ...f, cy: f.cy - 3 }, 0.6), 2.5, wallColors('#9fd3e8'));
}

export function flats(ctx: Ctx, f: Foot, storeys: number, wall: string, glass: string, rng: Rng, crown = false) {
  const body = inset(f, 0.72);
  const h = storeys * STOREY * 0.8;
  const top = box(ctx, body, h, wallColors(wall));
  windows(ctx, body, h, -1, storeys, 4, glass, 0, shade(wall, -0.3));
  windows(ctx, body, h, 1, storeys, 3, glass, 0, shade(wall, -0.3));
  if (crown) {
    const t2 = box(ctx, inset(top, 0.7), 10, wallColors(shade(wall, 0.1)));
    pyramidRoof(ctx, t2, 14, shade(glass, -0.1), 1);
  } else {
    box(ctx, inset(top, 0.4), 5, wallColors('#bbbbbb'));
    // water tank on the roof
    box(ctx, { ...inset(top, 0.2), cx: top.cx + top.hw * 0.4 }, 6, wallColors('#4a90b8'));
  }
  void rng;
}

export function glassTower(ctx: Ctx, f: Foot, h: number, glass: string, rng: Rng, spire = false) {
  const body = inset(f, 0.62);
  const c: BoxColors = { top: shade(glass, 0.3), left: shade(glass, 0.05), right: shade(glass, -0.25), outline: shade(glass, -0.55) };
  const top = box(ctx, body, h, c);
  // vertical mullions
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.7;
  for (let k = 1; k < 5; k++) {
    const t = k / 5;
    for (const side of [-1, 1]) {
      const x = body.cx + side * body.hw * (1 - t);
      const y = body.cy + body.hh * t;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - h);
      ctx.stroke();
    }
  }
  // horizontal bands
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let y = 10; y < h; y += 10) {
    ctx.beginPath();
    ctx.moveTo(body.cx - body.hw, body.cy - y);
    ctx.lineTo(body.cx, body.cy + body.hh - y);
    ctx.lineTo(body.cx + body.hw, body.cy - y);
    ctx.stroke();
  }
  const crown = box(ctx, inset(top, 0.75), 8, wallColors('#e8eef2'));
  if (spire) {
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(crown.cx, crown.cy);
    ctx.lineTo(crown.cx, crown.cy - 26);
    ctx.stroke();
  } else if (rng.chance(0.5)) {
    // helipad / garden roof
    diamond(ctx, inset(crown, 0.6), '#5aa05a');
  }
}

export function shed(ctx: Ctx, f: Foot, wall: string, roof: string, h = 12, sawtooth = false) {
  const body = inset(f, 0.82);
  const top = box(ctx, body, h, wallColors(wall));
  if (sawtooth) {
    for (let k = 0; k < 3; k++) {
      const sf = { cx: top.cx - top.hw * 0.5 + (k * top.hw) / 2.4, cy: top.cy - top.hh * 0.5 + (k * top.hh) / 2.4, hw: top.hw * 0.42, hh: top.hh * 0.42 };
      gableRoof(ctx, sf, 7, roof, false, 0, 1);
    }
  } else gableRoof(ctx, top, 9, roof, true, 0, 1.08);
  return top;
}

export function chimney(ctx: Ctx, x: number, y: number, h: number, rng: Rng, color = '#8a4a32') {
  box(ctx, { cx: x, cy: y, hw: 4, hh: 2 }, h, wallColors(color));
  smoke(ctx, x + 2, y - h - 4, 14, rng);
}

function lot(ctx: Ctx, f: Foot, color: string, rng: Rng) {
  diamond(ctx, inset(f, 0.96), color);
  speckle(ctx, f, [shade(color, 0.1), shade(color, -0.1)], 12, rng, 1.6);
}

/** Zone building sprite: zone 1=R, 2=C, 3=I; level 1..4; era style 1..4. */
export function zoneSprite(factory: CanvasFactory, zone: number, level: number, era: number, variant: number): Sprite {
  const extra = 30 + level * 34 + (era >= 3 && level >= 3 ? 80 : 0) + (era === 4 && level === 4 ? 120 : 0);
  return makeSprite(factory, 1, extra, (ctx, f) => {
    const rng = new Rng(zone * 7919 + level * 131 + era * 17 + variant * 3);
    if (zone === 1) drawResidential(ctx, f, level, era, variant, rng);
    else if (zone === 2) drawCommercial(ctx, f, level, era, variant, rng);
    else drawIndustrial(ctx, f, level, era, variant, rng);
  });
}

function drawResidential(ctx: Ctx, f: Foot, level: number, era: number, variant: number, rng: Rng) {
  if (era <= 2 && level <= 2) {
    lot(ctx, f, '#7aa34f', rng);
    const roof = era === 2 && variant % 2 ? ZINC : ATTAP;
    if (level === 1) {
      tree(ctx, f.cx + f.hw * 0.45, f.cy - 2, 16, 'palm', rng);
      kampungHouse(ctx, { ...f, cy: f.cy + 2 }, rng, roof, variant === 3);
      tree(ctx, f.cx - f.hw * 0.5, f.cy + 6, 14, rng.chance(0.5) ? 'palm' : 'shade', rng);
    } else {
      kampungHouse(ctx, subFoot(f, 0, 0, 2), rng, roof, variant === 3);
      tree(ctx, subFoot(f, 1, 0, 2).cx, subFoot(f, 1, 0, 2).cy, 16, 'palm', rng);
      kampungHouse(ctx, subFoot(f, 0, 1, 2), rng, roof);
      kampungHouse(ctx, subFoot(f, 1, 1, 2), rng, roof, variant === 1);
    }
    return;
  }
  if (era === 2) {
    lot(ctx, f, '#a39a86', rng);
    shophouses(ctx, f, 2, rng);
    return;
  }
  if (era === 3) {
    if (level <= 2) {
      lot(ctx, f, '#8fae6a', rng);
      terraceRow(ctx, f, level, rng);
    } else if (level === 3) {
      lot(ctx, f, '#9c9c94', rng);
      flats(ctx, f, 5, PASTELS[variant], '#4d7a99', rng);
    } else {
      lot(ctx, f, '#9c9c94', rng);
      flats(ctx, f, 13, ['#e8e2d0', '#d9e6ee', '#efe0c6', '#e2e8d8'][variant], '#3f6f8f', rng);
    }
    return;
  }
  // era 4
  if (level <= 2) {
    lot(ctx, f, '#86b46a', rng);
    for (let k = 0; k < 2; k++) {
      const sf = subFoot(f, k, k, 2);
      const top = box(ctx, inset(sf, 0.8), 2 * STOREY * 0.8, wallColors(['#f2f2ee', '#e0e6ea', '#efe6d8'][rng.int(0, 2)]));
      windows(ctx, inset(sf, 0.8), 25, -1, 2, 2, '#5aa0c8');
      pyramidRoof(ctx, top, 9, '#5d6168');
    }
    car(ctx, subFoot(f, 1, 0, 2).cx, subFoot(f, 1, 0, 2).cy, rng);
    tree(ctx, subFoot(f, 0, 1, 2).cx, subFoot(f, 0, 1, 2).cy, 13, 'palm', rng);
  } else {
    lot(ctx, f, '#7fa96a', rng);
    const h = level === 3 ? 120 : 220;
    flats(ctx, f, level === 3 ? 9 : 0, '#eef1f2', '#5fb0d8', rng, true);
    if (level === 4) {
      glassTower(ctx, f, h, ['#5fa8c8', '#6fc0b8', '#7a9ed8', '#88b8d0'][variant], rng);
    }
  }
}

function drawCommercial(ctx: Ctx, f: Foot, level: number, era: number, variant: number, rng: Rng) {
  const cloths = ['#c0392b', '#d4ac0d', '#1f8a70', '#8e44ad', '#e67e22'];
  if (era === 1) {
    lot(ctx, f, '#b9a06e', rng);
    if (level === 1) {
      stall(ctx, subFoot(f, 0, 0, 2).cx, subFoot(f, 0, 0, 2).cy, 22, cloths[variant]);
      stall(ctx, subFoot(f, 1, 0, 2).cx, subFoot(f, 1, 0, 2).cy, 22, cloths[(variant + 1) % 5]);
      stall(ctx, subFoot(f, 0, 1, 2).cx, subFoot(f, 0, 1, 2).cy, 22, cloths[(variant + 2) % 5]);
      tree(ctx, subFoot(f, 1, 1, 2).cx, subFoot(f, 1, 1, 2).cy, 14, 'palm', rng);
    } else {
      const body = inset(f, 0.8);
      const top = box(ctx, body, 16, wallColors(TIMBER));
      windows(ctx, body, 16, -1, 1, 4, '#3a2412');
      gableRoof(ctx, top, 12, ATTAP, true, 0, 1.15);
      stall(ctx, f.cx - f.hw * 0.55, f.cy + f.hh * 0.45, 18, cloths[variant]);
    }
    return;
  }
  if (era === 2) {
    lot(ctx, f, '#a39a86', rng);
    shophouses(ctx, f, level === 1 ? 1 : level === 2 ? 2 : 3, rng, variant % 2 ? CLAY : '#9e4a2a');
    return;
  }
  if (era === 3) {
    lot(ctx, f, '#8a8a86', rng);
    if (level <= 2) shophouses(ctx, f, level + 1, rng, '#8a8a8a', ['#f2f2ea', '#e8e0cc', '#dfe9ef']);
    else if (level === 3) {
      flats(ctx, f, 6, '#e6dccb', '#355f7a', rng);
    } else {
      // shopping complex: wide box with signage band
      const body = inset(f, 0.9);
      const top = box(ctx, body, 40, wallColors('#e9e4da'));
      poly(ctx, [body.cx - body.hw, body.cy - 28, body.cx, body.cy + body.hh - 28, body.cx, body.cy + body.hh - 36, body.cx - body.hw, body.cy - 36], ['#c0392b', '#2e86c1', '#27ae60', '#d35400'][variant]);
      windows(ctx, body, 40, 1, 2, 4, '#5a8aa8');
      box(ctx, inset(top, 0.5), 8, wallColors('#bfbfbf'));
    }
    return;
  }
  lot(ctx, f, '#8f9290', rng);
  if (level <= 2) {
    glassTower(ctx, f, 50 + level * 20, ['#4f8fb8', '#3fa0a0', '#6a8fc0', '#4aa3c8'][variant], rng);
  } else glassTower(ctx, f, level === 3 ? 150 : 250, ['#3f7fae', '#2f8f9a', '#5a7fc0', '#3a95c0'][variant], rng, level === 4);
}

function drawIndustrial(ctx: Ctx, f: Foot, level: number, era: number, variant: number, rng: Rng) {
  if (era === 1) {
    lot(ctx, f, '#9a8a62', rng);
    shed(ctx, subFoot(f, 0, 0, 2), TIMBER, ATTAP, 10);
    if (level >= 2) shed(ctx, subFoot(f, 1, 0, 2), TIMBER, ATTAP, 10);
    // clay pots / timber stacks
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k % 2 ? '#9a5a32' : '#7a5a3a';
      ctx.beginPath();
      ctx.ellipse(subFoot(f, 0, 1, 2).cx + k * 6 - 9, subFoot(f, 0, 1, 2).cy, 3, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    smoke(ctx, subFoot(f, 1, 1, 2).cx, subFoot(f, 1, 1, 2).cy - 6, 12, rng);
    return;
  }
  if (era === 2) {
    lot(ctx, f, '#8f8572', rng);
    const top = shed(ctx, f, '#c9b896', ZINC, 10 + level * 4);
    chimney(ctx, top.cx + top.hw * 0.5, top.cy + 4, 18 + level * 6, rng);
    return;
  }
  if (era === 3) {
    lot(ctx, f, '#878782', rng);
    const top = shed(ctx, f, '#d8d2c4', '#8f979c', 14 + level * 4, true);
    chimney(ctx, top.cx + top.hw * 0.55, top.cy + 6, 26 + level * 8, rng, '#9a9a9a');
    if (level >= 3) {
      // storage tank
      const t = { cx: f.cx - f.hw * 0.55, cy: f.cy + 4, hw: 9, hh: 4.5 };
      box(ctx, t, 18, wallColors('#c8cfd4'));
    }
    return;
  }
  lot(ctx, f, '#9aa29a', rng);
  const body = inset(f, 0.82);
  const top = box(ctx, body, 16 + level * 6, wallColors(['#f4f6f6', '#e6eef0', '#eef2ea', '#f0f0f4'][variant]));
  // blue glass band
  poly(ctx, [body.cx - body.hw, body.cy - 8, body.cx, body.cy + body.hh - 8, body.cx, body.cy + body.hh - 13, body.cx - body.hw, body.cy - 13], '#3f8fc0');
  // solar panels
  for (let k = 0; k < 3; k++) diamond(ctx, { cx: top.cx - top.hw * 0.4 + k * top.hw * 0.4, cy: top.cy, hw: top.hw * 0.18, hh: top.hh * 0.18 }, '#24456a', '#9ab');
  if (level >= 3) box(ctx, { cx: f.cx + f.hw * 0.55, cy: f.cy, hw: 6, hh: 3 }, 22, wallColors('#c8d2d8'));
}
