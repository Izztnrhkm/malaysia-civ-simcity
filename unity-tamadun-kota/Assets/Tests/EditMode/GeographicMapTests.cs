using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    public class GeographicMapTests
    {
        static readonly string[] StateIds = { "johor", "kedah", "kelantan", "melaka", "negeri_sembilan", "pahang", "perak", "perlis", "pulau_pinang", "sabah", "sarawak", "selangor", "terengganu" };

        static MapDefinition Definition(string state)
        {
            string json = File.ReadAllText(Path.Combine(TestData.GameDataDir(), "../Maps", state + "_region.json"));
#if UNITY_5_3_OR_NEWER
            return UnityEngine.JsonUtility.FromJson<MapDefinition>(json);
#else
            return System.Text.Json.JsonSerializer.Deserialize<MapDefinition>(json, new System.Text.Json.JsonSerializerOptions { IncludeFields = true });
#endif
        }

        static IEnumerable<TestCaseData> Starts()
        {
            foreach (var state in StateIds) foreach (var scenario in new[] { "melaka_1400", "larut_1875", "msc_1996" })
                yield return new TestCaseData(state, scenario).SetName("GeographicCity_" + state + "_" + scenario);
        }

        [TestCaseSource(nameof(StateIds))]
        public void SeedsKeepRealGeographyFixedAndSnapshotsKeepAllLayers(string state)
        {
            var definition = Definition(state); var a = definition.CreateMap(42); var b = definition.CreateMap(999);
            Assert.AreEqual(256, a.Width); Assert.AreEqual(256, a.Height);
            Assert.AreEqual(state, definition.stateId); Assert.IsNotEmpty(definition.sources);
            CollectionAssert.AreEqual(a.Terrain, b.Terrain); CollectionAssert.AreEqual(a.Elevation, b.Elevation);
            var restored = MapSnapshot.Capture(a).CreateMap();
            CollectionAssert.AreEqual(a.Fertility, restored.Fertility); CollectionAssert.AreEqual(a.Tin, restored.Tin);
            Assert.AreEqual(a.MouthX, restored.MouthX); Assert.AreEqual(a.MouthY, restored.MouthY);
            Assert.IsTrue(a.IsCoastal(a.MouthX, a.MouthY));
        }

        [TestCaseSource(nameof(Starts))]
        public void AllRegionalStartsPermitAHarbourAndSimulateAGrowingCity(string state, string scenario)
        {
            var db = TestData.QuietDatabase(); var profile = db.StateById(state);
            var sim = new GameSimulation(db, new GameSetup { stateId = state, leaderId = profile.leaderId, mapId = profile.mapId, scenarioId = scenario }, Definition(state).CreateMap(42));
            sim.Stock[ResourceType.Treasury] = 1000000;
            sim.Stock[ResourceType.Food] = 100000; sim.Stock[ResourceType.Fish] = 100000;
            int harbour = db.BuildingIndex("pelabuhan"), hx = -1, hy = -1;
            for (int radius = 0; radius < 256 && hx < 0; radius++)
                for (int dy = -radius; dy <= radius && hx < 0; dy++)
                    for (int dx = -radius; dx <= radius && hx < 0; dx++)
                    {
                        if (Math.Abs(dx) != radius && Math.Abs(dy) != radius) continue;
                        int x = sim.Map.MouthX + dx, y = sim.Map.MouthY + dy;
                        if (sim.CheckBuilding(harbour, x, y, out _) != PlacementResult.Ok) continue;
                        hx = x; hy = y;
                    }
            Assert.GreaterOrEqual(hx, 0, "real coastline must support the actual placement rules");
            Assert.IsNotNull(sim.PlaceBuilding(harbour, hx, hy, out _));

            // An affordable road grid uses only real land; it never carves or relocates the shore.
            var roads = new List<(int x, int y)>();
            var residential = new List<(int x, int y)>();
            var commercial = new List<(int x, int y)>();
            var industrial = new List<(int x, int y)>();
            int minX = Math.Max(2, hx - 32), maxX = Math.Min(253, hx + 32);
            int minY = Math.Max(2, hy - 32), maxY = Math.Min(253, hy + 32);
            for (int y = minY; y <= maxY; y += 4)
            {
                for (int x = minX; x <= maxX; x++)
                {
                    roads.Add((x, y));
                    for (int side = -1; side <= 1; side += 2)
                    {
                        var zones = x % 5 == 0 ? commercial : x % 5 == 1 ? industrial : residential;
                        zones.Add((x, y + side));
                    }
                }
            }
            sim.BuildTransport("road", roads, out _);
            sim.Zone(residential, ZoneType.Residential, out _);
            sim.Zone(commercial, ZoneType.Commercial, out _);
            sim.Zone(industrial, ZoneType.Industrial, out _);
            for (int tick = 0; tick < 100; tick++) sim.Step();
            Assert.Greater(sim.Economy.Population, 0, "zoning on this real waterfront must support population growth");
            Assert.That(sim.Economy.Happiness, Is.InRange(0, 100));
            foreach (double amount in sim.Stock.amounts) Assert.IsFalse(double.IsNaN(amount) || double.IsInfinity(amount));
            Assert.AreEqual(state, sim.State.id);
        }
    }
}
