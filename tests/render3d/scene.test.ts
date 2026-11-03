import * as THREE from 'three';
import { GameEngine } from '../../src/core/engine';
import { T, isWater } from '../../src/core/types';
import { ModelLibrary } from '../../src/render3d/library';
import { CHUNK, WATER_Y, tileHeight } from '../../src/render3d/terrain';
import { World3D, facing, mapSignature } from '../../src/render3d/world';
import { isWebGLAvailable } from '../../src/render3d/view3d';
import { Bot } from '../helpers/bot';

const lib = new ModelLibrary();

function city(seed = 42, ticks = 60) {
  const e = GameEngine.newGame(seed);
  const bot = new Bot(e);
  bot.setup();
  for (let i = 0; i < ticks; i++) {
    bot.step();
    e.tick();
  }
  return e;
}

/** Ray straight down onto the centre of tile (x, y). */
function downRay(x: number, y: number) {
  return new THREE.Raycaster(new THREE.Vector3(x + 0.5, 50, y + 0.5), new THREE.Vector3(0, -1, 0));
}

describe('terrain heights', () => {
  it('beds water below the surface and stacks land plains < hills < mountains', () => {
    for (const t of [T.DEEP, T.SEA, T.SHALLOW, T.RIVER]) expect(tileHeight(t, 60)).toBeLessThan(WATER_Y);
    expect(tileHeight(T.PLAIN, 100)).toBeGreaterThan(WATER_Y);
    expect(tileHeight(T.HILL, 180)).toBeGreaterThan(tileHeight(T.PLAIN, 160));
    expect(tileHeight(T.MOUNTAIN, 230)).toBeGreaterThan(tileHeight(T.HILL, 204));
    expect(tileHeight(T.DEEP, 0)).toBeLessThan(tileHeight(T.SHALLOW, 70));
  });
});

