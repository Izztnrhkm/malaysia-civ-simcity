import { useMemo, useState } from 'react';
import { GameEngine } from '../../core/engine';
import { ERAS } from '../../core/data/eras';
import { MILESTONES } from '../../core/sim/milestones';
import { EraId, HistoryPoint } from '../../core/types';
import { formatMoney, formatNumber, useI18n } from '../../i18n/i18n';
import { useEngineVersion } from '../hooks';
import { Modal } from './Modal';

type Key = 'money' | 'population' | 'output';
/** Validated against the panel surface #0d2430 (dataviz palette check: all PASS). */
const SERIES: Array<{ key: Key; label: string; color: string; fmt: (v: number) => string }> = [
  { key: 'money', label: 'timeline.treasury', color: '#c98500', fmt: formatMoney },
  { key: 'population', label: 'timeline.population', color: '#3987e5', fmt: (v) => formatNumber(v) },
  { key: 'output', label: 'timeline.output', color: '#199e70', fmt: formatMoney },
];
const ERA_BAND = ['', 'rgba(201,150,43,0.07)', 'rgba(57,135,229,0.07)', 'rgba(25,158,112,0.07)', 'rgba(144,133,233,0.08)'];

const W = 640;
const H = 110;
const PAD = { l: 52, r: 10, t: 8, b: 4 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Small multiples (one measure per panel, shared time axis) instead of a dual-axis chart. */
function Panel({ data, s, hover, setHover, t }: { data: HistoryPoint[]; s: (typeof SERIES)[number]; hover: number | null; setHover: (i: number | null) => void; t: (k: string) => string }) {
  const vals = data.map((d) => (s.key === 'output' ? (d.output ?? 0) : d[s.key]));
  const min = Math.min(0, ...vals);
  const max = niceMax(Math.max(...vals, 1));
  const x = (i: number) => PAD.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min || 1)) * (H - PAD.t - PAD.b);
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  // era bands
  const bands: Array<{ era: number; x0: number; x1: number }> = [];
  data.forEach((d, i) => {
    const era = d.era ?? 0;
    const last = bands[bands.length - 1];
    if (last && last.era === era) last.x1 = x(i);
    else bands.push({ era, x0: x(i), x1: x(i) });
  });
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-songket-100">
          <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: s.color }} />
          {t(s.label)}
        </span>
        <span className="opacity-80">{hover != null ? `${data[hover].year}: ${s.fmt(vals[hover])}` : s.fmt(vals[vals.length - 1] ?? 0)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label={t(s.label)} onPointerMove={onMove} onPointerLeave={() => setHover(null)} data-testid={`chart-${s.key}`}>
        {bands.map((b, k) => (
          <rect key={k} x={b.x0} y={PAD.t} width={Math.max(1, b.x1 - b.x0)} height={H - PAD.t - PAD.b} fill={ERA_BAND[b.era] ?? 'transparent'} />
        ))}
        {[0, 0.5, 1].map((f) => {
          const v = min + (max - min) * f;
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgba(248,236,200,0.12)" strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="rgba(248,236,200,0.6)">
                {s.fmt(v)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(248,236,200,0.45)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(vals[hover])} r={4} fill={s.color} stroke="#0d2430" strokeWidth={2} />
          </>
        )}
      </svg>
    </div>
  );
}

export function Timeline({ engine, onClose }: { engine: GameEngine; onClose: () => void }) {
  useEngineVersion(engine);
  const { t, L, lang } = useI18n();
  const s = engine.state;
  const data = s.history;
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const progress = useMemo(() => MILESTONES.map((m) => ({ m, reqs: m.requirements(s) })), [s, s.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const got = s.milestones ?? [];
  return (
    <Modal title={`📈 ${t('panel.timeline')}`} onClose={onClose} wide testId="modal-timeline">
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-songket-300">{t('timeline.chart')}</div>
            <button className="btn px-2 text-xs" onClick={() => setTable((v) => !v)} aria-pressed={table} data-testid="timeline-table-toggle">
              {table ? '📈' : '▦'}
            </button>
          </div>
          {data.length < 2 ? (
            <p className="text-sm opacity-75">{t('timeline.empty')}</p>
          ) : table ? (
            <div className="scroll-thin max-h-80 overflow-auto">
              <table className="w-full text-right text-xs" data-testid="timeline-table">
                <thead className="sticky top-0 bg-[#0d2430]">
                  <tr>
                    <th className="text-left">Era</th>
                    <th>{lang === 'ms' ? 'Tahun' : 'Year'}</th>
                    {SERIES.map((x) => (
                      <th key={x.key}>{t(x.label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((d) => (
                    <tr key={d.tick} className="border-t border-white/5">
                      <td className="text-left">{d.era ?? ''}</td>
                      <td>{d.year}</td>
                      <td>{formatMoney(d.money)}</td>
                      <td>{formatNumber(d.population)}</td>
                      <td>{d.output != null ? formatMoney(d.output) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            SERIES.map((x) => <Panel key={x.key} data={data} s={x} hover={hover} setHover={setHover} t={t} />)
          )}
          <div className="flex flex-wrap gap-2 text-[11px] opacity-80">
            {([1, 2, 3, 4] as EraId[]).map((e) => (
              <span key={e} className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-3 rounded-sm border border-white/20" style={{ background: ERA_BAND[e].replace(/0\.0\d\)/, '0.35)') }} />
                {L(ERAS[e].short)}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-songket-300">{t('timeline.milestones')}</div>
          <div className={`rounded-lg p-2 text-xs ${s.victory ? 'bg-emerald-900/40' : 'bg-black/20'}`}>
            🏆 {t('timeline.classic')} {s.victory && <b className="text-emerald-300">✓ {t('timeline.achieved')}</b>}
          </div>
          {progress.map(({ m, reqs }) => (
            <div key={m.id} className={`rounded-lg p-2 ${got.includes(m.id) ? 'bg-emerald-900/40' : 'bg-black/20'}`} data-testid={`milestone-${m.id}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-songket-100">
                  {m.icon} {L(m.name)}
                </div>
                {got.includes(m.id) && <span className="text-xs font-bold text-emerald-300">✓ {t('timeline.achieved')}</span>}
              </div>
              <div className="mb-1 text-xs opacity-75">{L(m.desc)}</div>
              <ul className="space-y-0.5 text-xs">
                {reqs.map((r, k) => (
                  <li key={k} className={r.met ? 'text-emerald-300' : 'opacity-85'}>
                    {r.met ? '✓' : '○'} {L(r.label)}
                    {r.target != null && (
                      <span className="opacity-75">
                        {' '}
                        ({formatNumber(Math.min(r.current ?? 0, r.target * 10))} / {formatNumber(r.target)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
