// Research & civics, era progression, historical events and crises: ports of
// Research, historical events and crises use the authoritative Unity catalogs.
using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    /// <summary>Progress through the 41 technologies and 25 civics.</summary>
    public sealed class TechTreeState
    {
        /// <summary>Idle research banks at most this many ticks of output.</summary>
        public const int BankCapTicks = 10;

        readonly GameDatabase db;
        public readonly bool[] Done;
        public readonly double[] Progress;
        public int CurrentTech = -1;
        public int CurrentCivic = -1;
        public double TechBank, CivicBank;
        /// <summary>Fired with the research index when an item completes.</summary>
        public event Action<int> Completed;

        public TechTreeState(GameDatabase db)
        {
            this.db = db;
            Done = new bool[db.Research.Length];
            Progress = new double[db.Research.Length];
        }

        public bool IsDone(string id) { int i = db.ResearchIndex(id); return i >= 0 && Done[i]; }

        public bool CanResearch(int index, int era)
        {
            if (index < 0 || index >= Done.Length || Done[index]) return false;
            var r = db.Research[index];
            if (r.era > era) return false;
            foreach (var p in r.prereqs) if (!IsDone(p)) return false;
            return true;
        }

        public bool Select(int index, int era)
        {
            if (!CanResearch(index, era)) return false;
            if (db.Research[index].IsTech) CurrentTech = index; else CurrentCivic = index;
            return true;
        }

        /// <summary>Port of progressTrack for both tracks.</summary>
        public void Advance(double techPoints, double civicPoints)
        {
            Step(ref CurrentTech, ref TechBank, techPoints);
            Step(ref CurrentCivic, ref CivicBank, civicPoints);
        }

        void Step(ref int current, ref double bank, double points)
        {
            if (current < 0)
            {
                bank = Math.Min(bank + points, Math.Max(bank, BankCapTicks * points));
                return;
            }
            int id = current;
            Progress[id] += points + bank;
            bank = 0;
            double cost = db.Research[id].cost;
            if (Progress[id] >= cost)
            {
                bank = Progress[id] - cost;
                Progress[id] = 0;
                Done[id] = true;
                current = -1;
                Completed?.Invoke(id);
            }
        }

        public void Grant(int index)
        {
            if (index < 0 || Done[index]) return;
            Done[index] = true;
            if (CurrentTech == index) CurrentTech = -1;
            if (CurrentCivic == index) CurrentCivic = -1;
            Progress[index] = 0;
            Completed?.Invoke(index);
        }

        /// <summary>Is a building unlocked by research (or available from the start)?</summary>
        public bool IsBuildingUnlocked(BuildingRecord b, int era)
        {
            if (b.era > era) return false;
            if (b.obsoleteAfterEra > 0 && era > b.obsoleteAfterEra) return false;
            if (b.startingBuilding) return true;
            if (string.IsNullOrEmpty(b.unlockedBy)) return false;
            return IsDone(b.unlockedBy);
        }

        public bool IsTransportUnlocked(string key, int era)
        {
            if (key == "road") return true;
            foreach (var t in db.Transports) if (t.key == key && t.era > era) return false;
            for (int i = 0; i < db.Research.Length; i++)
            {
                if (!Done[i]) continue;
                foreach (var k in db.Research[i].unlockTransport) if (k == key) return true;
            }
            return false;
        }

        public void ApplyEffects(EffectTotals fx)
        {
            for (int i = 0; i < Done.Length; i++) if (Done[i]) fx.Add(db.Research[i].effects);
        }
    }

    /// <summary>A requirement for advancing to the next era (shown in the UI).</summary>
    public struct EraRequirement
    {
        public string kind;
        public string id;
        public bool met;
        public double current, target;
    }

    /// <summary>Era state machine: 1 Ancient/Early Kingdoms .. 4 Future Smart Metropolis.</summary>
    public sealed class EraStateMachine
    {
        readonly GameDatabase db;
        public int CurrentEra { get; private set; } = 1;
        /// <summary>Fired with (oldEra, newEra) after the era changes.</summary>
        public event Action<int, int> EraAdvanced;
        readonly List<EraRequirement> reqs = new List<EraRequirement>(8);

        public EraStateMachine(GameDatabase db) { this.db = db; }

        public IReadOnlyList<EraRequirement> Requirements(TechTreeState tech, double population, CityState city)
        {
            reqs.Clear();
            var e = db.Era(CurrentEra);
            foreach (var t in e.advanceTechs) reqs.Add(new EraRequirement { kind = "tech", id = t, met = tech.IsDone(t) });
            foreach (var c in e.advanceCivics) reqs.Add(new EraRequirement { kind = "civic", id = c, met = tech.IsDone(c) });
            reqs.Add(new EraRequirement { kind = "population", id = "population", met = population >= e.advancePopulation, current = population, target = e.advancePopulation });
            int li = db.BuildingIndex(e.advanceLandmark);
            reqs.Add(new EraRequirement { kind = "landmark", id = e.advanceLandmark, met = li >= 0 && city.HasBuilding(li) });
            return reqs;
        }

        public bool CanAdvance(TechTreeState tech, double population, CityState city)
        {
            if (CurrentEra >= 4) return false;
            foreach (var r in Requirements(tech, population, city)) if (!r.met) return false;
            return true;
        }

        /// <summary>Advance one era. <paramref name="force"/> skips the requirements (scenarios, debug, tests).</summary>
        public bool Advance(TechTreeState tech, double population, CityState city, bool force = false)
        {
            if (CurrentEra >= 4) return false;
            if (!force && !CanAdvance(tech, population, city)) return false;
            int old = CurrentEra;
            CurrentEra++;
            EraAdvanced?.Invoke(old, CurrentEra);
            return true;
        }

        /// <summary>Restore from a save (no events).</summary>
        public void Restore(int era) { CurrentEra = Math.Max(1, Math.Min(4, era)); }
    }

    /// <summary>Historical events and interactive crises with policy choices.</summary>
    public sealed class GameEventSystem
    {
        public const int CrisisTimeout = 8;
        readonly GameDatabase db;
        public readonly List<ActiveEffect> Effects = new List<ActiveEffect>(16);
        public readonly ActiveEffectsView View = new ActiveEffectsView();
        public readonly HashSet<string> Fired = new HashSet<string>();
        public string PendingCrisis;
        public int PendingSince;
        public readonly List<(string crisis, string choice, int tick)> CrisisLog = new List<(string, string, int)>();
        public event Action<EventRecord> EventFired;
        public event Action<CrisisRecord> CrisisStarted;
        public event Action<CrisisRecord, CrisisChoiceRecord, bool> CrisisResolved;

        public GameEventSystem(GameDatabase db) { this.db = db; }

        static bool Contains(int[] a, int v) { foreach (var x in a) if (x == v) return true; return false; }

        /// <summary>Apply an event-style effect; duration effects are keyed by id.</summary>
        public void ApplyEffect(string id, EventEffectRecord e, ResourceLedger stock, TechTreeState tech, Dictionary<string, double> relations)
        {
            if (e == null) return;
            if (e.duration > 0)
            {
                Effects.RemoveAll(x => x.id == id);
                var a = new ActiveEffect { id = id, ticksLeft = e.duration, productionMult = e.productionMult, exportCapMult = e.exportCapMult, happiness = e.happiness, research = e.research, flood = e.flood };
                foreach (var p in e.priceMult) a.priceMult[(int)ResourceInfo.FromGood(p.key)] *= p.value;
                Effects.Add(a);
            }
            else if (e.happiness != 0) Effects.Add(new ActiveEffect { id = id, ticksLeft = 6, happiness = e.happiness });
            if (e.money != 0) stock.Add(ResourceType.Treasury, e.money);
            if (e.researchOnce != 0) tech.TechBank += e.researchOnce;
            if (relations != null) foreach (var r in e.relations) relations[r.key] = Math.Max(-100, Math.Min(100, (relations.TryGetValue(r.key, out double v) ? v : 0) + r.value));
            if (!string.IsNullOrEmpty(e.grantCivic)) tech.Grant(db.ResearchIndex(e.grantCivic));
            View.Refresh(Effects);
        }

        public void Fire(EventRecord ev, ResourceLedger stock, TechTreeState tech, Dictionary<string, double> relations, int tick)
        {
            if (ev.kind == "historical")
            {
                if (Fired.Contains(ev.id)) return;
                Fired.Add(ev.id);
            }
            ApplyEffect(ev.id, ev.effect, stock, tech, relations);
            EventFired?.Invoke(ev);
            foreach (var c in db.Crises)
                if (c.triggerEvent == ev.id && Contains(c.eras, CurrentEraHint) && !Started(c.id)) StartCrisis(c, stock, tech, relations, tick);
        }

        int CurrentEraHint = 1;

        bool Started(string id)
        {
            if (PendingCrisis == id) return true;
            foreach (var l in CrisisLog) if (l.crisis == id) return true;
            return false;
        }

        void StartCrisis(CrisisRecord c, ResourceLedger stock, TechTreeState tech, Dictionary<string, double> relations, int tick)
        {
            if (PendingCrisis != null) return;
            PendingCrisis = c.id;
            PendingSince = tick;
            if (c.hasBase) ApplyEffect("crisis_" + c.id, c.baseEffect, stock, tech, relations);
            CrisisStarted?.Invoke(c);
        }

        /// <summary>Port of tickEvents + tickCrises.</summary>
        public void Tick(int era, int year, int month, int tick, Rng rng, CityState city, ResourceLedger stock, TechTreeState tech, Dictionary<string, double> relations)
        {
            CurrentEraHint = era;
            bool changed = false;
            for (int k = Effects.Count - 1; k >= 0; k--)
            {
                if (--Effects[k].ticksLeft <= 0) { Effects.RemoveAt(k); changed = true; }
            }
            if (changed) View.Refresh(Effects);

            foreach (var ev in db.Events)
            {
                if (!Contains(ev.eras, era)) continue;
                if (!string.IsNullOrEmpty(ev.requiresBuilding) && !city.HasBuilding(db.BuildingIndex(ev.requiresBuilding))) continue;
                if (!string.IsNullOrEmpty(ev.requiresResearch) && !tech.IsDone(ev.requiresResearch)) continue;
                if (ev.kind == "historical")
                {
                    if (ev.onEraStart || ev.year == 0 || Fired.Contains(ev.id)) continue;
                    if (year >= ev.year) Fire(ev, stock, tech, relations, tick);
                }
                else
                {
                    if (ev.months.Length > 0 && !Contains(ev.months, month)) continue;
                    bool active = false;
                    foreach (var e in Effects) if (e.id == ev.id) { active = true; break; }
                    if (active || tick < 24) continue;
                    double chance = ev.chance;
                    if (ev.id == "lanun" && city.HasBuilding(db.BuildingIndex("menara_tinjau"))) chance *= 0.4;
                    if (rng.Chance(chance)) Fire(ev, stock, tech, relations, tick);
                }
            }

            // crises: auto-resolve with the default after the timeout, else check triggers
            if (PendingCrisis != null)
            {
                if (tick - PendingSince >= CrisisTimeout)
                {
                    var c = db.Crises[db.CrisisIndex(PendingCrisis)];
                    Resolve(c.defaultChoice, stock, tech, relations, tick, true);
                }
                return;
            }
            foreach (var c in db.Crises)
            {
                if (!Contains(c.eras, era)) continue;
                if (c.triggerYear > 0)
                {
                    if (year >= c.triggerYear && !Started(c.id)) { StartCrisis(c, stock, tech, relations, tick); return; }
                }
                else if (c.triggerChance > 0)
                {
                    if (c.triggerMonths.Length > 0 && !Contains(c.triggerMonths, month)) continue;
                    if (tick < (c.minTick > 0 ? c.minTick : 24)) continue;
                    int lastTick = int.MinValue;
                    foreach (var l in CrisisLog) if (l.crisis == c.id) lastTick = l.tick;
                    if (lastTick != int.MinValue && tick - lastTick < (c.cooldown > 0 ? c.cooldown : 30)) continue;
                    if (rng.Chance(c.triggerChance)) { StartCrisis(c, stock, tech, relations, tick); return; }
                }
            }
        }

        /// <summary>Choose a response. Returns false if the choice is invalid or unaffordable.</summary>
        public bool Resolve(int choice, ResourceLedger stock, TechTreeState tech, Dictionary<string, double> relations, int tick, bool auto = false)
        {
            if (PendingCrisis == null) return false;
            var c = db.Crises[db.CrisisIndex(PendingCrisis)];
            if (choice < 0 || choice >= c.choices.Length) return false;
            var ch = c.choices[choice];
            if (ch.cost > 0 && stock[ResourceType.Treasury] < ch.cost && !auto) return false;
            stock.Add(ResourceType.Treasury, -ch.cost);
            ApplyEffect("crisis_" + c.id + "_" + ch.id, ch.effect, stock, tech, relations);
            PendingCrisis = null;
            CrisisLog.Add((c.id, ch.id, tick));
            CrisisResolved?.Invoke(c, ch, auto);
            return true;
        }

        /// <summary>Fire every on-era-start event of an era (e.g. Merdeka!).</summary>
        public void FireEraStart(int era, ResourceLedger stock, TechTreeState tech, Dictionary<string, double> relations, int tick)
        {
            CurrentEraHint = era;
            foreach (var ev in db.Events) if (ev.onEraStart && Contains(ev.eras, era)) Fire(ev, stock, tech, relations, tick);
        }
    }
}
