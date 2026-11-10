using System;
using NUnit.Framework;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    public class DiplomacyAndSaveTests
    {
        static SaveGame JsonRoundTrip(SaveGame save)
        {
#if UNITY_5_3_OR_NEWER
            return UnityEngine.JsonUtility.FromJson<SaveGame>(UnityEngine.JsonUtility.ToJson(save));
#else
            var options = new System.Text.Json.JsonSerializerOptions { IncludeFields = true };
            return System.Text.Json.JsonSerializer.Deserialize<SaveGame>(System.Text.Json.JsonSerializer.Serialize(save, options), options);
#endif
        }

        [Test]
        public void CommandsRejectUnavailablePartnersAndDoNotChargeOnFailure()
        {
            var sim = RulesParityTests.Flat();
            Assert.AreEqual("err.noPartner", sim.SendEnvoy("portugis").Reason);
            Assert.AreEqual("err.noPartner", sim.ProposeDeal("china", "kayu", 1, 10).Reason);
            Assert.AreEqual("err.notWanted", sim.ProposeDeal("ming", "digital", 1, 10).Reason);
            Assert.AreEqual("err.invalid", sim.ProposeDeal("ming", "rempah", double.NaN, 10).Reason);
            Assert.AreEqual("err.invalid", sim.ProposeDeal("ming", "rempah", 1, double.PositiveInfinity).Reason);
            sim.Stock[ResourceType.Treasury] = 149;
            Assert.AreEqual("err.money", sim.SendEnvoy("ming").Reason);
            Assert.AreEqual(149, sim.Stock[ResourceType.Treasury]);
            sim.Events.Fired.Add("kejatuhan_melaka");
            sim.Diplomacy.EnsurePartners();
            Assert.IsTrue(sim.Diplomacy.FindPartner("portugis").Active);
            Assert.AreEqual(-30, sim.Relations["portugis"]);
            Assert.AreEqual("err.relation", sim.ProposeDeal("portugis", "rempah", 1, 10).Reason);
        }

        [Test]
        public void EnvoysRespectCooldownAndTheHarbourmasterBonus()
        {
            var sim = RulesParityTests.Flat(); RulesParityTests.Building(sim, "syahbandar", 4, 4);
            Assert.AreEqual(150, sim.SendEnvoy("ming").Cost);
            Assert.AreEqual(26, sim.Relations["ming"]);
            Assert.AreEqual("err.cooldown", sim.SendEnvoy("ming").Reason);
            Assert.IsTrue(sim.ToggleExchange("ming").Ok);
            sim.Stock[ResourceType.Treasury] = 2;
            Assert.AreEqual(0, sim.Diplomacy.Tick()); Assert.IsFalse(sim.Diplomacy.FindPartner("ming").Exchange);
            for (int i = 0; i < 7; i++) sim.Diplomacy.Tick();
            sim.Stock[ResourceType.Treasury] = 1000;
            Assert.IsTrue(sim.SendEnvoy("ming").Ok);
        }

        [Test]
        public void DealLimitCancellationAndRelationClampsMatchTheWebRules()
        {
            var sim = RulesParityTests.Flat();
            Assert.IsTrue(sim.ProposeDeal("ming", "rempah", 2, 10).Ok);
            Assert.IsTrue(sim.ProposeDeal("ming", "timah", 2, 10).Ok);
            Assert.AreEqual("err.tooManyDeals", sim.ProposeDeal("ming", "kayu", 1, 10).Reason);
            sim.Relations["ming"] = -99;
            Assert.IsTrue(sim.CancelDeal(sim.Diplomacy.Deals[0].Id).Ok);
            Assert.AreEqual(-100, sim.Relations["ming"]);
            Assert.AreEqual("err.invalid", sim.CancelDeal(-1).Reason);
        }

        [Test]
        public void OfferExpiryEraRetirementAndDeclineAreApplied()
        {
            var sim = RulesParityTests.Flat(); var save = SaveCodec.Capture(sim, "Offers", 42);
            save.offers = new[] {
                new SavedOffer { id = 1, partner = "ming", kind = OfferKind.Deal, good = "rempah", quantity = 1, price = 12, duration = 4, expires = 0 },
                new SavedOffer { id = 2, partner = "china", kind = OfferKind.Investment, money = 100, expires = 99 },
                new SavedOffer { id = 3, partner = "ming", kind = OfferKind.Exchange, expires = 99 }
            };
            sim = SaveCodec.Restore(TestData.QuietDatabase(), JsonRoundTrip(save));
            sim.Diplomacy.Tick(); Assert.AreEqual(1, sim.Diplomacy.Offers.Count);
            Assert.AreEqual(3, sim.Diplomacy.Offers[0].Id);
            double before = sim.Relations["ming"];
            Assert.IsTrue(sim.DeclineOffer(3).Ok); Assert.AreEqual(before - 2, sim.Relations["ming"]);
            Assert.AreEqual("err.invalid", sim.AcceptOffer(3).Reason);
        }

        [Test]
        public void AcceptedInvestmentAndExchangeOffersApplyTheirRewards()
        {
            var sim = RulesParityTests.Flat(); var save = SaveCodec.Capture(sim, "Offers", 42);
            save.offers = new[] {
                new SavedOffer { id = 4, partner = "ming", kind = OfferKind.Investment, money = 200, expires = 99 },
                new SavedOffer { id = 5, partner = "ming", kind = OfferKind.Exchange, expires = 99 }
            };
            sim = SaveCodec.Restore(TestData.QuietDatabase(), save);
            Assert.IsTrue(sim.AcceptOffer(4).Ok); Assert.AreEqual(12200, sim.Stock[ResourceType.Treasury]); Assert.AreEqual(15, sim.Relations["ming"]);
            Assert.IsTrue(sim.AcceptOffer(5).Ok); Assert.IsTrue(sim.Diplomacy.FindPartner("ming").Exchange);
        }

        [Test]
        public void RiceCannotFulfilAFishContract()
        {
            var sim = RulesParityTests.Flat(); RulesParityTests.Building(sim, "pelabuhan", 0, 0);
            for (int i = 128; i < 138; i++) { sim.City.Zone[i] = 1; sim.City.Density[i] = 1; }
            sim.Stock[ResourceType.Food] = 100; sim.Stock[ResourceType.Fish] = 0;
            Assert.IsTrue(sim.ProposeDeal("jawa", "ikan", 10, 2).Ok);
            sim.Economy.Tick(sim.City, sim.Stock, 1, sim.Effects, sim.Events.View, 9, 9, 9, sim.Tech.Done, 0, sim.Diplomacy);
            Assert.AreEqual(0, sim.Economy.Budget.deals); Assert.AreEqual(1, sim.Diplomacy.Deals[0].Missed);
            Assert.AreEqual(0, sim.Diplomacy.Deals[0].Delivered);
        }

        [TestCase(2)] [TestCase(3)]
        public void JsonPreservesDiplomacyAwardsAndRandomState(int version)
        {
            var sim = RulesParityTests.Achievements(); sim.Milestones.Check();
            sim.Relations["jepun"] = 70; Assert.IsTrue(sim.SendEnvoy("jepun").Ok); Assert.IsTrue(sim.ToggleExchange("jepun").Ok);
            Assert.IsTrue(sim.ProposeDeal("jepun", "elektronik", 12, 24).Ok);
            sim.Stock[ResourceType.Fish] = 123; sim.Rng.Next();
            var save = SaveCodec.Capture(sim, "Version two", 42);
            save.version = version;
            save.offers = new[] { new SavedOffer { id = 50, partner = "jepun", kind = OfferKind.Deal, good = "timah", quantity = 2, price = 3, duration = 4, expires = 99 } };
            var copy = JsonRoundTrip(save);
            var restored = SaveCodec.Restore(TestData.QuietDatabase(), copy);
            Assert.AreEqual(version, copy.version); Assert.AreEqual(sim.Rng.State, restored.Rng.State);
            Assert.AreEqual(123, restored.Stock[ResourceType.Fish]); Assert.AreEqual(sim.Relations["jepun"], restored.Relations["jepun"]);
            Assert.IsTrue(restored.Diplomacy.FindPartner("jepun").Exchange); Assert.AreEqual(8, restored.Diplomacy.FindPartner("jepun").EnvoyCooldown);
            Assert.AreEqual(12, restored.Diplomacy.Deals[0].Quantity); Assert.AreEqual(24, restored.Diplomacy.Deals[0].Remaining);
            Assert.AreEqual(50, restored.Diplomacy.Offers[0].Id); Assert.IsTrue(restored.Milestones.Victory);
            foreach (var m in restored.Milestones.All) Assert.IsTrue(m.Reached, m.Id);
            Assert.IsTrue(restored.AcceptOffer(50).Ok); Assert.Greater(restored.Diplomacy.Deals[1].Id, 50);
        }

        [Test]
        public void VersionOneSavesInitializeNewFieldsAndPreserveLegacyResourceIndices()
        {
            var sim = RulesParityTests.Flat(); var save = SaveCodec.Capture(sim, "Legacy", 42);
            save.version = 1; save.era = 2; save.resources = new double[14]; save.resources[1] = 321; save.resources[12] = 17;
            save.partners = null; save.deals = null; save.offers = null; save.milestones = null;
            var back = SaveCodec.Restore(TestData.QuietDatabase(), JsonRoundTrip(save));
            Assert.AreEqual(321, back.Stock[ResourceType.Food]); Assert.AreEqual(0, back.Stock[ResourceType.Fish]); Assert.AreEqual(17, back.Stock[ResourceType.Tech]);
            Assert.AreEqual(0, back.Diplomacy.Deals.Count); Assert.AreEqual(0, back.Diplomacy.Offers.Count);
            Assert.IsFalse(back.Milestones.Victory); Assert.IsFalse(back.Milestones.All[0].Reached);
            Assert.AreEqual(10, back.Diplomacy.FindPartner("negeri_selat").Relation);
            Assert.AreEqual(0, back.Diplomacy.FindPartner("negeri_selat").EnvoyCooldown);
            back.Step();
            Assert.Throws<FormatException>(() => SaveCodec.Restore(TestData.QuietDatabase(), new SaveGame { version = SaveGame.CurrentVersion + 1 }));
        }

        [Test]
        public void UiCollectionsCannotBeMutatedByCastingTheReadOnlyViews()
        {
            var sim = RulesParityTests.Flat();
            Assert.Throws<NotSupportedException>(() => ((System.Collections.Generic.IList<TradeDeal>)sim.Diplomacy.Deals).Clear());
            Assert.Throws<NotSupportedException>(() => ((System.Collections.Generic.IList<PartnerView>)sim.Diplomacy.Partners).Clear());
            Assert.Throws<NotSupportedException>(() => ((System.Collections.Generic.IList<MilestoneView>)sim.Milestones.All).Clear());
        }
    }
}
