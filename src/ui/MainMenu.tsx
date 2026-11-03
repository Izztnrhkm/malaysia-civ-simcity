import { useEffect, useMemo, useRef, useState } from 'react';
import { createGame } from '../core/sim/context';
import { listSlots } from '../core/save/save';
import { Lang } from '../core/types';
import { Renderer } from '../render/renderer';
import { useI18n } from '../i18n/i18n';

interface Props {
  onStart: (name: string, seed: number) => void;
  onOpenLoad: () => void;
  onContinue: (() => void) | null;
  setLang: (l: Lang) => void;
}

const NAMES = ['Kota Baharu', 'Bandar Seri Selat', 'Kuala Muara', 'Pengkalan Emas', 'Bandar Hilir', 'Kuala Damai'];

export function MainMenu({ onStart, onOpenLoad, onContinue, setLang }: Props) {
  const { t, lang } = useI18n();
  const [name, setName] = useState(NAMES[0]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preview = useMemo(() => createGame(seed, 'preview', 128), [seed]);
  const hasSaves = useMemo(() => listSlots().some((s) => !s.empty), []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const r = new Renderer();
    let raf = 0;
    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(c.clientWidth * dpr)) {
        c.width = Math.round(c.clientWidth * dpr);
        c.height = Math.round(c.clientHeight * dpr);
      }
      const z = Math.max(0.35, Math.min(0.8, c.clientWidth / 2600));
      r.camera = { x: Math.sin(time / 9000) * 600 - 400, y: 2000 + Math.cos(time / 11000) * 400, zoom: z };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      r.render(ctx, preview, c.clientWidth, c.clientHeight, time);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [preview]);

  return (
    <div className="relative h-full w-full overflow-hidden" data-testid="main-menu">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-selat-900/60 via-transparent to-selat-900/80" />
      <div className="relative flex h-full items-center justify-center p-4">
        <div className="panel w-full max-w-lg p-6">
          <div className="songket-border -mx-6 -mt-6 mb-4 h-2 rounded-t-xl" />
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-4xl font-bold text-songket-300 drop-shadow">{t('app.title')}</h1>
              <div className="font-display text-lg text-songket-100">{t('app.subtitle')}</div>
            </div>
            <div className="flex gap-1">
              {(['ms', 'en'] as Lang[]).map((l) => (
                <button key={l} className={`btn px-2 text-xs ${lang === l ? 'btn-active' : ''}`} onClick={() => setLang(l)} data-testid={`menu-lang-${l}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-sm opacity-85">{t('menu.tagline')}</p>
          <div className="mt-4 space-y-2">
            <label className="block text-sm">
              {t('menu.cityName')}
              <input className="mt-0.5 w-full rounded bg-black/40 px-2 py-1" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} data-testid="city-name" />
            </label>
            <label className="block text-sm">
              {t('menu.seed')}
              <div className="mt-0.5 flex gap-2">
                <input
                  className="w-full rounded bg-black/40 px-2 py-1"
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Math.abs(Math.floor(Number(e.target.value))) || 1)}
                  data-testid="seed"
                />
                <button className="btn" onClick={() => setSeed(Math.floor(Math.random() * 100000))}>
                  🎲 {t('menu.random')}
                </button>
              </div>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-gold px-4 py-2 text-base" onClick={() => onStart(name.trim() || NAMES[0], seed)} data-testid="start-game">
              🏗️ {t('menu.start')}
            </button>
            {onContinue && (
              <button className="btn px-4 py-2" onClick={onContinue}>
                ▶ {t('menu.continue')}
              </button>
            )}
            <button className="btn px-4 py-2" onClick={onOpenLoad} disabled={!hasSaves} data-testid="menu-load">
              📂 {t('menu.load')}
            </button>
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-songket-300">{t('menu.howto')}</summary>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 opacity-90">
              {[1, 2, 3, 4].map((i) => (
                <li key={i}>{t(`menu.howto.${i}`)}</li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}
