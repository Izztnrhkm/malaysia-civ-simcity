using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using TamadunKota.Core;
using TamadunKota.Data;
using TamadunKota.Simulation;
using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;

namespace TamadunKota.Tests
{
    /// <summary>
    /// Loads the real MainGame scene and plays it: builds a small city through the simulation,
    /// runs 2,000 ticks through TimeManager (so every tick subscriber runs: economy, views,
    /// traffic, HUD), forces the three era changes through EraManager and does a save/load
    /// round trip. Any exception or Debug.LogError in any component fails the test.
    ///
    /// Headless: Unity -batchmode -projectPath . -runTests -testPlatform PlayMode
    ///   -testResults results.xml
    /// </summary>
    public class MainGameSmokeTests
    {
        const string SceneName = "MainGame";
        const int TestSlot = 3;
        const int TotalTicks = 2000;
        const int TicksPerFrame = 10;

        string slotPath;
        byte[] slotBackup;

        [UnitySetUp]
        public IEnumerator LoadScene()
        {
            SceneManager.LoadScene(SceneName, LoadSceneMode.Single);
            yield return null;
            yield return null;
        }

        [TearDown]
        public void RestoreSlot()
        {
            if (slotPath == null) return;
            if (slotBackup != null) File.WriteAllBytes(slotPath, slotBackup);
            else if (File.Exists(slotPath)) File.Delete(slotPath);
            slotPath = null;
            slotBackup = null;
        }

        [Test]
        public void SceneHasEveryManagerWired()
        {
            Assert.IsNotNull(GameRoot.Instance, "GameRoot");
            Assert.IsNotNull(GameRoot.Instance.Sim, "GameRoot.Sim");
            Assert.IsNotNull(GameRoot.Instance.catalog, "GameRoot.catalog");
            Assert.IsNotNull(Object.FindAnyObjectByType<TimeManager>(), "TimeManager");
            Assert.IsNotNull(Object.FindAnyObjectByType<EconomyManager>(), "EconomyManager");
            Assert.IsNotNull(Object.FindAnyObjectByType<CityView>(), "CityView");
            Assert.IsNotNull(Object.FindAnyObjectByType<EraManager>(), "EraManager");
            Assert.IsNotNull(Object.FindAnyObjectByType<SaveLoadManager>(), "SaveLoadManager");
            Assert.IsNotNull(Object.FindAnyObjectByType<UIManager>(), "UIManager");
            Assert.IsNotNull(Object.FindAnyObjectByType<GridPlacementSystem>(), "GridPlacementSystem");
            Assert.IsNotNull(Camera.main, "main camera");
        }

        [UnityTest]
        public IEnumerator CityGrowsThroughAllErasAndSurvivesSaveLoad()
        {
            var root = GameRoot.Instance;
            var time = Object.FindAnyObjectByType<TimeManager>();
            var economy = Object.FindAnyObjectByType<EconomyManager>();
            var cityView = Object.FindAnyObjectByType<CityView>();
            var eras = Object.FindAnyObjectByType<EraManager>();
            var save = Object.FindAnyObjectByType<SaveLoadManager>();

            // Only Advance() drives the clock, and the test never writes the player's autosave.
            time.SetSpeed(0);
            save.autosaveEveryTicks = 0;

            var sim = root.Sim;
            int startTick = sim.Tick; // the clock may tick during the scene's first, long frame
            BuildStarterCity(sim);
            yield return null;
            Assert.Greater(cityView.AllViews().Count(), 0, "CityView spawned no building views");

            int eraEvents = 0;
            eras.OnEraAdvanced += _ => eraEvents++;
            double populationAt200 = -1, peakPopulation = 0;

            for (int tick = 0; tick < TotalTicks; tick += TicksPerFrame)
            {
                if (sim.Events.PendingCrisis != null) sim.ResolveCrisis(0);
                PickResearch(sim);
                if (tick == 500 || tick == 1000 || tick == 1500) Assert.IsTrue(eras.TryAdvance(force: true), "era advance at tick " + tick);
                time.Advance(TicksPerFrame);
                yield return null;

                double pop = economy.Current.population;
                Assert.IsTrue(double.IsFinite(pop) && double.IsFinite(economy.Current.treasury), "non-finite economy at tick " + tick);
                if (tick == 200) populationAt200 = pop;
                peakPopulation = System.Math.Max(peakPopulation, pop);
            }

            Assert.AreEqual(startTick + TotalTicks, sim.Tick, "simulation ticks");
            Assert.AreEqual(4, sim.CurrentEra, "final era");
            Assert.AreEqual(3, eraEvents, "EraManager.OnEraAdvanced count");
            Assert.AreEqual(sim.Year, economy.Current.year, "HUD snapshot year");
            Assert.Greater(populationAt200, 0, "population after 200 ticks");
            Assert.Greater(peakPopulation, populationAt200, "population did not grow after tick 200");

            // Save and load through SaveLoadManager, keeping whatever the player had in the slot.
            slotPath = save.PathFor(TestSlot);
            slotBackup = File.Exists(slotPath) ? File.ReadAllBytes(slotPath) : null;
            int buildings = sim.City.Buildings.Count;
            int year = sim.Year;
            Assert.IsTrue(save.Save(TestSlot), "save");
            Assert.IsTrue(save.Load(TestSlot), "load");
            yield return null;
            yield return null;

            var loaded = root.Sim;
            Assert.AreNotSame(sim, loaded, "load did not replace the simulation");
            Assert.AreEqual(buildings, loaded.City.Buildings.Count, "buildings after load");
            Assert.AreEqual(year, loaded.Year, "year after load");
            Assert.AreEqual(4, loaded.CurrentEra, "era after load");
            Assert.Greater(cityView.AllViews().Count(), 0, "CityView did not rebuild after load");

            time.Advance(50);
            yield return null;
            Assert.AreEqual(startTick + TotalTicks + 50, loaded.Tick, "ticks after load");
        }

