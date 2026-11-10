using System;
using NUnit.Framework;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    public class StateLeaderTests
    {
        static GameSimulation Selected(string state = "melaka")
        {
            var db = TestData.QuietDatabase();
            var record = db.StateById(state);
            return new GameSimulation(db, new GameSetup { stateId = state, leaderId = record.leaderId, mapId = record.mapId },
                MapGenerator.Generate(32, 32, 42));
        }

        [Test]
        public void AllThirteenStatesHaveDistinctLeadersAndBilingualProfiles()
        {
            var db = TestData.Database();
            Assert.AreEqual(13, db.States.Length); Assert.AreEqual(13, db.Leaders.Length);
            var ids = new System.Collections.Generic.HashSet<string>();
            foreach (var state in db.States)
            {
                var leader = db.LeaderById(state.leaderId);
                Assert.IsNotNull(leader, state.id); Assert.IsTrue(ids.Add(leader.id));
                foreach (var text in new[] { state.nameMs, state.nameEn, state.abilityMs, state.abilityEn,
                    leader.name, leader.bioMs, leader.bioEn, leader.abilityMs, leader.abilityEn, leader.modelResource, leader.portraitResource })
                    Assert.IsFalse(string.IsNullOrWhiteSpace(text), state.id);
                Assert.IsNotEmpty(leader.sources);
            }
        }

        [TestCase("johor", .08, 0, 0, -.10)]
        [TestCase("melaka", 0, .15, 0, 0)]
        [TestCase("perak", 0, 0, .08, 0)]
        public void StateAndLeaderEffectsArePermanentAndDoNotAccumulate(string state, double production, double exports, double price, double construction)
        {
            var sim = Selected(state);
            for (int i = 0; i < 4; i++)
            {
                sim.RefreshEffects();
                Assert.AreEqual(production, sim.Effects.ProductionAll, 1e-12);
                Assert.AreEqual(exports, sim.Effects.ExportCap, 1e-12);
                Assert.AreEqual(price, sim.Effects.ExportPrice, 1e-12);
                Assert.AreEqual(construction, sim.Effects.Construction, 1e-12);
            }
            sim.AdvanceEra(true); sim.AdvanceEra(true); sim.AdvanceEra(true);
            Assert.AreEqual(state, sim.State.id); Assert.AreEqual(construction, sim.Effects.Construction, 1e-12);
            Assert.IsEmpty(sim.Advisors);
        }

        [Test]
        public void ChosenLeaderCannotBeRecruitedAsAnAdvisor()
        {
            var sim = Selected();
            Assert.AreEqual("err.invalid", sim.CanRecruitAdvisor("tun_perak").Reason);
            Assert.IsFalse(sim.RecruitAdvisor("tun_perak"));
            Assert.AreEqual(.15, sim.Effects.RelationGain, 1e-12);
            var setup = sim.Setup; setup.stateId = "johor";
            Assert.AreEqual("melaka", sim.Setup.stateId, "setup cannot be changed after construction");
        }

        [Test]
        public void AllApprovedBonusesMatchTheStateRoster()
        {
            var johor = Selected("johor"); Assert.AreEqual(.08, johor.Effects.ProductionAll); Assert.AreEqual(-.10, johor.Effects.Construction);
            var kedah = Selected("kedah"); Assert.AreEqual(.20, kedah.Effects.Production[(int)ResourceType.Food]); Assert.AreEqual(.10, kedah.Effects.Research);
            var kelantan = Selected("kelantan"); Assert.AreEqual(.10, kelantan.Effects.Culture); Assert.AreEqual(4, kelantan.Effects.Happiness);
            var melaka = Selected("melaka"); Assert.AreEqual(.15, melaka.Effects.ExportCap); Assert.AreEqual(.15, melaka.Effects.RelationGain);
            var n9 = Selected("negeri_sembilan"); Assert.AreEqual(-.08, n9.Effects.Upkeep); Assert.AreEqual(.10, n9.Effects.Culture); Assert.AreEqual(2, n9.Effects.Happiness);
            var pahang = Selected("pahang"); Assert.AreEqual(.15, pahang.Effects.Production[(int)ResourceType.Timber]); Assert.AreEqual(.10, pahang.Effects.ResidentialGrowth); Assert.AreEqual(0, pahang.Effects.Growth);
            var perak = Selected("perak"); Assert.AreEqual(.20, perak.Effects.Production[(int)ResourceType.Tin]); Assert.AreEqual(.08, perak.Effects.ExportPrice);
            var perlis = Selected("perlis"); Assert.AreEqual(.10, perlis.Effects.Production[(int)ResourceType.Food]); Assert.AreEqual(.15, perlis.Effects.Culture); Assert.AreEqual(2, perlis.Effects.Happiness);
            var pinang = Selected("pulau_pinang"); Assert.AreEqual(.10, pinang.Effects.Research); Assert.AreEqual(.20, pinang.Effects.Production[(int)ResourceType.Electronics]);
            var sabah = Selected("sabah"); Assert.AreEqual(.15, sabah.Effects.Production[(int)ResourceType.Fish]); Assert.AreEqual(.10, sabah.Effects.Tax);
            var sarawak = Selected("sarawak"); Assert.AreEqual(.10, sarawak.Effects.Production[(int)ResourceType.Timber]); Assert.AreEqual(.05, sarawak.Effects.Culture); Assert.AreEqual(.15, sarawak.Effects.ExportCap);
            var selangor = Selected("selangor"); Assert.AreEqual(.10, selangor.Effects.Tax); Assert.AreEqual(.10, selangor.Effects.Growth); Assert.AreEqual(-.05, selangor.Effects.Construction);
            var terengganu = Selected("terengganu"); Assert.AreEqual(.10, terengganu.Effects.Production[(int)ResourceType.Fish]); Assert.AreEqual(.20, terengganu.Effects.Culture, 1e-12); Assert.AreEqual(.05, terengganu.Effects.Research);
        }

        [Test]
        public void LeaderBonusesStackWithResearchAndPoliciesWithoutReplacingThem()
        {
            var sim = Selected("johor");
            sim.Tech.Done[sim.Db.ResearchIndex("gotong_royong")] = true;
            Assert.IsTrue(sim.AdoptPolicy("gotong_royong").Ok);
            var baseline = new EffectTotals(); sim.Tech.ApplyEffects(baseline);
            foreach (var policy in sim.Db.Policies) if (sim.Policies.Contains(policy.id)) baseline.Add(policy.effects);
            sim.RefreshEffects();
            Assert.AreEqual(baseline.ProductionAll + .08, sim.Effects.ProductionAll, 1e-12);
            Assert.AreEqual(Math.Max(.3, 1 + baseline.Construction - .10), sim.Effects.ConstructionMult, 1e-12);
        }

        [TestCase(ZoneType.Residential)] [TestCase(ZoneType.Commercial)] [TestCase(ZoneType.Industrial)]
        public void ResidentialGrowthDoesNotChangeOtherZoneProbabilities(ZoneType zone)
        {
            var a = RulesParityTests.Flat(32); var b = RulesParityTests.Flat(32);
            foreach (var sim in new[] { a, b })
            {
                sim.Economy.DemandR = sim.Economy.DemandC = sim.Economy.DemandI = 100;
                for (int i = 0; i < sim.City.Zone.Length; i++)
                { sim.City.Zone[i] = (byte)zone; sim.City.Access[i] = 1; sim.City.LandValue[i] = 255; }
            }
            a.Economy.GrowZones(a.City, 1, 2, new Rng(42), 0, false);
            b.Economy.GrowZones(b.City, 1, 2, new Rng(42), 0, false, .10);
            if (zone != ZoneType.Residential) CollectionAssert.AreEqual(a.City.Density, b.City.Density);
            else
            {
                int first = 0, second = 0;
                foreach (byte d in a.City.Density) first += d;
                foreach (byte d in b.City.Density) second += d;
                Assert.Greater(second, first);
            }
        }

        [Test]
        public void MismatchedPairingsFailBeforeStarting()
        {
            var db = TestData.Database();
            Assert.Throws<ArgumentException>(() => new GameSimulation(db, new GameSetup { leaderId = "rentap" }, MapGenerator.Generate(32, 32, 1)));
            Assert.Throws<ArgumentException>(() => new GameSimulation(db, new GameSetup { stateId = "missing" }, MapGenerator.Generate(32, 32, 1)));
        }

        [Test]
        public void VersionThreeSavesStoreIdentityAndExactTerrainWithoutTheMapAsset()
        {
            var sim = Selected("kedah"); sim.Map.Terrain[100] = (byte)TerrainType.Plain;
            sim.Map.Elevation[100] = 130; sim.Map.Fertility[100] = 201; sim.Map.Tin[100] = 91;
            var save = SaveCodec.Capture(sim, "Kota", 42);
            Assert.AreEqual(3, save.version); Assert.AreEqual("kedah", save.setup.stateId);
            var restored = SaveCodec.Restore(sim.Db, save);
            CollectionAssert.AreEqual(sim.Map.Terrain, restored.Map.Terrain);
            CollectionAssert.AreEqual(sim.Map.Elevation, restored.Map.Elevation);
            CollectionAssert.AreEqual(sim.Map.Fertility, restored.Map.Fertility);
            CollectionAssert.AreEqual(sim.Map.Tin, restored.Map.Tin);
            Assert.AreEqual("sultan_abdul_hamid", restored.Leader.id);
            Assert.AreEqual(.20, restored.Effects.Production[(int)ResourceType.Food], 1e-12);
            Assert.AreEqual(.10, restored.Effects.Research, 1e-12);
        }

        [TestCase(1)] [TestCase(2)]
        public void LegacySavesRemainNeutralAndKeepTheirProceduralMap(int version)
        {
            var original = new GameSimulation(TestData.QuietDatabase(), 42, 32);
            var save = SaveCodec.Capture(original, "Legacy", 42); save.version = version; save.setup = null; save.map = null;
            var restored = SaveCodec.Restore(original.Db, save);
            Assert.IsNull(restored.State); Assert.IsNull(restored.Leader);
            Assert.AreEqual(original.Map.Fingerprint(), restored.Map.Fingerprint());
            Assert.AreEqual(0, restored.Effects.ExportCap);
        }

        [Test]
        public void DamagedTerrainSnapshotsAreRejected()
        {
            var sim = Selected(); var save = SaveCodec.Capture(sim, "Kota", 42);
            save.map.terrain = "AA==";
            Assert.Throws<FormatException>(() => SaveCodec.Restore(sim.Db, save));
        }

        [Test]
        public void SetupAndSaveMetadataUseOneAuthoritativeSeedAndScenario()
        {
            var sim = Selected(); var save = SaveCodec.Capture(sim, "Kota", 12345);
            Assert.AreEqual(sim.Map.Seed, save.seed);
            save.setup.seed++;
            Assert.Throws<FormatException>(() => SaveCodec.Restore(sim.Db, save));
            save = SaveCodec.Capture(sim, "Kota", 42); save.setup.scenarioId = "msc_1996";
            Assert.Throws<FormatException>(() => SaveCodec.Restore(sim.Db, save));
            Assert.Throws<ArgumentException>(() => new GameSimulation(sim.Db, new GameSetup(), MapGenerator.Generate(32, 32, 9)));
        }
    }
}
