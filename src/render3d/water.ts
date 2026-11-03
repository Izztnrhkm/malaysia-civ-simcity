import * as THREE from 'three';
import { MapLayers, T } from '../core/types';
import { WATER_Y } from './terrain';

/**
 * Animated water for the Straits of Melaka and the river: a subdivided plane
 * with Gerstner-like vertex swell, depth-tinted colour from a per-tile data
 * texture (deep / sea / shallow / river), shoreline foam, sun glint and a
 * night tint. Fog-aware.
 */
const vertex = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 w0 = modelMatrix * vec4(position, 1.0);
    vWorld = w0.xyz;
    vec4 mvPosition = viewMatrix * w0;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uDepth;
  uniform vec2 uMapSize;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uRiver;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  // gradient of a sum of directional swells (per-pixel normals, no aliasing)
  vec2 swellGrad(vec2 p, float t) {
    vec2 g = vec2(0.0);
    vec2 d1 = normalize(vec2(1.0, 0.35));
    vec2 d2 = normalize(vec2(-0.4, 1.0));
    vec2 d3 = normalize(vec2(0.7, -0.6));
    g += d1 * 0.025 * 1.1 * cos(dot(p, d1) * 1.1 + t * 1.3);
    g += d2 * 0.015 * 2.3 * cos(dot(p, d2) * 2.3 + t * 1.9);
    g += d3 * 0.008 * 4.1 * cos(dot(p, d3) * 4.1 + t * 2.7);
    g += vec2(0.6, 0.8) * 0.004 * 9.0 * cos(dot(p, vec2(0.6, 0.8)) * 9.0 + t * 3.4);
    return g;
  }
  void main() {
    vec2 g = swellGrad(vWorld.xz, uTime);
    vec3 vNormal = normalize(vec3(-g.x, 1.0, -g.y));
    vec2 uv = vWorld.xz / uMapSize;
    vec4 d = texture2D(uDepth, clamp(uv, vec2(0.0), vec2(1.0)));
    float depth = d.r;      // 0 = shore .. 1 = deep ocean
    float river = d.g;      // 1 on river tiles
    float shore = d.b;      // 1 next to land
    vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.85, depth));
    col = mix(col, uRiver, river * 0.85);
    // ripples
    float r1 = sin(vWorld.x * 5.3 + vWorld.z * 1.7 + uTime * 1.7);
    float r2 = sin(vWorld.z * 4.1 - vWorld.x * 2.3 - uTime * 1.3);
    vec3 n = normalize(vNormal + vec3(r1 * 0.025, 0.0, r2 * 0.025));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    vec3 sky = mix(vec3(0.62, 0.78, 0.9), vec3(0.08, 0.1, 0.2), uNight);
    col = mix(col, sky, fres * 0.45);
    vec3 h = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, h), 0.0), 140.0) * (1.0 - uNight * 0.7);
    float diff = 0.55 + 0.45 * max(dot(n, uSunDir), 0.0);
    col = col * diff * mix(vec3(1.0), vec3(0.25, 0.3, 0.5), uNight) + uSunColor * spec * 1.4;
    // shoreline foam
    float f1 = sin(vWorld.x * 3.1 + uTime * 1.3) * sin(vWorld.z * 2.7 - uTime * 1.1);
    float f2 = sin((vWorld.x - vWorld.z) * 5.3 + uTime * 2.1 + f1 * 2.0);
    float foam = smoothstep(0.55, 1.0, shore) * smoothstep(0.3, 0.95, 0.5 + 0.3 * f1 + 0.25 * f2);
    col = mix(col, vec3(0.92, 0.95, 0.95) * (1.0 - uNight * 0.6), foam * 0.3);
    float alpha = mix(0.62, 0.93, smoothstep(0.0, 0.6, depth)) + fres * 0.05;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    #include <fog_fragment>
  }
`;

export function buildDepthTexture(m: MapLayers): THREE.DataTexture {
  const data = new Uint8Array(m.width * m.height * 4);
  const W = m.width;
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = m.terrain[i];
      const depth = t === T.DEEP ? 1 : t === T.SEA ? 0.6 : t === T.SHALLOW ? 0.2 : t === T.RIVER ? 0.1 : 0;
      let shore = 0;
      if (depth > 0)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= m.height) continue;
          const nt = m.terrain[ny * W + nx];
          if (nt > T.SHALLOW && nt !== T.RIVER) shore = 1;
        }
      data[i * 4] = Math.round(depth * 255);
      data[i * 4 + 1] = t === T.RIVER ? 255 : 0;
      data[i * 4 + 2] = shore * 255;
      data[i * 4 + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, m.width, m.height, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export class Water {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  /** invisible flat plane used for mouse picking over water */
  readonly pickPlane: THREE.Mesh;

  constructor(m: MapLayers) {
    const margin = Math.max(m.width, m.height) * 1.5;
    const w = m.width + margin * 2;
    const h = m.height + margin * 2;
    const geo = new THREE.PlaneGeometry(w, h, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDepth: { value: null },
          uMapSize: { value: new THREE.Vector2(m.width, m.height) },
          uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
          uSunColor: { value: new THREE.Color('#fff2d6') },
          uNight: { value: 0 },
          uDeep: { value: new THREE.Color('#0f4a6e') },
          uShallow: { value: new THREE.Color('#3fa6a8') },
          uRiver: { value: new THREE.Color('#6b7a4a') },
        },
      ]),
    });
    // set after merge(): UniformsUtils clones textures
    this.material.uniforms.uDepth.value = buildDepthTexture(m);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'water';
    this.mesh.position.set(m.width / 2, WATER_Y, m.height / 2);
    this.mesh.renderOrder = 1;
    const pg = new THREE.PlaneGeometry(m.width, m.height);
    pg.rotateX(-Math.PI / 2);
    this.pickPlane = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ visible: false }));
    this.pickPlane.position.set(m.width / 2, WATER_Y, m.height / 2);
    this.pickPlane.name = 'water-pick';
  }

  update(time: number, sunDir: THREE.Vector3, sunColor: THREE.Color, night: number) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.copy(sunColor);
    u.uNight.value = night;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.uniforms.uDepth.value.dispose();
    this.material.dispose();
    this.pickPlane.geometry.dispose();
  }
}
