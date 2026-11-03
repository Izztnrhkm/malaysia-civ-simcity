import { GameEngine, MAX_DEBT } from '../../core/engine';
import { ERAS } from '../../core/data/eras';
import { GOOD_DEFS, basePrice, isTradable } from '../../core/data/goods';
import { GOODS, ZoneKey } from '../../core/types';
import { formatMoney, formatNumber, useI18n } from '../../i18n/i18n';
import { useEngineVersion } from '../hooks';
import { Modal } from './Modal';

function Chart({ points, color, label }: { points: number[]; color: string; label: string }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((v, i) => `${(i / (points.length - 1)) * 100},${30 - ((v - min) / span) * 28}`).join(' ');
  return (
    <div>
      <div className="text-xs opacity-75">
        {label}: <b>{formatMoney(points[points.length - 1])}</b>
      </div>
      <svg viewBox="0 0 100 32" className="h-14 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
        <polyline points={d} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function Economy({ engine, onClose, onResult }: { engine: GameEngine; onClose: () => void; onResult: (r: { ok: boolean; reason?: string }) => void }) {
  useEngineVersion(engine);
  const { t, L } = useI18n();
  const s = engine.state;
  const d = s.derived;
  const b = d.budget;
  const sym = ERAS[s.era].currencySymbol;
  const income: Array<[string, number]> = [
    ['eco.taxR', b.taxR],
    ['eco.taxC', b.taxC],
    ['eco.taxI', b.taxI],
    ['eco.exports', b.exports],
    ['eco.deals', b.deals],
  ];
  const expenses: Array<[string, number]> = [
    ['eco.upkeepBuildings', b.upkeepBuildings],
    ['eco.upkeepTransport', b.upkeepTransport],
    ['eco.admin', b.admin],
    ['eco.infrastructure', b.infrastructure ?? 0],
    ['eco.advisors', b.advisors ?? 0],
    ['eco.imports', b.imports],
    ['eco.interest', b.interest],
  ];
  const loanStep = Math.round(MAX_DEBT[s.era] / 8);
  return (
    <Modal title={`💰 ${t('panel.economy')}`} onClose={onClose} wide testId="modal-economy">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="rounded-lg bg-black/20 p-3">
            <div className="mb-2 font-semibold text-songket-300">{t('eco.taxes')}</div>
            {(['R', 'C', 'I'] as ZoneKey[]).map((z) => (
              <label key={z} className="mb-1 flex items-center gap-2 text-sm">
                <span className="w-24">{t(`zone.${z}`)}</span>
                <input type="range" min={0} max={20} value={s.tax[z]} onChange={(e) => engine.setTax(z, Number(e.target.value))} className="flex-1 accent-amber-500" data-testid={`tax-${z}`} />
                <span className="w-10 text-right">{s.tax[z]}%</span>
              </label>
            ))}
          </div>
          <div className="rounded-lg bg-black/20 p-3 text-sm">
            <div className="mb-1 font-semibold text-songket-300">{t('eco.loan')}</div>
            <div>
              {t('eco.debt')}: {sym}
              {formatMoney(s.debt)} / {formatMoney(MAX_DEBT[s.era])}
            </div>
            <div className="mt-1 flex gap-2">
              <button className="btn" onClick={() => onResult(engine.takeLoan(loanStep))}>
                {t('eco.borrow')} {formatMoney(loanStep)}
              </button>
              <button className="btn" disabled={s.debt <= 0} onClick={() => onResult(engine.repayLoan(loanStep))}>
                {t('eco.repay')}
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-black/20 p-3 text-sm">
            <div className="mb-1 font-semibold text-songket-300">{t('eco.labour')}</div>
            <div>
              {t('eco.workers')}: {formatNumber(d.workers)} · {t('eco.jobs')}: {formatNumber(d.jobs)}
            </div>
            <div>
              {t('eco.unemployment')}: {formatNumber(d.unemployment * 100, 1)}%
            </div>
            <div>
              {t('eco.food')}: {formatNumber(d.foodSatisfaction * 100)}%
            </div>
            <div>
              {t('eco.exportCap')}: {formatNumber(d.exportCapacity, 1)} · {t('eco.storage')}: {formatNumber(d.storage)}
            </div>
            {s.era >= 3 && (
              <div>
                {t('eco.utilities')}: ⚡ {formatNumber(d.power.supply)}/{formatNumber(d.power.demand)} · 💧 {formatNumber(d.water.supply)}/{formatNumber(d.water.demand)}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-black/20 p-3 text-sm">
          <div className="font-semibold text-emerald-300">{t('eco.income')}</div>
          {income.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{t(k)}</span>
              <span>{formatMoney(v)}</span>
            </div>
          ))}
          <div className="mt-2 font-semibold text-red-300">{t('eco.expenses')}</div>
          {expenses.map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{t(k)}</span>
              <span>-{formatMoney(v)}</span>
            </div>
          ))}
          <div className={`mt-2 flex justify-between border-t border-white/20 pt-1 font-bold ${d.netIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            <span>
              {t('eco.net')} {t('top.perTick')}
            </span>
            <span>{formatMoney(d.netIncome)}</span>
          </div>
          <div className="mt-3 font-semibold text-songket-300">{t('eco.history')}</div>
          <Chart points={s.history.map((h) => h.population)} color="#3fbf5f" label={t('top.population')} />
          <Chart points={s.history.map((h) => h.money)} color="#e9c46a" label={t('top.money')} />
          <Chart points={s.history.map((h) => h.happiness)} color="#5aa6c9" label={t('top.happiness')} />
        </div>
        <div className="rounded-lg bg-black/20 p-3 text-xs">
          <table className="w-full" data-testid="goods-table">
            <thead>
              <tr className="text-left text-songket-300">
                <th>{t('eco.goods')}</th>
                <th className="text-right">{t('eco.stock')}</th>
                <th className="text-right">{t('eco.produced')}</th>
                <th className="text-right">{t('eco.used')}</th>
                <th className="text-right">{t('eco.exported')}</th>
                <th className="text-right">{t('eco.priceCol')}</th>
              </tr>
            </thead>
            <tbody>
              {GOODS.filter((g) => isTradable(g, s.era) || s.stock[g] > 0).map((g) => (
                <tr key={g} className="border-t border-white/10">
                  <td>
                    {GOOD_DEFS[g].icon} {L(GOOD_DEFS[g].name)}
                  </td>
                  <td className="text-right">{formatNumber(s.stock[g])}</td>
                  <td className="text-right">{formatNumber(d.production[g], 1)}</td>
                  <td className="text-right">{formatNumber(d.consumption[g], 1)}</td>
                  <td className="text-right">{formatNumber(d.exported[g], 1)}</td>
                  <td className="text-right">{formatNumber(basePrice(g, s.era) * (engine.ctx.priceMult[g] ?? 1), 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
