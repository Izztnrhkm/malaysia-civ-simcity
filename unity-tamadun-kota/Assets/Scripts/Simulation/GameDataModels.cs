// Serializable records for the authoritative JSON tables in Assets/Resources/GameData.
// Field names match
// the JSON exactly so UnityEngine.JsonUtility (and System.Text.Json in the CI tests)
// can read them. No UnityEngine dependency: this assembly is pure C#.
using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    [Serializable]
    public class KeyValue
    {
        public string key;
        public double value;
    }

    [Serializable]
    public class EffectRecord
    {
        public KeyValue[] production = Array.Empty<KeyValue>();
        public double productionAll;
        public double exportCap;
        public double exportPrice;
        public double tax;
        public double research;
        public double culture;
        public double happiness;
        public double pollution;
        public double growth;
        public double residentialGrowth;
        public double upkeep;
        public double construction;
        public double relationGain;
    }

    [Serializable]
    public class EventEffectRecord
    {
        public int duration;
        public KeyValue[] priceMult = Array.Empty<KeyValue>();
        public double productionMult = 1;
        public double happiness;
        public double research;
        public double money;
        public double researchOnce;
        public KeyValue[] relations = Array.Empty<KeyValue>();
        public string grantCivic = "";
        public bool flood;
        public double exportCapMult = 1;
    }

    [Serializable]
    public class BuildingRecord
    {
        public string id;
        public int era;
        public string category;
        public int sizeTiles;
        public int footprintMeters;
        public double cost;
        public double upkeep;
        public int jobs;
        public KeyValue[] produces = Array.Empty<KeyValue>();
        public KeyValue[] consumes = Array.Empty<KeyValue>();
        public string placement;
        public bool exportHub;
        public bool transfer;
        public bool market;
        public double exportCapacity;
        public double storage;
        public string serviceKind;
        public int serviceRadius;
        public double serviceStrength;
        public double research;
        public double culture;
        public double happiness;
        public double power;
        public double water;
        public double pollution;
        public int floodGuard;
        public bool landmark;
        public int obsoleteAfterEra;
        public bool startingBuilding;
        public string unlockedBy;
        public bool unityOnly;
        public string nameMs, nameEn, descMs, descEn;
        public string entryId, entryTitleMs, entryTitleEn, entrySummaryMs, entrySummaryEn;
        public string modelId;
        public string[] eraModelIds = Array.Empty<string>();
    }

    [Serializable]
    public class ZoneRecord
    {
        public string id;
        public string zone;
        public int density;
        public int capacity;
        public int footprintMeters;
        public string nameMs, nameEn;
        public string[] eraNamesMs = Array.Empty<string>();
        public string[] eraNamesEn = Array.Empty<string>();
        public string[] eraModelIds = Array.Empty<string>();
    }

    [Serializable]
    public class ResearchRecord
    {
        public string id;
        public string kind;
        public int era;
        public string date;
        public double cost;
        public string[] prereqs = Array.Empty<string>();
        public string[] unlockBuildings = Array.Empty<string>();
        public string[] unlockTransport = Array.Empty<string>();
        public string[] unlockPolicies = Array.Empty<string>();
        public EffectRecord effects = new EffectRecord();
        public string nameMs, nameEn, descMs, descEn, entryId;
        public bool IsTech => kind == "tech";
    }

    [Serializable]
    public class PolicyRecord
    {
        public string id, nameMs, nameEn, descMs, descEn;
        public EffectRecord effects = new EffectRecord();
    }

    [Serializable]
    public class EraRecord
    {
        public int id;
        public string nameMs, nameEn, shortMs, shortEn, spanMs, spanEn;
        public int startYear, endYear, monthsPerTick;
        public string currencyMs, currencyEn, currencySymbol;
        public int maxDensity;
        public double wealth, commercialRatio, industrialRatio;
        public int policySlots;
        public string[] advanceTechs = Array.Empty<string>();
        public string[] advanceCivics = Array.Empty<string>();
        public int advancePopulation;
        public string advanceLandmark;
        public string introMs, introEn, entryId;
    }

    [Serializable]
    public class GoodRecord
    {
        public string id, nameMs, nameEn, color;
        public bool food;
        /// <summary>Base world price per era (index 0..3); -1 = not traded yet.</summary>
        public double[] prices = Array.Empty<double>();
    }

    [Serializable]
    public class TransportRecord
    {
        public string key;
        public int id;
        public string nameMs, nameEn;
        public double cost, upkeep, step;
        public int era;
        public bool bridge;
    }

    [Serializable]
    public class EventRecord
    {
        public string id, kind;
        public int[] eras = Array.Empty<int>();
        public int year;
        public bool onEraStart;
        public int[] months = Array.Empty<int>();
        public double chance;
        public string requiresBuilding, requiresResearch;
        public string nameMs, nameEn, descMs, descEn;
        public EventEffectRecord effect = new EventEffectRecord();
        public string entryId;
    }

    [Serializable]
    public class CrisisChoiceRecord
    {
        public string id, nameMs, nameEn, descMs, descEn;
        public double cost;
        public EventEffectRecord effect = new EventEffectRecord();
    }

    [Serializable]
    public class CrisisRecord
    {
        public string id;
        public int[] eras = Array.Empty<int>();
        public string triggerEvent;
        public int triggerYear;
        public int[] triggerMonths = Array.Empty<int>();
        public double triggerChance;
        public int cooldown, minTick;
        public bool hasBase;
        public EventEffectRecord baseEffect = new EventEffectRecord();
        public string nameMs, nameEn, descMs, descEn;
        public int defaultChoice;
        public string entryId;
        public CrisisChoiceRecord[] choices = Array.Empty<CrisisChoiceRecord>();
    }

    [Serializable]
    public class AdvisorRecord
    {
        public string id, name, titleMs, titleEn, life;
        public int[] eras = Array.Empty<int>();
        public double cost, upkeep;
        public EffectRecord effects = new EffectRecord();
        public string bonusMs, bonusEn, bioMs, bioEn;
        public string[] sources = Array.Empty<string>();
    }

    [Serializable]
    public class PartnerRecord
    {
        public string id, nameMs, nameEn, descMs, descEn;
        public int[] eras = Array.Empty<int>();
        public string color;
        public KeyValue[] buys = Array.Empty<KeyValue>();
        public double baseRelation;
        public string requiresEvent;
        public double knowledge;
    }

    [Serializable]
    public class ScenarioRecord
    {
        public string id;
        public int era, year;
        public string nameMs, nameEn, descMs, descEn;
        public string[] objectivesMs = Array.Empty<string>();
        public string[] objectivesEn = Array.Empty<string>();
    }

    [Serializable]
    public class MilestoneRecord
    {
        public string id, nameMs, nameEn, descMs, descEn;
    }

    [Serializable]
    public class SourceRecord
    {
        public string title, url;
    }

    [Serializable]
    public class EntryRecord
    {
        public string id, category, period;
        public string titleMs, titleEn, summaryMs, summaryEn, bodyMs, bodyEn, inGameMs, inGameEn;
        public SourceRecord[] sources = Array.Empty<SourceRecord>();
        public string[] related = Array.Empty<string>();
    }

    // ---- JsonUtility cannot read top-level arrays: every file is { "items": [...] } ----
    [Serializable] public class BuildingTable { public BuildingRecord[] items = Array.Empty<BuildingRecord>(); }
    [Serializable] public class ZoneTable { public ZoneRecord[] items = Array.Empty<ZoneRecord>(); }
    [Serializable] public class ResearchTable { public ResearchRecord[] items = Array.Empty<ResearchRecord>(); }
    [Serializable] public class PolicyTable { public PolicyRecord[] items = Array.Empty<PolicyRecord>(); }
    [Serializable] public class EraTable { public EraRecord[] items = Array.Empty<EraRecord>(); }
    [Serializable] public class GoodTable { public GoodRecord[] items = Array.Empty<GoodRecord>(); }
    [Serializable] public class TransportTable { public TransportRecord[] items = Array.Empty<TransportRecord>(); }
    [Serializable] public class EventTable { public EventRecord[] items = Array.Empty<EventRecord>(); }
    [Serializable] public class CrisisTable { public CrisisRecord[] items = Array.Empty<CrisisRecord>(); }
    [Serializable] public class AdvisorTable { public AdvisorRecord[] items = Array.Empty<AdvisorRecord>(); }
    [Serializable] public class PartnerTable { public PartnerRecord[] items = Array.Empty<PartnerRecord>(); }
    [Serializable] public class ScenarioTable { public ScenarioRecord[] items = Array.Empty<ScenarioRecord>(); }
    [Serializable] public class MilestoneTable { public MilestoneRecord[] items = Array.Empty<MilestoneRecord>(); }
    [Serializable] public class EntryTable { public EntryRecord[] items = Array.Empty<EntryRecord>(); }

    /// <summary>All game data tables, indexed for lookups. Built once at load; never mutated during play.</summary>
    public sealed class GameDatabase
    {
        public BuildingRecord[] Buildings = Array.Empty<BuildingRecord>();
        public ZoneRecord[] Zones = Array.Empty<ZoneRecord>();
        public ResearchRecord[] Research = Array.Empty<ResearchRecord>();
        public PolicyRecord[] Policies = Array.Empty<PolicyRecord>();
        public EraRecord[] Eras = Array.Empty<EraRecord>();
        public GoodRecord[] Goods = Array.Empty<GoodRecord>();
        public TransportRecord[] Transports = Array.Empty<TransportRecord>();
        public EventRecord[] Events = Array.Empty<EventRecord>();
        public CrisisRecord[] Crises = Array.Empty<CrisisRecord>();
        public AdvisorRecord[] Advisors = Array.Empty<AdvisorRecord>();
        public PartnerRecord[] Partners = Array.Empty<PartnerRecord>();
        public ScenarioRecord[] Scenarios = Array.Empty<ScenarioRecord>();
        public MilestoneRecord[] Milestones = Array.Empty<MilestoneRecord>();
        public EntryRecord[] Entries = Array.Empty<EntryRecord>();
        public StateRecord[] States = Array.Empty<StateRecord>();
        public LeaderRecord[] Leaders = Array.Empty<LeaderRecord>();

        readonly Dictionary<string, int> buildingIndex = new Dictionary<string, int>();
        readonly Dictionary<string, int> researchIndex = new Dictionary<string, int>();
        readonly Dictionary<string, int> crisisIndex = new Dictionary<string, int>();
        readonly Dictionary<string, int> entryIndex = new Dictionary<string, int>();

        /// <summary>Build the lookup indices after the arrays are assigned.</summary>
        public GameDatabase Index()
        {
            buildingIndex.Clear();
            researchIndex.Clear();
            crisisIndex.Clear();
            entryIndex.Clear();
            for (int i = 0; i < Buildings.Length; i++) buildingIndex[Buildings[i].id] = i;
            for (int i = 0; i < Research.Length; i++) researchIndex[Research[i].id] = i;
            for (int i = 0; i < Crises.Length; i++) crisisIndex[Crises[i].id] = i;
            for (int i = 0; i < Entries.Length; i++) entryIndex[Entries[i].id] = i;
            return this;
        }

        public int BuildingIndex(string id) => id != null && buildingIndex.TryGetValue(id, out int i) ? i : -1;
        public int ResearchIndex(string id) => id != null && researchIndex.TryGetValue(id, out int i) ? i : -1;
        public int CrisisIndex(string id) => id != null && crisisIndex.TryGetValue(id, out int i) ? i : -1;
        public BuildingRecord Building(string id) { int i = BuildingIndex(id); return i < 0 ? null : Buildings[i]; }
        public ResearchRecord ResearchById(string id) { int i = ResearchIndex(id); return i < 0 ? null : Research[i]; }
        public EntryRecord Entry(string id) => id != null && entryIndex.TryGetValue(id, out int i) ? Entries[i] : null;
        public StateRecord StateById(string id) { foreach (var state in States) if (state.id == id) return state; return null; }
        public LeaderRecord LeaderById(string id) { foreach (var leader in Leaders) if (leader.id == id) return leader; return null; }
        public EraRecord Era(int era) => Eras[Math.Max(0, Math.Min(Eras.Length - 1, era - 1))];

        public int TechCount { get { int n = 0; foreach (var r in Research) if (r.IsTech) n++; return n; } }
        public int CivicCount => Research.Length - TechCount;
    }
}
