import { ERAS } from './data/eras';
import { POLICY_MAP } from './data/research';
import { CommandResult, GameState, Good, TransportKey, ZONE, ZoneKey } from './types';
import {
  SimContext,
  canResearch,
  createContext,
  createGame,
  isPolicyUnlocked,
  refreshModifiers,
} from './sim/context';
import { computeCoverage, computeHappinessTarget, computeLandValue, computePollution } from './sim/environment';
import { runEconomy } from './sim/economy';
import { computeDemand, growZones, zoneTotals } from './sim/zoning';
import { buildNetwork, computeAccess, deliveryCost } from './sim/transport';
import { advanceEra, checkVictory, progressTrack, trackFor } from './sim/research';
import { tickEvents } from './sim/events';
import {
  acceptOffer,
  cancelDeal,
  declineOffer,
  proposeDeal,
  sendEnvoy,
  tickDiplomacy,
  toggleExchange,
} from './sim/diplomacy';
import { bulldoze, buildTransport, checkBuilding, linePath, placeBuilding, rectTiles, zoneArea } from './sim/placement';
import { resolveCrisis } from './sim/crises';
import { dismissAdvisor, recruitAdvisor, retireAdvisors } from './sim/advisors';
import { checkMilestones } from './sim/milestones';
import { outputValue } from './sim/economy';

export const MAX_DEBT = [0, 8000, 20000, 80000, 250000];

/**
 * GameEngine owns the mutable GameState plus non-serialised caches. The UI
 * calls commands and `tick()`; subscribers are notified after every change.
 */
export class GameEngine {
  state: GameState;
  ctx: SimContext;
  version = 0;
  private listeners = new Set<() => void>();

  constructor(state: GameState) {
    this.state = state;
    this.ctx = createContext(state);
    this.refreshNetwork();
    this.updateDerivedOnly();
  }