describe('World3D scene graph (renderer-independent)', () => {
  it('needs no WebGL to build: jsdom reports no WebGL so the app falls back to 2D', () => {
    expect(isWebGLAvailable()).toBe(false);
    const e = GameEngine.newGame(42);
    const w = new World3D(e.state, lib, 'low');
    expect(w.scene.getObjectByName('terrain')).toBeDefined();
    expect(w.scene.getObjectByName('water')).toBeDefined();
    expect(w.stats().chunks).toBe(Math.ceil(128 / CHUNK) ** 2);
    w.dispose();
  });

  it('mirrors buildings, zoned lots, transport, trees and traffic from the game state', () => {
    const e = city();
    const w = new World3D(e.state, lib, 'high');
    expect(w.sync(e.state, 'none', e.version)).toBe(true);
    const st = w.stats();
    expect(st.buildings).toBeGreaterThanOrEqual(e.state.buildings.length);
    const developed = Array.from(e.state.map.density).filter((d, i) => d > 0 && e.state.map.zone[i] && e.state.map.building[i] < 0).length;
    expect(st.zones).toBe(developed);
    expect(st.transport).toBeGreaterThan(Array.from(e.state.map.transport).filter(Boolean).length);
    expect(st.trees).toBeGreaterThan(1000);
    expect(w.sync(e.state, 'none', e.version)).toBe(false);
    w.update(0.5, 1000);
    expect(w.stats().traffic).toBeGreaterThan(0);
    w.dispose();
  });

  it('only rebuilds static layers when the map changes', () => {
    const e = city(7, 20);
    const w = new World3D(e.state, lib, 'low');
    w.sync(e.state, 'none', 1);
    const sig = mapSignature(e.state);
    expect(w.sync(e.state, 'none', 2)).toBe(false);
    const b = e.state.buildings[0];
    e.bulldoze(b.x, b.y, b.x, b.y);
    expect(mapSignature(e.state)).not.toBe(sig);
    expect(w.sync(e.state, 'none', 3)).toBe(true);
    w.dispose();
  });

  it('removes trees where rainforest is zoned', () => {
    const e = GameEngine.newGame(42);
    const w = new World3D(e.state, lib, 'low');
    w.sync(e.state, 'none', 0);
    const before = w.stats().trees;
    const m = e.state.map;
    const i = m.terrain.findIndex((t, k) => t === T.JUNGLE && m.terrain[k + 1] === T.JUNGLE && m.terrain[k + 2] === T.JUNGLE);
    const x = i % m.width;
    const y = (i / m.width) | 0;
    e.state.money = 1e6;
    expect(e.zone('R', x, y, x + 2, y).ok).toBe(true);
    w.sync(e.state, 'none', 1);
    expect(w.stats().trees).toBeLessThan(before);
    expect(w.stats().zoneTint).toBeGreaterThanOrEqual(3);
    w.dispose();
  });

  it('raycast picking returns the tile under the cursor on land and on water', () => {
    const e = GameEngine.newGame(42);
    const w = new World3D(e.state, lib, 'low');
    const m = e.state.map;
    w.scene.updateMatrixWorld(true);
    const land = m.terrain.findIndex((t) => t === T.HILL);
    const sea = m.terrain.findIndex((t) => t === T.DEEP);
    for (const i of [land, sea, 64 * 128 + 64]) {
      const x = i % m.width;
      const y = (i / m.width) | 0;
      expect(w.pickTile(downRay(x, y))).toEqual({ x, y });
    }
    expect(isWater(m.terrain[sea])).toBe(true);
    // an oblique ray from a typical strategy camera
    const cam = new THREE.PerspectiveCamera(40, 1.6, 0.1, 500);
    cam.position.set(80, 25, 80);
    cam.lookAt(60.5, 0.3, 60.5);
    cam.updateMatrixWorld();
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(0, 0), cam);
    const t = w.pickTile(r)!;
    expect(Math.abs(t.x - 60)).toBeLessThanOrEqual(2);
    expect(Math.abs(t.y - 60)).toBeLessThanOrEqual(2);
    w.dispose();
  });

  it('shows a translucent ghost and coloured tiles for a building preview', () => {
    const e = GameEngine.newGame(42);
    const w = new World3D(e.state, lib, 'low');
    w.setPreview({ tiles: [[10, 10], [11, 10], [10, 11], [11, 11]], ok: true, building: { id: 'pasar', x: 10, y: 10 } });
    expect(w.stats().preview).toBe(4);
    expect(w.stats().ghost).toBe(true);
    const ghost = w.scene.getObjectByName('ghost')!;
    expect(ghost.children.length).toBeGreaterThan(2);
    const mat = (ghost.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(1);
    w.setPreview({ tiles: [[1, 1]], ok: false });
    expect(w.stats().ghost).toBe(false);
    w.setPreview(null);
    expect(w.stats().preview).toBe(0);
    w.dispose();
  });

  it('draws overlays from the shared 2D overlay logic', () => {
    const e = city(42, 30);
    const w = new World3D(e.state, lib, 'low');
    w.sync(e.state, 'none', 0);
    expect(w.stats().overlay).toBe(0);
    w.sync(e.state, 'landValue', 1);
    expect(w.stats().overlay).toBeGreaterThan(500);
    w.dispose();
  });

  it('lights windows at night and dims the sun', () => {
    const e = GameEngine.newGame(42);
    const l = new ModelLibrary();
    const w = new World3D(e.state, l, 'low');
    w.update(0.1, 0);
    const daySun = w.sun.intensity;
    expect(w.night).toBeLessThan(0.1);
    w.dayMode = 'night';
    for (let i = 0; i < 40; i++) w.update(0.1, i * 100);
    expect(w.night).toBeGreaterThan(0.9);
    expect(w.sun.intensity).toBeLessThan(daySun);
    expect(l.materials.window.emissiveIntensity).toBeGreaterThan(0.6);
    expect(l.materials.concrete.emissiveIntensity).toBe(1);
    w.dispose();
  });

  it('rains during monsoon floods and reports lightning for thunder', () => {
    const e = GameEngine.newGame(42);
    const w = new World3D(e.state, lib, 'low');
    expect(w.rainTarget()).toBe(0);
    e.state.effects.push({ id: 'banjir_monsun', ticksLeft: 3, flood: true });
    expect(w.rainTarget()).toBe(1);
    let strikes = 0;
    w.onLightning = () => strikes++;
    for (let i = 0; i < 400; i++) w.update(0.1, i * 100);
    expect(w.rain.intensity).toBeGreaterThan(0.9);
    expect(w.rain.lines.visible).toBe(true);
    expect(strikes).toBeGreaterThan(0);
    w.weatherMode = 'clear';
    expect(w.rainTarget()).toBe(0);
    w.dispose();
  });

  it('faces harbours towards the sea', () => {
    const e = city(42, 5);
    const w = new World3D(e.state, lib, 'low');
    const port = e.state.buildings.find((b) => b.def === 'pelabuhan')!;
    const ry = w.buildingFacing({ id: 'pelabuhan', placement: 'coast' } as never, port.x, port.y, port.w, port.h);
    // the sea is to the west (smaller x) on these maps
    expect([facing(-1, 0), facing(0, 1), facing(0, -1)]).toContain(ry);
    expect(ry).not.toBe(facing(1, 0));
    w.dispose();
  });
});
