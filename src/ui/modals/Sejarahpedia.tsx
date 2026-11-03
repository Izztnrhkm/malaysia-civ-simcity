import { useMemo, useState } from 'react';
import { CATEGORY_NAMES, ENTRIES, ENTRY_MAP, EntryCategory } from '../../content/sejarahpedia';
import { useI18n } from '../../i18n/i18n';
import { Modal } from './Modal';

export function Sejarahpedia({ initial, onClose }: { initial?: string | null; onClose: () => void }) {
  const { t, L, lang } = useI18n();
  const [sel, setSel] = useState(initial && ENTRY_MAP[initial] ? initial : ENTRIES[0].id);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<EntryCategory | 'all'>('all');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ENTRIES.filter((e) => (cat === 'all' || e.category === cat) && (!needle || `${e.title.ms} ${e.title.en} ${e.summary[lang]} ${e.period}`.toLowerCase().includes(needle)));
  }, [q, cat, lang]);
  const e = ENTRY_MAP[sel];
  return (
    <Modal title={`📖 ${t('panel.encyclopedia')}`} onClose={onClose} wide testId="modal-encyclopedia">
      <div className="grid gap-4 md:grid-cols-[17rem_1fr]">
        <div className="flex min-h-0 flex-col gap-2">
          <input className="rounded bg-black/40 px-2 py-1 text-sm" placeholder={t('enc.search')} value={q} onChange={(ev) => setQ(ev.target.value)} data-testid="enc-search" />
          <div className="flex flex-wrap gap-1">
            <button className={`chip ${cat === 'all' ? 'bg-songket-700' : ''}`} onClick={() => setCat('all')}>
              {t('enc.all')}
            </button>
            {(Object.keys(CATEGORY_NAMES) as EntryCategory[]).map((c) => (
              <button key={c} className={`chip ${cat === c ? 'bg-songket-700' : ''}`} onClick={() => setCat(c)}>
                {L(CATEGORY_NAMES[c])}
              </button>
            ))}
          </div>
          <div className="scroll-thin max-h-[55vh] overflow-y-auto pr-1">
            {list.map((x) => (
              <button
                key={x.id}
                className={`mb-1 w-full rounded px-2 py-1 text-left text-sm ${x.id === sel ? 'bg-songket-900/70 text-songket-100' : 'hover:bg-white/10'}`}
                onClick={() => setSel(x.id)}
                data-testid={`enc-item-${x.id}`}
              >
                <div className="font-semibold">{L(x.title)}</div>
                <div className="text-xs opacity-70">{x.period}</div>
              </button>
            ))}
          </div>
        </div>
        {e && (
          <article className="text-sm leading-relaxed" data-testid="enc-article">
            <div className="text-xs uppercase tracking-wide text-songket-300">
              {L(CATEGORY_NAMES[e.category])} · {e.period}
            </div>
            <h3 className="font-display text-2xl font-bold text-songket-100">{L(e.title)}</h3>
            <p className="mt-1 italic opacity-85">{L(e.summary)}</p>
            {e.body[lang].map((p, i) => (
              <p key={i} className="mt-2">
                {p}
              </p>
            ))}
            <div className="mt-3 rounded-lg border border-songket-500/40 bg-songket-900/30 p-2">
              <div className="text-xs font-semibold uppercase text-songket-300">🎮 {t('enc.inGame')}</div>
              <div>{L(e.inGame)}</div>
            </div>
            {e.related.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
                <span className="opacity-75">{t('enc.related')}:</span>
                {e.related
                  .filter((r) => ENTRY_MAP[r])
                  .map((r) => (
                    <button key={r} className="chip hover:bg-songket-700" onClick={() => setSel(r)}>
                      {L(ENTRY_MAP[r].title)}
                    </button>
                  ))}
              </div>
            )}
            <div className="mt-3 text-xs">
              <div className="font-semibold text-songket-300">{t('enc.sources')}</div>
              <ul className="list-disc pl-5">
                {e.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-300 underline">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-2 opacity-60">{t('enc.disclaimer')}</div>
            </div>
          </article>
        )}
      </div>
    </Modal>
  );
}
