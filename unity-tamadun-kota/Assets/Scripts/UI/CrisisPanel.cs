using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Crisis decision dialog. Opens when the engine has a pending crisis, pauses the clock while
    /// it is open (without changing the chosen speed) and closes when the crisis is resolved.
    /// </summary>
    public sealed class CrisisPanel : HudPanel
    {
        RectTransform crisisPanel, crisisChoices;
        Text crisisTitle, crisisBody;
        string shownCrisis;
        bool crisisPaused;

        public CrisisPanel(HudContext context) : base(context) { }

        public bool IsOpen => crisisPanel != null && crisisPanel.gameObject.activeSelf;

        public override void Build(RectTransform root)
        {
            crisisPanel = Kit.Panel(root, "Crisis", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-430, -260), new Vector2(430, 260));
            crisisTitle = Kit.Label(crisisPanel, "Title", FontSize + 6, TextAnchor.UpperLeft);
            crisisTitle.color = Kit.AccentColor;
            HudKit.Stretch(crisisTitle.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(16, -56), new Vector2(-16, -12));
            crisisBody = Kit.Label(crisisPanel, "Body", FontSize - 1, TextAnchor.UpperLeft);
            HudKit.Stretch(crisisBody.rectTransform, new Vector2(0, 0.5f), new Vector2(1, 1), new Vector2(16, 0), new Vector2(-16, -60));
            crisisChoices = Kit.Column(crisisPanel, "Choices", Vector2.zero, new Vector2(1, 0.5f), new Vector2(16, 16), new Vector2(-16, -8));
            crisisPanel.gameObject.SetActive(false);
        }

        /// <summary>Redraw the open crisis in the new language on the next frame.</summary>
        public override void OnLanguage() => shownCrisis = null;

        public override void Tick()
        {
            var sim = Sim;
            string id = sim.Events.PendingCrisis;
            if (id == shownCrisis) return;
            shownCrisis = id;
            if (string.IsNullOrEmpty(id))
            {
                crisisPanel.gameObject.SetActive(false);
                if (crisisPaused) { ctx.Time?.PopPause(); crisisPaused = false; }
                return;
            }
            int ci = sim.Db.CrisisIndex(id);
            if (ci < 0) return;
            var c = sim.Db.Crises[ci];
            crisisTitle.text = T(c.nameMs, c.nameEn);
            crisisBody.text = T(c.descMs, c.descEn);
            HudKit.ClearChildren(crisisChoices);
            string cur = ctx.Currency;
            for (int k = 0; k < c.choices.Length; k++)
            {
                int choice = k;
                var ch = c.choices[k];
                var b = Kit.Btn(crisisChoices, T(ch.nameMs, ch.nameEn) + (ch.cost > 0 ? "  (" + cur + HudFormat.Fmt(ch.cost) + ")" : "") + "\n" + T(ch.descMs, ch.descEn), () =>
                {
                    if (!sim.ResolveCrisis(choice)) ctx.ShowMessage(T("Wang tidak cukup", "Not enough money"));
                }, 800);
                var t = b.GetComponentInChildren<Text>();
                t.fontSize = FontSize - 4;
                t.alignment = TextAnchor.MiddleLeft;
                b.GetComponent<LayoutElement>().preferredHeight = 64;
            }
            crisisPanel.SetAsLastSibling();   // over any open window
            crisisPanel.gameObject.SetActive(true);
            if (!crisisPaused) { ctx.Time?.PushPause(); crisisPaused = true; }
        }
    }
}
