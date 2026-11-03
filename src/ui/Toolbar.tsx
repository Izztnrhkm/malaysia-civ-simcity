import { useState } from 'react';
import { GameEngine } from '../core/engine';
import { BUILDINGS, BuildingCategory, BuildingDef, TRANSPORTS, ZONE_NAMES } from '../core/data/buildings';
import { ERAS } from '../core/data/eras';
import { GOOD_DEFS } from '../core/data/goods';
import { ALL_RESEARCH } from '../core/data/research';
import { isBuildingUnlocked, isTransportUnlocked } from '../core/sim/context';
import { Good, ZONE, ZoneKey } from '../core/types';
import { formatMoney, useI18n } from '../i18n/i18n';
import { useEngineVersion } from './hooks';
import { buildingIcon, transportIcon, zoneIcon } from './icons';
import { Tool } from './types';

interface Props {
  engine: GameEngine;
  tool: Tool;
  setTool: (t: Tool) => void;
}

const CATS: Array<[BuildingCategory, string]> = [
  ['trade', '⚓'],
  ['production', '🌾'],
  ['service', '🕌'],
  ['research', '📚'],
  ['culture', '🎭'],
  ['utility', '⚡'],
  ['landmark', '🏛️'],
];

const ZONE_COLORS: Record<ZoneKey, string> = { R: 'bg-emerald-600', C: 'bg-sky-600', I: 'bg-amber-600' };

export function BuildingCard({ def, engine, compact = false }: { def: BuildingDef; engine: GameEngine; compact?: boolean }) {
  const { t, L } = useI18n();
  const unlocked = isBuildingUnlocked(engine.state, def.id);
  const by = ALL_RESEARCH.find((r) => r.unlocks.buildings?.includes(def.id));
  const icon = buildingIcon(def.id);
  return (
    <div className="flex gap-2">
      {icon ? <img src={icon} alt="" className="h-12 w-14 shrink-0 object-contain" /> : <div className="h-12 w-14 shrink-0 rounded bg-black/30" />}
      <div className="min-w-0 text-left text-xs">
        <div className="text-sm font-semibold text-songket-100">{L(def.name)}</div>
        {!compact && <div className="opacity-75">{L(def.desc)}</div>}
        <div className="mt-0.5 flex flex-wrap gap-1">
          <span className="chip">
            {t('build.cost')} {formatMoney(def.cost)}
          </span>
          <span className="chip">
            {t('build.upkeep')} {def.upkeep}
          </span>
          {def.jobs ? (
            <span className="chip">
              {t('build.jobs')} {def.jobs}
            </span>
          ) : null}
          {def.size > 1 && (
            <span className="chip">
              {def.size}×{def.size}
            </span>
          )}
          {def.produces &&
            Object.entries(def.produces).map(([g, q]) => (
              <span key={g} className="chip text-emerald-200">
                +{q} {GOOD_DEFS[g as Good].icon}
              </span>
            ))}
          {def.consumes &&
            Object.entries(def.consumes).map(([g, q]) => (
              <span key={g} className="chip text-red-200">
                -{q} {GOOD_DEFS[g as Good].icon}
              </span>
            ))}
          {def.exportCapacity ? <span className="chip">⚓ {def.exportCapacity}</span> : null}
          {def.research ? <span className="chip">📚 {def.research}</span> : null}
          {def.culture ? <span className="chip">🎭 {def.culture}</span> : null}
          {def.power ? <span className="chip">⚡ {def.power > 0 ? '+' : ''}{def.power}</span> : null}
          {def.placement && def.placement !== 'land' && <span className="chip text-amber-200">{t(`place.${def.placement}`)}</span>}
        </div>
        {!unlocked && by && (
          <div className="mt-0.5 text-amber-300">
            🔒 {t('build.unlockBy')}: {L(by.name)}
          </div>
        )}
      </div>
    </div>
  );
}

