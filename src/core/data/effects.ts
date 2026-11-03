import { Good } from '../types';

/** Additive modifiers granted by techs, civics, policies and events. */
export interface Effects {
  /** per good, additive (+0.25 = +25 %) */
  production?: Partial<Record<Good, number>>;
  /** applies to every good */
  productionAll?: number;
  exportCap?: number;
  exportPrice?: number;
  tax?: number;
  research?: number;
  culture?: number;
  happiness?: number;
  pollution?: number;
  growth?: number;
  upkeep?: number;
  construction?: number;
  relationGain?: number;
}

export interface EffectTotals {
  production: Record<string, number>;
  productionAll: number;
  exportCap: number;
  exportPrice: number;
  tax: number;
  research: number;
  culture: number;
  happiness: number;
  pollution: number;
  growth: number;
  upkeep: number;
  construction: number;
  relationGain: number;
}

export const emptyTotals = (): EffectTotals => ({
  production: {},
  productionAll: 0,
  exportCap: 0,
  exportPrice: 0,
  tax: 0,
  research: 0,
  culture: 0,
  happiness: 0,
  pollution: 0,
  growth: 0,
  upkeep: 0,
  construction: 0,
  relationGain: 0,
});

export function addEffects(t: EffectTotals, e: Effects | undefined): void {
  if (!e) return;
  if (e.production) for (const [g, v] of Object.entries(e.production)) t.production[g] = (t.production[g] ?? 0) + (v ?? 0);
  t.productionAll += e.productionAll ?? 0;
  t.exportCap += e.exportCap ?? 0;
  t.exportPrice += e.exportPrice ?? 0;
  t.tax += e.tax ?? 0;
  t.research += e.research ?? 0;
  t.culture += e.culture ?? 0;
  t.happiness += e.happiness ?? 0;
  t.pollution += e.pollution ?? 0;
  t.growth += e.growth ?? 0;
  t.upkeep += e.upkeep ?? 0;
  t.construction += e.construction ?? 0;
  t.relationGain += e.relationGain ?? 0;
}
