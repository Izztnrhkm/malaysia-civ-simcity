using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    public enum NoticeKind { Info, Good, Bad, Event, Era }

    public struct Notice
    {
        public NoticeKind kind;
        public string titleMs, titleEn, bodyMs, bodyEn;
        /// <summary>Subject id (event, crisis, research, era, advisor, partner or milestone), not a unique delivery id.</summary>
        public string id;
        /// <summary>Sejarahpedia entry id, or null when the subject has no linked entry.</summary>
        public string entryId;
    }

    /// <summary>A sample of the city's history for the timeline chart.</summary>
    [Serializable]
    public struct HistoryPoint
    {
        public int tick, year, era;
        public double treasury, population, output;
    }

    /// <summary>
    /// The whole game rules engine, independent of Unity. MonoBehaviours (TimeManager,
    /// EconomyManager, GridPlacementSystem, EraManager...) drive it and render its state.
    /// </summary>
    public sealed class GameSimulation
    {
        static readonly int[] AdvisorSlotsByEra = { 0, 1, 2, 2, 3 };
        public readonly GameDatabase Db;
        public readonly MapData Map;
        public readonly CityState City;
        public readonly ResourceLedger Stock = new ResourceLedger();
        public readonly EconomyModel Economy;
        public readonly EnvironmentModel Environment;
        public DiplomacyState Diplomacy { get; }
        public MilestoneState Milestones { get; }
        public readonly TechTreeState Tech;
        public readonly EraStateMachine Era;
        public readonly GameEventSystem Events;
        public readonly EffectTotals Effects = new EffectTotals();
        public readonly Dictionary<string, double> Relations;
        public readonly List<string> Advisors = new List<string>(4);
        public readonly List<string> Policies = new List<string>(4);
        public readonly List<HistoryPoint> History = new List<HistoryPoint>(512);
        public readonly Rng Rng;
        public double TaxR = 9, TaxC = 9, TaxI = 9;
        public int Tick, Year, Month;
        public string Scenario = "melaka_1400";
        public event Action<Notice> NoticePosted;
        public event Action<int> Ticked;
        public event Action<string> OnMilestoneReached;
        public event Action OnVictory;

        public GameSimulation(GameDatabase db, int seed, int mapSize = 128)
        {
            Db = db;
            Relations = new Dictionary<string, double>(db.Partners.Length);
            Map = MapGenerator.Generate(mapSize, mapSize, seed);
            City = new CityState(Map, database: db);
            Economy = new EconomyModel(db);
            Environment = new EnvironmentModel(db, City);
            Tech = new TechTreeState(db);
            Era = new EraStateMachine(db);
            Events = new GameEventSystem(db);
            Rng = new Rng((uint)(seed * 2654435761u) == 0 ? 1u : (uint)(seed * 2654435761u));
            Year = db.Era(1).startYear;
            Stock[ResourceType.Treasury] = 12000;
            Stock[ResourceType.Food] = 80;
            Stock[ResourceType.Fish] = 40;
            Diplomacy = new DiplomacyState(this);

            Tech.Completed += i =>
            {
                RefreshEffects();
                var r = db.Research[i];
                Post(NoticeKind.Good, (r.IsTech ? "Teknologi selesai: " : "Sivik selesai: ") + r.nameMs, (r.IsTech ? "Technology complete: " : "Civic complete: ") + r.nameEn, r.descMs, r.descEn, r.id, r.entryId);
            };
            Events.EventFired += ev => Post(NoticeKind.Event, ev.nameMs, ev.nameEn, ev.descMs, ev.descEn, ev.id, ev.entryId);
            Events.CrisisStarted += c => Post(NoticeKind.Bad, "Krisis: " + c.nameMs, "Crisis: " + c.nameEn, c.descMs, c.descEn, c.id, c.entryId);
            Events.CrisisResolved += (c, ch, auto) => Post(NoticeKind.Info, c.nameMs + ": " + ch.nameMs, c.nameEn + ": " + ch.nameEn, ch.descMs, ch.descEn, c.id, c.entryId);
            Era.EraAdvanced += (oldEra, newEra) =>
            {
                var e = db.Era(newEra);
                if (Year < e.startYear) { Year = e.startYear; Month = 0; }
                Diplomacy.EnsurePartners();
                for (int k = 0; k < Advisors.Count;)
                {
                    var a = FindAdvisor(Advisors[k]);
                    if (a != null && Array.IndexOf(a.eras, newEra) >= 0) { k++; continue; }
                    string id = Advisors[k];
                    Advisors.RemoveAt(k);
                    RefreshEffects();
                    string name = a?.name ?? id;
                    Post(NoticeKind.Info, "Penasihat bersara: " + name, "Advisor retired: " + name, a?.titleMs, a?.titleEn, id);
                }
                if (Advisors.Count > AdvisorSlots) Advisors.RemoveRange(AdvisorSlots, Advisors.Count - AdvisorSlots);
                Events.FireEraStart(newEra, Stock, Tech, Relations, Tick);
                Diplomacy.EnsurePartners();
                RefreshEffects();
                Post(NoticeKind.Era, "Era baharu: " + e.nameMs, "A new era begins: " + e.nameEn, e.introMs, e.introEn, e.id.ToString(System.Globalization.CultureInfo.InvariantCulture), e.entryId);
            };
            RefreshEffects();
            Economy.ComputePopulation(City);
            Environment.Compute(City, CurrentEra, Effects);
            Milestones = new MilestoneState(this);
        }

        public int CurrentEra => Era.CurrentEra;
        public EraRecord EraDef => Db.Era(Era.CurrentEra);
        public int AdvisorSlots => AdvisorSlotsByEra[CurrentEra];
        public int PolicySlots => EraDef.policySlots;

        internal void Post(NoticeKind kind, string tMs, string tEn, string bMs, string bEn, string id = null, string entryId = null) =>
            NoticePosted?.Invoke(new Notice { kind = kind, titleMs = tMs, titleEn = tEn, bodyMs = bMs, bodyEn = bEn, id = id, entryId = string.IsNullOrEmpty(entryId) ? null : entryId });
        internal void RaiseMilestone(string id) => OnMilestoneReached?.Invoke(id);
        internal void RaiseVictory() => OnVictory?.Invoke();

        AdvisorRecord FindAdvisor(string id) { foreach (var a in Db.Advisors) if (a.id == id) return a; return null; }

        /// <summary>Recompute effect totals from research, policies and advisors.</summary>
        public void RefreshEffects()
        {
            Effects.Reset();
            Tech.ApplyEffects(Effects);
            foreach (var p in Policies) foreach (var pr in Db.Policies) if (pr.id == p) Effects.Add(pr.effects);
            foreach (var a in Advisors) Effects.Add(FindAdvisor(a)?.effects);
        }

        // ------------------------------------------------------------ the tick

        /// <summary>Advance the simulation one turn (6 months in era 1 ... 1 month in era 4).</summary>
        public void Step()
        {
            int era = Era.CurrentEra;
            Events.Tick(era, Year, Month, Tick, Rng, City, Stock, Tech, Relations);
            Environment.Compute(City, era, Effects);
            double advisorUpkeep = 0;
            foreach (var a in Advisors) advisorUpkeep += FindAdvisor(a)?.upkeep ?? 0;
            Diplomacy.CaptureProduction();
            Economy.Tick(City, Stock, era, Effects, Events.View, TaxR, TaxC, TaxI, Tech.Done, advisorUpkeep, Diplomacy);
            double knowledge = Diplomacy.Tick();
            Economy.ResearchPerTick += knowledge;
            Stock.Add(ResourceType.Tech, knowledge);
            Tech.Advance(Economy.ResearchPerTick, Economy.CulturePerTick);
            Economy.GrowZones(City, era, EraDef.maxDensity, Rng, Effects.Growth, Events.View.Flood);

            Tick++;
            Month += EraDef.monthsPerTick;
            while (Month >= 12) { Month -= 12; Year++; }
            if (Year > EraDef.endYear) { Year = EraDef.endYear; Month = 11; }
            if (Tick % 6 == 0)
            {
                double output = 0;
                foreach (var good in ResourceInfo.GoodIds)
                { var r = ResourceInfo.FromGood(good); output += Economy.Production[r] * Economy.BasePrice(r, era); }
                History.Add(new HistoryPoint { tick = Tick, year = Year, era = era, treasury = Stock[ResourceType.Treasury], population = Economy.Population, output = output });
                if (History.Count > 400) History.RemoveAt(0);
            }
            Milestones.Check();
            Ticked?.Invoke(Tick);
        }

        // ------------------------------------------------------------ commands

        public CommandResult SendEnvoy(string partnerId) => Diplomacy.SendEnvoy(partnerId);
        public CommandResult ProposeDeal(string partnerId, string good, double quantity, double duration) => Diplomacy.ProposeDeal(partnerId, good, quantity, duration);
        public CommandResult CancelDeal(int dealId) => Diplomacy.CancelDeal(dealId);
        public CommandResult ToggleExchange(string partnerId) => Diplomacy.ToggleExchange(partnerId);
        public CommandResult AcceptOffer(int offerId) => Diplomacy.ResolveOffer(offerId, true);
        public CommandResult DeclineOffer(int offerId) => Diplomacy.ResolveOffer(offerId, false);

        public bool IsUnlocked(int defIndex) => Tech.IsBuildingUnlocked(Db.Buildings[defIndex], Era.CurrentEra);

        public PlacementResult CheckBuilding(int defIndex, int x, int y, out double cost) =>
            City.CanPlace(Db.Buildings[defIndex], defIndex, x, y, IsUnlocked(defIndex), Stock[ResourceType.Treasury], Effects.ConstructionMult, out cost);

        public PlacedBuilding PlaceBuilding(int defIndex, int x, int y, out PlacementResult result)
        {
            result = CheckBuilding(defIndex, x, y, out double cost);
            if (result != PlacementResult.Ok) return null;
            Stock.Add(ResourceType.Treasury, -cost);
            return City.Place(Db.Buildings[defIndex], defIndex, x, y, Tick);
        }

        public TransportRecord TransportByKey(string key) { foreach (var t in Db.Transports) if (t.key == key) return t; return null; }

        public bool BuildTransport(string key, List<(int x, int y)> path, out double cost)
        {
            cost = 0;
            var def = TransportByKey(key);
            if (def == null || !Tech.IsTransportUnlocked(key, Era.CurrentEra)) return false;
            cost = City.PathCost(def, path, Effects.ConstructionMult);
            if (cost <= 0 || Stock[ResourceType.Treasury] < cost) return false;
            Stock.Add(ResourceType.Treasury, -cost);
            City.BuildTransport(def, path, Effects.ConstructionMult);
            return true;
        }

        public bool Zone(List<(int x, int y)> cells, ZoneType zone, out double cost)
        {
            cost = City.ZoneCostFor(cells, zone, Effects.ConstructionMult);
            if (Stock[ResourceType.Treasury] < cost) return false;
            if (City.ApplyZone(cells, zone) == 0) return false;
            Stock.Add(ResourceType.Treasury, -cost);
            return true;
        }

        public double Bulldoze(List<(int x, int y)> cells, List<PlacedBuilding> removed)
        {
            double cost = City.Bulldoze(cells, Db.Buildings, removed);
            Stock.Add(ResourceType.Treasury, -cost);
            return cost;
        }

        public bool AdvanceEra(bool force = false) => Era.Advance(Tech, Economy.Population, City, force);
        public bool ResolveCrisis(int choice) => Events.Resolve(choice, Stock, Tech, Relations, Tick);

        /// <summary>Web canRecruit: era, duplicate, seats, then treasury, in that order.</summary>
        public CommandResult CanRecruitAdvisor(string id)
        {
            var a = FindAdvisor(id);
            if (a == null || Array.IndexOf(a.eras, CurrentEra) < 0) return new CommandResult(false, "err.locked");
            if (Advisors.Contains(id)) return new CommandResult(false, "err.invalid");
            if (Advisors.Count >= AdvisorSlots) return new CommandResult(false, "err.noSlot");
            if (Stock[ResourceType.Treasury] < a.cost) return new CommandResult(false, "err.money", a.cost);
            return new CommandResult(true, cost: a.cost);
        }

        public bool RecruitAdvisor(string id)
        {
            var check = CanRecruitAdvisor(id);
            if (!check.Ok) return false;
            Stock.Add(ResourceType.Treasury, -check.Cost);
            Advisors.Add(id);
            RefreshEffects();
            var a = FindAdvisor(id);
            Post(NoticeKind.Good, "Penasihat baharu: " + a.name, "Advisor joined: " + a.name, a.bonusMs, a.bonusEn, id);
            return true;
        }

        /// <summary>Dismiss without refund or retirement notice, matching the web command.</summary>
        public bool DismissAdvisor(string id)
        {
            if (!Advisors.Contains(id)) return false;
            for (int i = Advisors.Count - 1; i >= 0; i--) if (Advisors[i] == id) Advisors.RemoveAt(i);
            RefreshEffects();
            return true;
        }

        /// <summary>A completed civic must explicitly unlock the policy.</summary>
        public bool IsPolicyUnlocked(string id)
        {
            for (int i = 0; i < Db.Research.Length; i++)
                if (Tech.Done[i] && !Db.Research[i].IsTech && Array.IndexOf(Db.Research[i].unlockPolicies, id) >= 0) return true;
            return false;
        }

        public CommandResult AdoptPolicy(string id)
        {
            bool known = false;
            foreach (var p in Db.Policies) if (p.id == id) { known = true; break; }
            if (!known || !IsPolicyUnlocked(id)) return new CommandResult(false, "err.locked");
            if (Policies.Contains(id)) return new CommandResult(false, "err.invalid");
            if (Policies.Count >= PolicySlots) return new CommandResult(false, "err.noSlot");
            Policies.Add(id);
            RefreshEffects();
            return new CommandResult(true);
        }

        public CommandResult RevokePolicy(string id)
        {
            if (!Policies.Contains(id)) return new CommandResult(false, "err.invalid");
            for (int i = Policies.Count - 1; i >= 0; i--) if (Policies[i] == id) Policies.RemoveAt(i);
            RefreshEffects();
            return new CommandResult(true);
        }

        // ------------------------------------------------------------ scenarios

        /// <summary>Jump-start a scenario: grant earlier research and move the calendar (the city layout is built by the caller).</summary>
        public void ApplyScenario(string id)
        {
            foreach (var s in Db.Scenarios)
            {
                if (s.id != id) continue;
                Scenario = id;
                for (int i = 0; i < Db.Research.Length; i++) if (Db.Research[i].era < s.era) Tech.Done[i] = true;
                while (Era.CurrentEra < s.era) Era.Advance(Tech, Economy.Population, City, true);
                Year = s.year;
                Month = 0;
                Stock[ResourceType.Treasury] = s.era == 4 ? 120000 : s.era == 2 ? 15000 : 12000;
                foreach (var ev in Db.Events) if (ev.kind == "historical" && ev.year > 0 && ev.year < s.year) Events.Fired.Add(ev.id);
                RefreshEffects();
            }
        }
    }
}
