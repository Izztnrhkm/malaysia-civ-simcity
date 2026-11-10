using System;
using System.Collections.Generic;
using NUnit.Framework;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    public class RulesParityTests
    {
        internal static GameSimulation Flat(int size = 16)
        {
            var sim = new GameSimulation(TestData.QuietDatabase(), 42, size);
            for (int i = 0; i < sim.Map.Terrain.Length; i++)
            { sim.Map.Terrain[i] = 6; sim.Map.Elevation[i] = 120; sim.Map.Fertility[i] = 160; sim.Map.Tin[i] = 100; }
            EnvironmentModel.ComputeWaterDistance(sim.City);
            sim.City.RecomputeAccess();
            return sim;
        }

        internal static void Building(GameSimulation sim, string id, int x, int y, double efficiency = 1)
        {
            int index = sim.Db.BuildingIndex(id);
            Assert.GreaterOrEqual(index, 0, id);
            sim.City.Restore(sim.City.NextId, index, x, y, sim.City.Grid.FootprintCells(sim.Db.Buildings[index].footprintMeters), 0, 0).efficiency = efficiency;
        }

        static void Equal(double[] expected, byte[] actual)
        { Assert.AreEqual(expected.Length, actual.Length); for (int i = 0; i < actual.Length; i++) Assert.AreEqual(expected[i], actual[i], "tile " + i); }

        static void Equal(double[] expected, double[] actual, double tolerance = 1e-10)
        { Assert.AreEqual(expected.Length, actual.Length); for (int i = 0; i < actual.Length; i++) Assert.AreEqual(expected[i], actual[i], tolerance, "value " + i); }

        [Test]
        public void MultimodalTransportMatchesTypeScript()
        {
            var sim = Flat(); var city = sim.City;
            for (int y = 0; y < 16; y++) sim.Map.Terrain[y * 16] = 5;
            for (int x = 1; x < 13; x++) city.Transport[4 * 16 + x] = (byte)(x < 7 ? 1 : 3);
            for (int x = 1; x < 15; x++) city.Transport[8 * 16 + x] = 2;
            for (int x = 1; x < 15; x++) city.Transport[11 * 16 + x] = 4;
            city.Transport[255] = 2;
            Building(sim, "pelabuhan", 0, 3); Building(sim, "jeti", 6, 8); Building(sim, "pasar", 9, 10);
            city.RecomputeAccess();
            Equal(RulesRegression.Modes, city.Network.Modes); Equal(RulesRegression.Access, city.Access); Equal(RulesRegression.Delivery, city.Network.Cost);
        }

        [Test]
        public void EnvironmentLayersAndHappinessMatchTypeScript()
        {
            var sim = Flat(); var city = sim.City;
            sim.Era.Restore(3);
            for (int y = 0; y < 16; y++) sim.Map.Terrain[y * 16] = 5;
            sim.Map.Terrain[22] = 8; sim.Map.Terrain[24] = 4;
            for (int i = 32; i < 64; i++) { city.Zone[i] = (byte)(i % 3 + 1); city.Density[i] = (byte)(i % 4 + 1); }
            for (int x = 0; x < 16; x++) city.Transport[4 * 16 + x] = 3;
            Building(sim, "masjid", 2, 6, 0); Building(sim, "surau", 5, 7, 0.2);
            Building(sim, "pasar", 8, 9, 0.6); Building(sim, "relau_besi", 5, 3, 0.75); Building(sim, RulesRegression.Cleaner, 10, 2);
            sim.Effects.Pollution = -0.2;
            city.RecomputeAccess(); EnvironmentModel.ComputeWaterDistance(city);
            sim.Environment.Compute(city, 3, sim.Effects);
            Equal(RulesRegression.Coverage, city.Coverage); Equal(RulesRegression.Pollution, city.Pollution); Equal(RulesRegression.LandValue, city.LandValue);
            Assert.AreEqual(RulesRegression.AverageLandValue, sim.Environment.AverageLandValue, 1e-10);
            sim.Economy.FoodSatisfaction = 0.85; sim.Economy.Unemployment = 0.12;
            sim.Economy.PowerRatio = 0.8; sim.Economy.WaterRatio = 0.95; sim.Economy.BuildingHappiness = 8;
            Assert.AreEqual(RulesRegression.HappinessTarget, sim.Economy.ComputeHappinessTarget(city, 3, sim.Effects, sim.Events.View, 9, 9, 9), 1e-10);
        }

        [TestCase(1)] [TestCase(2)] [TestCase(3)] [TestCase(4)]
        public void ZoneGrowthMatchesTypeScriptIncludingRngAndStyle(int era)
        {
            var sim = Flat(); var city = sim.City; var rng = new Rng(12345);
            sim.Economy.DemandR = 90; sim.Economy.DemandC = 70; sim.Economy.DemandI = -65;
            sim.Economy.PowerRatio = era == 4 ? 0.8 : 1; sim.Economy.WaterRatio = 1;
            for (int i = 0; i < 256; i++)
            {
                city.Zone[i] = (byte)(i % 4); city.Density[i] = (byte)(i % 5); city.Style[i] = 1;
                city.Access[i] = (byte)(i % 7 == 0 ? 0 : 1); city.LandValue[i] = (byte)i;
                city.Pollution[i] = (byte)((i * 17) % 256); sim.Map.Elevation[i] = (byte)(i % 2 != 0 ? 80 : 120); city.WaterDistance[i] = (byte)(i % 5);
            }
            for (int t = 0; t < 80; t++) sim.Economy.GrowZones(city, era, sim.Db.Era(era).maxDensity, rng, 0.2, true);
            var densities = new[] { RulesRegression.Growth1, RulesRegression.Growth2, RulesRegression.Growth3, RulesRegression.Growth4 };
            var styles = new[] { RulesRegression.Style1, RulesRegression.Style2, RulesRegression.Style3, RulesRegression.Style4 };
            var states = new[] { RulesRegression.GrowthRng1, RulesRegression.GrowthRng2, RulesRegression.GrowthRng3, RulesRegression.GrowthRng4 };
            Equal(densities[era - 1], city.Density); Equal(styles[era - 1], city.Style); Assert.AreEqual(states[era - 1], rng.State);
        }

        [Test]
        public void DiplomacyCommandsDriftAndKnowledgeMatchTypeScript()
        {
            var sim = Flat(); sim.Relations["ming"] = 40;
            Assert.IsTrue(sim.SendEnvoy("ming").Ok);
            Assert.IsTrue(sim.ProposeDeal("ming", "rempah", 3, 4).Ok);
            Assert.IsTrue(sim.ToggleExchange("ming").Ok);
            double knowledge = 0;
            for (int t = 0; t < 30; t++) { knowledge += sim.Diplomacy.Tick(); sim.Tick++; }
            var p = sim.Diplomacy.FindPartner("ming");
            Equal(RulesRegression.Diplomacy, new[] { sim.Stock[ResourceType.Treasury], p.Relation, p.EnvoyCooldown, knowledge, sim.Rng.State, sim.Diplomacy.DealPrice("ming", "rempah") });
        }

        [Test]
        public void ContractSettlementMatchesTypeScriptBeforeSpotExports()
        {
            var sim = Flat(); Building(sim, "pelabuhan", 1, 1);
            for (int i = 128; i < 138; i++) { sim.City.Zone[i] = 1; sim.City.Density[i] = 1; }
            sim.Stock[ResourceType.Spices] = 50; sim.Stock[ResourceType.Tin] = 50; sim.Events.View.PriceMult[(int)ResourceType.Spices] = 4;
            Assert.IsTrue(sim.ProposeDeal("ming", "rempah", 20, 3).Ok); Assert.IsTrue(sim.ProposeDeal("gujerat", "timah", 20, 3).Ok);
            var values = new List<double>();
            for (int t = 0; t < 3; t++)
            {
                sim.Economy.Tick(sim.City, sim.Stock, 1, sim.Effects, sim.Events.View, 9, 9, 9, sim.Tech.Done, 0, sim.Diplomacy);
                values.AddRange(new[] { sim.Economy.Budget.deals, sim.Economy.Budget.exports, sim.Stock[ResourceType.Spices], sim.Stock[ResourceType.Tin], sim.Relations["ming"], sim.Relations["gujerat"], sim.Diplomacy.Deals.Count,
                    sim.Diplomacy.Deals.Count > 0 ? sim.Diplomacy.Deals[0].Delivered : 0, sim.Diplomacy.Deals.Count > 1 ? sim.Diplomacy.Deals[1].Missed : 0 });
            }
            Equal(RulesRegression.Settlement, values.ToArray());
        }

        [TestCase(1)] [TestCase(2)] [TestCase(3)] [TestCase(4)]
        public void PartnerInitiatedOffersMatchTypeScriptInEveryEra(int era)
        {
            var sim = Flat(); sim.Era.Restore(era); sim.Diplomacy.EnsurePartners(); sim.Rng.State = 8765;
            sim.Stock[ResourceType.Treasury] = 1000000; sim.Tech.Done[sim.Db.ResearchIndex("zon_perdagangan_bebas")] = true;
            foreach (var p in sim.Diplomacy.Partners) if (p.Known) sim.Relations[p.Id] = 50;
            foreach (var g in ResourceInfo.GoodIds) sim.Economy.Production[ResourceInfo.FromGood(g)] = 10;
            sim.Diplomacy.CaptureProduction();
            var values = new List<double>();
            for (int tick = 0; tick < 250; tick++)
            {
                sim.Tick = tick; sim.Diplomacy.Tick();
                while (sim.Diplomacy.Offers.Count > 0)
                {
                    var o = sim.Diplomacy.Offers[0];
                    values.AddRange(new[] { (double)o.Id, Array.IndexOf(ResourceInfo.GoodIds, o.Good), o.Quantity, o.Price, o.Money, o.Expires });
                    Assert.IsTrue(sim.AcceptOffer(o.Id).Ok);
                }
            }
            var expected = new[] { RulesRegression.Offers1, RulesRegression.Offers2, RulesRegression.Offers3, RulesRegression.Offers4 };
            var states = new[] { RulesRegression.OffersRng1, RulesRegression.OffersRng2, RulesRegression.OffersRng3, RulesRegression.OffersRng4 };
            Equal(expected[era - 1], values.ToArray()); Assert.AreEqual(states[era - 1], sim.Rng.State);
        }

        internal static GameSimulation Achievements()
        {
            var sim = Flat(32); sim.Era.Restore(4); sim.Diplomacy.EnsurePartners();
            sim.Stock[ResourceType.Treasury] = 500000;
            foreach (var p in sim.Diplomacy.Partners) if (p.Known) sim.Relations[p.Id] = 50;
            sim.Economy.Population = 30000; sim.Economy.CulturePerTick = 60; sim.Economy.Happiness = 70;
            sim.Economy.Budget.exports = 5900; sim.Economy.Budget.deals = 100;
            foreach (var id in new[] { "bandar_pintar", "kecerdasan_buatan", "negara_maju" }) sim.Tech.Done[sim.Db.ResearchIndex(id)] = true;
            string[] ids = { "hab_inovasi", "pusat_data", "stesen_mrt", "ladang_solar", "istana", "masjid", "candi", "bangunan_moorish", "menara_berkembar" };
            for (int i = 0; i < ids.Length; i++) Building(sim, ids[i], i % 5 * 5, i / 5 * 5);
            for (int i = 500; i < 620; i++) { sim.City.Zone[i] = 1; sim.City.Density[i] = 1; sim.City.Style[i] = (byte)(i % 2 + 1); }
            return sim;
        }

        [Test]
        public void MilestonesAndVictoryMatchTypeScriptAndFireOnce()
        {
            var sim = Achievements(); int awards = 0, victories = 0;
            sim.OnMilestoneReached += id => awards++; sim.OnVictory += () => victories++;
            sim.Milestones.Check();
            var requirements = new List<double>();
            foreach (var m in sim.Milestones.All) foreach (var r in m.Requirements) requirements.Add(r.Met ? 1 : 0);
            Equal(RulesRegression.MilestoneRequirements, requirements.ToArray());
            Assert.AreEqual(RulesRegression.Victory, victories); Assert.IsTrue(sim.Milestones.Victory);
            Assert.AreEqual(RulesRegression.Awards, awards); Assert.AreEqual(120, sim.Milestones.HeritageLots);
            sim.Milestones.Check(); Assert.AreEqual(3, awards); Assert.AreEqual(1, victories);
        }

        [Test]
        public void MilestonesUseUnroundedThresholdsAndKeepAwardsAfterRegression()
        {
            var sim = Achievements(); sim.Stock[ResourceType.Treasury] = 499999.9;
            sim.Milestones.Check(); Assert.IsFalse(sim.Milestones.All[0].Reached);
            Assert.AreEqual(500000, sim.Milestones.All[0].Requirements[1].Current);
            sim.Stock[ResourceType.Treasury] = 500000; sim.Milestones.Check(); Assert.IsTrue(sim.Milestones.All[0].Reached);
            sim.Stock[ResourceType.Treasury] = 0; sim.Milestones.Check(); Assert.IsTrue(sim.Milestones.All[0].Reached);
        }

        [Test]
        public void VictoryRequiresTheDigitalEraCivicAndLandmark()
        {
            var sim = Achievements(); sim.Tech.Done[sim.Db.ResearchIndex("negara_maju")] = false;
            sim.Milestones.Check(); Assert.IsFalse(sim.Milestones.Victory);
            sim.Tech.Done[sim.Db.ResearchIndex("negara_maju")] = true; sim.Era.Restore(3);
            sim.Milestones.Check(); Assert.IsFalse(sim.Milestones.Victory);
            sim.Era.Restore(4); sim.Milestones.Check(); Assert.IsTrue(sim.Milestones.Victory);
        }
    }
}
