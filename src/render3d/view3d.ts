import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GameState, T } from '../core/types';
import { Overlay, Preview } from '../render/renderer';
import { ModelLibrary } from './library';
import { DayMode, Quality, WeatherMode, World3D } from './world';

/** True when a WebGL context can be created (false in jsdom and on blocked GPUs). */
export function isWebGLAvailable(): boolean {
  try {
    if (typeof document === 'undefined' || typeof navigator === 'undefined' || navigator.userAgent.includes('jsdom')) return false;
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Shared model library so geometry survives switching views and games. */
let sharedLib: ModelLibrary | null = null;
let glbPromise: Promise<number> | null = null;
export function getModelLibrary(): ModelLibrary {
  if (!sharedLib) sharedLib = new ModelLibrary();
  return sharedLib;
}

/**
 * Fetch the Blender-exported `.glb` models next to the page. Skipped in the
 * single-file Artifact build (external fetches are blocked there: the inline
 * mesh builders produce the same models) and on file:// pages.
 */
export function loadExternalModels(lib: ModelLibrary): Promise<number> {
  if (glbPromise) return glbPromise;
  const artifact = import.meta.env.MODE === 'artifact';
  const http = typeof location !== 'undefined' && /^https?:$/.test(location.protocol);
  if (artifact || !http || typeof fetch === 'undefined') return (glbPromise = Promise.resolve(0));
  const base = `${import.meta.env.BASE_URL ?? './'}models/`;
  glbPromise = lib.loadGLB(base).catch(() => 0);
  return glbPromise;
}

export interface ViewHooks {
  getState: () => GameState;
  getVersion: () => number;
  getOverlay: () => Overlay;
}

const DEFAULT_POLAR = 0.92;
const DEFAULT_AZIMUTH = Math.PI / 4;
const DEFAULT_DISTANCE = 26;

/** The interactive 3D view: renderer, camera, orbit controls and render loop. */
export class View3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly world: World3D;
  readonly raycaster = new THREE.Raycaster();
  readonly quality: Quality;
  private raf = 0;
  private last = 0;
  private lastVersion = -1;
  private ro: ResizeObserver | null = null;
  private home = new THREE.Vector3();
  fps = 0;
  frames = 0;
  onContextLost: (() => void) | null = null;

  constructor(
    readonly container: HTMLElement,
    private hooks: ViewHooks,
    quality?: Quality,
  ) {
    const state = hooks.getState();
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    const gl = this.renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    this.quality = quality ?? (/swiftshader|llvmpipe|software/i.test(gpu) ? 'low' : 'high');
    const r = this.renderer;
    r.setPixelRatio(this.quality === 'low' ? 1 : Math.min(2, window.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = this.quality === 'high';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.dataset.testid = 'game-canvas-3d';
    r.domElement.style.display = 'block';
    r.domElement.style.width = '100%';
    r.domElement.style.height = '100%';
    r.domElement.style.touchAction = 'none';
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLost?.();
    });
    container.appendChild(r.domElement);

    this.world = new World3D(state, getModelLibrary(), this.quality);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);
    this.controls = new OrbitControls(this.camera, r.domElement);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.screenSpacePanning = false;
    c.minDistance = 2.5;
    c.maxDistance = 190;
    c.minPolarAngle = 0.05;
    c.maxPolarAngle = 1.47;
    c.zoomToCursor = true;
    c.rotateSpeed = 0.6;
    this.setInspectMode(true);
    this.home.copy(startFocus(state));
    this.resetCamera();
    this.resize();
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null;
    this.ro?.observe(container);
  }

  /** Inspect: left-drag pans. Build tools: left button belongs to the tool. */
  setInspectMode(inspect: boolean) {
    const c = this.controls;
    c.mouseButtons = {
      LEFT: inspect ? THREE.MOUSE.PAN : (null as unknown as THREE.MOUSE),
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    c.touches = { ONE: inspect ? THREE.TOUCH.PAN : (null as unknown as THREE.TOUCH), TWO: THREE.TOUCH.DOLLY_ROTATE };
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    const loop = (time: number) => {
      this.raf = requestAnimationFrame(loop);
      this.frame(time);
    };
    this.raf = requestAnimationFrame(loop);
  }

  frame(time: number) {
    const dt = this.last ? Math.min(0.1, (time - this.last) / 1000) : 0.016;
    this.last = time;
    const v = this.hooks.getVersion();
    if (v !== this.lastVersion) {
      this.lastVersion = v;
      this.world.sync(this.hooks.getState(), this.hooks.getOverlay(), v);
    }
    this.controls.update();
    this.clampTarget();
    const dist = this.camera.position.distanceTo(this.controls.target);
    this.world.setShadowFocus(this.controls.target, dist * 0.9);
    (this.world.scene.fog as THREE.Fog).near = dist * 1.6;
    (this.world.scene.fog as THREE.Fog).far = dist * 4.5 + 60;
    this.world.update(dt, time);
    this.renderer.render(this.world.scene, this.camera);
    this.frames++;
    this.fps = this.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
  }

  /** Force the next frame to resync with the game state (e.g. overlay change). */
  invalidate() {
    this.lastVersion = -1;
  }

  private clampTarget() {
    const m = this.hooks.getState().map;
    const t = this.controls.target;
    const cx = Math.max(0, Math.min(m.width, t.x));
    const cz = Math.max(0, Math.min(m.height, t.z));
    if (cx !== t.x || cz !== t.z) {
      const d = new THREE.Vector3(cx - t.x, 0, cz - t.z);
      t.add(d);
      this.camera.position.add(d);
    }
  }

  private ndc(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  /** Map tile under a screen point (THREE.Raycaster against terrain chunks and water). */
  pick(clientX: number, clientY: number): { x: number; y: number } | null {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    return this.world.pickTile(this.raycaster);
  }

  /** Page coordinates of a tile centre (used by automation and labels). */
  tileToScreen(x: number, y: number): { x: number; y: number } {
    this.camera.updateMatrixWorld();
    const p = new THREE.Vector3(x + 0.5, this.world.heightAt(x, y), y + 0.5).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  centerOn(tx: number, ty: number) {
    const target = new THREE.Vector3(tx + 0.5, this.world.heightAt(tx, ty), ty + 0.5);
    const d = target.clone().sub(this.controls.target);
    this.controls.target.add(d);
    this.camera.position.add(d);
    this.controls.update();
  }

  /** Pan in screen-aligned ground directions (tiles). */
  pan(right: number, forward: number) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const d = side.multiplyScalar(right).add(dir.multiplyScalar(forward));
    this.controls.target.add(d);
    this.camera.position.add(d);
  }

  zoomBy(factor: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const len = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, off.length() / factor));
    this.camera.position.copy(this.controls.target).add(off.setLength(len));
  }

  rotateBy(angle: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(this.controls.target).add(off);
  }

  /** Top-down-ish strategy view over the city centre. */
  resetCamera(focus?: THREE.Vector3) {
    const f = focus ?? this.home;
    this.controls.target.copy(f);
    const off = new THREE.Vector3().setFromSphericalCoords(DEFAULT_DISTANCE, DEFAULT_POLAR, DEFAULT_AZIMUTH);
    this.camera.position.copy(f).add(off);
    this.camera.lookAt(f);
    this.controls.update();
  }

  setHome(tx: number, ty: number) {
    this.home.set(tx + 0.5, this.world.heightAt(tx, ty), ty + 0.5);
  }

  setPreview(p: Preview | null) {
    this.world.setPreview(p);
  }
  setHover(t: { x: number; y: number } | null) {
    this.world.setHover(t);
  }
  setSelected(t: { x: number; y: number } | null) {
    this.world.setSelected(t);
  }
  setDayMode(m: DayMode) {
    this.world.dayMode = m;
  }
  setWeather(m: WeatherMode) {
    this.world.weatherMode = m;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.controls.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Where to look first: the oldest building, else just inland of the river mouth. */
export function startFocus(state: GameState): THREE.Vector3 {
  const m = state.map;
  if (state.buildings.length) {
    const b = state.buildings[0];
    return new THREE.Vector3(b.x + 4, 0.2, b.y + 1);
  }
  let best = Infinity;
  let pos = { x: m.width / 3, y: m.height / 2 };
  for (let i = 0; i < m.terrain.length; i++)
    if (m.terrain[i] === T.RIVER) {
      const x = i % m.width;
      if (x < best) {
        best = x;
        pos = { x: x + 8, y: (i / m.width) | 0 };
      }
    }
  return new THREE.Vector3(pos.x, 0.2, pos.y);
}
