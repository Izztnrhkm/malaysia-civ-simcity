import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../core/engine';
import { CommandResult } from '../core/types';
import { Camera, clampCamera, screenToTile, zoomAt } from '../render/iso';
import { Renderer } from '../render/renderer';
import { useI18n } from '../i18n/i18n';
import { commitTool, computeToolPreview } from './toolLogic';
import { Tool } from './types';

interface Props {
  engine: GameEngine;
  renderer: Renderer;
  tool: Tool;
  onSelect: (tile: { x: number; y: number } | null) => void;
  onResult: (r: CommandResult) => void;
  onCancelTool: () => void;
}

interface DragState {
  button: number;
  startX: number;
  startY: number;
  startTile: { x: number; y: number };
  cam: Camera;
  moved: boolean;
}

export function GameCanvas({ engine, renderer, tool, onSelect, onResult, onCancelTool }: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<DragState | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const dirty = useRef(true);
  const [label, setLabel] = useState<{ x: number; y: number; text: string; ok: boolean } | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  // resize to device pixels
  useEffect(() => {
    const c = canvasRef.current!;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      dirty.current = true;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // render loop
  useEffect(() => {
    let raf = 0;
    let lastVersion = -1;
    let lastDraw = 0;
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      const c = canvasRef.current;
      if (!c) return;
      const changed = engine.version !== lastVersion || dirty.current;
      if (!changed && time - lastDraw < 350) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const dpr = c.width / Math.max(1, c.clientWidth);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.render(ctx, engine.state, c.clientWidth, c.clientHeight, time);
      lastVersion = engine.version;
      lastDraw = time;
      dirty.current = false;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, renderer]);

  // clear previews when tool changes
  useEffect(() => {
    renderer.preview = null;
    setLabel(null);
    dirty.current = true;
  }, [tool, renderer]);

  const size = () => {
    const c = canvasRef.current!;
    return { w: c.clientWidth, h: c.clientHeight };
  };

  const tileAt = (sx: number, sy: number) => {
    const { w, h } = size();
    return screenToTile(renderer.camera, w, h, sx, sy);
  };

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const inMap = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x < engine.state.map.width && p.y < engine.state.map.height;

  /** Compute preview tiles, validity and cost for the active tool. */
  const updatePreview = (a: { x: number; y: number }, b: { x: number; y: number }, sx: number, sy: number) => {
    const r = computeToolPreview(engine, toolRef.current, a, b, t);
    renderer.preview = r.preview;
    setLabel(r.label ? { x: sx, y: sy, ...r.label } : null);
    dirty.current = true;
  };

  const commit = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const r = commitTool(engine, toolRef.current, a, b);
    if (r) onResult(r);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    c.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom: renderer.camera.zoom };
      drag.current = null;
      renderer.preview = null;
      return;
    }
    drag.current = { button: e.button, startX: p.x, startY: p.y, startTile: tileAt(p.x, p.y), cam: { ...renderer.camera }, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    if (pinch.current && pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const { w, h } = size();
      const target = (pinch.current.zoom * dist) / pinch.current.dist;
      renderer.camera = zoomAt(renderer.camera, w, h, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, target / renderer.camera.zoom);
      dirty.current = true;
      return;
    }
    const tile = tileAt(p.x, p.y);
    renderer.hover = inMap(tile) ? tile : null;
    dirty.current = true;
    const d = drag.current;
    const tl = toolRef.current;
    if (d) {
      if (Math.hypot(p.x - d.startX, p.y - d.startY) > 4) d.moved = true;
      const pan = d.button === 1 || d.button === 2 || (d.button === 0 && tl.kind === 'inspect');
      if (pan) {
        const { w, h } = size();
        const z = renderer.camera.zoom;
        renderer.camera = clampCamera({ ...d.cam, x: d.cam.x - (p.x - d.startX) / z, y: d.cam.y - (p.y - d.startY) / z }, engine.state.map.width, engine.state.map.height);
        void w;
        void h;
        return;
      }
      if (d.button === 0) updatePreview(tl.kind === 'building' ? tile : d.startTile, tile, p.x, p.y);
    } else if (tl.kind === 'building') updatePreview(tile, tile, p.x, p.y);
    else if (tl.kind !== 'inspect') updatePreview(tile, tile, p.x, p.y);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = local(e);
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const tl = toolRef.current;
    const tile = tileAt(p.x, p.y);
    if (d.button === 2 && !d.moved && tl.kind !== 'inspect') {
      onCancelTool();
      return;
    }
    if (d.button !== 0) return;
    if (tl.kind === 'inspect') {
      if (!d.moved) {
        const sel = inMap(tile) ? tile : null;
        renderer.selected = sel;
        onSelect(sel);
        dirty.current = true;
      }
      return;
    }
    commit(tl.kind === 'building' ? tile : d.startTile, tile);
    renderer.preview = null;
    setLabel(null);
    dirty.current = true;
  };

  const onWheel = (e: React.WheelEvent) => {
    const p = local(e);
    const { w, h } = size();
    renderer.camera = zoomAt(renderer.camera, w, h, p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    dirty.current = true;
  };

  return (
    <div className="absolute inset-0">
      <canvas
        ref={canvasRef}
        data-testid="game-canvas"
        className="h-full w-full touch-none select-none"
        style={{ cursor: tool.kind === 'inspect' ? 'grab' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          renderer.hover = null;
          dirty.current = true;
        }}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      {label && (
        <div
          className={`pointer-events-none absolute rounded px-2 py-0.5 text-xs font-semibold shadow ${label.ok ? 'bg-emerald-800/90 text-emerald-50' : 'bg-red-800/90 text-red-50'}`}
          style={{ left: label.x + 16, top: label.y + 12 }}
        >
          {label.text}
        </div>
      )}
    </div>
  );
}
