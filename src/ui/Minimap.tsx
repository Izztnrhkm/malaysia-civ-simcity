import { useEffect, useRef } from 'react';
import { GameEngine } from '../core/engine';
import { OVERLAYS, Overlay, Renderer, drawMinimap } from '../render/renderer';
import { useI18n } from '../i18n/i18n';
import { useEngineVersion } from './hooks';

interface Props {
  engine: GameEngine;
  renderer: Renderer;
  overlay: Overlay;
  setOverlay: (o: Overlay) => void;
}

export function Minimap({ engine, renderer, overlay, setOverlay }: Props) {
  const version = useEngineVersion(engine);
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && version % 4 === 0) drawMinimap(ref.current, engine.state);
  }, [version, engine]);
  useEffect(() => {
    if (ref.current) drawMinimap(ref.current, engine.state);
  }, [engine]);

  const onClick = (e: React.MouseEvent) => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    // the canvas is rotated 45deg and squashed, so invert via its bounding box centre
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    const m = engine.state.map;
    const tx = ((dx + dy) / 2 + 0.5) * m.width;
    const ty = ((dy - dx) / 2 + 0.5) * m.height;
    renderer.centerOn(Math.round(tx), Math.round(ty));
    engine.emit();
  };

  return (
    <div className="panel pointer-events-auto absolute bottom-2 right-2 hidden p-2 sm:block" data-testid="minimap">
      <div className="relative mx-auto h-[92px] w-[184px] cursor-pointer overflow-hidden" onClick={onClick}>
        <canvas
          ref={ref}
          className="absolute left-1/2 top-1/2"
          style={{ width: 130, height: 130, imageRendering: 'pixelated', transform: 'translate(-50%,-50%) scaleY(0.5) rotate(45deg)' }}
        />
      </div>
      <label className="mt-1 flex items-center gap-1 text-xs">
        <span className="opacity-75">{t('overlay.title')}</span>
        <select className="flex-1 rounded bg-black/40 px-1 py-0.5 text-xs" value={overlay} onChange={(e) => setOverlay(e.target.value as Overlay)} data-testid="overlay-select">
          {OVERLAYS.map((o) => (
            <option key={o} value={o}>
              {t(`overlay.${o}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
