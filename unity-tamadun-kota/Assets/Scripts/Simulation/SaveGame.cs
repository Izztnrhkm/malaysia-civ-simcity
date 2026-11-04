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

    /// <summary>
    /// JSON save file (written with UnityEngine.JsonUtility by SaveLoadManager). Plain
    /// arrays only so JsonUtility can read it; map terrain is regenerated from the seed and
    /// only changed tiles are stored.
    /// </summary>
    [Serializable]
    public class SaveGame
    {
        public const string Format = "tamadun-kota-unity-save";
        public const int CurrentVersion = 1;

        public string format = Format;
        public int version = CurrentVersion;
        public string savedAt;
        public string cityName;
        public string scenario;
        public int seed;
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
    }

    public static class SaveCodec
    {
        public static SaveGame Capture(GameSimulation sim, string cityName, int seed)
        {
            var s = new SaveGame
            {
                savedAt = DateTime.UtcNow.ToString("o"),
                cityName = cityName,
                scenario = sim.Scenario,
                seed = seed,
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
            };
            var done = new List<string>();
            for (int i = 0; i < sim.Tech.Done.Length; i++) if (sim.Tech.Done[i]) done.Add(sim.Db.Research[i].id);
            s.researchDone = done.ToArray();
            var bs = new List<SavedBuilding>();
            foreach (var b in sim.City.Buildings)
                bs.Add(new SavedBuilding { id = b.id, def = sim.Db.Buildings[b.defIndex].id, x = b.x, y = b.y, cells = b.cells, rotation = b.rotation, builtTick = b.builtTick });
            s.buildings = bs.ToArray();
            var tr = new List<SavedCell>();
            var zs = new List<SavedCell>();
            var tc = new List<SavedCell>();
            var fresh = MapGenerator.Generate(sim.Map.Width, sim.Map.Height, seed);
            for (int i = 0; i < sim.City.Transport.Length; i++)
            {
                if (sim.City.Transport[i] != 0) tr.Add(new SavedCell { index = i, value = sim.City.Transport[i] });
                if (sim.City.Zone[i] != 0) zs.Add(new SavedCell { index = i, value = sim.City.Zone[i] | sim.City.Density[i] << 4 | sim.City.Style[i] << 8 });
                if (sim.Map.Terrain[i] != fresh.Terrain[i]) tc.Add(new SavedCell { index = i, value = sim.Map.Terrain[i] });
            }
            s.transport = tr.ToArray();
            s.zones = zs.ToArray();
            s.terrainChanges = tc.ToArray();
            s.firedEvents = new List<string>(sim.Events.Fired).ToArray();
            var rel = new List<SavedRelation>();
            foreach (var kv in sim.Relations) rel.Add(new SavedRelation { partner = kv.Key, value = kv.Value });
            s.relations = rel.ToArray();
            return s;
        }

        /// <summary>Rebuild a simulation from a save. Throws <see cref="FormatException"/> for foreign or newer files.</summary>
        public static GameSimulation Restore(GameDatabase db, SaveGame s)
        {
            if (s == null || s.format != SaveGame.Format) throw new FormatException("Not a Tamadun & Kota (Unity) save");
            if (s.version > SaveGame.CurrentVersion) throw new FormatException("Save is from a newer version");
            var sim = new GameSimulation(db, s.seed, s.mapSize > 0 ? s.mapSize : 128) { Scenario = s.scenario ?? "melaka_1400" };
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
            foreach (var c in s.terrainChanges) if (c.index >= 0 && c.index < sim.Map.Terrain.Length) sim.Map.Terrain[c.index] = (byte)c.value;
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
                sim.City.Restore(b.id, di, b.x, b.y, b.cells, b.rotation, b.builtTick);
            }
            sim.City.RecomputeAccess();
            foreach (var e in s.firedEvents) sim.Events.Fired.Add(e);
            sim.Events.PendingCrisis = string.IsNullOrEmpty(s.pendingCrisis) || db.CrisisIndex(s.pendingCrisis) < 0 ? null : s.pendingCrisis;
            sim.Events.PendingSince = s.tick;
            sim.Advisors.Clear();
            foreach (var a in s.advisors) sim.Advisors.Add(a);
            foreach (var r in s.relations) sim.Relations[r.partner] = r.value;
            sim.History.Clear();
            sim.History.AddRange(s.history);
            sim.RefreshEffects();
            sim.Economy.ComputePopulation(sim.City);
            return sim;
        }
    }
}
