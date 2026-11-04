using System;
using System.Collections.Generic;
using NUnit.Framework;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    /// <summary>The C# port must reproduce the web game exactly (values computed from the TypeScript sources).</summary>
    public class PortParityTests
    {
        [TestCase(42, 2899772967u, 25, 60, 113, 1251)]
        [TestCase(7, 437910654u, 26, 58, 113, 988)]
        [TestCase(2024, 4193483891u, 31, 83, 104, 1097)]
        public void MapGeneratorMatchesTheWebGame(int seed, uint fingerprint, int mouthX, int mouthY, int riverTiles, int tinTiles)
        {
            var map = MapGenerator.Generate(128, 128, seed);
            Assert.AreEqual(fingerprint, map.Fingerprint());
            Assert.AreEqual(mouthX, map.MouthX);
            Assert.AreEqual(mouthY, map.MouthY);
            int river = 0, tin = 0;
            for (int i = 0; i < map.Terrain.Length; i++)
            {
                if (map.Terrain[i] == (byte)TerrainType.River) river++;
                if (map.Tin[i] > 0) tin++;
            }
            Assert.AreEqual(riverTiles, river);
            Assert.AreEqual(tinTiles, tin);
        }

        [Test]
        public void RngAndHashMatchTheWebGame()
        {
            var r = new Rng(12345);
            double[] expected = { 0.9797282677609473, 0.3067522644996643, 0.484205421525985, 0.817934412509203, 0.5094283693470061 };
            foreach (var e in expected) Assert.AreEqual(e, r.Next(), 1e-15);
            Assert.AreEqual(0.0, Rng.Hash2(0, 0, 0), 1e-15);
            Assert.AreEqual(0.3195407500024885, Rng.Hash2(17, -3, 9), 1e-15);
            Assert.AreEqual(0.04457894037477672, Rng.Hash2(-100, 250, unchecked((int)2246822519u)), 1e-15);
            Assert.AreEqual(0.4207611514721066, Rng.Hash2(123456, 654321, 77), 1e-15);
        }

        [Test]
        public void GamelanComposerMatchesTheWebGame()
        {
            var bar = ProceduralMusic.ComposeBar(1, 3, 7);
            string[] inst = { "Kenong", "Saron", "Saron", "Bonang", "Saron", "Bonang", "Saron", "Bonang", "Seruling", "Seruling", "Seruling", "Seruling", "Seruling" };
            double[] beats = { 2, 0, 1, 1.5, 2, 2.5, 3, 3.5, 0, 0.5, 1, 2, 3 };
            double[] freqs = { 386.146, 772.292, 1019.634, 1777.339, 1019.634, 2039.269, 1174.64, 2039.269, 1174.64, 1342.311, 1342.311, 1174.64, 1174.64 };
            Assert.AreEqual(inst.Length, bar.Count);
            for (int i = 0; i < bar.Count; i++)
            {
                Assert.AreEqual(inst[i], bar[i].inst.ToString());
                Assert.AreEqual(beats[i], bar[i].beat, 1e-9);
                Assert.AreEqual(freqs[i], Math.Round(bar[i].freqs[0] * 1000) / 1000, 1e-6);
            }
        }
    }

    public class DataTests
    {
        [Test]
        public void TablesKeepTheWebGameContent()
        {
            var db = TestData.Database();
            Assert.AreEqual(41, db.TechCount);
            Assert.AreEqual(25, db.CivicCount);
            Assert.AreEqual(18, db.Partners.Length);
            Assert.AreEqual(40, db.Entries.Length);
            Assert.AreEqual(5, db.Crises.Length);
            Assert.AreEqual(4, db.Eras.Length);
            Assert.AreEqual(51, Array.FindAll(db.Buildings, b => !b.unityOnly).Length);
            Assert.AreEqual(4, Array.FindAll(db.Buildings, b => b.unityOnly).Length);
        }

        [Test]
        public void FootprintsAre4x4_8x8_16x16Metres()
        {
            foreach (var b in TestData.Database().Buildings)
            {
                Assert.Contains(b.footprintMeters, new[] { 4, 8, 16 }, b.id);
                Assert.AreEqual(4, b.eraModelIds.Length, b.id);
                if (b.landmark) Assert.AreEqual(16, b.footprintMeters, b.id);
            }
        }

        [Test]
        public void EveryNonStartingBuildingIsUnlockedByResearch()
        {
            var db = TestData.Database();
            foreach (var b in db.Buildings)
            {
                if (b.startingBuilding) continue;
                Assert.IsNotNull(db.ResearchById(b.unlockedBy), b.id);
            }
        }

        [Test]
        public void BilingualTextIsPresent()
        {
            var db = TestData.Database();
            foreach (var b in db.Buildings) Assert.IsTrue(b.nameMs.Length > 1 && b.nameEn.Length > 1 && b.descMs.Length > 5 && b.descEn.Length > 5, b.id);
            foreach (var r in db.Research) Assert.IsTrue(r.nameMs.Length > 1 && r.nameEn.Length > 1, r.id);
            foreach (var e in db.Entries) Assert.IsTrue(e.bodyMs.Length > 40 && e.bodyEn.Length > 40 && e.sources.Length > 0, e.id);
        }
    }

    public class GridTests
    {
        [Test]
        public void CellsAreFourMetres()
        {
            var g = new GridSpec(128, 128);
            Assert.AreEqual(512f, g.WorldWidth);
            Assert.AreEqual(1, g.FootprintCells(4));
            Assert.AreEqual(2, g.FootprintCells(8));
            Assert.AreEqual(4, g.FootprintCells(16));
            g.WorldToCell(9.9f, 4.1f, out int x, out int y);
            Assert.AreEqual(2, x);
            Assert.AreEqual(1, y);
            g.CellCenter(2, 1, out float wx, out float wz);
            Assert.AreEqual(10f, wx);
            Assert.AreEqual(6f, wz);
            g.FootprintOrigin(10, 10, 4, out int ox, out int oy);
            Assert.AreEqual(9, ox);
            Assert.AreEqual(9, oy);
        }

        [Test]
        public void LinePathIsHorizontalFirst()
        {
            var cells = new List<(int x, int y)>();
            GridPaths.LinePath(0, 0, 3, 2, cells);
            Assert.AreEqual(6, cells.Count);
            Assert.AreEqual((3, 0), cells[3]);
            Assert.AreEqual((3, 2), cells[5]);
            GridPaths.Rect(5, 5, 3, 4, cells);
            Assert.AreEqual(6, cells.Count);
        }

        [Test]
        public void RoadGraphFindsShortestPathOverRoads()
        {
            var g = new RoadGraph(10, 10);
            var road = new bool[100];
            for (int x = 0; x < 10; x++) road[5 * 10 + x] = true; // row 5
            for (int y = 0; y < 10; y++) road[y * 10 + 2] = true; // column 2
            var path = new List<int>();
            Assert.IsTrue(g.FindPath(5 * 10 + 9, 0 * 10 + 2, i => road[i], path));
            Assert.AreEqual(5 * 10 + 9, path[0]);
            Assert.AreEqual(2, path[path.Count - 1]);
            Assert.AreEqual(7 + 5 + 1, path.Count);
            Assert.IsFalse(g.FindPath(0, 99, i => road[i], path));
        }
    }

    public class CityTests
    {
        static (GameSimulation sim, int hx, int hy) NewCityWithHarbour(int seed = 42)
        {
            var sim = new GameSimulation(TestData.Database(), seed);
            int harbour = sim.Db.BuildingIndex("pelabuhan");
            for (int r = 0; r < 30; r++)
                for (int dy = -r; dy <= r; dy++)
                    for (int dx = -r; dx <= r; dx++)
                    {
                        int x = sim.Map.MouthX + dx, y = sim.Map.MouthY - 3 + dy;
                        if (sim.CheckBuilding(harbour, x, y, out _) == PlacementResult.Ok)
                        {
                            sim.PlaceBuilding(harbour, x, y, out _);
                            return (sim, x, y);
                        }
                    }
            throw new Exception("no harbour site");
        }

        [Test]
        public void HarbourNeedsTheCoastAndCostsMoney()
        {
            var sim = new GameSimulation(TestData.Database(), 42);
            int harbour = sim.Db.BuildingIndex("pelabuhan");
            // far inland in the hills: refused
            Assert.AreNotEqual(PlacementResult.Ok, sim.CheckBuilding(harbour, 100, 64, out _));
            var (s2, hx, hy) = NewCityWithHarbour();
            Assert.AreEqual(1, s2.City.Buildings.Count);
            Assert.Less(s2.Stock[ResourceType.Treasury], 12000);
            Assert.AreEqual(PlacementResult.Occupied, s2.CheckBuilding(s2.Db.BuildingIndex("pasar"), hx, hy, out _));
            Assert.AreEqual(PlacementResult.Locked, s2.CheckBuilding(s2.Db.BuildingIndex("istana"), hx + 6, hy, out _));
        }

        [Test]
        public void RoadsZonesAndGrowthProduceAPopulation()
        {
            var (sim, hx, hy) = NewCityWithHarbour();
            var path = new List<(int x, int y)>();
            GridPaths.LinePath(hx + 4, hy + 1, hx + 20, hy + 1, path);
            Assert.IsTrue(sim.BuildTransport("road", path, out double cost));
            Assert.Greater(cost, 0);
            var rect = new List<(int x, int y)>();
            GridPaths.Rect(hx + 5, hy, hx + 19, hy, rect);
            Assert.IsTrue(sim.Zone(rect, ZoneType.Residential, out _));
            GridPaths.Rect(hx + 5, hy + 2, hx + 12, hy + 2, rect);
            sim.Zone(rect, ZoneType.Commercial, out _);
            for (int t = 0; t < 80; t++) sim.Step();
            Assert.Greater(sim.Economy.Population, 0);
            Assert.IsTrue(double.IsFinite(sim.Stock[ResourceType.Treasury]));
            Assert.Greater(sim.History.Count, 5);
        }

        [Test]
        public void BulldozeRefundsSpaceAndCharges()
        {
            var (sim, hx, hy) = NewCityWithHarbour();
            var cells = new List<(int x, int y)> { (hx, hy) };
            var removed = new List<PlacedBuilding>();
            double before = sim.Stock[ResourceType.Treasury];
            sim.Bulldoze(cells, removed);
            Assert.AreEqual(1, removed.Count);
            Assert.AreEqual(0, sim.City.Buildings.Count);
            Assert.Less(sim.Stock[ResourceType.Treasury], before);
            Assert.AreEqual(-1, sim.City.BuildingAt[hy * sim.City.Grid.Width + hx]);
        }
    }

    public class ProgressionTests
    {
        [Test]
        public void ResearchCompletesAndUnlocksBuildings()
        {
            var sim = new GameSimulation(TestData.Database(), 7);
            int jawi = sim.Db.ResearchIndex("tulisan_jawi");
            Assert.IsTrue(sim.Tech.Select(jawi, 1));
            var madrasah = sim.Db.Building("madrasah");
            Assert.IsFalse(sim.Tech.IsBuildingUnlocked(madrasah, 1));
            sim.Tech.Advance(1000, 0);
            Assert.IsTrue(sim.Tech.Done[jawi]);
            Assert.IsTrue(sim.Tech.IsBuildingUnlocked(madrasah, 1));
            Assert.IsFalse(sim.Tech.Select(sim.Db.ResearchIndex("internet"), 1), "era 4 tech is locked in era 1");
        }

        [Test]
        public void EraAdvanceNeedsRequirementsUnlessForced()
        {
            var sim = new GameSimulation(TestData.Database(), 7);
            Assert.IsFalse(sim.AdvanceEra());
            int fired = 0;
            sim.Era.EraAdvanced += (a, b) => fired = b;
            Assert.IsTrue(sim.AdvanceEra(force: true));
            Assert.AreEqual(2, sim.CurrentEra);
            Assert.AreEqual(2, fired);
            Assert.GreaterOrEqual(sim.Year, 1824);
        }

        [Test]
        public void TheGreatFloodOf1926IsACrisisWithChoices()
        {
            var sim = new GameSimulation(TestData.Database(), 42);
            sim.AdvanceEra(force: true);
            sim.Year = 1926;
            sim.Step();
            Assert.AreEqual("bah_besar", sim.Events.PendingCrisis);
            Assert.IsTrue(sim.Events.View.Flood);
            sim.Stock[ResourceType.Treasury] = 10000;
            Assert.IsTrue(sim.ResolveCrisis(1));
            Assert.AreEqual(10000 - 3500, sim.Stock[ResourceType.Treasury], 1e-6);
            Assert.IsNull(sim.Events.PendingCrisis);
            Assert.AreEqual("tebatan", sim.Events.CrisisLog[0].choice);
        }

        [Test]
        public void CrisesAutoResolveAfterTheTimeout()
        {
            var sim = new GameSimulation(TestData.Database(), 42);
            sim.AdvanceEra(force: true);
            sim.Year = 1926;
            for (int i = 0; i <= GameEventSystem.CrisisTimeout + 1; i++) sim.Step();
            Assert.IsNull(sim.Events.PendingCrisis);
            Assert.AreEqual("biarkan", sim.Events.CrisisLog[0].choice);
        }

        [Test]
        public void AdvisorsGrantTheirBuffAndRetire()
        {
            var sim = new GameSimulation(TestData.Database(), 3);
            double tax0 = sim.Effects.Tax;
            Assert.IsTrue(sim.RecruitAdvisor("tun_perak"));
            Assert.AreEqual(tax0 + 0.1, sim.Effects.Tax, 1e-9);
            Assert.IsFalse(sim.RecruitAdvisor("tun_sri_lanang"), "one seat in era 1");
            sim.AdvanceEra(force: true);
            Assert.AreEqual(0, sim.Advisors.Count, "Tun Perak serves only in era 1");
        }

        [Test]
        public void ScenarioJumpStartsTheTinRush()
        {
            var sim = new GameSimulation(TestData.Database(), 5);
            sim.ApplyScenario("larut_1875");
            Assert.AreEqual(2, sim.CurrentEra);
            Assert.AreEqual(1875, sim.Year);
            Assert.IsTrue(sim.Tech.IsDone("tulisan_jawi"));
        }
    }

    public class EconomyTests
    {
        [Test]
        public void InfrastructureUpkeepOnlyAppliesInEras3And4()
        {
            var sim = new GameSimulation(TestData.QuietDatabase(), 42);
            int pasar = sim.Db.BuildingIndex("pasar");
            sim.City.Restore(500, pasar, 60, 60, 2, 0, 0);
            sim.Step();
            Assert.AreEqual(0, sim.Economy.Budget.infrastructure);
            sim.AdvanceEra(true);
            sim.AdvanceEra(true);
            sim.Step();
            Assert.Greater(sim.Economy.Budget.infrastructure, 0);
        }

        [Test]
        public void SoakStaysNumericallySane()
        {
            var sim = new GameSimulation(TestData.Database(), 2024);
            int harbour = sim.Db.BuildingIndex("pelabuhan");
            int hx = -1, hy = -1;
            for (int r = 0; r < 30 && hx < 0; r++)
                for (int dy = -r; dy <= r && hx < 0; dy++)
                    for (int dx = -r; dx <= r && hx < 0; dx++)
                        if (sim.CheckBuilding(harbour, sim.Map.MouthX + dx, sim.Map.MouthY - 3 + dy, out _) == PlacementResult.Ok) { hx = sim.Map.MouthX + dx; hy = sim.Map.MouthY - 3 + dy; }
            sim.PlaceBuilding(harbour, hx, hy, out _);
            var cells = new List<(int x, int y)>();
            for (int row = 0; row < 4; row++)
            {
                GridPaths.LinePath(hx + 3, hy + 1 + row * 4, hx + 24, hy + 1 + row * 4, cells);
                sim.BuildTransport("road", cells, out _);
                GridPaths.Rect(hx + 4, hy + row * 4, hx + 23, hy + row * 4, cells);
                sim.Zone(cells, row % 3 == 0 ? ZoneType.Commercial : row % 3 == 1 ? ZoneType.Residential : ZoneType.Industrial, out _);
                GridPaths.Rect(hx + 4, hy + 2 + row * 4, hx + 23, hy + 2 + row * 4, cells);
                sim.Zone(cells, ZoneType.Residential, out _);
            }
            int sawah = sim.Db.BuildingIndex("sawah");
            for (int k = 0; k < 4; k++)
                for (int r = 2; r < 30; r++)
                {
                    bool placed = false;
                    for (int d = -r; d <= r && !placed; d++)
                        if (sim.CheckBuilding(sawah, hx + 10 + d, hy + 18 + r, out _) == PlacementResult.Ok) placed = sim.PlaceBuilding(sawah, hx + 10 + d, hy + 18 + r, out _) != null;
                    if (placed) break;
                }
            for (int t = 0; t < 650; t++)
            {
                if (sim.Events.PendingCrisis != null) sim.ResolveCrisis(0);
                if (sim.Tech.CurrentTech < 0)
                    for (int i = 0; i < sim.Db.Research.Length; i++) if (sim.Db.Research[i].IsTech && sim.Tech.Select(i, sim.CurrentEra)) break;
                if (sim.Tech.CurrentCivic < 0)
                    for (int i = 0; i < sim.Db.Research.Length; i++) if (!sim.Db.Research[i].IsTech && sim.Tech.Select(i, sim.CurrentEra)) break;
                if (t == 200 || t == 400 || t == 550) sim.AdvanceEra(force: true);
                sim.Step();
                if (t % 25 == 0)
                {
                    for (int r = 0; r < ResourceInfo.Count; r++) Assert.IsTrue(double.IsFinite(sim.Stock.amounts[r]), ((ResourceType)r).ToString());
                    for (int r = (int)ResourceType.Food; r <= (int)ResourceType.Digital; r++) Assert.GreaterOrEqual(sim.Stock.amounts[r], 0);
                    Assert.That(sim.Economy.Happiness, Is.InRange(0, 100));
                }
            }
            Assert.AreEqual(4, sim.CurrentEra);
            Assert.Greater(sim.Economy.Population, 300);
            Assert.Greater(sim.History.Count, 100);
        }
    }

    public class SaveAndMusicTests
    {
        [Test]
        public void SaveCaptureAndRestoreRoundTrips()
        {
            var sim = new GameSimulation(TestData.Database(), 42);
            var harbour = sim.Db.BuildingIndex("pelabuhan");
            for (int x = 10; x < 60 && sim.City.Buildings.Count == 0; x++)
                for (int y = 10; y < 120 && sim.City.Buildings.Count == 0; y++)
                    if (sim.CheckBuilding(harbour, x, y, out _) == PlacementResult.Ok) sim.PlaceBuilding(harbour, x, y, out _);
            var b = sim.City.Buildings[0];
            var path = new List<(int x, int y)>();
            GridPaths.LinePath(b.x + 3, b.y, b.x + 12, b.y, path);
            sim.BuildTransport("road", path, out _);
            for (int t = 0; t < 30; t++) sim.Step();
            var save = SaveCodec.Capture(sim, "Kota Ujian", 42);
            var back = SaveCodec.Restore(TestData.Database(), save);
            Assert.AreEqual(sim.Tick, back.Tick);
            Assert.AreEqual(sim.Year, back.Year);
            Assert.AreEqual(sim.CurrentEra, back.CurrentEra);
            Assert.AreEqual(sim.City.Buildings.Count, back.City.Buildings.Count);
            Assert.AreEqual(sim.Stock[ResourceType.Treasury], back.Stock[ResourceType.Treasury], 1e-9);
            CollectionAssert.AreEqual(sim.City.Transport, back.City.Transport);
            CollectionAssert.AreEqual(sim.City.Zone, back.City.Zone);
            Assert.Throws<FormatException>(() => SaveCodec.Restore(TestData.Database(), new SaveGame { format = "something-else" }));
        }

        [Test]
        public void MusicRendersFiniteLoopsForEveryEra()
        {
            for (int era = 1; era <= 4; era++)
            {
                var buf = ProceduralMusic.RenderLoop(era, 2, 8000, 3);
                Assert.Greater(buf.Length, 8000);
                float peak = 0;
                foreach (var v in buf) { Assert.IsFalse(float.IsNaN(v)); peak = Math.Max(peak, Math.Abs(v)); }
                Assert.Greater(peak, 0.01f);
                Assert.LessOrEqual(peak, 1f);
            }
            var amb = ProceduralMusic.RenderAmbience(false, 4, 8000);
            Assert.AreEqual(32000, amb.Length);
        }

        [Test]
        public void GongClosesEveryGongan()
        {
            for (int bar = 0; bar < 12; bar++)
            {
                bool gong = false;
                foreach (var e in ProceduralMusic.ComposeBar(2, bar, 9)) if (e.inst == Instrument.Gong) gong = true;
                Assert.AreEqual(bar % 4 == 0, gong, "bar " + bar);
            }
        }
    }
}
