import { GameEngine } from '../../core/engine';
import { ADVISORS } from '../../core/data/advisors';
import { ERAS } from '../../core/data/eras';
import { advisorSlots, canRecruit } from '../../core/sim/advisors';
import { CommandResult } from '../../core/types';
import { formatMoney, useI18n } from '../../i18n/i18n';
import { useEngineVersion } from '../hooks';
import { Modal } from './Modal';

export function Advisors({ engine, onClose, onResult }: { engine: GameEngine; onClose: () => void; onResult: (r: CommandResult) => void }) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const s = engine.state;
  const serving = s.advisors ?? [];
  const sym = ERAS[s.era].currencySymbol;
  const list = [...ADVISORS].sort((a, b) => Number(!a.eras.includes(s.era)) - Number(!b.eras.includes(s.era)) || a.eras[0] - b.eras[0]);
  return (
    <Modal title={`🎓 ${t('panel.advisors')}`} onClose={onClose} wide testId="modal-advisors">
      <p className="mb-2 text-sm opacity-85">{t('advisors.intro')}</p>
      <div className="mb-3 text-sm font-semibold text-songket-300" data-testid="advisor-slots">
        {t('advisors.slots', { used: serving.length, max: advisorSlots(s) })}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((a) => {
          const here = a.eras.includes(s.era);
          const on = serving.includes(a.id);
          const chk = canRecruit(s, a.id);
          return (
            <div key={a.id} className={`rounded-lg p-3 ${on ? 'bg-emerald-900/40 ring-1 ring-emerald-400/50' : here ? 'bg-black/25' : 'bg-black/10 opacity-60'}`} data-testid={`advisor-${a.id}`}>
              <div className="flex items-start gap-2">
                <div className="text-3xl leading-none">{a.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-songket-100">
                    {a.name} <span className="text-xs font-normal opacity-70">({a.life})</span>
                  </div>
                  <div className="text-xs opacity-80">{L(a.title)}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-300">★ {L(a.bonus)}</div>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed opacity-85">{L(a.bio)}</p>
              <div className="mt-1 text-[10px] opacity-60">
                {t('advisors.sources')}:{' '}
                {a.sources.map((u, k) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="underline">
                    [{k + 1}]
                  </a>
                ))}{' '}
                · Era {a.eras.join(', ')}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="chip">
                  {t('advisors.cost')} {sym}
                  {formatMoney(a.cost)}
                </span>
                <span className="chip">
                  {t('advisors.upkeep')} {a.upkeep}
                </span>
                <span className="ml-auto" />
                {on ? (
                  <>
                    <span className="font-semibold text-emerald-300">{t('advisors.serving')}</span>
                    <button className="btn px-2 text-xs" onClick={() => onResult(engine.dismissAdvisor(a.id))} data-testid={`dismiss-${a.id}`}>
                      {t('advisors.dismiss')}
                    </button>
                  </>
                ) : here ? (
                  <button className="btn-gold px-2 text-xs" disabled={!chk.ok} title={chk.reason ? t(chk.reason) : undefined} onClick={() => onResult(engine.recruitAdvisor(a.id))} data-testid={`recruit-${a.id}`}>
                    {t('advisors.recruit')}
                  </button>
                ) : (
                  <span className="opacity-70">{t('advisors.otherEra')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
