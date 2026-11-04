// .NET-only checks (GC.GetAllocatedBytesForCurrentThread is not used inside Unity tests).
using System;
using System.Collections.Generic;
using NUnit.Framework;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    public class AllocationTests
    {
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
