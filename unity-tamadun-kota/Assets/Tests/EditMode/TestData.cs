// Loads Assets/Resources/GameData for tests, both inside the Unity Test Runner (JsonUtility)
// and under plain .NET in ci/SimulationTests (System.Text.Json).
using System;
using System.IO;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    public static class TestData
    {
        static GameDatabase cached;

        /// <summary>Walk up from the working directory and the test assembly until Assets/Resources/GameData is found.</summary>
        public static string GameDataDir()
        {
            foreach (var startDir in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
            {
                var dir = new DirectoryInfo(startDir);
                for (int i = 0; i < 10 && dir != null; i++, dir = dir.Parent)
                {
                    var candidate = Path.Combine(dir.FullName, "Assets", "Resources", "GameData");
                    if (Directory.Exists(candidate)) return candidate;
                    candidate = Path.Combine(dir.FullName, "unity-tamadun-kota", "Assets", "Resources", "GameData");
                    if (Directory.Exists(candidate)) return candidate;
                }
            }
            throw new DirectoryNotFoundException("Assets/Resources/GameData not found");
        }

        public static T Load<T>(string name)
        {
            string json = File.ReadAllText(Path.Combine(GameDataDir(), name + ".json"));
#if UNITY_5_3_OR_NEWER
            return UnityEngine.JsonUtility.FromJson<T>(json);
#else
            return System.Text.Json.JsonSerializer.Deserialize<T>(json, new System.Text.Json.JsonSerializerOptions { IncludeFields = true });
#endif
        }

        public static GameDatabase Database()
        {
            if (cached != null) return cached;
            cached = new GameDatabase
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
            }.Index();
            return cached;
        }

        /// <summary>The same database without random/historical events, for deterministic economy checks.</summary>
        public static GameDatabase QuietDatabase()
        {
            var d = Database();
            return new GameDatabase
            {
                Buildings = d.Buildings, Zones = d.Zones, Research = d.Research, Policies = d.Policies, Eras = d.Eras, Goods = d.Goods,
                Transports = d.Transports, Advisors = d.Advisors, Partners = d.Partners, Scenarios = d.Scenarios, Milestones = d.Milestones, Entries = d.Entries,
            }.Index();
        }
    }
}
