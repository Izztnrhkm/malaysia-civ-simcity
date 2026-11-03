import { GameEngine } from '../core/engine';
import { BUILDING_MAP, ZONE_CAPACITY } from '../core/data/buildings';
import { TERRAIN_KEYS } from '../core/types';
import { useI18n } from '../i18n/i18n';
import { useEngineVersion } from './hooks';
import { BuildingCard } from './Toolbar';

interface Props {
  engine: GameEngine;
  tile: { x: number; y: number } | null;
  onClose: () => void;
  openEntry: (id: string) => void;
}

function Meter({ label, value, max = 255, invert = false }: { label: string; value: number; max?: number; invert?: boolean }) {
  const v = Math.max(0, Math.min(1, value / max));
  const good = invert ? 1 - v : v;
  const color = good > 0.66 ? 'bg-emerald-400' : good > 0.33 ? 'bg-amber-300' : 'bg-red-400';
  return (
    <div className="text-xs">
      <div className="flex justify-between">
        <span className="opacity-80">{label}</span>
        <span>{Math.round(v * 100)}%</span>
      </div>
      <div className="h-1.5 rounded bg-black/40">
        <div className={`h-1.5 rounded ${color}`} style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}

export function InfoPanel({ engine, tile, onClose, openEntry }: Props) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  if (!tile) return null;
  const m = engine.state.map;
  const i = tile.y * m.width + tile.x;
  const terrainKey = TERRAIN_KEYS[m.terrain[i]];
  const bid = m.building[i];
  const b = bid >= 0 ? engine.state.buildings.find((bb) => bb.id === bid) : undefined;
  const def = b ? BUILDING_MAP[b.def] : undefined;
  const zone = m.zone[i];
  const zoneKey = zone === 1 ? 'R' : zone === 2 ? 'C' : zone === 3 ? 'I' : null;
  return (
    <div className="panel pointer-events-auto absolute right-2 top-24 w-72 p-3" data-testid="info-panel">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display font-bold text-songket-300">
          {def ? L(def.name) : t(`terrain.${terrainKey}`)}{' '}
          <span className="text-xs font-normal opacity-60">
            ({tile.x}, {tile.y})
          </span>
        </div>
        <button className="btn px-2" onClick={onClose} aria-label={t('panel.close')}>
          ✕
        </button>
      </div>
      {def && b && (
        <div className="mb-2 rounded-lg bg-black/25 p-2">
          <BuildingCard def={def} engine={engine} compact />
          <Meter label={t('info.efficiency')} value={b.efficiency} max={1} />
          {def.entry && (
            <button className="btn mt-2 w-full" onClick={() => openEntry(def.entry!)}>
              📖 {t('info.readMore')}
            </button>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <div className="text-xs">
          {t('info.terrain')}: <b>{t(`terrain.${terrainKey}`)}</b>
        </div>
        {zoneKey && (
          <div className="text-xs">
            {t('info.zone')}: <b>{t(`zone.${zoneKey}`)}</b> · {t('info.density')} {m.density[i]}/4 ·{' '}
            {zoneKey === 'R' ? `👥 ${ZONE_CAPACITY.R[m.density[i]]}` : `💼 ${ZONE_CAPACITY[zoneKey][m.density[i]]}`}
          </div>
        )}
        <div className="text-xs">
          {t('info.access')}: <b>{m.access[i] ? t('info.yes') : t('info.no')}</b>
          {m.tin[i] > 0 && (
            <>
              {' '}
              · {t('info.tin')}: <b>{Math.round((m.tin[i] / 255) * 100)}%</b>
            </>
          )}
        </div>
        <Meter label={t('info.landValue')} value={m.landValue[i]} />
        <Meter label={t('info.pollution')} value={m.pollution[i]} invert />
        <Meter label={t('info.coverage')} value={m.coverage[i]} max={250} />
        <Meter label={t('info.logistics')} value={m.logistics[i]} />
        <Meter label={t('info.fertility')} value={m.fertility[i]} />
      </div>
    </div>
  );
}
