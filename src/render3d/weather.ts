import * as THREE from 'three';

/**
 * Monsoon rain: streaks that fall inside a box following the camera target,
 * plus occasional lightning flashes (reported through `onLightning` so the
 * sound engine can play thunder).
 */
export class Rain {
  readonly lines: THREE.LineSegments;
  private positions: Float32Array;
  private speeds: Float32Array;
  intensity = 0;
  private target = 0;
  private flash = 0;
  private nextBolt = 6;
  onLightning: (() => void) | null = null;
  readonly count: number;

  constructor(count = 1800, private size = 34, private top = 14) {
    this.count = count;
    this.positions = new Float32Array(count * 6);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) this.respawn(i, true, 0, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: '#b8c8d8', transparent: true, opacity: 0, depthWrite: false });
    this.lines = new THREE.LineSegments(g, mat);
    this.lines.frustumCulled = false;
    this.lines.name = 'rain';
    this.lines.visible = false;
  }

  private respawn(i: number, anyHeight: boolean, cx: number, cz: number) {
    const x = cx + (Math.random() - 0.5) * this.size;
    const z = cz + (Math.random() - 0.5) * this.size;
    const y = anyHeight ? Math.random() * this.top : this.top;
    const p = this.positions;
    p[i * 6] = x;
    p[i * 6 + 1] = y;
    p[i * 6 + 2] = z;
    p[i * 6 + 3] = x + 0.06;
    p[i * 6 + 4] = y + 0.45;
    p[i * 6 + 5] = z + 0.03;
    this.speeds[i] = 14 + Math.random() * 6;
  }

  setTarget(intensity: number) {
    this.target = Math.max(0, Math.min(1, intensity));
  }

  /** returns current lightning flash strength 0..1 */
  update(dt: number, center: THREE.Vector3): number {
    const d = Math.min(0.1, dt);
    this.intensity += (this.target - this.intensity) * Math.min(1, d * 1.5);
    const on = this.intensity > 0.02;
    this.lines.visible = on;
    (this.lines.material as THREE.LineBasicMaterial).opacity = 0.55 * this.intensity;
    if (on) {
      const p = this.positions;
      const active = Math.floor(this.count * this.intensity);
      for (let i = 0; i < this.count; i++) {
        if (i >= active) {
          p[i * 6 + 1] = -100;
          p[i * 6 + 4] = -100;
          continue;
        }
        const dy = this.speeds[i] * d;
        p[i * 6 + 1] -= dy;
        p[i * 6 + 4] -= dy;
        if (p[i * 6 + 1] < center.y - 1 || Math.abs(p[i * 6] - center.x) > this.size / 2 + 2 || Math.abs(p[i * 6 + 2] - center.z) > this.size / 2 + 2)
          this.respawn(i, p[i * 6 + 1] < -50, center.x, center.z);
      }
      this.lines.position.y = 0;
      (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.nextBolt -= d;
      if (this.nextBolt <= 0 && this.intensity > 0.5) {
        this.flash = 1;
        this.nextBolt = 5 + Math.random() * 9;
        this.onLightning?.();
      }
    }
    this.flash = Math.max(0, this.flash - d * 3.5);
    return this.flash;
  }

  dispose() {
    this.lines.geometry.dispose();
    (this.lines.material as THREE.Material).dispose();
  }
}
