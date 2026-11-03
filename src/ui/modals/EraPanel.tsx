import { GameEngine } from '../../core/engine';
import { BUILDING_MAP } from '../../core/data/buildings';
import { ERAS, nextEra } from '../../core/data/eras';
import { RESEARCH_MAP } from '../../core/data/research';
import { canAdvanceEra, eraRequirements } from '../../core/sim/research';
import { formatNumber, useI18n } from '../../i18n/i18n';
import { useEngineVersion } from '../hooks';
import { Modal } from './Modal';

export function EraPanel({ engine, onClose, openEntry }: { engine: GameEngine; onClose: () => void; openEntry: (id: string) => void }) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const s = engine.state;
  const era = ERAS[s.era];
  const ne = nextEra(s.era);
  const reqs = eraRequirements(s);
  const label = (kind: string, id: string) =>
    kind === 'tech' || kind === 'civic' ? L(RESEARCH_MAP[id]?.name) : kind === 'landmark' ? L(BUILDING_MAP[id]?.name) : t('era.req.population');
  return (
    <Modal title={`🏛️ ${t('panel.era')}`} onClose={onClose} testId="modal-era">
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wide opacity-70">{t('era.current')}</div>
        <div className="font-display text-xl font-bold text-songket-300">
          Era {s.era}: {L(era.name)}
        </div>
        <div className="text-sm opacity-80">{L(era.span)}</div>
        <p className="mt-1 text-sm">{L(era.intro)}</p>
        <button className="mt-1 text-sm text-songket-300 underline" onClick={() => openEntry(era.entry)}>
          📖 {t('info.readMore')}
        </button>
      </div>
      <div className="rounded-lg border border-songket-500/30 bg-black/20 p-3">
        <div className="mb-2 font-semibold">{ne ? t('era.requirements') : t('era.final')}</div>
        <ul className="space-y-1 text-sm" data-testid="era-reqs">
          {reqs.map((r) => (
            <li key={r.kind + r.id} className="flex items-center gap-2">
              <span className={r.met ? 'text-emerald-300' : 'text-red-300'}>{r.met ? '✔' : '✘'}</span>
              <span className="chip">{t(`era.req.${r.kind}`)}</span>
              <span>{label(r.kind, r.id)}</span>
              {r.kind === 'population' && (
                <span className="opacity-75">
                  {formatNumber(r.current ?? 0)} / {formatNumber(r.target ?? 0)}
                </span>
              )}
            </li>
          ))}
        </ul>
        {ne && (
          <>
            <div className="mt-3 text-xs opacity-70">
              {t('era.next')}: <b>{L(ERAS[ne].name)}</b> ({ERAS[ne].startYear})
            </div>
            <button className="btn-gold mt-2 w-full py-2 text-base" disabled={!canAdvanceEra(s)} onClick={() => engine.advanceEra().ok && onClose()} data-testid="advance-era">
              ⏩ {t('era.advance')}
            </button>
          </>
        )}
        {!ne && s.victory && <div className="mt-3 text-center font-bold text-emerald-300">🏆 {t('era.victory')}</div>}
      </div>
    </Modal>
  );
}
