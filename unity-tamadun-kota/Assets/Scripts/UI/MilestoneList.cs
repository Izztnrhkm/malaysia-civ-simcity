using System.Collections.Generic;
using System.Text;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// The victory milestones list of the era and timeline window (web: the "Victory milestones"
    /// column of src/ui/modals/Timeline.tsx): the classic Developed Nation victory, then each
    /// milestone with its description and requirements, green once reached. Cards are built once
    /// per milestone layout; updates only rewrite texts and tints.
    /// </summary>
    public sealed class MilestoneList
    {
        static readonly Color ReachedTint = new Color(0.08f, 0.3f, 0.16f, 0.55f);

        sealed class Card
        {
            public Image background;
            public Text title, description;
            public readonly List<Text> requirements = new List<Text>(8);
        }

        readonly HudContext ctx;
        readonly RectTransform content;
        readonly List<Card> cards = new List<Card>(4);
        Image classicBackground;
        Text classicText;
        int layout = -1;
        readonly StringBuilder sb = new StringBuilder(160);

        public RectTransform Root { get; }

        HudKit Kit => ctx.Kit;
        int FontSize => ctx.Kit.FontSize;

        public MilestoneList(HudContext context, RectTransform parent, Vector2 oMin, Vector2 oMax)
        {
            ctx = context;
            content = Kit.ScrollList(parent, "Milestones", Vector2.zero, Vector2.one, oMin, oMax, 8);
            Root = (RectTransform)content.parent;
        }

        /// <summary>Rewrite the list for <paramref name="sim"/>; rebuilds the cards if the milestone layout changed.</summary>
        public void Fill(GameSimulation sim)
        {
            if (sim == null) return;
            var all = sim.Milestones.All;
            int shape = all.Count;
            for (int i = 0; i < all.Count; i++) shape = shape * 17 + all[i].Requirements.Count;
            if (shape != layout)
            {
                layout = shape;
                Build(all);
            }

            bool victory = sim.Milestones.Victory;
            classicBackground.color = victory ? ReachedTint : HudKit.CardTint;
            sb.Clear();
            sb.Append("<b>").Append(Loc.Get("timeline.classic")).Append("</b>");
            if (victory) sb.Append("   <color=#73DB8C><b>[x] ").Append(Loc.Get("timeline.achieved")).Append("</b></color>");
            classicText.text = sb.ToString();

            for (int i = 0; i < all.Count && i < cards.Count; i++)
            {
                var m = all[i];
                var c = cards[i];
                c.background.color = m.Reached ? ReachedTint : HudKit.CardTint;
                sb.Clear();
                sb.Append(ctx.T(m.NameMs, m.NameEn));
                if (m.Reached) sb.Append("   <color=#73DB8C>[x] ").Append(Loc.Get("timeline.achieved")).Append("</color>");
                c.title.text = sb.ToString();
                c.description.text = ctx.T(m.DescriptionMs, m.DescriptionEn);
                var reqs = m.Requirements;
                for (int k = 0; k < reqs.Count && k < c.requirements.Count; k++)
                {
                    var r = reqs[k];
                    sb.Clear();
                    sb.Append(r.Met ? "<color=#73DB8C>[x] " : "[ ] ").Append(ctx.T(r.LabelMs, r.LabelEn));
                    if (r.Numeric)
                        sb.Append("  (").Append(HudFormat.Fmt(System.Math.Min(r.Current, r.Target * 10))).Append(" / ").Append(HudFormat.Fmt(r.Target)).Append(')');
                    if (r.Met) sb.Append("</color>");
                    c.requirements[k].text = sb.ToString();
                }
            }
        }

        void Build(IReadOnlyList<MilestoneView> all)
        {
            HudKit.ClearChildren(content);
            cards.Clear();
            var classic = Kit.Card(content, "Classic", HudKit.CardTint, 10);
            classicBackground = classic.GetComponent<Image>();
            classicText = Kit.Para(classic, "", FontSize - 4);
            for (int i = 0; i < all.Count; i++)
            {
                var rt = Kit.Card(content, all[i].Id, HudKit.CardTint, 10);
                var c = new Card { background = rt.GetComponent<Image>() };
                c.title = Kit.Para(rt, "", FontSize - 2, Kit.AccentColor);
                c.title.fontStyle = FontStyle.Bold;
                c.description = Kit.Para(rt, "", FontSize - 6);
                for (int k = 0; k < all[i].Requirements.Count; k++) c.requirements.Add(Kit.Para(rt, "", FontSize - 6));
                cards.Add(c);
            }
            HudKit.ScrollToTop(content);
        }
    }
}
