import * as THREE from 'three';
import { BUILDING_MAP, BuildingDef } from '../core/data/buildings';
import { hash2 } from '../core/rng';
import { GameState, T, TRANSPORT, ZONE, isSea, isWater } from '../core/types';
import { Overlay, Preview, ZONE_TINT, overlayRGBA, overlayValueFor } from '../render/renderer';
import { Instance, InstanceLayer } from './instancing';
import { ModelLibrary } from './library';
import { buildingModelId } from './models/catalog';
import { ZoneLetter, zoneModelId } from './models/zones';
import { TerrainMesh, WATER_Y, standHeight } from './terrain';
import { Traffic } from './vehicles';
import { Water } from './water';
import { Rain } from './weather';

export type DayMode = 'day' | 'night' | 'cycle';
export type WeatherMode = 'auto' | 'clear' | 'rain';
export type Quality = 'high' | 'low';

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const ZONE_LETTER: Record<number, ZoneLetter> = { [ZONE.R]: 'R', [ZONE.C]: 'C', [ZONE.I]: 'I' };
/** model front is +Z; rotation that makes it face (dx, dy) in tile space */
export const facing = (dx: number, dy: number) => Math.atan2(dx, dy);

const roadish = (t: number) => t === TRANSPORT.ROAD || t === TRANSPORT.HIGHWAY;

function fnv(h: number, arr: ArrayLike<number>): number {
  for (let i = 0; i < arr.length; i++) h = Math.imul(h ^ (arr[i] & 0xff), 16777619);
  return h >>> 0;
}

/** Cheap fingerprint of everything that changes the static 3D layers. */
export function mapSignature(s: GameState): string {
  const m = s.map;
  let h = 2166136261;
  for (const a of [m.terrain, m.zone, m.density, m.style, m.transport]) h = fnv(h, a);
  let hb = 2166136261;
  for (const b of s.buildings) hb = Math.imul(hb ^ b.id, 16777619) ^ (b.x * 131 + b.y);
  return `${h}:${hb >>> 0}:${s.buildings.length}:${s.era}`;
}

const SKY_DAY = new THREE.Color('#9fcbe6');
const SKY_DUSK = new THREE.Color('#e9a46e');
const SKY_NIGHT = new THREE.Color('#0a1426');
const SUN_DAY = new THREE.Color('#fff1d8');
const SUN_DUSK = new THREE.Color('#ffb070');
const MOON = new THREE.Color('#9fb6e8');

/**
 * The 3D scene graph for a GameState, independent of any WebGL renderer so it
 * can be built and inspected in unit tests. `View3D` adds the renderer,
 * camera and controls.
 */
export class World3D {
  readonly scene = new THREE.Scene();
  readonly lib: ModelLibrary;
  terrain: TerrainMesh;
  water: Water;
  readonly sun = new THREE.DirectionalLight('#ffffff', 2.4);
  readonly hemi = new THREE.HemisphereLight('#cfe6ff', '#5a4a30', 1.1);
  readonly trees: InstanceLayer;
  readonly zones: InstanceLayer;
  readonly buildings: InstanceLayer;
  readonly transport: InstanceLayer;
  readonly traffic: InstanceLayer;
  readonly rain = new Rain();
  readonly vehicles = new Traffic();
  private overlayMesh: THREE.InstancedMesh;
  private zoneTintMesh: THREE.InstancedMesh;
  private previewMesh: THREE.InstancedMesh;
  private ghost = new THREE.Group();
  private ghostKey = '';
  private ghostMat = new THREE.MeshStandardMaterial({ color: '#7dff9a', transparent: true, opacity: 0.55, depthWrite: false, emissive: '#1d6b2c', emissiveIntensity: 0.4 });
  private hoverMarker: THREE.LineLoop;
  private selectMarker: THREE.LineLoop;
  private sig = '';
  private overlayKey = '';
  private state: GameState;
  dayMode: DayMode = 'day';
  weatherMode: WeatherMode = 'auto';
  quality: Quality;
  /** 0..1 where 0.25 is sunrise-ish morning, 0.5 noon, 0.8 night */
  timeOfDay = 0.36;
  night = 0;
  lightning = 0;
  readonly focus = new THREE.Vector3();
  /** callback fired by a lightning strike during monsoon rain */
  onLightning: (() => void) | null = null;
  private shadowRadius = 30;

