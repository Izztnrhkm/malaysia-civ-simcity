import { GameEngine } from '../core/engine';
import { ERAS } from '../core/data/eras';
import { canAdvanceEra } from '../core/sim/research';
import { formatMoney, formatNumber, useI18n } from '../i18n/i18n';
import { useEngineVersion } from './hooks';
import { ModalId, ViewMode } from './types';

interface Props {
  engine: GameEngine;
  speed: number;
  setSpeed: (s: number) => void;
  openModal: (m: ModalId) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
}

function DemandBar({ label, value, color }: { label: string; value: number; color: string }) {
  const h = Math.abs(value) / 100;
  return (
    <div className="flex flex-col items-center" title={`${label}: ${Math.round(value)}`}>
      <div className="relative h-8 w-2.5 rounded-sm bg-black/40">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/30" />
        <div
          className="absolute left-0 right-0 rounded-sm"
          style={{
            background: color,
            height: `${h * 50}%`,
            bottom: value >= 0 ? '50%' : `${50 - h * 50}%`,
            opacity: value >= 0 ? 1 : 0.5,
          }}
        />
      </div>
      <span className="text-[10px] font-bold leading-none">{label}</span>
    </div>
  );
}

export function TopBar({ engine, speed, setSpeed, openModal, viewMode, setViewMode }: Props) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const s = engine.state;
  const d = s.derived;
  const era = ERAS[s.era];
  const canAdv = canAdvanceEra(s);
  const happyColor = d.happiness >= 65 ? 'text-emerald-300' : d.happiness >= 45 ? 'text-amber-200' : 'text-red-300';
  const panels: Array<[ModalId, string, string]> = [
    ['tech', '⚙️', 'panel.tech'],
    ['civics', '📜', 'panel.civics'],
    ['diplomacy', '🤝', 'panel.diplomacy'],
    ['economy', '💰', 'panel.economy'],
    ['encyclopedia', '📖', 'panel.encyclopedia'],
    ['save', '💾', 'panel.save'],
    ['settings', '⚙', 'panel.settings'],
  ];
  return (
    <div className="panel pointer-events-auto absolute left-2 right-2 top-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5" data-testid="topbar">
      <div className="min-w-0">
        <div className="truncate font-display text-base font-bold text-songket-300">{s.name}</div>
        <div className="text-xs text-songket-100/80" data-testid="date">
          {t(`month.${s.month}`)} {s.year}
        </div>
      </div>
      <button
        className={`btn ${canAdv ? 'btn-gold animate-pulse' : ''}`}
        onClick={() => openModal('era')}
        title={t('panel.era')}
        data-testid="era-button"
      >
        <span className="text-xs opacity-70">Era {s.era}</span>
        <span className="font-semibold">{L(era.short)}</span>
      </button>
      <div className="flex items-center gap-3 text-sm">
        <div title={t('top.money')} data-testid="money">
          <span className="opacity-70">{era.currencySymbol}</span> <b>{formatMoney(s.money)}</b>{' '}
          <span className={d.netIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}>
            ({d.netIncome >= 0 ? '+' : ''}
            {formatMoney(d.netIncome)}
            {t('top.perTick')})
          </span>
        </div>
        <div title={t('top.population')} data-testid="population">
          👥 <b>{formatNumber(d.population)}</b>
        </div>
        <div title={t('top.happiness')} className={happyColor}>
          ☺ <b>{Math.round(d.happiness)}%</b>
        </div>
        <div className="flex items-end gap-1" title={t('top.demand')}>
          <DemandBar label="R" value={d.demand.R} color="#3fbf5f" />
          <DemandBar label="C" value={d.demand.C} color="#3f8fdf" />
          <DemandBar label="I" value={d.demand.I} color="#e0b030" />
        </div>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="speed">
        {[0, 1, 2, 3].map((sp) => (
          <button
            key={sp}
            className={`btn px-2 ${speed === sp ? 'btn-active' : ''}`}
            onClick={() => setSpeed(sp)}
            title={t(sp === 0 ? 'speed.pause' : `speed.${sp}`)}
            aria-pressed={speed === sp}
            data-testid={`speed-${sp}`}
          >
            {sp === 0 ? '⏸' : '▶'.repeat(sp)}
          </button>
        ))}
      </div>
      <button
        className="btn px-2 font-bold"
        onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
        title={t(viewMode === '3d' ? 'view.to2d' : 'view.to3d')}
        aria-label={t(viewMode === '3d' ? 'view.to2d' : 'view.to3d')}
        data-testid="toggle-view"
      >
        {viewMode === '3d' ? '3D' : '2D'}
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-1">
        {panels.map(([id, icon, key]) => (
          <button key={id} className="btn" onClick={() => openModal(id)} title={t(key)} data-testid={`open-${id}`}>
            <span>{icon}</span>
            <span className="hidden xl:inline">{t(key)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
