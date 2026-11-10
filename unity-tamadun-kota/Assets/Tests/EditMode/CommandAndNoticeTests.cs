using System;
using System.Collections.Generic;
using NUnit.Framework;
using TamadunKota.Simulation;

namespace TamadunKota.Tests
{
    public class CommandAndNoticeTests
    {
        static void Effects(List<double> values, EffectTotals e)
        {
            values.AddRange(new[] { e.ProductionAll, e.ExportCap, e.ExportPrice, e.Tax, e.Research, e.Culture,
                e.Happiness, e.Pollution, e.Growth, e.Upkeep, e.Construction, e.RelationGain });
            foreach (var good in ResourceInfo.GoodIds) values.Add(e.Production[(int)ResourceInfo.FromGood(good)]);
        }

        static void Equal(double[] expected, List<double> actual)
        {
            Assert.AreEqual(expected.Length, actual.Count);
            for (int i = 0; i < expected.Length; i++) Assert.AreEqual(expected[i], actual[i], 1e-10, "value " + i);
        }

        [TestCase(1)] [TestCase(2)] [TestCase(3)] [TestCase(4)]
        public void AdvisorCommandsMatchTypeScriptInEveryEra(int era)
        {
            var sim = RulesParityTests.Flat(); sim.Era.Restore(era); sim.Stock[ResourceType.Treasury] = 0;
            var values = new List<double>(); var reasons = new List<string>();
            var noticeIds = new List<string>(); var noticeKeys = new List<string>();
            sim.NoticePosted += n =>
            {
                if (Array.Find(sim.Db.Advisors, a => a.id == n.id) == null) return;
                noticeIds.Add(n.id); noticeKeys.Add(n.kind == NoticeKind.Good ? "notice.advisorJoined" : "notice.advisorRetired");
                Assert.IsNull(n.entryId, "advisors do not have Sejarahpedia entries in the catalog");
            };
            string first = Array.Find(sim.Db.Advisors, a => Array.IndexOf(a.eras, era) >= 0).id;
            void Recruit(string id)
            {
                var check = sim.CanRecruitAdvisor(id); bool ok = sim.RecruitAdvisor(id);
                Assert.AreEqual(check.Ok, ok);
                reasons.Add(check.Reason);
                values.AddRange(new[] { ok ? 1.0 : 0, check.Cost, sim.Stock[ResourceType.Treasury], sim.Advisors.Count });
                Effects(values, sim.Effects);
            }
            Recruit("unknown"); Recruit(first); sim.Stock[ResourceType.Treasury] = 100000;
            foreach (var a in sim.Db.Advisors) Recruit(a.id);
            Recruit(first);
            for (int i = 0; i < 2; i++)
            {
                bool ok = sim.DismissAdvisor(first); reasons.Add(ok ? null : "err.invalid");
                values.AddRange(new[] { ok ? 1.0 : 0, 0, sim.Stock[ResourceType.Treasury], sim.Advisors.Count });
                Effects(values, sim.Effects);
            }
            Assert.AreEqual(new[] { RulesRegression.AdvisorSlots1, RulesRegression.AdvisorSlots2, RulesRegression.AdvisorSlots3, RulesRegression.AdvisorSlots4 }[era - 1], sim.AdvisorSlots);
            if (era < 4) Assert.IsTrue(sim.AdvanceEra(true));
            Equal(new[] { RulesRegression.AdvisorCommands1, RulesRegression.AdvisorCommands2, RulesRegression.AdvisorCommands3, RulesRegression.AdvisorCommands4 }[era - 1], values);
            CollectionAssert.AreEqual(new[] { RulesRegression.AdvisorReasons1, RulesRegression.AdvisorReasons2, RulesRegression.AdvisorReasons3, RulesRegression.AdvisorReasons4 }[era - 1], reasons);
            CollectionAssert.AreEqual(new[] { RulesRegression.AdvisorsAfterRetirement1, RulesRegression.AdvisorsAfterRetirement2, RulesRegression.AdvisorsAfterRetirement3, RulesRegression.AdvisorsAfterRetirement4 }[era - 1], sim.Advisors);
            CollectionAssert.AreEqual(new[] { RulesRegression.AdvisorNoticeIds1, RulesRegression.AdvisorNoticeIds2, RulesRegression.AdvisorNoticeIds3, RulesRegression.AdvisorNoticeIds4 }[era - 1], noticeIds);
            CollectionAssert.AreEqual(new[] { RulesRegression.AdvisorNoticeKeys1, RulesRegression.AdvisorNoticeKeys2, RulesRegression.AdvisorNoticeKeys3, RulesRegression.AdvisorNoticeKeys4 }[era - 1], noticeKeys);
        }