  constructor(state: GameState, lib = new ModelLibrary(), quality: Quality = 'high') {
    this.state = state;
    this.lib = lib;
    this.quality = quality;
    const m = state.map;
    this.scene.name = 'world';
    this.scene.background = SKY_DAY.clone();
    this.scene.fog = new THREE.Fog(SKY_DAY.clone(), 60, 220);
    this.terrain = new TerrainMesh(m);
    this.water = new Water(m);
    this.scene.add(this.terrain.group, this.water.mesh, this.water.pickPlane);

    this.sun.castShadow = quality === 'high';
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target, this.hemi);

    const shadows = quality === 'high';
    this.trees = new InstanceLayer(lib, 'trees', { castShadow: shadows, receiveShadow: false, tinted: true });
    this.zones = new InstanceLayer(lib, 'zones', { castShadow: shadows, receiveShadow: shadows, tinted: true });
    this.buildings = new InstanceLayer(lib, 'buildings', { castShadow: shadows, receiveShadow: shadows });
    this.transport = new InstanceLayer(lib, 'transport', { castShadow: shadows, receiveShadow: shadows });
    this.traffic = new InstanceLayer(lib, 'traffic', { castShadow: false });
    this.scene.add(this.trees.group, this.zones.group, this.buildings.group, this.transport.group, this.traffic.group, this.rain.lines);
    lib.register('plinth', [{ t: 'box', p: [0, 0, 0], s: [1, 1, 1], m: 'soil' }]);

