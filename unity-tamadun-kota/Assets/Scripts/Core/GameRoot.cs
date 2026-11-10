using System;
using TamadunKota.Data;
using TamadunKota.Simulation;
using UnityEngine;

namespace TamadunKota.Core
{
    /// <summary>Loads the authoritative Unity game catalogs and baked geographic maps.</summary>
    public static class GameDataLoader
    {
        static T Load<T>(string name) where T : new()
        {
            var asset = Resources.Load<TextAsset>("GameData/" + name);
            if (asset == null)
            {
                Debug.LogError("Missing Resources/GameData/" + name + ".json");
                return new T();
            }
            return JsonUtility.FromJson<T>(asset.text);
        }

        public static GameDatabase Load()
        {
            return new GameDatabase
            {
                Buildings = Load<BuildingTable>("buildings").items,
                Zones = Load<ZoneTable>("zones").items,
                Research = Load<ResearchTable>("research").items,
                Policies = Load<PolicyTable>("policies").items,
                Eras = Load<EraTable>("eras").items,
                Goods = Load<GoodTable>("goods").items,
                Transports = Load<TransportTable>("transports").items,
                Events = Load<EventTable>("events").items,
                Crises = Load<CrisisTable>("crises").items,
                Advisors = Load<AdvisorTable>("advisors").items,
                Partners = Load<PartnerTable>("partners").items,
                Scenarios = Load<ScenarioTable>("scenarios").items,
                Milestones = Load<MilestoneTable>("milestones").items,
                Entries = Load<EntryTable>("sejarahpedia").items,
                States = Load<StateTable>("states").items,
                Leaders = Load<LeaderTable>("leaders").items,
            }.Index();
        }

        public static MapDefinition LoadMap(string mapId)
        {
            if (string.IsNullOrEmpty(mapId) || mapId.IndexOfAny(new[] { '/', '\\', '.' }) >= 0)
                throw new ArgumentException("Invalid geographic map id", nameof(mapId));
            var asset = Resources.Load<TextAsset>("Maps/" + mapId);
            if (asset == null) throw new InvalidOperationException("Missing geographic map: " + mapId);
            try
            {
                var map = JsonUtility.FromJson<MapDefinition>(asset.text);
                if (map == null || map.id != mapId) throw new FormatException("Geographic map identity does not match: " + mapId);
                return map;
            }
            finally { Resources.UnloadAsset(asset); }
        }
    }

    /// <summary>Greybox / Full 3D Art switch shared by every building view.</summary>
    public static class ArtMode
    {
        public static bool Greybox { get; private set; }
        public static event Action<bool> Changed;

        public static void Set(bool greybox)
        {
            if (Greybox == greybox) return;
            Greybox = greybox;
            Changed?.Invoke(greybox);
        }

        public static void Toggle() => Set(!Greybox);
    }

    /// <summary>
    /// Scene root: owns the rules simulation and the shared data. Every other manager finds it
    /// through <see cref="Instance"/>. Starts a new game on Awake (seed + scenario below) unless
    /// SaveLoadManager replaces the simulation with a saved one.
    /// </summary>
    [DefaultExecutionOrder(-1000)]
    public class GameRoot : MonoBehaviour
    {
        public static GameRoot Instance { get; private set; }

        [Header("New game")]
        public int seed = 42;
        public string cityName = "Kota Baharu";
        [Tooltip("melaka_1400, larut_1875 or msc_1996")]
        public string scenario = "melaka_1400";
        [Range(64, 256)] public int mapSize = 128;

        [Header("Data")]
        public BuildingCatalog catalog;
        [Tooltip("Show Bahasa Melayu text (otherwise English)")]
        public bool malay = true;

        public GameDatabase Db { get; private set; }
        public GameSimulation Sim { get; private set; }

        /// <summary>Raised when a new or loaded simulation replaces the current one.</summary>
        public event Action<GameSimulation> SimulationChanged;
        public event Action<bool> LanguageChanged;

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            Db = GameDataLoader.Load();
            if (Application.isBatchMode) NewLegacyGame(seed, scenario);
            else NewGame(seed, scenario);
        }

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        public void NewGame(int newSeed, string newScenario)
        {
            var state = Db.StateById("melaka");
            if (state == null) throw new InvalidOperationException("The Melaka state profile is missing");
            NewGame(new GameSetup { stateId = state.id, leaderId = state.leaderId, mapId = state.mapId,
                seed = newSeed, scenarioId = string.IsNullOrEmpty(newScenario) ? "melaka_1400" : newScenario }, cityName);
        }

        public void NewGame(GameSetup setup, string newCityName)
        {
            if (setup == null) throw new ArgumentNullException(nameof(setup));
            setup.Validate(Db);
            var definition = GameDataLoader.LoadMap(setup.mapId);
            if (definition.stateId != setup.stateId) throw new FormatException("Geographic map belongs to a different state");
            var map = definition.CreateMap(setup.seed);
            var sim = new GameSimulation(Db, setup, map);
            seed = setup.seed;
            scenario = setup.scenarioId;
            cityName = string.IsNullOrWhiteSpace(newCityName) ? "Kota Baharu" : newCityName.Trim();
            Replace(sim);
        }

        /// <summary>Procedural entry point retained for headless smoke tests and legacy tooling.</summary>
        public void NewLegacyGame(int newSeed, string newScenario)
        {
            seed = newSeed;
            scenario = string.IsNullOrEmpty(newScenario) ? "melaka_1400" : newScenario;
            var sim = new GameSimulation(Db, seed, mapSize);
            if (scenario != "melaka_1400") sim.ApplyScenario(scenario);
            Replace(sim);
        }

        public void Replace(GameSimulation sim)
        {
            Sim = sim;
            SimulationChanged?.Invoke(sim);
        }

        public void SetLanguage(bool useMalay)
        {
            malay = useMalay;
            LanguageChanged?.Invoke(useMalay);
        }

        public string T(string ms, string en) => malay ? ms : en;
    }
}
