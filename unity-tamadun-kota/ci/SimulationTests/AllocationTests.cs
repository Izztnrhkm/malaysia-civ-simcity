// .NET-only checks (GC.GetAllocatedBytesForCurrentThread is not used inside Unity tests).
using System;
using System.Collections.Generic;
using NUnit.Framework;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    public class AllocationTests
    {
        [TestCase(1)] [TestCase(2)] [TestCase(3)] [TestCase(4)]
        public void DiplomacyEnvironmentAndMilestoneTicksDoNotAllocate(int era)
        {
            var sim = RulesParityTests.Flat(32);
            sim.Era.Restore(era); sim.Diplomacy.EnsurePartners();
            sim.Stock[ResourceType.Treasury] = 1000000;
            foreach (var p in sim.Diplomacy.Partners) if (p.Active) sim.Relations[p.Id] = 60;
            foreach (var good in ResourceInfo.GoodIds) sim.Economy.Production[ResourceInfo.FromGood(good)] = 10;
            sim.Diplomacy.CaptureProduction();
            // Warm up every path, then measure offer creation as well as steady-state drift.
            for (int t = 0; t < 300; t++) { sim.Tick = t; sim.Diplomacy.Tick(); sim.Environment.Compute(sim.City, era, sim.Effects); sim.Milestones.Check(); }
            long before = GC.GetAllocatedBytesForCurrentThread();
            for (int t = 300; t < 900; t++) { sim.Tick = t; sim.Diplomacy.Tick(); sim.Environment.Compute(sim.City, era, sim.Effects); sim.Milestones.Check(); }
            long allocated = GC.GetAllocatedBytesForCurrentThread() - before;
            Assert.AreEqual(0, allocated, "all rules buffers must be reused");
        }

        [Test]
        public void FullTicksWithAContractAndResearchExchangeDoNotAllocate()
        {
            var sim = RulesParityTests.Flat(32);
            sim.Relations["ming"] = 60;
            sim.ToggleExchange("ming"); sim.ProposeDeal("ming", "rempah", 2, 1000);
            for (int t = 0; t < 50; t++) sim.Step();
            long before = GC.GetAllocatedBytesForCurrentThread();
            for (int t = 0; t < 100; t++) sim.Step();
            long allocated = GC.GetAllocatedBytesForCurrentThread() - before;
            Assert.AreEqual(0, allocated);
        }

        [Test]
        public void EconomyTicksDoNotAllocate()
        {
            // no random/historical events: they legitimately allocate notices when they fire
            var sim = new GameSimulation(TestData.QuietDatabase(), 42);
            int pasar = sim.Db.BuildingIndex("pasar");
            sim.City.Restore(900, pasar, 40, 60, 2, 0, 0);
            var cells = new List<(int x, int y)>();
            GridPaths.LinePath(30, 63, 60, 63, cells);
            sim.City.BuildTransport(sim.TransportByKey("road"), cells, 1);
            GridPaths.Rect(31, 62, 59, 62, cells);
            sim.City.ApplyZone(cells, ZoneType.Residential);
            for (int t = 0; t < 30; t++) sim.Step(); // warm up (JIT, dictionaries, history list)
            long before = GC.GetAllocatedBytesForCurrentThread();
            for (int t = 0; t < 5; t++) sim.Step();
            long perTick = (GC.GetAllocatedBytesForCurrentThread() - before) / 5;
            Assert.AreEqual(0, perTick, "bytes allocated per simulation tick");
        }
    }
}
