/** Isometric projection helpers. World pixel space has the map's (0,0) tile
 *  top corner at the origin; screens map world space through a Camera. */

export const TW = 64; // tile width (px at zoom 1)
export const TH = 32; // tile height
export const HALF_W = TW / 2;
export const HALF_H = TH / 2;

/** World-space pixel position of a tile's centre. */
export function tileCenter(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * HALF_W, y: (x + y) * HALF_H + HALF_H };
}

/** Inverse projection: world pixel -> fractional tile coordinates. */
export function worldToTileF(wx: number, wy: number): { x: number; y: number } {
  const a = wx / HALF_W;
  const b = wy / HALF_H;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  const f = worldToTileF(wx, wy);
  return { x: Math.floor(f.x), y: Math.floor(f.y) };
}

export interface Camera {
  /** world position at the centre of the viewport */
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;

export function screenToWorld(cam: Camera, vw: number, vh: number, sx: number, sy: number) {
  return { x: (sx - vw / 2) / cam.zoom + cam.x, y: (sy - vh / 2) / cam.zoom + cam.y };
}

export function worldToScreen(cam: Camera, vw: number, vh: number, wx: number, wy: number) {
  return { x: (wx - cam.x) * cam.zoom + vw / 2, y: (wy - cam.y) * cam.zoom + vh / 2 };
}

export function screenToTile(cam: Camera, vw: number, vh: number, sx: number, sy: number) {
  const w = screenToWorld(cam, vw, vh, sx, sy);
  return worldToTile(w.x, w.y);
}

/** Zoom keeping the world point under (sx, sy) fixed. */
export function zoomAt(cam: Camera, vw: number, vh: number, sx: number, sy: number, factor: number): Camera {
  const before = screenToWorld(cam, vw, vh, sx, sy);
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
  const nx = before.x - (sx - vw / 2) / zoom;
  const ny = before.y - (sy - vh / 2) / zoom;
  return { x: nx, y: ny, zoom };
}

/** Inclusive tile bounds that may be visible (with a margin for tall sprites). */
export function visibleTileRange(cam: Camera, vw: number, vh: number, mapW: number, mapH: number, margin = 4) {
  const corners = [
    screenToWorld(cam, vw, vh, 0, 0),
    screenToWorld(cam, vw, vh, vw, 0),
    screenToWorld(cam, vw, vh, 0, vh + 200 * cam.zoom),
    screenToWorld(cam, vw, vh, vw, vh + 200 * cam.zoom),
  ].map((p) => worldToTileF(p.x, p.y));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    x0: Math.max(0, Math.floor(Math.min(...xs)) - margin),
    x1: Math.min(mapW - 1, Math.ceil(Math.max(...xs)) + margin),
    y0: Math.max(0, Math.floor(Math.min(...ys)) - margin),
    y1: Math.min(mapH - 1, Math.ceil(Math.max(...ys)) + margin),
  };
}

/** Clamp the camera so the map stays reachable. */
export function clampCamera(cam: Camera, mapW: number, mapH: number): Camera {
  const minX = -mapH * HALF_W;
  const maxX = mapW * HALF_W;
  const minY = 0;
  const maxY = (mapW + mapH) * HALF_H;
  return { zoom: cam.zoom, x: Math.max(minX, Math.min(maxX, cam.x)), y: Math.max(minY, Math.min(maxY, cam.y)) };
}
