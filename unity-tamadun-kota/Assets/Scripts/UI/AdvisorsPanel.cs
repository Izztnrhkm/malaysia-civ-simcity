using System;
using System.Collections.Generic;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Historical advisors, Tokoh Sejarah, from the advisors catalog:
    /// council seats, and per advisor the bonus, biography, sources, cost and upkeep with Recruit /
    /// Dismiss. Advisors of other eras are listed greyed out. The list is rebuilt on open, on
    /// language change and after a recruit or dismiss; each tick only updates which Recruit
    /// buttons are affordable.
    /// </summary>
    public sealed class AdvisorsPanel : ModalPanel
    {
        RectTransform list;
        Text slots;
        readonly List<(Button button, AdvisorRecord advisor)> recruitButtons = new List<(Button, AdvisorRecord)>(12);
        readonly List<AdvisorRecord> sorted = new List<AdvisorRecord>(12);

        public AdvisorsPanel(HudContext context) : base(context) { }

        protected override string TitleKey => "panel.advisors";
        protected override Vector2 HalfSize => new Vector2(580, 390);

        protected override void BuildBody()
        {
            var intro = Kit.Label(Body, "Intro", FontSize - 4, TextAnchor.UpperLeft);
            HudKit.Stretch(intro.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -46), Vector2.zero);
            Kit.Localize(intro, () => Loc.Get("advisors.intro"));
            slots = Kit.Label(Body, "Slots", FontSize - 2, TextAnchor.MiddleLeft);
            slots.color = Kit.AccentColor;
            slots.fontStyle = FontStyle.Bold;
            HudKit.Stretch(slots.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -80), new Vector2(0, -50));
            list = Kit.ScrollList(Body, "Advisors", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(0, -86), 8);
        }

        public override void Refresh()
        {
            var sim = Sim;
            if (sim == null) return;
            HudKit.ClearChildren(list);
            recruitButtons.Clear();
            slots.text = Loc.Format("advisors.slots", "used", sim.Advisors.Count, "max", SimCommands.AdvisorSlots(sim));

            int era = sim.CurrentEra;
            sorted.Clear();
            sorted.AddRange(sim.Db.Advisors);
            sorted.Sort((a, b) =>
            {
                int ha = Array.IndexOf(a.eras, era) >= 0 ? 0 : 1, hb = Array.IndexOf(b.eras, era) >= 0 ? 0 : 1;
                if (ha != hb) return ha - hb;
                return (a.eras.Length > 0 ? a.eras[0] : 0) - (b.eras.Length > 0 ? b.eras[0] : 0);
            });

            // Two alternating columns keep advisor cards readable.
            var columns = Kit.HRow(list, "Columns", 0, 10);
            var le = columns.GetComponent<LayoutElement>();
            le.preferredHeight = -1;
            le.minHeight = -1;
            var left = Kit.Card(columns, "Left", null, 0);
            var right = Kit.Card(columns, "Right", null, 0);
            left.GetComponent<VerticalLayoutGroup>().spacing = 8;
            right.GetComponent<VerticalLayoutGroup>().spacing = 8;
            HudKit.Size(left, -1, -1).flexibleWidth = 1;
            HudKit.Size(right, -1, -1).flexibleWidth = 1;
            for (int i = 0; i < sorted.Count; i++) BuildCard(i % 2 == 0 ? left : right, sorted[i], sim);
            HudKit.ScrollToTop(list);
            UpdateAffordable();
        }

        void BuildCard(RectTransform column, AdvisorRecord a, GameSimulation sim)
        {
            bool here = Array.IndexOf(a.eras, sim.CurrentEra) >= 0;
            bool on = sim.Advisors.Contains(a.id);
            bool leading = sim.Leader != null && sim.Leader.id == a.id;
            var tint = on ? new Color(0.08f, 0.3f, 0.16f, 0.55f) : here ? HudKit.CardTint : new Color(0, 0, 0, 0.1f);
            var card = Kit.Card(column, a.id, tint, 10);
            if (!here && !on) card.gameObject.AddComponent<CanvasGroup>().alpha = 0.6f;

            Kit.Para(card, "<b>" + a.name + "</b>  <size=" + (FontSize - 6) + ">(" + a.life + ")</size>", FontSize - 1, Kit.TextColor);
            Kit.Para(card, "<i>" + T(a.titleMs, a.titleEn) + "</i>", FontSize - 5);
            Kit.Para(card, "+ " + T(a.bonusMs, a.bonusEn), FontSize - 5, HudKit.GoodColor).fontStyle = FontStyle.Bold;
            Kit.Para(card, T(a.bioMs, a.bioEn), FontSize - 6);

            var src = Kit.HRow(card, "Sources", 24, 4);
            HudKit.Size(Kit.Line(src, Loc.Get("advisors.sources") + ":", FontSize - 7, 24), 70, -1);
            for (int k = 0; k < a.sources.Length; k++)
            {
                string url = a.sources[k];
                var b = Kit.Btn(src, "[" + (k + 1) + "]", () => Application.OpenURL(url), 36);
                b.GetComponentInChildren<Text>().fontSize = FontSize - 7;
                b.GetComponent<LayoutElement>().preferredHeight = 24;
            }
            HudKit.Size(Kit.Line(src, "  Era " + string.Join(", ", a.eras), FontSize - 7, 24), -1, -1).flexibleWidth = 1;

            var row = Kit.HRow(card, "Actions", 34);
            string cur = ctx.Currency;
            HudKit.Size(Kit.Line(row, Loc.Get("advisors.cost") + " " + cur + HudFormat.Fmt(a.cost), FontSize - 6, 34), 170, -1);
            HudKit.Size(Kit.Line(row, Loc.Get("advisors.upkeep") + " " + a.upkeep.ToString("0.#"), FontSize - 6, 34), 120, -1);
            Kit.Spacer(row, 0);
            row.GetChild(row.childCount - 1).GetComponent<LayoutElement>().flexibleWidth = 1;
            if (on)
            {
                var status = Kit.Line(row, Loc.Get("advisors.serving"), FontSize - 6, 34, TextAnchor.MiddleRight);
                status.color = HudKit.GoodColor;
                HudKit.Size(status, 150, -1);
                Kit.Btn(row, Loc.Get("advisors.dismiss"), () => Dismiss(a), 110).GetComponentInChildren<Text>().fontSize = FontSize - 5;
            }
            else if (leading)
            {
                HudKit.Size(Kit.Line(row, Loc.Get("leader.alreadyLeading"), FontSize - 6, 34, TextAnchor.MiddleRight), 200, -1);
            }
            else if (here)
            {
                var b = Kit.Btn(row, Loc.Get("advisors.recruit"), () => Recruit(a), 110);
                b.GetComponentInChildren<Text>().fontSize = FontSize - 5;
                Kit.SetSelected(b, true);
                recruitButtons.Add((b, a));
            }
            else
            {
                HudKit.Size(Kit.Line(row, Loc.Get("advisors.otherEra"), FontSize - 6, 34, TextAnchor.MiddleRight), 200, -1);
            }
        }

        /// <summary>Recruit is enabled when the simulation accepts the command.</summary>
        void UpdateAffordable()
        {
            var sim = Sim;
            if (sim == null) return;
            for (int i = 0; i < recruitButtons.Count; i++)
                recruitButtons[i].button.interactable = sim.CanRecruitAdvisor(recruitButtons[i].advisor.id).Ok;
        }

        public override void OnEconomy(EconomySnapshot s)
        {
            if (IsOpen) UpdateAffordable();
        }

        public override void OnBind(GameSimulation sim)
        {
            if (IsOpen) Refresh();
        }

        void Recruit(AdvisorRecord a)
        {
            var sim = Sim;
            if (sim == null) return;
            var check = sim.CanRecruitAdvisor(a.id);
            if (!check.Ok) { ctx.ShowMessage(Loc.Get(check.Reason)); return; }
            if (sim.RecruitAdvisor(a.id))
            {
                ctx.ShowMessage(Loc.Format("notice.advisorJoined", "name", a.name));
                ctx.Economy?.Publish();
            }
            else ctx.ShowMessage(Loc.Get("err.invalid"));
            Refresh();
        }

        void Dismiss(AdvisorRecord a)
        {
            var sim = Sim;
            if (sim == null) return;
            if (SimCommands.DismissAdvisor(sim, a.id)) ctx.Economy?.Publish();
            Refresh();
        }
    }
}
