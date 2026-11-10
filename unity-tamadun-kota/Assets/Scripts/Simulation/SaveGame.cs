using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    [Serializable]
    public class SavedBuilding
    {
        public int id;
        public string def;
        public int x, y, cells, rotation, builtTick;
        public double efficiency = 1;
    }

    [Serializable]
    public class SavedCell
    {
        public int index;
        public int value;
    }

    [Serializable]
    public class SavedRelation
    {
        public string partner;
        public double value;
    }

    [Serializable]
    public class SavedPartner
    {
        public string id;
        public double relation;
        public int envoyCooldown;
        public bool exchange;
    }

    [Serializable]
    public class SavedDeal
    {
        public int id, missed;
        public string partner, good;
        public double quantity, price, remaining, delivered;
    }

    [Serializable]
    public class SavedOffer
    {
        public int id, expires;
        public string partner;
        public OfferKind kind;
        public string good;
        public double quantity, price, duration, money;
    }

    /// <summary>
    /// JSON save file (written with UnityEngine.JsonUtility by SaveLoadManager). Plain
    /// arrays and base64 map layers so JsonUtility and .NET can read the same file.
    /// Versions one and two regenerate the original procedural map from the seed.
    /// </summary>
    [Serializable]
    public class SaveGame
    {
        public const string Format = "tamadun-kota-unity-save";
        public const int CurrentVersion = 3;

        public string format = Format;
        public int version = CurrentVersion;
        public string savedAt;
        public string cityName;
        public string scenario;
        public int seed;
        public GameSetup setup;
        public MapSnapshot map;
        public int mapSize;
        public int era;
        public int tick, year, month;
        public double[] resources = Array.Empty<double>();
        public double taxR, taxC, taxI;
        public string[] researchDone = Array.Empty<string>();
        public string currentTech, currentCivic;
        public double techBank, civicBank;
        public SavedBuilding[] buildings = Array.Empty<SavedBuilding>();
        /// <summary>Non-empty transport cells (value = TransportType).</summary>
        public SavedCell[] transport = Array.Empty<SavedCell>();
        /// <summary>Zoned cells: value = zone | density << 4 | style << 8.</summary>
        public SavedCell[] zones = Array.Empty<SavedCell>();
        /// <summary>Tiles whose terrain changed since generation (cleared rainforest).</summary>
        public SavedCell[] terrainChanges = Array.Empty<SavedCell>();
        public string[] firedEvents = Array.Empty<string>();
        public string pendingCrisis;
        public string[] advisors = Array.Empty<string>();
        public SavedRelation[] relations = Array.Empty<SavedRelation>();
        public HistoryPoint[] history = Array.Empty<HistoryPoint>();
        public SavedPartner[] partners = Array.Empty<SavedPartner>();
        public SavedDeal[] deals = Array.Empty<SavedDeal>();
        public SavedOffer[] offers = Array.Empty<SavedOffer>();
        public string[] milestones = Array.Empty<string>();
        public bool victory;
        public int diplomacyNextId;
        public uint rngState;
        public double happiness = 60;
        public string[] policies = Array.Empty<string>();
        public double[] production = Array.Empty<double>();
    }

    public static class SaveCodec
    {
        public static SaveGame Capture(GameSimulation sim, string cityName, int seed)
        {
            // The seed parameter remains for older callers; the running map is authoritative.
            var choices = sim.Setup;
            if (choices != null)
            {
                choices.seed = sim.Map.Seed; choices.scenarioId = sim.Scenario;
                choices.Validate(sim.Db);
            }
            var s = new SaveGame
            {
                savedAt = DateTime.UtcNow.ToString("o"),
                cityName = cityName,
                scenario = sim.Scenario,
                seed = sim.Map.Seed,
                setup = choices,
                map = MapSnapshot.Capture(sim.Map),
                mapSize = sim.Map.Width,
                era = sim.CurrentEra,
                tick = sim.Tick,
                year = sim.Year,
                month = sim.Month,
                resources = (double[])sim.Stock.amounts.Clone(),
                taxR = sim.TaxR,
                taxC = sim.TaxC,
                taxI = sim.TaxI,
                currentTech = sim.Tech.CurrentTech >= 0 ? sim.Db.Research[sim.Tech.CurrentTech].id : "",
                currentCivic = sim.Tech.CurrentCivic >= 0 ? sim.Db.Research[sim.Tech.CurrentCivic].id : "",
                techBank = sim.Tech.TechBank,
                civicBank = sim.Tech.CivicBank,
                pendingCrisis = sim.Events.PendingCrisis ?? "",
                advisors = sim.Advisors.ToArray(),
                history = sim.History.ToArray(),
                victory = sim.Milestones.Victory,
                diplomacyNextId = sim.Diplomacy.NextId,
                rngState = sim.Rng.State,
                happiness = sim.Economy.Happiness,
                policies = sim.Policies.ToArray(),
                production = (double[])sim.Economy.Production.amounts.Clone(),
            };
            var done = new List<string>();
            for (int i = 0; i < sim.Tech.Done.Length; i++) if (sim.Tech.Done[i]) done.Add(sim.Db.Research[i].id);
            s.researchDone = done.ToArray();
            var bs = new List<SavedBuilding>();
            foreach (var b in sim.City.Buildings)
                bs.Add(new SavedBuilding { id = b.id, def = sim.Db.Buildings[b.defIndex].id, x = b.x, y = b.y, cells = b.cells, rotation = b.rotation, builtTick = b.builtTick, efficiency = b.efficiency });
            s.buildings = bs.ToArray();
            var tr = new List<SavedCell>();
            var zs = new List<SavedCell>();
            for (int i = 0; i < sim.City.Transport.Length; i++)
            {
                if (sim.City.Transport[i] != 0) tr.Add(new SavedCell { index = i, value = sim.City.Transport[i] });
                if (sim.City.Zone[i] != 0) zs.Add(new SavedCell { index = i, value = sim.City.Zone[i] | sim.City.Density[i] << 4 | sim.City.Style[i] << 8 });
            }
            s.transport = tr.ToArray();
            s.zones = zs.ToArray();
            s.firedEvents = new List<string>(sim.Events.Fired).ToArray();
            var rel = new List<SavedRelation>();
            foreach (var kv in sim.Relations) rel.Add(new SavedRelation { partner = kv.Key, value = kv.Value });
            s.relations = rel.ToArray();
            var partners = new List<SavedPartner>();
            for (int i = 0; i < sim.Diplomacy.Partners.Count; i++)
            {
                var p = sim.Diplomacy.Partners[i];
                if (p.Known) partners.Add(new SavedPartner { id = p.Id, relation = p.Relation, envoyCooldown = p.EnvoyCooldown, exchange = p.Exchange });
            }
            s.partners = partners.ToArray();
            s.deals = new SavedDeal[sim.Diplomacy.Deals.Count];
            for (int i = 0; i < s.deals.Length; i++)
            {
                var d = sim.Diplomacy.Deals[i];
                s.deals[i] = new SavedDeal { id = d.Id, partner = d.Partner, good = d.Good, quantity = d.Quantity, price = d.Price, remaining = d.Remaining, delivered = d.Delivered, missed = d.Missed };
            }
            s.offers = new SavedOffer[sim.Diplomacy.Offers.Count];
            for (int i = 0; i < s.offers.Length; i++)
            {
                var o = sim.Diplomacy.Offers[i];
                s.offers[i] = new SavedOffer { id = o.Id, partner = o.Partner, kind = o.Kind, good = o.Good, quantity = o.Quantity, price = o.Price, duration = o.Duration, money = o.Money, expires = o.Expires };
            }
            var reached = new List<string>();
            for (int i = 0; i < sim.Milestones.All.Count; i++) if (sim.Milestones.All[i].Reached) reached.Add(sim.Milestones.All[i].Id);
            s.milestones = reached.ToArray();
            return s;
        }

        /// <summary>Rebuild a simulation from a save. Throws <see cref="FormatException"/> for foreign or newer files.</summary>
        public static GameSimulation Restore(GameDatabase db, SaveGame s)
        {
            if (s == null || s.format != SaveGame.Format) throw new FormatException("Not a Tamadun & Kota (Unity) save");
            if (s.version < 1 || s.version > SaveGame.CurrentVersion) throw new FormatException("Unsupported save version");
            MapData map;
            GameSetup choices = null;
            if (s.version >= 3)
            {
                map = (s.map ?? throw new FormatException("The save has no terrain snapshot.")).CreateMap();
                if (map.Seed != s.seed || map.Width != s.mapSize) throw new FormatException("Conflicting map metadata.");
                choices = s.setup;
                if (choices != null)
                {
                    try { choices.Validate(db); }
                    catch (ArgumentException e) { throw new FormatException("The save has an invalid state/leader pairing.", e); }
                    if (choices.seed != s.seed || choices.scenarioId != s.scenario) throw new FormatException("Conflicting city setup metadata.");
                }
            }
            else
            {
                int size = s.mapSize > 0 ? s.mapSize : 128;
                if (size < 8 || size > 512) throw new FormatException("Invalid legacy map dimensions.");
                map = MapGenerator.Generate(size, size, s.seed);
            }
            var sim = new GameSimulation(db, s.seed, map, choices) { Scenario = s.scenario ?? "melaka_1400" };
            sim.Era.Restore(s.era);
            sim.Tick = s.tick;
            sim.Year = s.year;
            sim.Month = s.month;
            if (s.resources != null) Array.Copy(s.resources, sim.Stock.amounts, Math.Min(s.resources.Length, sim.Stock.amounts.Length));
            sim.TaxR = s.taxR;
            sim.TaxC = s.taxC;
            sim.TaxI = s.taxI;
            foreach (var id in s.researchDone) { int i = db.ResearchIndex(id); if (i >= 0) sim.Tech.Done[i] = true; }
            sim.Tech.CurrentTech = db.ResearchIndex(s.currentTech);
            sim.Tech.CurrentCivic = db.ResearchIndex(s.currentCivic);
            sim.Tech.TechBank = s.techBank;
            sim.Tech.CivicBank = s.civicBank;
            if (s.version < 3)
                foreach (var c in s.terrainChanges ?? Array.Empty<SavedCell>()) if (c.index >= 0 && c.index < sim.Map.Terrain.Length) sim.Map.Terrain[c.index] = (byte)c.value;
            foreach (var c in s.transport) if (c.index >= 0 && c.index < sim.City.Transport.Length) sim.City.Transport[c.index] = (byte)c.value;
            foreach (var c in s.zones)
            {
                if (c.index < 0 || c.index >= sim.City.Zone.Length) continue;
                sim.City.Zone[c.index] = (byte)(c.value & 15);
                sim.City.Density[c.index] = (byte)((c.value >> 4) & 15);
                sim.City.Style[c.index] = (byte)((c.value >> 8) & 15);
            }
            foreach (var b in s.buildings)
            {
                int di = db.BuildingIndex(b.def);
                if (di < 0) continue; // unknown building ids are skipped rather than failing the load
                var restored = sim.City.Restore(b.id, di, b.x, b.y, b.cells, b.rotation, b.builtTick);
                restored.efficiency = s.version >= 2 ? b.efficiency : 1;
            }
            sim.City.RecomputeAccess();
            EnvironmentModel.ComputeWaterDistance(sim.City);
            foreach (var e in s.firedEvents) sim.Events.Fired.Add(e);
            sim.Events.PendingCrisis = string.IsNullOrEmpty(s.pendingCrisis) || db.CrisisIndex(s.pendingCrisis) < 0 ? null : s.pendingCrisis;
            sim.Events.PendingSince = s.tick;
            sim.Advisors.Clear();
            foreach (var a in s.advisors) if (sim.Leader == null || sim.Leader.id != a) sim.Advisors.Add(a);
            sim.Relations.Clear();
            foreach (var r in s.relations ?? Array.Empty<SavedRelation>()) sim.Relations[r.partner] = r.value;
            foreach (var p in s.partners ?? Array.Empty<SavedPartner>())
            {
                var partner = sim.Diplomacy.FindPartner(p.id);
                if (partner == null) continue;
                partner.SetRelation(p.relation); partner.EnvoyCooldown = p.envoyCooldown; partner.Exchange = p.exchange;
            }
            var deals = new TradeDeal[s.deals?.Length ?? 0];
            for (int i = 0; i < deals.Length; i++)
            {
                var d = s.deals[i];
                deals[i] = new TradeDeal { Id = d.id, Partner = d.partner, Good = d.good, Quantity = d.quantity, Price = d.price, Remaining = d.remaining, Delivered = d.delivered, Missed = d.missed };
            }
            var offers = new DiplomaticOffer[s.offers?.Length ?? 0];
            for (int i = 0; i < offers.Length; i++)
            {
                var o = s.offers[i];
                offers[i] = new DiplomaticOffer { Id = o.id, Partner = o.partner, Kind = o.kind, Good = o.good, Quantity = o.quantity, Price = o.price, Duration = o.duration, Money = o.money, Expires = o.expires };
            }
            sim.Diplomacy.NextId = Math.Max(1, s.diplomacyNextId);
            sim.Diplomacy.Restore(deals, offers);
            if (s.production != null) Array.Copy(s.production, sim.Economy.Production.amounts, Math.Min(s.production.Length, ResourceInfo.Count));
            if (s.version >= 2) { sim.Rng.State = s.rngState; sim.Economy.Happiness = s.happiness; }
            else sim.Stock[ResourceType.Fish] = 0; // version one stored all food at index one
            sim.Policies.AddRange(s.policies ?? Array.Empty<string>());
            sim.History.Clear();
            sim.History.AddRange(s.history);
            sim.RefreshEffects();
            sim.Economy.ComputePopulation(sim.City);
            sim.Environment.Compute(sim.City, sim.CurrentEra, sim.Effects);
            sim.Milestones.Restore(s.milestones, s.victory);
            return sim;
        }
    }
}