    const quad = new THREE.PlaneGeometry(0.96, 0.96);
    quad.rotateX(-Math.PI / 2);
    const n = m.width * m.height;
    const flatMat = (opacity: number) =>
      new THREE.MeshBasicMaterial({ transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.overlayMesh = new THREE.InstancedMesh(quad, flatMat(0.6), n);
    this.zoneTintMesh = new THREE.InstancedMesh(quad, flatMat(0.38), n);
    this.previewMesh = new THREE.InstancedMesh(quad, flatMat(0.55), 4096);
    for (const [mesh, name] of [
      [this.overlayMesh, 'overlay'],
      [this.zoneTintMesh, 'zone-tint'],
      [this.previewMesh, 'preview-tiles'],
    ] as const) {
      mesh.name = name;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3), 3);
      this.scene.add(mesh);
    }
    this.ghost.name = 'ghost';
    this.scene.add(this.ghost);
    const ring = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 1), new THREE.Vector3(0, 0, 1)]);
    this.hoverMarker = new THREE.LineLoop(ring, new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.9 }));
    this.selectMarker = new THREE.LineLoop(ring, new THREE.LineBasicMaterial({ color: '#ffd740', depthTest: false }));
    for (const mk of [this.hoverMarker, this.selectMarker]) {
      mk.visible = false;
      mk.renderOrder = 5;
      this.scene.add(mk);
    }
    this.rain.onLightning = () => this.onLightning?.();
    this.focus.set(m.width / 2, 0, m.height / 2);
    this.applyLighting();
  }

  get heights() {
    return this.terrain.heights;
  }

  heightAt(x: number, y: number): number {
    const m = this.state.map;
    const cx = Math.max(0, Math.min(m.width - 1, Math.floor(x)));
    const cy = Math.max(0, Math.min(m.height - 1, Math.floor(y)));
    return standHeight(this.terrain.heights, cy * m.width + cx);
  }

  /** Switch to another game (new map). */
  setState(state: GameState) {
    if (state === this.state) return;
    this.state = state;
    this.scene.remove(this.terrain.group, this.water.mesh, this.water.pickPlane);
    this.terrain.dispose();
    this.water.dispose();
    this.terrain = new TerrainMesh(state.map);
    this.water = new Water(state.map);
    this.scene.add(this.terrain.group, this.water.mesh, this.water.pickPlane);
    this.sig = '';
    this.overlayKey = '';
  }

  /** Bring the scene up to date with the game state. Returns true if static layers were rebuilt. */
  sync(state: GameState, overlay: Overlay, version = 0): boolean {
    if (state !== this.state) this.setState(state);
    const sig = mapSignature(state);
    let rebuilt = false;
    if (sig !== this.sig || this.libVersion !== this.lib.version) {
      this.sig = sig;
      this.libVersion = this.lib.version;
      this.terrain.sync();
      this.rebuildStatic();
      this.vehicles.rebuild(state, this.terrain.heights);
      rebuilt = true;
    }
    const okey = `${overlay}:${overlay === 'none' ? '' : version}:${sig}`;
    if (okey !== this.overlayKey) {
      this.overlayKey = okey;
      this.rebuildOverlay(overlay);
    }
    return rebuilt;
  }
  private libVersion = -1;

  // ------------------------------------------------------------------ static layers

  private rebuildStatic() {
    const s = this.state;
    const m = s.map;
    const W = m.width;
    const H = this.terrain.heights;
    const at = (x: number, y: number) => y * W + x;
    const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < m.height;

    // ---- buildings
    const binst: Instance[] = [];
    for (const b of s.buildings) {
      const def = BUILDING_MAP[b.def];
      if (!def) continue;
      let hi = -Infinity;
      let lo = Infinity;
      for (let dy = 0; dy < b.h; dy++)
        for (let dx = 0; dx < b.w; dx++) {
          const hh = standHeight(H, at(b.x + dx, b.y + dy));
          hi = Math.max(hi, hh);
          lo = Math.min(lo, hh);
        }
      const cx = b.x + b.w / 2;
      const cz = b.y + b.h / 2;
      if (hi - lo > 0.01) binst.push({ model: 'plinth', x: cx, y: lo, z: cz, sx: b.w - 0.04, sy: hi - lo, sz: b.h - 0.04 });
      binst.push({ model: buildingModelId(def.id), x: cx, y: hi, z: cz, ry: this.buildingFacing(def, b.x, b.y, b.w, b.h) });
    }
    this.buildings.set(binst);

    // ---- zoned lots
    const zinst: Instance[] = [];
    const tint = this.zoneTintMesh;
    let tn = 0;
    const mat = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < W; x++) {
        const i = at(x, y);
        const z = m.zone[i];
        if (!z || m.building[i] >= 0) continue;
        const d = m.density[i];
        if (!d) {
          mat.makeTranslation(x + 0.5, standHeight(H, i) + 0.025, y + 0.5);
          tint.setMatrixAt(tn, mat);
          tint.setColorAt(tn, col.set(ZONE_TINT[z]));
          tn++;
          continue;
        }
        const style = m.style[i] || s.era;
        let ry = Math.floor(hash2(x, y, 5) * 4) * (Math.PI / 2);
        for (const [dx, dy] of DIRS)
          if (inMap(x + dx, y + dy) && roadish(m.transport[at(x + dx, y + dy)])) {
            ry = facing(dx, dy);
            break;
          }
        zinst.push({ model: zoneModelId(ZONE_LETTER[z], d, style), x: x + 0.5, y: standHeight(H, i), z: y + 0.5, ry, tint: 0.86 + hash2(x, y, 9) * 0.18 });
      }
    tint.count = tn;
    tint.instanceMatrix.needsUpdate = true;
    if (tint.instanceColor) tint.instanceColor.needsUpdate = true;
    this.zones.set(zinst);

    // ---- transport
    const tinst: Instance[] = [];
    const hubAt = (x: number, y: number) => {
      if (!inMap(x, y)) return false;
      const bid = m.building[at(x, y)];
      if (bid < 0) return false;
      const b = s.buildings.find((bb) => bb.id === bid);
      const d = b && BUILDING_MAP[b.def];
      return !!(d && (d.transfer || d.market));
    };
    const era = s.era;
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < W; x++) {
        const i = at(x, y);
        const t = m.transport[i];
        if (!t) continue;
        const water = isWater(m.terrain[i]);
        const ground = standHeight(H, i);
        const kind = t === TRANSPORT.ROAD ? 'road' : t === TRANSPORT.RAIL ? 'rail' : t === TRANSPORT.HIGHWAY ? 'highway' : 'mrt';
        const suffix = kind === 'road' ? `_e${era}` : '';
        const y0 = ground + (water && (kind === 'road' || kind === 'rail') ? 0.09 : 0);
        if (water && (kind === 'road' || kind === 'rail')) tinst.push({ model: 'infra_bridge_pier', x: x + 0.5, y: WATER_Y + 0.0, z: y + 0.5 });
        tinst.push({ model: `infra_${kind}_center${suffix}`, x: x + 0.5, y: y0, z: y + 0.5 });
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inMap(nx, ny)) continue;
          const nt = m.transport[at(nx, ny)];
          const linked = nt && (nt === t || (kind === 'road' && roadish(nt) && nt !== TRANSPORT.HIGHWAY) || (kind === 'highway' && nt === TRANSPORT.HIGHWAY));
          if (linked || ((kind === 'road' || kind === 'rail') && hubAt(nx, ny)))
            tinst.push({ model: `infra_${kind}_arm${suffix}`, x: x + 0.5, y: y0, z: y + 0.5, ry: facing(dx, dy) });
        }
        if (kind === 'road' && era >= 3 && !water && hash2(x, y, 21) < 0.22) tinst.push({ model: 'infra_streetlamp', x: x + 0.86, y: ground, z: y + 0.86, ry: facing(-1, 0) });
      }
    this.transport.set(tinst);

    // ---- vegetation
    const trees: Instance[] = [];
    const low = this.quality === 'low';
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < W; x++) {
        const i = at(x, y);
        if (m.zone[i] || m.building[i] >= 0 || m.transport[i]) continue;
        const t = m.terrain[i];
        const r1 = hash2(x, y, 31);
        const r2 = hash2(x, y, 32);
        const h0 = H[i];
        const jx = (r1 - 0.5) * 0.5;
        const jz = (r2 - 0.5) * 0.5;
        const tn2 = 0.85 + r1 * 0.25;
        if (t === T.JUNGLE) {
          trees.push({ model: 'tree_rainforest', x: x + 0.5 + jx, y: h0, z: y + 0.5 + jz, ry: r2 * 6.28, scale: 0.8 + r1 * 0.5, tint: tn2 });
          if (!low && r2 > 0.35) trees.push({ model: 'tree_rainforest_small', x: x + 0.5 - jz, y: h0, z: y + 0.5 + jx * 0.5, ry: r1 * 6.28, scale: 0.9 + r2 * 0.4, tint: tn2 });
        } else if (t === T.MANGROVE) {
          trees.push({ model: 'tree_mangrove', x: x + 0.5 + jx, y: h0, z: y + 0.5 + jz, ry: r1 * 6.28, scale: 1 + r2 * 0.3, tint: tn2 });
          if (!low) trees.push({ model: 'tree_mangrove', x: x + 0.5 - jz, y: h0, z: y + 0.5 - jx, ry: r2 * 6.28, scale: 0.8, tint: tn2 });
        } else if (t === T.BEACH && r1 < 0.35) {
          trees.push({ model: 'tree_coconut', x: x + 0.5 + jx, y: h0, z: y + 0.5 + jz, ry: r2 * 6.28, scale: 0.9 + r2 * 0.4, tint: tn2 });
        } else if (t === T.HILL && r1 < 0.55) {
          trees.push({ model: 'tree_rainforest', x: x + 0.5 + jx, y: h0, z: y + 0.5 + jz, ry: r2 * 6.28, scale: 0.7 + r2 * 0.4, tint: tn2 * 0.95 });
        } else if (t === T.MOUNTAIN && r1 < 0.3) {
          trees.push({ model: 'tree_rainforest_small', x: x + 0.5 + jx, y: h0, z: y + 0.5 + jz, ry: r2 * 6.28, scale: 0.8, tint: 0.8 });
        } else if (t === T.PLAIN && r1 < 0.05) {
          trees.push({ model: 'tree_rainforest_small', x: x + 0.5 + jx, y: h0, z: y + 0.5 + jz, ry: r2 * 6.28, scale: 0.8 + r2 * 0.3, tint: tn2 });
        }
      }
    this.trees.set(trees);
  }

  /** Waterside buildings face the water; others face an adjacent road. */
  buildingFacing(def: BuildingDef, x: number, y: number, w: number, h: number): number {
    const m = this.state.map;
    const W = m.width;
    const cx = x + (w - 1) / 2;
    const cy = y + (h - 1) / 2;
    const wantsWater = def.placement === 'coast' || def.placement === 'water' || def.placement === 'river';
    if (wantsWater) {
      const pred = def.placement === 'coast' ? (t: number) => isSea(t) : def.placement === 'river' ? (t: number) => t === T.RIVER : (t: number) => isWater(t);
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (let r = 1; r <= 4 && !best; r++)
        for (let ty = y - r; ty < y + h + r; ty++)
          for (let tx = x - r; tx < x + w + r; tx++) {
            if (tx < 0 || ty < 0 || tx >= W || ty >= m.height) continue;
            if (!pred(m.terrain[ty * W + tx])) continue;
            const d = (tx - cx) ** 2 + (ty - cy) ** 2;
            if (d < bd) {
              bd = d;
              best = [tx - cx, ty - cy];
            }
          }
      if (best) return Math.abs(best[0]) >= Math.abs(best[1]) ? facing(Math.sign(best[0]), 0) : facing(0, Math.sign(best[1]));
    }
    // adjacent road, checking the sides in order +y, +x, -x, -y
    const sides: Array<[number, number, Array<[number, number]>]> = [
      [0, 1, Array.from({ length: w }, (_, k) => [x + k, y + h] as [number, number])],
      [1, 0, Array.from({ length: h }, (_, k) => [x + w, y + k] as [number, number])],
      [-1, 0, Array.from({ length: h }, (_, k) => [x - 1, y + k] as [number, number])],
      [0, -1, Array.from({ length: w }, (_, k) => [x + k, y - 1] as [number, number])],
    ];
    for (const [dx, dy, tiles] of sides)
      if (tiles.some(([tx, ty]) => tx >= 0 && ty >= 0 && tx < W && ty < m.height && m.transport[ty * W + tx])) return facing(dx, dy);
    return 0;
  }

  private rebuildOverlay(overlay: Overlay) {
    const s = this.state;
    const m = s.map;
    const mesh = this.overlayMesh;
    if (overlay === 'none') {
      mesh.count = 0;
      return;
    }
    const mat = new THREE.Matrix4();
    const col = new THREE.Color();
    let n = 0;
    for (let i = 0; i < m.terrain.length; i++) {
      const v = overlayValueFor(s, overlay, i);
      if (v == null) continue;
      const [r, g, b, a] = overlayRGBA(overlay, v);
      if (a < 0.05) continue;
      mat.makeTranslation((i % m.width) + 0.5, standHeight(this.terrain.heights, i) + 0.05, ((i / m.width) | 0) + 0.5);
      mesh.setMatrixAt(n, mat);
      // pre-multiply the overlay alpha into a brighter/darker colour
      col.setRGB((r / 255) * (0.4 + a), (g / 255) * (0.4 + a), (b / 255) * (0.4 + a), THREE.SRGBColorSpace);
      mesh.setColorAt(n, col);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ interaction

  setPreview(p: Preview | null) {
    const mesh = this.previewMesh;
    const m = this.state.map;
    if (!p) {
      mesh.count = 0;
      this.ghost.visible = false;
      return;
    }
    const mat = new THREE.Matrix4();
    const col = new THREE.Color(p.color ? '#f07828' : p.ok ? '#50dc78' : '#e6463c');
    let n = 0;
    for (const [x, y] of p.tiles) {
      if (n >= mesh.instanceMatrix.count) break;
      if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue;
      mat.makeTranslation(x + 0.5, this.heightAt(x, y) + 0.07, y + 0.5);
      mesh.setMatrixAt(n, mat);
      mesh.setColorAt(n, col);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (p.building && BUILDING_MAP[p.building.id]) {
      const def = BUILDING_MAP[p.building.id];
      const key = `${def.id}:${this.lib.version}`;
      if (key !== this.ghostKey) {
        this.ghostKey = key;
        this.ghost.clear();
        for (const piece of this.lib.get(buildingModelId(def.id)).pieces) this.ghost.add(new THREE.Mesh(piece.geometry, this.ghostMat));
      }
      this.ghostMat.color.set(p.ok ? '#7dff9a' : '#ff7a6a');
      this.ghostMat.emissive.set(p.ok ? '#1d6b2c' : '#7a1d14');
      let hi = -Infinity;
      for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) hi = Math.max(hi, this.heightAt(p.building.x + dx, p.building.y + dy));
      this.ghost.position.set(p.building.x + def.size / 2, hi, p.building.y + def.size / 2);
      this.ghost.rotation.y = this.buildingFacing(def, p.building.x, p.building.y, def.size, def.size);
      this.ghost.visible = true;
    } else this.ghost.visible = false;
  }

  setHover(t: { x: number; y: number } | null) {
    this.placeMarker(this.hoverMarker, t);
  }
  setSelected(t: { x: number; y: number } | null) {
    this.placeMarker(this.selectMarker, t);
  }
  private placeMarker(mk: THREE.LineLoop, t: { x: number; y: number } | null) {
    if (!t) {
      mk.visible = false;
      return;
    }
    mk.visible = true;
    mk.position.set(t.x, this.heightAt(t.x, t.y) + 0.06, t.y);
  }

  /** Tile under a ray (terrain chunks and the water surface). */
  pickTile(ray: THREE.Raycaster): { x: number; y: number } | null {
    const hits = ray.intersectObjects([...this.terrain.meshes, this.water.pickPlane], false);
    const m = this.state.map;
    for (const h of hits) {
      const p = h.point.clone().addScaledVector(ray.ray.direction, 0.002);
      const x = Math.floor(p.x);
      const y = Math.floor(p.z);
      if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue;
      // a hit on the water plane over land means the ray passed under a cliff edge: keep looking
      if (h.object === this.water.pickPlane && !isWater(m.terrain[y * m.width + x])) continue;
      return { x, y };
    }
    return null;
  }

  // ------------------------------------------------------------------ animation and lighting

  setShadowFocus(target: THREE.Vector3, radius: number) {
    this.focus.copy(target);
    this.shadowRadius = Math.max(12, Math.min(90, radius));
  }

  /** Rain target from weather mode and active monsoon flood effects. */
  rainTarget(): number {
    if (this.weatherMode === 'rain') return 1;
    if (this.weatherMode === 'clear') return 0;
    const fx = this.state.effects;
    if (fx.some((e) => e.flood)) return 1;
    if (fx.some((e) => e.id === 'banjir_monsun' || e.id.startsWith('crisis_'))) return 0.6;
    return 0;
  }

  update(dt: number, time: number) {
    if (this.dayMode === 'cycle') this.timeOfDay = (this.timeOfDay + dt / 240) % 1;
    else this.timeOfDay += ((this.dayMode === 'day' ? 0.36 : 0.86) - this.timeOfDay) * Math.min(1, dt * 2);
    this.rain.setTarget(this.rainTarget());
    this.lightning = this.rain.update(dt, this.focus);
    this.vehicles.update(dt);
    this.traffic.set(this.vehicles.instances());
    this.applyLighting();
    this.water.update(time / 1000, this.sunDir, this.sun.color, this.night);
  }

  readonly sunDir = new THREE.Vector3(0.5, 0.8, 0.3).normalize();

  private applyLighting() {
    // 0.25 sunrise, 0.5 noon, 0.75 sunset
    const sunEl = Math.sin(((this.timeOfDay - 0.25) / 0.5) * Math.PI);
    const day = Math.max(0, Math.min(1, (sunEl + 0.12) / 0.4));
    this.night = 1 - day;
    const dusk = Math.max(0, 1 - Math.abs(sunEl) / 0.35) * day;
    const az = this.timeOfDay * Math.PI * 1.2 + 0.9;
    const el = day > 0.01 ? Math.max(0.18, sunEl) : 0.75; // moon stands high at night
    this.sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    const R = this.shadowRadius;
    this.sun.position.copy(this.focus).addScaledVector(this.sunDir, R * 2);
    this.sun.target.position.copy(this.focus);
    const cam = this.sun.shadow.camera;
    if (cam.right !== R) {
      cam.left = -R;
      cam.right = R;
      cam.top = R;
      cam.bottom = -R;
      cam.near = 0.5;
      cam.far = R * 4;
      cam.updateProjectionMatrix();
    }
    this.sun.color.copy(SUN_DAY).lerp(SUN_DUSK, dusk).lerp(MOON, this.night);
    const rainDim = 1 - this.rain.intensity * 0.45;
    this.sun.intensity = (0.35 + 2.3 * day) * rainDim + this.lightning * 3;
    this.hemi.intensity = (0.35 + 0.85 * day) * rainDim + this.lightning * 1.5;
    const sky = this.scene.background as THREE.Color;
    sky.copy(SKY_DAY).lerp(SKY_DUSK, dusk * 0.7).lerp(SKY_NIGHT, this.night);
    if (this.rain.intensity > 0.02) sky.lerp(new THREE.Color('#6b7680'), this.rain.intensity * 0.5 * day);
    (this.scene.fog as THREE.Fog).color.copy(sky);
    this.lib.setNight(this.night);
    (this.zoneTintMesh.material as THREE.MeshBasicMaterial).color.setScalar(1 - 0.6 * this.night);
  }

  /** Counts used by tests and the debug handle. */
  stats() {
    return {
      buildings: this.buildings.count,
      zones: this.zones.count,
      transport: this.transport.count,
      trees: this.trees.count,
      traffic: this.traffic.count,
      overlay: this.overlayMesh.count,
      zoneTint: this.zoneTintMesh.count,
      preview: this.previewMesh.count,
      ghost: this.ghost.visible,
      chunks: this.terrain.meshes.length,
      batches: this.buildings.batches + this.zones.batches + this.transport.batches + this.trees.batches,
    };
  }

  dispose() {
    this.terrain.dispose();
    this.water.dispose();
    this.trees.dispose();
    this.zones.dispose();
    this.buildings.dispose();
    this.transport.dispose();
    this.traffic.dispose();
    this.rain.dispose();
    this.overlayMesh.dispose();
    this.zoneTintMesh.dispose();
    this.previewMesh.dispose();
    this.ghostMat.dispose();
  }
}
