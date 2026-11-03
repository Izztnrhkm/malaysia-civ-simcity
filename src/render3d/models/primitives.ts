/**
 * Primitive solids for the procedural 3D model catalog.
 *
 * This module is pure TypeScript (no Three.js, no DOM) so the exact same
 * geometry can be produced in three places:
 *   1. in the browser, where meshes are built inline (always available, and the
 *      only source in the single-file Artifact build);
 *   2. by `scripts/generate-glb.ts`, the Node binary glTF 2.0 packer;
 *   3. by `scripts/generate_blender_models.py`, which ports `partPolygons` to
 *      Python/bmesh and exports through Blender's glTF exporter.
 *
 * Units: 1 = one map tile. +Y is up. Every part is positioned by the centre of
 * its base (`p`), rotated by `r` (radians, applied X then Y then Z around the
 * base centre).
 */
import type { MatId } from './materials';

export type Vec3 = [number, number, number];

export type Part =
  /** axis-aligned box: s = [width (x), height (y), depth (z)] */
  | { t: 'box'; p: Vec3; s: [number, number, number]; r?: Vec3; m: MatId }
  /** rectangular frustum / pyramid / hip roof: s = [bottomW, bottomD, topW, topD, height] */
  | { t: 'frustum'; p: Vec3; s: [number, number, number, number, number]; r?: Vec3; m: MatId }
  /** triangular prism (gable roof), ridge along z: s = [span (x), height (y), length (z)] */
  | { t: 'gable'; p: Vec3; s: [number, number, number]; r?: Vec3; m: MatId }
  /** cylinder / cone / frustum: s = [radiusBottom, radiusTop, height, segments] */
  | { t: 'cyl'; p: Vec3; s: [number, number, number, number]; r?: Vec3; m: MatId; smooth?: boolean }
  /** ellipsoid (hemi = 1 for a dome resting on its base): s = [rx, ry, rz, segments, rings, hemi] */
  | { t: 'sphere'; p: Vec3; s: [number, number, number, number, number, number]; r?: Vec3; m: MatId };

export interface Polygon {
  verts: Vec3[];
  /** per-vertex normals for smooth-shaded faces; flat faces omit this */
  normals?: Vec3[];
}

export interface MeshData {
  positions: number[];
  normals: number[];
  indices: number[];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Newell's method: robust polygon normal. */
export function polygonNormal(vs: Vec3[]): Vec3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([nx, ny, nz]);
}

function centroid(vs: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const v of vs) {
    c[0] += v[0];
    c[1] += v[1];
    c[2] += v[2];
  }
  return [c[0] / vs.length, c[1] / vs.length, c[2] / vs.length];
}

/** Drop consecutive duplicate vertices (collapsed apexes). */
function dedupe(vs: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (const v of vs) {
    const p = out[out.length - 1];
    if (!p || Math.abs(p[0] - v[0]) + Math.abs(p[1] - v[1]) + Math.abs(p[2] - v[2]) > 1e-7) out.push(v);
  }
  while (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 1e-7) break;
    out.pop();
  }
  return out;
}

/** Local-space polygons of a primitive (before rotation and translation). */
function localPolygons(part: Part): Polygon[] {
  switch (part.t) {
    case 'box': {
      const [w, h, d] = part.s;
      return frustumPolys(w, d, w, d, h);
    }
    case 'frustum': {
      const [bw, bd, tw, td, h] = part.s;
      return frustumPolys(bw, bd, tw, td, h);
    }
    case 'gable': {
      const [w, h, d] = part.s;
      const x = w / 2;
      const z = d / 2;
      const a: Vec3 = [-x, 0, -z];
      const b: Vec3 = [x, 0, -z];
      const c: Vec3 = [x, 0, z];
      const e: Vec3 = [-x, 0, z];
      const r0: Vec3 = [0, h, -z];
      const r1: Vec3 = [0, h, z];
      return [{ verts: [a, b, c, e] }, { verts: [a, r0, b] }, { verts: [e, c, r1] }, { verts: [a, e, r1, r0] }, { verts: [b, r0, r1, c] }];
    }
    case 'cyl': {
      const [rb, rt, h, segRaw] = part.s;
      const n = Math.max(3, Math.round(segRaw));
      const polys: Polygon[] = [];
      const ring = (r: number, y: number) => Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return [r * Math.cos(a), y, r * Math.sin(a)] as Vec3;
      });
      const bot = ring(rb, 0);
      const top = ring(rt, h);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const verts = [bot[i], bot[j], top[j], top[i]];
        if (part.smooth) {
          const nrm = (k: number): Vec3 => {
            const a = (k / n) * Math.PI * 2;
            return norm([Math.cos(a) * h, rb - rt, Math.sin(a) * h]);
          };
          polys.push({ verts, normals: [nrm(i), nrm(j), nrm(j), nrm(i)] });
        } else polys.push({ verts });
      }
      if (rb > 0) polys.push({ verts: bot.slice() });
      if (rt > 0) polys.push({ verts: top.slice() });
      return polys;
    }
    case 'sphere': {
      const [rx, ry, rz, segRaw, ringsRaw, hemi] = part.s;
      const n = Math.max(4, Math.round(segRaw));
      const rings = Math.max(2, Math.round(ringsRaw));
      const lat0 = hemi ? 0 : -Math.PI / 2;
      const yOff = hemi ? 0 : ry;
      const pt = (i: number, j: number): Vec3 => {
        const lat = lat0 + ((Math.PI / 2 - lat0) * j) / rings;
        const lon = (i / n) * Math.PI * 2;
        return [rx * Math.cos(lat) * Math.cos(lon), yOff + ry * Math.sin(lat), rz * Math.cos(lat) * Math.sin(lon)];
      };
      const nr = (v: Vec3): Vec3 => norm([v[0] / (rx * rx), (v[1] - yOff) / (ry * ry), v[2] / (rz * rz)]);
      const polys: Polygon[] = [];
      for (let j = 0; j < rings; j++)
        for (let i = 0; i < n; i++) {
          const verts = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)];
          const d = dedupe(verts);
          if (d.length < 3) continue;
          polys.push({ verts: d, normals: d.map(nr) });
        }
      if (hemi) polys.push({ verts: Array.from({ length: n }, (_, i) => pt(i, 0)) });
      return polys;
    }
  }
}