        [TestCase(1)] [TestCase(2)] [TestCase(3)] [TestCase(4)]
        public void PolicyCommandsMatchTypeScriptInEveryEra(int era)
        {
            var sim = RulesParityTests.Flat(); sim.Era.Restore(era);
            for (int i = 0; i < sim.Db.Research.Length; i++) if (sim.Db.Research[i].era <= era) sim.Tech.Done[i] = true;
            sim.RefreshEffects();
            var values = new List<double>(); var reasons = new List<string>(); var unlocked = new List<double>();
            void Record(CommandResult result)
            {
                reasons.Add(result.Reason); values.AddRange(new[] { result.Ok ? 1.0 : 0, sim.Policies.Count, sim.Stock[ResourceType.Treasury] });
                Effects(values, sim.Effects);
            }
            Record(sim.AdoptPolicy("unknown"));
            foreach (var p in sim.Db.Policies) { unlocked.Add(sim.IsPolicyUnlocked(p.id) ? 1 : 0); Record(sim.AdoptPolicy(p.id)); }
            string first = sim.Db.Policies[0].id;
            Record(sim.AdoptPolicy(first)); Record(sim.RevokePolicy(first)); Record(sim.RevokePolicy(first)); Record(sim.AdoptPolicy(first));
            Assert.AreEqual(new[] { RulesRegression.PolicySlots1, RulesRegression.PolicySlots2, RulesRegression.PolicySlots3, RulesRegression.PolicySlots4 }[era - 1], sim.PolicySlots);
            Equal(new[] { RulesRegression.PolicyUnlocked1, RulesRegression.PolicyUnlocked2, RulesRegression.PolicyUnlocked3, RulesRegression.PolicyUnlocked4 }[era - 1], unlocked);
            Equal(new[] { RulesRegression.PolicyCommands1, RulesRegression.PolicyCommands2, RulesRegression.PolicyCommands3, RulesRegression.PolicyCommands4 }[era - 1], values);
            CollectionAssert.AreEqual(new[] { RulesRegression.PolicyReasons1, RulesRegression.PolicyReasons2, RulesRegression.PolicyReasons3, RulesRegression.PolicyReasons4 }[era - 1], reasons);
            CollectionAssert.AreEqual(new[] { RulesRegression.PoliciesAfterCommands1, RulesRegression.PoliciesAfterCommands2, RulesRegression.PoliciesAfterCommands3, RulesRegression.PoliciesAfterCommands4 }[era - 1], sim.Policies);
        }

        [Test]
        public void TechAloneCannotUnlockAPolicy()
        {
            var db = TestData.QuietDatabase();
            db.Research = new[] { new ResearchRecord { id = "test_tech", kind = "tech", unlockPolicies = new[] { "gotong_royong" } },
                new ResearchRecord { id = "test_civic", kind = "civic", unlockPolicies = new[] { "gotong_royong" } } };
            db.Index(); var sim = new GameSimulation(db, 42, 16);
            sim.Tech.Done[0] = true;
            Assert.IsFalse(sim.IsPolicyUnlocked("gotong_royong")); Assert.AreEqual("err.locked", sim.AdoptPolicy("gotong_royong").Reason);
            sim.Tech.Done[1] = true;
            Assert.IsTrue(sim.IsPolicyUnlocked("gotong_royong")); Assert.IsTrue(sim.AdoptPolicy("gotong_royong").Ok);
        }

        [Test]
        public void DismissalRefreshesEffectsBeforeTheNextTickAndStopsUpkeep()
        {
            var sim = RulesParityTests.Flat(); Assert.IsTrue(sim.RecruitAdvisor("tun_perak"));
            Assert.AreEqual(0.1, sim.Effects.Tax); Assert.AreEqual(2, sim.Effects.Happiness);
            sim.Step(); Assert.AreEqual(2, sim.Economy.Budget.advisors);
            double money = sim.Stock[ResourceType.Treasury];
            Assert.IsTrue(sim.DismissAdvisor("tun_perak")); Assert.AreEqual(money, sim.Stock[ResourceType.Treasury]);
            Assert.AreEqual(0, sim.Effects.Tax); Assert.AreEqual(0, sim.Effects.Happiness);
            sim.Step(); Assert.AreEqual(0, sim.Economy.Budget.advisors);
        }

        [Test]
        public void PolicySaveRoundTripKeepsTheListEffectsAndAvailableSlots()
        {
            var sim = RulesParityTests.Flat(); sim.Tech.Done[sim.Db.ResearchIndex("gotong_royong")] = true;
            sim.RefreshEffects(); Assert.IsTrue(sim.AdoptPolicy("gotong_royong").Ok);
            double happiness = sim.Effects.Happiness;
            var save = SaveCodec.Capture(sim, "Policy", 42);
#if UNITY_5_3_OR_NEWER
            save = UnityEngine.JsonUtility.FromJson<SaveGame>(UnityEngine.JsonUtility.ToJson(save));
#else
            var options = new System.Text.Json.JsonSerializerOptions { IncludeFields = true };
            save = System.Text.Json.JsonSerializer.Deserialize<SaveGame>(System.Text.Json.JsonSerializer.Serialize(save, options), options);
#endif
            var back = SaveCodec.Restore(TestData.QuietDatabase(), save);
            CollectionAssert.AreEqual(new[] { "gotong_royong" }, back.Policies);
            Assert.AreEqual(happiness, back.Effects.Happiness); Assert.AreEqual(-0.15, back.Effects.Construction);
            Assert.AreEqual("err.invalid", back.AdoptPolicy("gotong_royong").Reason);
            Assert.IsTrue(back.RevokePolicy("gotong_royong").Ok); Assert.AreEqual(0, back.Effects.Construction);
            Assert.AreEqual(happiness - 1, back.Effects.Happiness); Assert.IsTrue(back.AdoptPolicy("gotong_royong").Ok);
        }

