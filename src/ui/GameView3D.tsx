import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../core/engine';
import { CommandResult } from '../core/types';
import { Overlay } from '../render/renderer';
import { View3D, getModelLibrary, loadExternalModels } from '../render3d/view3d';
import { DayMode, WeatherMode } from '../render3d/world';
import { useI18n } from '../i18n/i18n';
import { commitTool, computeToolPreview } from './toolLogic';
import { Tool, ViewController } from './types';

interface Props {
  engine: GameEngine;
  tool: Tool;
  overlay: Overlay;
  dayMode: DayMode;
  weather: WeatherMode;
  selected: { x: number; y: number } | null;
  onSelect: (tile: { x: number; y: number } | null) => void;
  onResult: (r: CommandResult, kind: 'build' | 'transport' | 'zone' | 'bulldoze') => void;
  onCancelTool: () => void;
  onFail: () => void;
  controllerRef: MutableRefObject<ViewController | null>;
  onLightning?: () => void;
  quality?: 'auto' | 'high' | 'low';
}

interface Drag {
  button: number;
  x: number;
  y: number;
  start: { x: number; y: number } | null;
  moved: boolean;
}

export function GameView3D({ engine, tool, overlay, dayMode, weather, selected, onSelect, onResult, onCancelTool, onFail, controllerRef, onLightning, quality = 'auto' }: Props) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View3D | null>(null);
  const drag = useRef<Drag | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const lightningRef = useRef(onLightning);
  lightningRef.current = onLightning;
  const [label, setLabel] = useState<{ x: number; y: number; text: string; ok: boolean } | null>(null);

  // create / dispose the WebGL view
  useEffect(() => {
    const host = hostRef.current!;
    let view: View3D;
    try {
      view = new View3D(host, { getState: () => engine.state, getVersion: () => engine.version, getOverlay: () => overlayRef.current }, quality === 'auto' ? undefined : quality);
    } catch {
      onFail();
      return;
    }
    viewRef.current = view;
    view.onContextLost = onFail;
    view.world.onLightning = () => lightningRef.current?.();
    view.start();
    void loadExternalModels(getModelLibrary()).then(() => view.invalidate());
    controllerRef.current = {
      mode: '3d',
      centerOn: (x, y) => view.centerOn(x, y),
      pan: (dx, dy) => view.pan(dx, dy),
      zoom: (f) => view.zoomBy(f),
      rotate: (a) => view.rotateBy(a),
      resetCamera: () => view.resetCamera(),
      tileToScreen: (x, y) => view.tileToScreen(x, y),
      pick: (x, y) => view.pick(x, y),
      view,
    };
    return () => {
      controllerRef.current = null;
      viewRef.current = null;
      view.dispose();
    };
    // the view lives for the lifetime of this engine and quality setting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, quality]);

  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    v.setInspectMode(tool.kind === 'inspect');
    v.setPreview(null);
    setLabel(null);
  }, [tool]);
  useEffect(() => viewRef.current?.invalidate(), [overlay]);
  useEffect(() => viewRef.current?.setDayMode(dayMode), [dayMode]);
  useEffect(() => viewRef.current?.setWeather(weather), [weather]);
  useEffect(() => viewRef.current?.setSelected(selected), [selected]);

  const local = (e: React.PointerEvent) => {
    const r = hostRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const preview = (a: { x: number; y: number }, b: { x: number; y: number }, e: React.PointerEvent) => {
    const v = viewRef.current;
    if (!v) return;
    const r = computeToolPreview(engine, toolRef.current, a, b, t);
    v.setPreview(r.preview);
    const p = local(e);
    setLabel(r.label ? { x: p.x, y: p.y, ...r.label } : null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const v = viewRef.current;
    if (!v) return;
    drag.current = { button: e.button, x: e.clientX, y: e.clientY, start: v.pick(e.clientX, e.clientY), moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const v = viewRef.current;
    if (!v) return;
    const tile = v.pick(e.clientX, e.clientY);
    v.setHover(tile);
    const d = drag.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
    const tl = toolRef.current;
    if (tl.kind === 'inspect' || !tile) return;
    if (d && d.button === 0 && d.start) preview(tl.kind === 'building' ? tile : d.start, tile, e);
    else if (!d) preview(tile, tile, e);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const v = viewRef.current;
    const d = drag.current;
    drag.current = null;
    if (!v || !d) return;
    const tl = toolRef.current;
    if (d.button === 2 && !d.moved && tl.kind !== 'inspect') {
      onCancelTool();
      return;
    }
    if (d.button !== 0) return;
    const tile = v.pick(e.clientX, e.clientY);
    if (tl.kind === 'inspect') {
      if (!d.moved) onSelect(tile);
      return;
    }
    if (!tile || !d.start) return;
    const r = commitTool(engine, tl, tl.kind === 'building' ? tile : d.start, tile);
    if (r) onResult(r, tl.kind === 'building' ? 'build' : tl.kind === 'transport' ? 'transport' : tl.kind === 'zone' ? 'zone' : 'bulldoze');
    v.setPreview(null);
    setLabel(null);
  };

  return (
    <div className="absolute inset-0">
      <div
        ref={hostRef}
        className="h-full w-full touch-none select-none"
        data-testid="game-view-3d"
        style={{ cursor: tool.kind === 'inspect' ? 'grab' : 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerLeave={() => viewRef.current?.setHover(null)}
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
