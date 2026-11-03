import { useState } from 'react';
import { GameEngine } from '../../core/engine';
import { ERAS } from '../../core/data/eras';
import { GOOD_DEFS, isTradable } from '../../core/data/goods';
import { PARTNER_MAP } from '../../core/data/partners';
import { activePartners } from '../../core/sim/context';
import { ENVOY_COST, EXCHANGE_MIN_RELATION, dealPrice } from '../../core/sim/diplomacy';
import { Good } from '../../core/types';
import { formatMoney, formatNumber, useI18n } from '../../i18n/i18n';
import { useEngineVersion } from '../hooks';
import { Modal } from './Modal';

interface Props {
  engine: GameEngine;
  onClose: () => void;
  openEntry: (id: string) => void;
  onResult: (r: { ok: boolean; reason?: string }) => void;
}

function RelationBar({ value }: { value: number }) {
  const pct = (value + 100) / 2;
  const color = value >= 30 ? 'bg-emerald-400' : value >= 0 ? 'bg-amber-300' : 'bg-red-400';
  return (
    <div className="h-2 w-full rounded bg-black/40" title={`${Math.round(value)}`}>
      <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Diplomacy({ engine, onClose, openEntry, onResult }: Props) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const s = engine.state;
  const sym = ERAS[s.era].currencySymbol;
  const partners = activePartners(s);
  const [sel, setSel] = useState(partners[0]?.id ?? '');
  const def = PARTNER_MAP[sel];
  const st = s.partners[sel];
  const wanted = def ? (Object.keys(def.buys) as Good[]).filter((g) => isTradable(g, s.era)) : [];
  const [good, setGood] = useState<Good | ''>('');
  const [qty, setQty] = useState(2);
  const [dur, setDur] = useState(24);
  const g = (good && wanted.includes(good) ? good : wanted[0]) as Good | undefined;

  return (
    <Modal title={`🤝 ${t('panel.diplomacy')}`} onClose={onClose} wide testId="modal-diplomacy">
      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <div className="flex flex-col gap-1">
          {partners.map((p) => (
            <button
              key={p.id}
              className={`rounded-lg border p-2 text-left text-sm ${sel === p.id ? 'border-songket-300 bg-songket-900/50' : 'border-white/10 bg-black/20 hover:bg-white/10'}`}
              onClick={() => setSel(p.id)}
              data-testid={`partner-${p.id}`}
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                <span className="font-semibold">{L(p.name)}</span>
              </div>
              <RelationBar value={s.partners[p.id]?.relation ?? 0} />
            </button>
          ))}
        </div>
        {def && st && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-display text-lg font-bold text-songket-300">{L(def.name)}</div>
              <div className="opacity-80">{L(def.desc)}</div>
              {def.entry && (
                <button className="text-songket-300 underline" onClick={() => openEntry(def.entry!)}>
                  📖 {t('info.readMore')}
                </button>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className="w-24 opacity-75">{t('dip.relation')}</span>
                <RelationBar value={st.relation} />
                <span className="w-10 text-right">{Math.round(st.relation)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="opacity-75">{t('dip.buys')}:</span>
                {wanted.map((w) => (
                  <span key={w} className="chip">
                    {GOOD_DEFS[w].icon} {L(GOOD_DEFS[w].name)} ×{def.buys[w]}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={st.envoyCooldown > 0 || s.money < ENVOY_COST[s.era]} onClick={() => onResult(engine.sendEnvoy(sel))} data-testid="send-envoy">
                🕊️ {st.envoyCooldown > 0 ? `${t('dip.cooldown')} (${st.envoyCooldown})` : `${t('dip.envoy')} (${sym}${formatMoney(ENVOY_COST[s.era])})`}
              </button>
              <button className={`btn ${st.exchange ? 'btn-active' : ''}`} disabled={!st.exchange && st.relation < EXCHANGE_MIN_RELATION} onClick={() => onResult(engine.toggleExchange(sel))}>
                📚 {t('dip.exchange')}: {st.exchange ? t('dip.exchangeOn') : t('dip.exchangeOff')}
              </button>
            </div>
            {g && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="mb-1 font-semibold">{t('dip.deal')}</div>
                <div className="flex flex-wrap items-end gap-2">
                  <select className="rounded bg-black/40 px-1 py-1" value={g} onChange={(e) => setGood(e.target.value as Good)} data-testid="deal-good">
                    {wanted.map((w) => (
                      <option key={w} value={w}>
                        {GOOD_DEFS[w].icon} {L(GOOD_DEFS[w].name)}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs">
                    {t('dip.qty')}
                    <input type="number" min={1} max={500} className="ml-1 w-16 rounded bg-black/40 px-1" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
                  </label>
                  <label className="text-xs">
                    {t('dip.duration')}
                    <input type="number" min={6} max={120} className="ml-1 w-16 rounded bg-black/40 px-1" value={dur} onChange={(e) => setDur(Math.max(6, Number(e.target.value)))} />
                  </label>
                  <span className="text-xs opacity-80">
                    {t('dip.price')}: {sym}
                    {formatNumber(dealPrice(s, engine.ctx, sel, g), 1)}
                  </span>
                  <button className="btn-gold" onClick={() => onResult(engine.proposeDeal(sel, g, qty, dur))} data-testid="propose-deal">
                    {t('dip.deal')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 font-semibold text-songket-300">{t('dip.offers')}</div>
          {s.offers.length === 0 && <div className="text-xs opacity-70">{t('dip.noOffers')}</div>}
          {s.offers.map((o) => (
            <div key={o.id} className="mb-1 flex items-center gap-2 rounded border border-white/10 bg-black/20 p-1.5 text-xs">
              <span className="flex-1">
                <b>{L(PARTNER_MAP[o.partner]?.name)}</b>:{' '}
                {o.kind === 'deal' && o.good
                  ? `${GOOD_DEFS[o.good].icon} ${o.qty}/${t('top.perTick')} × ${o.duration} @ ${sym}${formatNumber(o.price ?? 0, 1)}`
                  : `${t('dip.investment')} ${sym}${formatMoney(o.money ?? 0)}`}
              </span>
              <button className="btn-gold px-2" onClick={() => onResult(engine.acceptOffer(o.id))}>
                {t('dip.accept')}
              </button>
              <button className="btn px-2" onClick={() => onResult(engine.declineOffer(o.id))}>
                {t('dip.decline')}
              </button>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 font-semibold text-songket-300">{t('dip.deals')}</div>
          {s.deals.length === 0 && <div className="text-xs opacity-70">{t('dip.noDeals')}</div>}
          {s.deals.map((d) => (
            <div key={d.id} className="mb-1 flex items-center gap-2 rounded border border-white/10 bg-black/20 p-1.5 text-xs" data-testid="deal-row">
              <span className="flex-1">
                <b>{L(PARTNER_MAP[d.partner]?.name)}</b>: {GOOD_DEFS[d.good].icon} {d.qty} @ {sym}
                {formatNumber(d.price, 1)} · {d.remaining} {t('dip.remaining')}
                {d.missed > 0 && <span className="text-red-300"> · ✘{d.missed}</span>}
              </span>
              <button className="btn px-2" onClick={() => onResult(engine.cancelDeal(d.id))}>
                {t('dip.cancel')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
