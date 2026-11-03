import { GameEngine } from '../../core/engine';
import { CRISIS_MAP, CRISIS_TIMEOUT } from '../../core/data/crises';
import { ERAS } from '../../core/data/eras';
import { CommandResult } from '../../core/types';
import { formatMoney, useI18n } from '../../i18n/i18n';
import { useEngineVersion } from '../hooks';
import { Modal } from './Modal';

/** Decision dialog for a pending historical crisis. Closing it defers the decision. */
export function Crisis({ engine, onClose, onResult, openEntry }: { engine: GameEngine; onClose: () => void; onResult: (r: CommandResult) => void; openEntry: (id: string) => void }) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const s = engine.state;
  const def = s.crisis ? CRISIS_MAP[s.crisis.id] : null;
  if (!def) return null;
  const sym = ERAS[s.era].currencySymbol;
  return (
    <Modal title={`⚠️ ${t('crisis.title')}: ${L(def.name)}`} onClose={onClose} testId="modal-crisis">
      <p className="text-sm leading-relaxed">{L(def.desc)}</p>
      {def.entry && (
        <button className="mt-1 text-xs text-songket-300 underline" onClick={() => openEntry(def.entry!)}>
          📖 Sejarahpedia
        </button>
      )}
      <div className="mt-3 text-sm font-semibold text-songket-300">{t('crisis.choose')}</div>
      <div className="mt-2 grid gap-2">
        {def.choices.map((c, i) => {
          const afford = (c.cost ?? 0) <= s.money;
          return (
            <button
              key={c.id}
              className="rounded-lg border border-songket-500/30 bg-black/25 p-3 text-left transition hover:bg-selat-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!afford}
              onClick={() => onResult(engine.resolveCrisis(i))}
              data-testid={`crisis-choice-${i}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-songket-100">
                  {L(c.name)} {i === def.defaultChoice && <span className="text-xs font-normal opacity-60">({t('crisis.default')})</span>}
                </span>
                <span className="chip shrink-0">{c.cost ? `${t('crisis.cost')} ${sym}${formatMoney(c.cost)}` : t('crisis.free')}</span>
              </div>
              <div className="mt-0.5 text-xs opacity-80">{L(c.desc)}</div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs opacity-60">{t('crisis.timeout', { n: CRISIS_TIMEOUT })}</p>
    </Modal>
  );
}