export function Toolbar({ engine, tool, setTool }: Props) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const [open, setOpen] = useState<BuildingCategory | null>(null);
  const s = engine.state;
  const zoneNames = (z: ZoneKey) => L(ZONE_NAMES[z].era[Math.min(3, s.era - 1)]);
  const isTool = (tt: Tool) => JSON.stringify(tt) === JSON.stringify(tool);
  const pick = (tt: Tool) => {
    setTool(isTool(tt) ? { kind: 'inspect' } : tt);
  };
  const list = open ? BUILDINGS.filter((b) => b.category === open && b.era <= s.era && !(b.obsolete && s.era > b.obsolete)) : [];

  return (
    <div className="pointer-events-auto absolute left-2 top-24 flex max-h-[calc(100%-7rem)] gap-2" data-testid="toolbar">
      <div className="panel scroll-thin flex w-[4.25rem] flex-col items-stretch gap-1 overflow-y-auto p-1.5">
        <button className={`btn flex-col py-1.5 ${tool.kind === 'inspect' ? 'btn-active' : ''}`} onClick={() => setTool({ kind: 'inspect' })} title={t('tool.inspect')} data-testid="tool-inspect">
          <span className="text-lg">🔍</span>
          <span className="text-[10px]">{t('tool.inspect')}</span>
        </button>
        <button className={`btn flex-col py-1.5 ${tool.kind === 'bulldoze' ? 'btn-active' : ''}`} onClick={() => pick({ kind: 'bulldoze' })} title={t('tool.bulldoze')} data-testid="tool-bulldoze">
          <span className="text-lg">🚜</span>
          <span className="text-[10px]">{t('tool.bulldoze')}</span>
        </button>
        <div className="mt-1 text-center text-[10px] uppercase tracking-wide text-songket-300">{t('tool.zones')}</div>
        {(['R', 'C', 'I'] as ZoneKey[]).map((z) => {
          const icon = zoneIcon(ZONE[z], s.era);
          return (
            <button
              key={z}
              className={`btn flex-col py-1 ${isTool({ kind: 'zone', zone: z }) ? 'btn-active' : ''}`}
              onClick={() => pick({ kind: 'zone', zone: z })}
              title={`${t(`zone.${z}`)} (${zoneNames(z)})`}
              data-testid={`tool-zone-${z}`}
            >
              {icon ? <img src={icon} alt="" className="h-7 w-9 object-contain" /> : <span className={`h-4 w-6 rounded ${ZONE_COLORS[z]}`} />}
              <span className="text-[10px] leading-tight">{zoneNames(z)}</span>
            </button>
          );
        })}
        <button className={`btn py-1 text-[10px] ${isTool({ kind: 'zone', zone: 'none' }) ? 'btn-active' : ''}`} onClick={() => pick({ kind: 'zone', zone: 'none' })} data-testid="tool-dezone">
          {t('tool.dezone')}
        </button>
        <div className="mt-1 text-center text-[10px] uppercase tracking-wide text-songket-300">{t('tool.transport')}</div>
        {TRANSPORTS.filter((tr) => tr.era <= s.era).map((tr) => {
          const ok = isTransportUnlocked(s, tr.key);
          const icon = transportIcon(tr.id, s.era);
          return (
            <button
              key={tr.key}
              disabled={!ok}
              className={`btn flex-col py-1 ${isTool({ kind: 'transport', key: tr.key }) ? 'btn-active' : ''}`}
              onClick={() => pick({ kind: 'transport', key: tr.key })}
              title={`${L(tr.name)} (${formatMoney(tr.cost)}/tile)${ok ? '' : ' 🔒'}`}
              data-testid={`tool-transport-${tr.key}`}
            >
              {icon ? <img src={icon} alt="" className="h-6 w-9 object-contain" /> : <span>🛣️</span>}
              <span className="text-[10px] leading-tight">{t(`transport.${tr.key}`)}</span>
            </button>
          );
        })}
        <div className="mt-1 text-center text-[10px] uppercase tracking-wide text-songket-300">🏗️</div>
        {CATS.map(([cat, icon]) => (
          <button
            key={cat}
            className={`btn flex-col py-1 ${open === cat ? 'btn-active' : ''}`}
            onClick={() => setOpen(open === cat ? null : cat)}
            title={t(`cat.${cat}`)}
            data-testid={`cat-${cat}`}
          >
            <span className="text-lg">{icon}</span>
            <span className="text-[10px] leading-tight">{t(`cat.${cat}`)}</span>
          </button>
        ))}
      </div>
      {open && (
        <div className="panel scroll-thin w-80 overflow-y-auto p-2" data-testid="build-menu">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display font-bold text-songket-300">{t(`cat.${open}`)}</span>
            <button className="btn px-2" onClick={() => setOpen(null)} aria-label={t('panel.close')}>
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {list.map((def) => {
              const unlocked = isBuildingUnlocked(s, def.id);
              const active = tool.kind === 'building' && tool.id === def.id;
              return (
                <button
                  key={def.id}
                  disabled={!unlocked}
                  className={`rounded-lg border p-1.5 text-left transition ${active ? 'border-songket-300 bg-songket-900/60' : 'border-white/10 bg-black/20 hover:bg-white/10'} ${unlocked ? '' : 'opacity-60'}`}
                  onClick={() => pick({ kind: 'building', id: def.id })}
                  data-testid={`build-${def.id}`}
                >
                  <BuildingCard def={def} engine={engine} />
                </button>
              );
            })}
            {list.length === 0 && <div className="text-xs opacity-70">—</div>}
          </div>
          <div className="mt-2 text-[10px] opacity-60">{L(ERAS[s.era].name)}</div>
        </div>
      )}
    </div>
  );
}
