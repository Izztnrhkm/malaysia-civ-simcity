import { createContext, useContext } from 'react';
import { BUILDING_MAP } from '../core/data/buildings';
import { ERAS } from '../core/data/eras';
import { EVENT_MAP } from '../core/data/events';
import { PARTNER_MAP } from '../core/data/partners';
import { RESEARCH_MAP } from '../core/data/research';
import { Bilingual, EraId, Lang, Notice } from '../core/types';
import { STRINGS, StringKey } from './strings';

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dict = STRINGS[lang] as Record<string, string>;
  let s = dict[key] ?? (STRINGS.en as Record<string, string>)[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export interface I18n {
  lang: Lang;
  t: (key: StringKey | string, params?: Record<string, string | number>) => string;
  L: (b: Bilingual | undefined) => string;
}

export function makeI18n(lang: Lang): I18n {
  return {
    lang,
    t: (key, params) => translate(lang, key, params),
    L: (b) => (b ? b[lang] : ''),
  };
}

export const I18nContext = createContext<I18n>(makeI18n('ms'));
export const useI18n = () => useContext(I18nContext);

/** Human-readable text (title, body) for an engine notice. */
export function noticeText(lang: Lang, n: Notice): { title: string; body?: string } {
  const L = (b?: Bilingual) => (b ? b[lang] : '');
  if (n.key.startsWith('event.')) {
    const ev = EVENT_MAP[n.key.slice(6)];
    return { title: L(ev?.name), body: L(ev?.desc) };
  }
  const p = n.params ?? {};
  let name = '';
  if (n.key === 'notice.techDone' || n.key === 'notice.civicDone') name = L(RESEARCH_MAP[String(p.id)]?.name);
  if (n.key === 'notice.newEra') name = L(ERAS[Number(p.era) as EraId]?.name);
  if (n.key === 'notice.offer') name = L(PARTNER_MAP[String(p.partner)]?.name);
  if (n.key === 'notice.build') name = L(BUILDING_MAP[String(p.id)]?.name);
  return { title: translate(lang, n.key, { ...p, name }) };
}

export function formatMoney(v: number): string {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}k` : Math.round(a).toLocaleString('en-US');
  return (v < 0 ? '-' : '') + s;
}

export function formatNumber(v: number, digits = 0): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
