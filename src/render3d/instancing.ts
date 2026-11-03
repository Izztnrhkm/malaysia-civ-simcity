import * as THREE from 'three';
import { ModelLibrary } from './library';

export interface Instance {
  model: string;
  x: number;
  y: number;
  z: number;
  ry?: number;
  scale?: number;
  /** optional non-uniform scale (overrides `scale`) */
  sx?: number;
  sy?: number;
  sz?: number;
  /** optional per-instance tint (multiplies material colour) */
  tint?: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Draws many copies of catalog models with one InstancedMesh per
 * (model, material) pair. Meshes are kept between rebuilds and only grown when
 * their capacity is exceeded, so frequent updates stay cheap.
 */
export class InstanceLayer {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.InstancedMesh>();
  private libVersion = -1;
  count = 0;

  constructor(
    private lib: ModelLibrary,
    name: string,
    private opts: { castShadow?: boolean; receiveShadow?: boolean; tinted?: boolean } = {},
  ) {
    this.group.name = name;
  }

  private meshFor(model: string, pieceIdx: number, capacity: number): THREE.InstancedMesh {
    const key = `${model}#${pieceIdx}`;
    let m = this.meshes.get(key);
    if (m && m.instanceMatrix.count >= capacity) return m;
    const piece = this.lib.get(model).pieces[pieceIdx];
    const cap = Math.max(4, 1 << Math.ceil(Math.log2(capacity)));
    if (m) {
      this.group.remove(m);
      m.dispose();
    }
    m = new THREE.InstancedMesh(piece.geometry, this.lib.materials[piece.mat], cap);
    m.name = key;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = !!this.opts.castShadow;
    m.receiveShadow = !!this.opts.receiveShadow;
    m.frustumCulled = false;
    if (this.opts.tinted) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    this.meshes.set(key, m);
    this.group.add(m);
    return m;
  }

  set(instances: Instance[]) {
    if (this.libVersion !== this.lib.version) {
      // geometry was swapped (e.g. .glb models arrived): rebuild every mesh
      for (const m of this.meshes.values()) {
        this.group.remove(m);
        m.dispose();
      }
      this.meshes.clear();
      this.libVersion = this.lib.version;
    }
    const byModel = new Map<string, Instance[]>();
    for (const inst of instances) {
      const list = byModel.get(inst.model);
      if (list) list.push(inst);
      else byModel.set(inst.model, [inst]);
    }
    const used = new Set<string>();
    for (const [model, list] of byModel) {
      if (!this.lib.has(model)) continue;
      const pieces = this.lib.get(model).pieces;
      for (let p = 0; p < pieces.length; p++) {
        const mesh = this.meshFor(model, p, list.length);
        used.add(mesh.name);
        for (let i = 0; i < list.length; i++) {
          const it = list[i];
          tmpQ.setFromAxisAngle(UP, it.ry ?? 0);
          const s = it.scale ?? 1;
          tmpM.compose(tmpP.set(it.x, it.y, it.z), tmpQ, tmpS.set(it.sx ?? s, it.sy ?? s, it.sz ?? s));
          mesh.setMatrixAt(i, tmpM);
          if (mesh.instanceColor) mesh.setColorAt(i, tmpC.setScalar(it.tint ?? 1));
        }
        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.visible = true;
      }
    }
    for (const [key, m] of this.meshes) {
      if (!used.has(key)) {
        m.count = 0;
        m.visible = false;
      }
    }
    this.count = instances.length;
  }

  /** number of active draw batches (for diagnostics/tests) */
  get batches() {
    let n = 0;
    for (const m of this.meshes.values()) if (m.visible && m.count > 0) n++;
    return n;
  }

  dispose() {
    for (const m of this.meshes.values()) m.dispose();
    this.meshes.clear();
    this.group.clear();
  }
}
