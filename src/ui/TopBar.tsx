import { useState } from 'react';
import { GameEngine } from '../core/engine';
import { ERAS } from '../core/data/eras';
import { canAdvanceEra } from '../core/sim/research';
import { SoundEngine } from '../audio/soundEngine';
import { formatMoney, formatNumber, useI18n } from '../i18n/i18n';
import { useEngineVersion } from './hooks';
import { SoundControl } from './SoundControl';
import { ModalId, ViewMode } from './types';

interface Props {
  engine: GameEngine;
  speed: number;
  setSpeed: (s: number) => void;
  openModal: (m: ModalId) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  sound?: SoundEngine;
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

export const PANELS: Array<[ModalId, string, string]> = [
  ['tech', '⚙️', 'panel.tech'],
  ['civics', '📜', 'panel.civics'],
  ['advisors', '🎓', 'panel.advisors'],
  ['diplomacy', '🤝', 'panel.diplomacy'],
  ['economy', '💰', 'panel.economy'],
  ['timeline', '📈', 'panel.timeline'],
  ['encyclopedia', '📖', 'panel.encyclopedia'],
  ['save', '💾', 'panel.save'],
  ['settings', '⚙', 'panel.settings'],
];

export function TopBar({ engine, speed, setSpeed, openModal, viewMode, setViewMode, sound }: Props) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const [menu, setMenu] = useState(false);
  const s = engine.state;
  const d = s.derived;
  const era = ERAS[s.era];
  const canAdv = canAdvanceEra(s);
  const happyColor = d.happiness >= 65 ? 'text-emerald-300' : d.happiness >= 45 ? 'text-amber-200' : 'text-red-300';
  return (
    <div className="panel pointer-events-auto absolute left-1 right-1 top-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 sm:left-2 sm:right-2 sm:top-2 sm:px-3 sm:py-1.5" data-testid="topbar">
      <div className="min-w-0 max-w-[9rem] sm:max-w-none">
        <div className="truncate font-display text-sm font-bold text-songket-300 sm:text-base">{s.name}</div>
        <div className="text-xs text-songket-100/80" data-testid="date">
          {t(`month.${s.month}`)} {s.year}
        </div>
      </div>
      <button className={`btn px-2 ${canAdv ? 'btn-gold animate-pulse' : ''}`} onClick={() => openModal('era')} title={t('panel.era')} data-testid="era-button">
        <span className="text-xs opacity-70">Era {s.era}</span>
        <span className="hidden font-semibold sm:inline">{L(era.short)}</span>
      </button>
      {s.crisis && (
        <button className="btn border-red-400 bg-red-900/70 px-2 animate-pulse" onClick={() => openModal('crisis')} data-testid="crisis-button" title={t('crisis.title')}>
          ⚠️ <span className="hidden sm:inline">{t('crisis.title')}</span>
        </button>
      )}
      <div className="flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
        <div title={t('top.money')} data-testid="money">
          <span className="opacity-70">{era.currencySymbol}</span> <b>{formatMoney(s.money)}</b>{' '}
          <span className={`hidden md:inline ${d.netIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            ({d.netIncome >= 0 ? '+' : ''}
            {formatMoney(d.netIncome)}
            {t('top.perTick')})
          </span>
        </div>
        <div title={t('top.population')} data-testid="population">
          👥 <b>{formatNumber(d.population)}</b>
        </div>
        <div title={t('top.happiness')} className={`hidden sm:block ${happyColor}`}>
          ☺ <b>{Math.round(d.happiness)}%</b>
        </div>
        <div className="hidden items-end gap-1 sm:flex" title={t('top.demand')}>
          <DemandBar label="R" value={d.demand.R} color="#3fbf5f" />
          <DemandBar label="C" value={d.demand.C} color="#3f8fdf" />
          <DemandBar label="I" value={d.demand.I} color="#e0b030" />
        </div>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="speed">
        {[0, 1, 2, 3].map((sp) => (
          <button
            key={sp}
            className={`btn px-1.5 sm:px-2 ${speed === sp ? 'btn-active' : ''}`}
            onClick={() => setSpeed(sp)}
            title={t(sp === 0 ? 'speed.pause' : `speed.${sp}`)}
            aria-pressed={speed === sp}
            data-testid={`speed-${sp}`}
          >
            {sp === 0 ? '⏸' : '▶'.repeat(sp)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          className="btn px-2 font-bold"
          onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
          title={t(viewMode === '3d' ? 'view.to2d' : 'view.to3d')}
          aria-label={t(viewMode === '3d' ? 'view.to2d' : 'view.to3d')}
          data-testid="toggle-view"
        >
          {viewMode === '3d' ? '3D' : '2D'}
        </button>
        {sound && <SoundControl engine={sound} />}
      </div>
      {/* desktop / tablet: inline panel buttons */}
      <div className="ml-auto hidden flex-wrap items-center gap-1 md:flex">
        {PANELS.map(([id, icon, key]) => (
          <button key={id} className="btn" onClick={() => openModal(id)} title={t(key)} data-testid={`open-${id}`}>
            <span>{icon}</span>
            <span className="hidden 2xl:inline">{t(key)}</span>
          </button>
        ))}
      </div>
      {/* phone: collapsible drawer */}
      <div className="relative ml-auto md:hidden">
        <button className={`btn px-2 ${menu ? 'btn-active' : ''}`} onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="menu" data-testid="menu-drawer">
          ☰
        </button>
        {menu && (
          <div className="panel absolute right-0 top-full z-30 mt-1 grid w-56 grid-cols-1 gap-1 p-2" data-testid="menu-drawer-panel">
            {PANELS.map(([id, icon, key]) => (
              <button
                key={id}
                className="btn justify-start"
                onClick={() => {
                  setMenu(false);
                  openModal(id);
                }}
                data-testid={`drawer-open-${id}`}
              >
                <span>{icon}</span>
                <span>{t(key)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