        /// <summary>
        /// The 5,000-building stress city: builds, every building and lot gets a view, the clock keeps
        /// ticking, and a short PerfProbe run reports frame times (headless numbers are CPU-side only;
        /// use the menu item in the Editor for real rendering numbers).
        /// </summary>
        [UnityTest]
        public IEnumerator StressCityOfFiveThousandBuildingsRuns()
        {
            var root = GameRoot.Instance;
            var time = Object.FindAnyObjectByType<TimeManager>();
            var cityView = Object.FindAnyObjectByType<CityView>();
            Object.FindAnyObjectByType<SaveLoadManager>().autosaveEveryTicks = 0;
            time.SetSpeed(0);

            var sw = System.Diagnostics.Stopwatch.StartNew();
            var result = StressCity.Build(root.Sim, 5000);
            long buildMs = sw.ElapsedMilliseconds;
            Assert.GreaterOrEqual(result.Total, 5000, result.ToString());
            Assert.AreEqual(4, root.Sim.CurrentEra);

            sw.Restart();
            yield return null;
            long syncMs = sw.ElapsedMilliseconds;
            int views = cityView.AllViews().Count();
            Assert.GreaterOrEqual(views, result.Total * 95 / 100, "CityView views for " + result);

            sw.Restart();
            var perFrame = new System.Text.StringBuilder();
            var part = new System.Diagnostics.Stopwatch();
            for (int f = 0; f < 10; f++)
            {
                part.Restart();
                time.Advance(6);
                double advanceMs = part.Elapsed.TotalMilliseconds;
                part.Restart();
                yield return null;
                perFrame.Append($" [{advanceMs:0}+{part.Elapsed.TotalMilliseconds:0}]");
            }
            long tickMs = sw.ElapsedMilliseconds;

            // Break the tick cost down: the rules engine alone, then one full CityView re-sync.
            sw.Restart();
            for (int t = 0; t < 30; t++) root.Sim.Step();
            double simStepMs = sw.Elapsed.TotalMilliseconds / 30;
            yield return null;
            var frame = System.Diagnostics.Stopwatch.StartNew();
            cityView.ForceSync();
            yield return null;
            double resyncFrameMs = frame.Elapsed.TotalMilliseconds;
            frame.Restart();
            yield return null;
            double quietFrameMs = frame.Elapsed.TotalMilliseconds;

            var probe = root.gameObject.AddComponent<PerfProbe>();
            probe.label = "stress5000_headless";
            probe.warmupSeconds = 1f;
            probe.sampleSeconds = 3f;
            probe.context = $"City: {result}; views {views}; build {buildMs} ms, first sync {syncMs} ms, 60 ticks over 10 frames {tickMs} ms\n" +
                            $"Sim.Step alone {simStepMs:0.0} ms/tick; frame with a full CityView re-sync {resyncFrameMs:0.0} ms; quiet frame {quietFrameMs:0.0} ms\n" +
                            $"Per frame [6 ticks ms + frame ms]:{perFrame}";
            while (probe != null) yield return null;
        }

        /// <summary>Harbour at the river mouth, four rows of road and zones, four rice fields (as the EditMode soak test).</summary>
        static void BuildStarterCity(GameSimulation sim)
        {
            int harbour = sim.Db.BuildingIndex("pelabuhan");
            int hx = -1, hy = -1;
            for (int r = 0; r < 30 && hx < 0; r++)
                for (int dy = -r; dy <= r && hx < 0; dy++)
                    for (int dx = -r; dx <= r && hx < 0; dx++)
                        if (sim.CheckBuilding(harbour, sim.Map.MouthX + dx, sim.Map.MouthY - 3 + dy, out _) == PlacementResult.Ok)
                        {
                            hx = sim.Map.MouthX + dx;
                            hy = sim.Map.MouthY - 3 + dy;
                        }
            Assert.GreaterOrEqual(hx, 0, "no harbour site near the river mouth");
            Assert.IsNotNull(sim.PlaceBuilding(harbour, hx, hy, out _), "harbour");

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
                        if (sim.CheckBuilding(sawah, hx + 10 + d, hy + 18 + r, out _) == PlacementResult.Ok)
                            placed = sim.PlaceBuilding(sawah, hx + 10 + d, hy + 18 + r, out _) != null;
                    if (placed) break;
                }
        }

        static void PickResearch(GameSimulation sim)
        {
            if (sim.Tech.CurrentTech < 0)
                for (int i = 0; i < sim.Db.Research.Length; i++)
                    if (sim.Db.Research[i].IsTech && sim.Tech.Select(i, sim.CurrentEra)) break;
            if (sim.Tech.CurrentCivic < 0)
                for (int i = 0; i < sim.Db.Research.Length; i++)
                    if (!sim.Db.Research[i].IsTech && sim.Tech.Select(i, sim.CurrentEra)) break;
        }
    }
}