function frustumPolys(bw: number, bd: number, tw: number, td: number, h: number): Polygon[] {
  const b = [
    [-bw / 2, 0, -bd / 2],
    [bw / 2, 0, -bd / 2],
    [bw / 2, 0, bd / 2],
    [-bw / 2, 0, bd / 2],
  ] as Vec3[];
  const t = [
    [-tw / 2, h, -td / 2],
    [tw / 2, h, -td / 2],
    [tw / 2, h, td / 2],
    [-tw / 2, h, td / 2],
  ] as Vec3[];
  const polys: Polygon[] = [{ verts: b.slice() }];
  if (tw > 0 && td > 0) polys.push({ verts: t.slice() });
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    polys.push({ verts: [b[i], b[j], t[j], t[i]] });
  }
  return polys;
}

/** Rotate X, then Y, then Z. */
export function rotate(v: Vec3, r?: Vec3): Vec3 {
  if (!r) return v;
  let [x, y, z] = v;
  if (r[0]) {
    const c = Math.cos(r[0]);
    const s = Math.sin(r[0]);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (r[1]) {
    const c = Math.cos(r[1]);
    const s = Math.sin(r[1]);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  if (r[2]) {
    const c = Math.cos(r[2]);
    const s = Math.sin(r[2]);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}

/**
 * World-space polygons of a part with outward-facing winding. All primitives
 * are convex, so a face is flipped whenever its normal points towards the
 * part's centroid.
 */
export function partPolygons(part: Part): Polygon[] {
  const local = localPolygons(part);
  const all = local.flatMap((p) => p.verts);
  const c = centroid(all);
  const out: Polygon[] = [];
  for (const poly of local) {
    const verts = dedupe(poly.verts);
    if (verts.length < 3) continue;
    const n = polygonNormal(verts);
    const outward = dot(n, sub(centroid(verts), c)) >= 0;
    let vs = verts;
    let ns = poly.normals && poly.normals.length === verts.length ? poly.normals : undefined;
    if (!outward) {
      vs = verts.slice().reverse();
      ns = ns?.slice().reverse();
    }
    out.push({
      verts: vs.map((v) => {
        const w = rotate(v, part.r);
        return [round6(w[0] + part.p[0]), round6(w[1] + part.p[1]), round6(w[2] + part.p[2])] as Vec3;
      }),
      normals: ns?.map((nn) => rotate(nn, part.r)),
    });
  }
  return out;
}

/** Append polygons (fan-triangulated, flat or smooth normals) to a mesh buffer. */
export function appendPolygons(mesh: MeshData, polys: Polygon[]): void {
  for (const poly of polys) {
    const base = mesh.positions.length / 3;
    const flat = poly.normals ? null : polygonNormal(poly.verts);
    poly.verts.forEach((v, k) => {
      mesh.positions.push(v[0], v[1], v[2]);
      const n = poly.normals ? poly.normals[k] : flat!;
      mesh.normals.push(round6(n[0]), round6(n[1]), round6(n[2]));
    });
    for (let k = 1; k + 1 < poly.verts.length; k++) mesh.indices.push(base, base + k, base + k + 1);
  }
}

/** Group a model's parts by material into indexed meshes. */
export function buildMeshes(parts: Part[]): Map<MatId, MeshData> {
  const out = new Map<MatId, MeshData>();
  for (const part of parts) {
    let m = out.get(part.m);
    if (!m) {
      m = { positions: [], normals: [], indices: [] };
      out.set(part.m, m);
    }
    appendPolygons(m, partPolygons(part));
  }
  return out;
}

/** Axis-aligned bounds of a list of parts. */
export function partsBounds(parts: Part[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (const poly of partPolygons(p))
      for (const v of poly.verts)
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], v[k]);
          max[k] = Math.max(max[k], v[k]);
        }
  return { min, max };
}
