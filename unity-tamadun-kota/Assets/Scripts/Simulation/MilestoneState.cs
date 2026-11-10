using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    public readonly struct MilestoneRequirement
    {
        public string LabelMs { get; }
        public string LabelEn { get; }
        public bool Met { get; }
        public bool Numeric { get; }
        public double Current { get; }
        public double Target { get; }
        internal MilestoneRequirement(string ms, string en, bool met, double current = 0, double target = 0, bool numeric = false)
        { LabelMs = ms; LabelEn = en; Met = met; Current = current; Target = target; Numeric = numeric; }
    }

    public sealed class MilestoneView
    {
        public string Id { get; }
        public string NameMs { get; }
        public string NameEn { get; }
        public string DescriptionMs { get; }
        public string DescriptionEn { get; }
        public bool Reached { get; internal set; }
        public IReadOnlyList<MilestoneRequirement> Requirements { get; }
        internal readonly MilestoneRequirement[] Items;
        internal MilestoneView(GameDatabase db, string id, int count)
        {
            Id = id;
            foreach (var m in db.Milestones) if (m.id == id)
            { NameMs = m.nameMs; NameEn = m.nameEn; DescriptionMs = m.descMs; DescriptionEn = m.descEn; break; }
            Items = new MilestoneRequirement[count]; Requirements = Array.AsReadOnly(Items);
        }
    }

    /// <summary>Independent milestone awards and era-four victory; neither stops the simulation.</summary>
    public sealed class MilestoneState
    {
        readonly GameSimulation sim;
        readonly MilestoneView[] all;
        public IReadOnlyList<MilestoneView> All { get; }
        public bool Victory { get; internal set; }
        public int HeritageLots { get; private set; }

        internal MilestoneState(GameSimulation sim)
        {
            this.sim = sim;
            all = new[] { new MilestoneView(sim.Db, "economic_hegemon", 4), new MilestoneView(sim.Db, "smart_nation", 5), new MilestoneView(sim.Db, "heritage_metropolis", 7) };
            All = Array.AsReadOnly(all);
            Refresh();
        }

        bool Has(string id) { int i = sim.Db.BuildingIndex(id); return i >= 0 && sim.City.HasBuilding(i); }
        static MilestoneRequirement Flag(string ms, string en, bool met) => new MilestoneRequirement(ms, en, met);
        static MilestoneRequirement Number(string ms, string en, double current, double target) =>
            new MilestoneRequirement(ms, en, current >= target, Noise.JsRound(current), target, true);

        /// <summary>Refresh requirement values without awarding achievements or emitting events.</summary>
        public void Refresh()
        {
            var city = sim.City; var economy = sim.Economy;
            int heritage = 0, friends = 0;
            for (int i = 0; i < city.Zone.Length; i++)
                if (city.Zone[i] != 0 && city.Density[i] > 0 && city.Style[i] > 0 && city.Style[i] <= 2 && city.BuildingAt[i] < 0) heritage++;
            HeritageLots = heritage;
            foreach (var p in sim.Relations) if (p.Value >= 50) friends++;
            var r = all[0].Items;
            r[0] = Flag("Capai Era Bandar Pintar Digital", "Reach the Digital Smart City era", sim.CurrentEra >= 4);
            r[1] = Number("Tabung negeri", "Treasury", sim.Stock[ResourceType.Treasury], 500000);
            r[2] = Number("Pendapatan eksport & perjanjian setiap giliran", "Export and deal income per turn", economy.Budget.exports + economy.Budget.deals, 6000);
            r[3] = Number("Rakan dagang dengan hubungan ≥ 50", "Trade partners with relations ≥ 50", friends, 3);
            r = all[1].Items;
            r[0] = Flag("Teknologi Bandar Pintar", "Smart City technology", sim.Tech.IsDone("bandar_pintar"));
            r[1] = Flag("Teknologi Kecerdasan Buatan", "Artificial Intelligence technology", sim.Tech.IsDone("kecerdasan_buatan"));
            r[2] = Flag("Hab Inovasi dan Pusat Data", "An Innovation Hub and a Data Centre", Has("hab_inovasi") && Has("pusat_data"));
            r[3] = Flag("Stesen MRT dan Ladang Solar", "An MRT station and a Solar Farm", Has("stesen_mrt") && Has("ladang_solar"));
            r[4] = Number("Penduduk", "Population", economy.Population, 30000);
            r = all[2].Items;
            r[0] = Flag("Capai Era Perindustrian Pasca-Merdeka", "Reach the Post-Merdeka era", sim.CurrentEra >= 3);
            r[1] = Flag("Istana, Masjid Bumbung Bertingkat dan Candi masih berdiri", "Palace, Tiered-Roof Mosque and Candi still standing", Has("istana") && Has("masjid") && Has("candi"));
            r[2] = Flag("Stesen Besar Moorish masih berdiri", "Grand Moorish Station still standing", Has("bangunan_moorish"));
            r[3] = Number("Lot warisan era 1-2 dipelihara", "Era 1-2 heritage lots preserved", heritage, 120);
            r[4] = Number("Budaya setiap giliran", "Culture per turn", economy.CulturePerTick, 60);
            r[5] = Number("Kebahagiaan", "Happiness", economy.Happiness, 70);
            r[6] = Number("Penduduk", "Population", economy.Population, 20000);
        }

        internal void Check()
        {
            Refresh();
            if (!Victory && sim.CurrentEra == 4)
            {
                bool met = true;
                var reqs = sim.Era.Requirements(sim.Tech, sim.Economy.Population, sim.City);
                for (int i = 0; i < reqs.Count; i++) if (!reqs[i].met) { met = false; break; }
                if (met)
                {
                    Victory = true;
                    sim.Post(NoticeKind.Era, "Kemenangan", "Victory", "Bandar pintar telah berjaya.", "The smart city has succeeded.", "victory", "menara_berkembar");
                    sim.RaiseVictory();
                }
            }
            for (int i = 0; i < all.Length; i++)
            {
                var milestone = all[i];
                if (milestone.Reached) continue;
                bool met = true;
                for (int j = 0; j < milestone.Items.Length; j++) if (!milestone.Items[j].Met) { met = false; break; }
                if (!met) continue;
                milestone.Reached = true;
                sim.Post(NoticeKind.Era, milestone.NameMs, milestone.NameEn, milestone.DescriptionMs, milestone.DescriptionEn, milestone.Id);
                sim.RaiseMilestone(milestone.Id);
            }
        }

        internal void Restore(string[] reached, bool victory)
        {
            Victory = victory;
            for (int i = 0; i < all.Length; i++) all[i].Reached = reached != null && Array.IndexOf(reached, all[i].Id) >= 0;
            Refresh();
        }
    }
}