        [Test]
        public void EventIdsDisambiguateIdenticalTitlesAndMissingEntriesStayEmpty()
        {
            var sim = RulesParityTests.Flat(); var notices = new List<Notice>(); sim.NoticePosted += notices.Add;
            var first = new EventRecord { id = "first", kind = "historical", nameMs = "Sama", nameEn = "Same title", entryId = "first_entry" };
            var second = new EventRecord { id = "second", kind = "historical", nameMs = "Sama", nameEn = "Same title" };
            sim.Events.Fire(first, sim.Stock, sim.Tech, sim.Relations, 0); sim.Events.Fire(second, sim.Stock, sim.Tech, sim.Relations, 0);
            Assert.AreEqual(2, notices.Count); Assert.AreEqual(notices[0].titleEn, notices[1].titleEn);
            Assert.AreEqual("first", notices[0].id); Assert.AreEqual("first_entry", notices[0].entryId);
            Assert.AreEqual("second", notices[1].id); Assert.IsNull(notices[1].entryId);
        }

        [TestCase("tulisan_jawi")] [TestCase("hukum_kanun")] [TestCase("gotong_royong")]
        public void CompletedTechsAndCivicsCarryTheirOwnIds(string id)
        {
            var sim = RulesParityTests.Flat(); var notices = new List<Notice>(); sim.NoticePosted += notices.Add;
            int index = sim.Db.ResearchIndex(id); sim.Tech.Grant(index);
            Assert.AreEqual(1, notices.Count); Assert.AreEqual(NoticeKind.Good, notices[0].kind);
            Assert.AreEqual(id, notices[0].id);
            string entry = sim.Db.Research[index].entryId;
            Assert.AreEqual(string.IsNullOrEmpty(entry) ? null : entry, notices[0].entryId);
        }

        [Test]
        public void CrisisStartAndResolutionKeepTheCrisisEntryAfterItCloses()
        {
            var sim = new GameSimulation(TestData.Database(), 42, 16); sim.AdvanceEra(true);
            var notices = new List<Notice>(); sim.NoticePosted += notices.Add;
            sim.Year = 1926; sim.Step(); Assert.AreEqual("bah_besar", sim.Events.PendingCrisis);
            var start = notices.Find(n => n.kind == NoticeKind.Bad && n.id == "bah_besar");
            var crisis = sim.Db.Crises[sim.Db.CrisisIndex("bah_besar")];
            Assert.AreEqual("bah_besar", start.id); Assert.AreEqual(crisis.entryId, start.entryId);
            sim.Stock[ResourceType.Treasury] = 10000; Assert.IsTrue(sim.ResolveCrisis(1));
            Assert.IsNull(sim.Events.PendingCrisis);
            var resolved = notices.Find(n => n.kind == NoticeKind.Info && n.id == "bah_besar");
            Assert.AreEqual("bah_besar", resolved.id); Assert.AreEqual(crisis.entryId, resolved.entryId);
        }

        [TestCase(2)] [TestCase(3)] [TestCase(4)]
        public void EraNoticesCarryTheNewEraIdAndEntry(int era)
        {
            var sim = RulesParityTests.Flat(); var notices = new List<Notice>(); sim.NoticePosted += notices.Add;
            sim.Era.Restore(era - 1); Assert.IsTrue(sim.AdvanceEra(true));
            var notice = notices.Find(n => n.kind == NoticeKind.Era);
            Assert.AreEqual(era.ToString(System.Globalization.CultureInfo.InvariantCulture), notice.id);
            Assert.AreEqual(sim.Db.Era(era).entryId, notice.entryId);
        }

        [Test]
        public void AchievementNoticesKeepVictoryAndMilestonesSeparate()
        {
            var sim = RulesParityTests.Achievements(); var notices = new List<Notice>(); sim.NoticePosted += notices.Add;
            sim.Milestones.Check(); Assert.AreEqual(4, notices.Count);
            Assert.AreEqual("victory", notices[0].id); Assert.AreEqual("menara_berkembar", notices[0].entryId);
            for (int i = 0; i < sim.Milestones.All.Count; i++)
            { Assert.AreEqual(sim.Milestones.All[i].Id, notices[i + 1].id); Assert.IsNull(notices[i + 1].entryId); }
            sim.Milestones.Check(); Assert.AreEqual(4, notices.Count);
        }
    }
}