  static newGame(seed: number, name?: string, size?: number): GameEngine {
    return new GameEngine(createGame(seed, name, size));
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  refreshNetwork(): void {
    const net = buildNetwork(this.state);
    this.ctx.net = net;
    this.ctx.cost = deliveryCost(this.state, net);
    const acc = computeAccess(this.state, net);
    this.state.map.access.set(acc);
    const m = this.state.map;
    for (let i = 0; i < m.logistics.length; i++) {
      const c = this.ctx.cost[i];
      m.logistics[i] = isFinite(c) ? Math.round(Math.max(0.25, Math.min(1, 1 - (c / (this.state.era === 1 ? 70 : this.state.era === 2 ? 90 : 110)) * 0.75)) * 255) : 0;
    }
    this.ctx.networkDirty = false;
  }

  /** Recompute layers and stats without advancing time (used after load). */
  updateDerivedOnly(): void {
    const s = this.state;
    computeCoverage(s);
    computePollution(s, this.ctx);
    s.derived.avgLandValue = computeLandValue(s, this.ctx);
    const z = zoneTotals(s);
    s.derived.population = z.population;
    s.derived.zoneCounts = z.counts;
  }

  /** Advance the simulation by one tick. */
  tick(): void {
    const s = this.state;
    const ctx = this.ctx;
    ctx.rng.state = s.rngState;
    if (ctx.networkDirty) this.refreshNetwork();

    tickEvents(s, ctx);
    computeCoverage(s);
    computePollution(s, ctx);
    const avgLv = computeLandValue(s, ctx);

    const z = zoneTotals(s);
    const econ = runEconomy(s, ctx, z);
    const knowledge = tickDiplomacy(s, ctx);

    const happyTarget = computeHappinessTarget(s, ctx, {
      foodSatisfaction: econ.foodSatisfaction,
      unemployment: econ.unemployment,
      powerRatio: econ.powerRatio,
      waterRatio: econ.waterRatio,
      buildingHappiness: econ.buildingHappiness,
    });
    const prevH = s.derived.happiness;
    const happiness = prevH + (happyTarget - prevH) * 0.15;
    const demand = computeDemand(s, ctx, {
      population: econ.population,
      workers: econ.workers,
      jobs: econ.jobs,
      cJobs: z.cJobs,
      iJobs: z.iJobs,
      happiness,
      foodSatisfaction: econ.foodSatisfaction,
      unemployment: econ.unemployment,
      exportCapacity: econ.exportCapacity,
    });

    const d = s.derived;
    d.population = econ.population;
    d.workers = econ.workers;
    d.jobs = econ.jobs;
    d.employed = econ.employed;
    d.unemployment = econ.unemployment;
    d.happiness = happiness;
    d.demand = demand;
    d.production = econ.production;
    d.consumption = econ.consumption;
    d.exported = econ.exported;
    d.imported = econ.imported;
    d.budget = econ.budget;
    d.netIncome = econ.netIncome;
    d.researchPerTick = econ.researchPerTick + knowledge;
    d.culturePerTick = econ.culturePerTick;
    d.exportCapacity = econ.exportCapacity;
    d.power = econ.power;
    d.water = econ.water;
    d.foodSatisfaction = econ.foodSatisfaction;
    d.storage = econ.storage;
    d.avgLandValue = avgLv;
    d.zoneCounts = z.counts;

    progressTrack(s, ctx, s.research, d.researchPerTick);
    progressTrack(s, ctx, s.civics, d.culturePerTick);

    growZones(s, ctx, { powerRatio: econ.powerRatio, waterRatio: econ.waterRatio });

    // calendar
    s.tick += 1;
    s.month += ERAS[s.era].monthsPerTick;
    while (s.month >= 12) {
      s.month -= 12;
      s.year += 1;
    }
    const end = ERAS[s.era].endYear;
    if (s.year > end) {
      s.year = end;
      s.month = 11;
    }
    if (s.tick % 6 === 0) {
      s.history.push({
        tick: s.tick,
        year: s.year,
        population: d.population,
        money: Math.round(s.money),
        happiness: Math.round(d.happiness),
        output: Math.round(outputValue(s, d.production)),
        era: s.era,
      });
      if (s.history.length > 400) s.history.splice(0, s.history.length - 400);
    }
    checkVictory(s);
    checkMilestones(s);
    s.rngState = ctx.rng.state;
    this.emit();
  }

  // ---------------- commands ----------------
  private done(r: CommandResult): CommandResult {
    if (r.ok) {
      if (this.ctx.networkDirty) this.refreshNetwork();
      this.updateDerivedOnly();
      this.emit();
    }
    return r;
  }

  checkBuilding(defId: string, x: number, y: number) {
    return checkBuilding(this.state, this.ctx, defId, x, y);
  }
  placeBuilding(defId: string, x: number, y: number) {
    return this.done(placeBuilding(this.state, this.ctx, defId, x, y));
  }
  zone(zone: ZoneKey | 'none', x0: number, y0: number, x1: number, y1: number, onlyEmpty = false) {
    const tiles = rectTiles(x0, y0, x1, y1);
    if (zone === 'none') return this.done(bulldoze(this.state, this.ctx, tiles.filter(([x, y]) => this.state.map.zone[y * this.state.map.width + x] && this.state.map.building[y * this.state.map.width + x] === -1)));
    return this.done(zoneArea(this.state, this.ctx, ZONE[zone], tiles, onlyEmpty));
  }
  buildTransport(key: TransportKey, x0: number, y0: number, x1: number, y1: number) {
    return this.done(buildTransport(this.state, this.ctx, key, linePath(x0, y0, x1, y1)));
  }
  bulldoze(x0: number, y0: number, x1: number, y1: number) {
    return this.done(bulldoze(this.state, this.ctx, rectTiles(x0, y0, x1, y1)));
  }
  setTax(zone: ZoneKey, value: number): CommandResult {
    this.state.tax[zone] = Math.max(0, Math.min(20, Math.round(value)));
    this.emit();
    return { ok: true };
  }
  setResearch(id: string): CommandResult {
    const track = trackFor(this.state, id);
    if (!track || !canResearch(this.state, id)) return { ok: false, reason: 'err.locked' };
    track.current = id;
    this.emit();
    return { ok: true };
  }
  adoptPolicy(id: string): CommandResult {
    const s = this.state;
    if (!POLICY_MAP[id] || !isPolicyUnlocked(s, id)) return { ok: false, reason: 'err.locked' };
    if (s.policies.includes(id)) return { ok: false, reason: 'err.invalid' };
    if (s.policies.length >= ERAS[s.era].policySlots) return { ok: false, reason: 'err.noSlot' };
    s.policies.push(id);
    refreshModifiers(s, this.ctx);
    this.emit();
    return { ok: true };
  }
  revokePolicy(id: string): CommandResult {
    const s = this.state;
    if (!s.policies.includes(id)) return { ok: false, reason: 'err.invalid' };
    s.policies = s.policies.filter((p) => p !== id);
    refreshModifiers(s, this.ctx);
    this.emit();
    return { ok: true };
  }
  advanceEra(): CommandResult {
    const ok = advanceEra(this.state, this.ctx);
    if (ok) {
      retireAdvisors(this.state, this.ctx);
      this.refreshNetwork();
      this.updateDerivedOnly();
      this.emit();
    }
    return ok ? { ok } : { ok, reason: 'err.requirements' };
  }
  takeLoan(amount: number): CommandResult {
    const s = this.state;
    if (amount <= 0) return { ok: false, reason: 'err.invalid' };
    if (s.debt + amount > MAX_DEBT[s.era]) return { ok: false, reason: 'err.debtLimit' };
    s.debt += amount;
    s.money += amount;
    this.emit();
    return { ok: true };
  }
  repayLoan(amount: number): CommandResult {
    const s = this.state;
    const a = Math.min(amount, s.debt, s.money);
    if (a <= 0) return { ok: false, reason: 'err.money' };
    s.debt -= a;
    s.money -= a;
    this.emit();
    return { ok: true };
  }
  recruitAdvisor(id: string) {
    const r = recruitAdvisor(this.state, this.ctx, id);
    if (r.ok) this.emit();
    return r;
  }
  dismissAdvisor(id: string) {
    const r = dismissAdvisor(this.state, this.ctx, id);
    if (r.ok) this.emit();
    return r;
  }
  /** Choose a response to the pending historical crisis. */
  resolveCrisis(choice: number) {
    const r = resolveCrisis(this.state, this.ctx, choice);
    if (r.ok) {
      this.updateDerivedOnly();
      this.emit();
    }
    return r;
  }
  sendEnvoy(partner: string) {
    const r = sendEnvoy(this.state, this.ctx, partner);
    if (r.ok) this.emit();
    return r;
  }
  proposeDeal(partner: string, good: Good, qty: number, duration: number) {
    const r = proposeDeal(this.state, this.ctx, partner, good, qty, duration);
    if (r.ok) this.emit();
    return r;
  }
  cancelDeal(id: number) {
    const r = cancelDeal(this.state, id);
    if (r.ok) this.emit();
    return r;
  }
  toggleExchange(partner: string) {
    const r = toggleExchange(this.state, partner);
    if (r.ok) this.emit();
    return r;
  }
  acceptOffer(id: number) {
    const r = acceptOffer(this.state, this.ctx, id);
    if (r.ok) this.emit();
    return r;
  }
  declineOffer(id: number) {
    const r = declineOffer(this.state, id);
    if (r.ok) this.emit();
    return r;
  }
}
