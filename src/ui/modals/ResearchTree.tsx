import { GameEngine } from '../../core/engine';
import { BUILDING_MAP, TRANSPORT_BY_KEY } from '../../core/data/buildings';
import { ERAS } from '../../core/data/eras';
import { CIVICS, POLICIES, RESEARCH_MAP, ResearchDef, TECHS } from '../../core/data/research';
import { canResearch, isPolicyUnlocked } from '../../core/sim/context';
import { ERA_IDS } from '../../core/types';
import { formatNumber, useI18n } from '../../i18n/i18n';
import { useEngineVersion } from '../hooks';
import { Modal } from './Modal';

interface Props {
  engine: GameEngine;
  kind: 'tech' | 'civic';
  onClose: () => void;
  openEntry: (id: string) => void;
  onResult: (r: { ok: boolean; reason?: string }) => void;
}

function Node({ r, engine, openEntry, onResult }: { r: ResearchDef; engine: GameEngine; openEntry: (id: string) => void; onResult: Props['onResult'] }) {
  const { t, L } = useI18n();
  const s = engine.state;
  const track = r.kind === 'tech' ? s.research : s.civics;
  const done = track.done.includes(r.id);
  const current = track.current === r.id;
  const avail = canResearch(s, r.id);
  const prog = track.progress[r.id] ?? 0;
  const style = done
    ? 'border-emerald-400/60 bg-emerald-900/40'
    : current
      ? 'border-songket-300 bg-songket-900/60 ring-1 ring-songket-300'
      : avail
        ? 'border-sky-400/50 bg-selat-700/40 hover:bg-selat-500/50 cursor-pointer'
        : 'border-white/10 bg-black/20 opacity-55';
  const unlocks = [
    ...(r.unlocks.buildings ?? []).map((b) => L(BUILDING_MAP[b]?.name)),
    ...(r.unlocks.transport ?? []).map((k) => L(TRANSPORT_BY_KEY[k].name)),
    ...(r.unlocks.policies ?? []).map((p) => L(POLICIES.find((x) => x.id === p)?.name)),
  ];
  return (
    <div
      className={`rounded-lg border p-2 text-xs transition ${style}`}
      onClick={() => avail && !current && onResult(engine.setResearch(r.id))}
      role={avail ? 'button' : undefined}
      data-testid={`research-${r.id}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="font-semibold text-songket-100">{L(r.name)}</div>
        <span className="chip shrink-0">{r.date}</span>
      </div>
      <div className="mt-0.5 opacity-80">{L(r.desc)}</div>
      {r.prereqs.length > 0 && (
        <div className="mt-0.5 opacity-70">
          {t('tech.prereqs')}: {r.prereqs.map((p) => L(RESEARCH_MAP[p].name)).join(', ')}
        </div>
      )}
      {unlocks.length > 0 && (
        <div className="mt-0.5 text-sky-200">
          {t('tech.unlocks')}: {unlocks.join(', ')}
        </div>
      )}
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded bg-black/40">
          <div className={`h-1.5 rounded ${done ? 'bg-emerald-400' : 'bg-songket-300'}`} style={{ width: `${done ? 100 : Math.min(100, (prog / r.cost) * 100)}%` }} />
        </div>
        <span className="opacity-80">{done ? '✓' : `${formatNumber(prog)}/${formatNumber(r.cost)}`}</span>
        {r.entry && (
          <button
            className="text-songket-300"
            title={t('info.readMore')}
            onClick={(e) => {
              e.stopPropagation();
              openEntry(r.entry!);
            }}
          >
            📖
          </button>
        )}
      </div>
    </div>
  );
}

export function ResearchTree({ engine, kind, onClose, openEntry, onResult }: Props) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const s = engine.state;
  const list = kind === 'tech' ? TECHS : CIVICS;
  const track = kind === 'tech' ? s.research : s.civics;
  const rate = kind === 'tech' ? s.derived.researchPerTick : s.derived.culturePerTick;
  const cur = track.current ? RESEARCH_MAP[track.current] : null;
  const eta = cur && rate > 0 ? Math.ceil((cur.cost - (track.progress[cur.id] ?? 0) - track.bank) / rate) : null;
  const slots = ERAS[s.era].policySlots;
  return (
    <Modal title={kind === 'tech' ? `⚙️ ${t('panel.tech')}` : `📜 ${t('panel.civics')}`} onClose={onClose} wide testId={`modal-${kind}`}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="chip">
          {kind === 'tech' ? '📚' : '🎭'} {formatNumber(rate, 1)} {t('tech.perTick')}
        </span>
        <span>
          {t('tech.researching')}: <b className="text-songket-300">{cur ? L(cur.name) : t('tech.none')}</b>
          {eta != null && eta > 0 && <span className="opacity-70"> (~{eta})</span>}
        </span>
        {track.bank > 0 && (
          <span className="chip">
            {t('tech.bank')}: {formatNumber(track.bank)}
          </span>
        )}
      </div>
      {kind === 'civic' && (
        <div className="mb-4 rounded-lg border border-songket-500/30 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display font-bold text-songket-300">{t('civic.policies')}</span>
            <span className="chip">
              {t('civic.slots')}: {s.policies.length}/{slots}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {POLICIES.filter((p) => isPolicyUnlocked(s, p.id)).map((p) => {
              const on = s.policies.includes(p.id);
              return (
                <div key={p.id} className={`rounded border p-2 text-xs ${on ? 'border-songket-300 bg-songket-900/50' : 'border-white/10'}`}>
                  <div className="font-semibold">{L(p.name)}</div>
                  <div className="opacity-80">{L(p.desc)}</div>
                  <button className={`btn mt-1 ${on ? '' : 'btn-gold'}`} onClick={() => onResult(on ? engine.revokePolicy(p.id) : engine.adoptPolicy(p.id))} data-testid={`policy-${p.id}`}>
                    {on ? t('civic.revoke') : t('civic.adopt')}
                  </button>
                </div>
              );
            })}
            {POLICIES.every((p) => !isPolicyUnlocked(s, p.id)) && <div className="text-xs opacity-70">{t('civic.noPolicies')}</div>}
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ERA_IDS.map((e) => (
          <div key={e} className={`rounded-lg p-2 ${e === s.era ? 'bg-selat-700/30 ring-1 ring-songket-500/50' : 'bg-black/15'}`}>
            <div className="mb-2 text-center font-display text-sm font-bold text-songket-300">
              Era {e}: {L(ERAS[e].short)}
              {e > s.era && ' 🔒'}
            </div>
            <div className="flex flex-col gap-2">
              {list
                .filter((r) => r.era === e)
                .map((r) => (
                  <Node key={r.id} r={r} engine={engine} openEntry={openEntry} onResult={onResult} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
