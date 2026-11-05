using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>Research picker: current technology and civic with progress, and up to 12 available choices.</summary>
    public sealed class ResearchPanel : HudPanel
    {
        RectTransform researchPanel, researchList;
        Text researchStatus;
        readonly StringBuilder sb = new StringBuilder(256);

        public ResearchPanel(HudContext context) : base(context) { }

        public bool IsOpen => researchPanel != null && researchPanel.gameObject.activeSelf;

        public override void Build(RectTransform root)
        {
            researchPanel = Kit.Panel(root, "Research", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-420, -330), new Vector2(420, 330));
            researchStatus = Kit.Label(researchPanel, "Status", FontSize - 2, TextAnchor.UpperLeft);
            HudKit.Stretch(researchStatus.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(12, -70), new Vector2(-12, -8));
            researchList = Kit.Column(researchPanel, "List", Vector2.zero, Vector2.one, new Vector2(12, 12), new Vector2(-12, -76));
            researchPanel.gameObject.SetActive(false);
        }

        public void Toggle()
        {
            bool show = !researchPanel.gameObject.activeSelf;
            researchPanel.gameObject.SetActive(show);
            if (show) Rebuild();
        }

        public override void OnLanguage()
        {
            if (IsOpen) Rebuild();
        }

        public override void Tick()
        {
            if (IsOpen) UpdateStatus();
        }

        void Rebuild()
        {
            var sim = Sim;
            if (sim == null) return;
            HudKit.ClearChildren(researchList);
            var db = sim.Db;
            int shown = 0;
            for (int i = 0; i < db.Research.Length && shown < 12; i++)
            {
                if (!sim.Tech.CanResearch(i, sim.CurrentEra)) continue;
                var r = db.Research[i];
                int index = i;
                string kind = r.IsTech ? T("Teknologi", "Tech") : T("Sivik", "Civic");
                bool current = index == sim.Tech.CurrentTech || index == sim.Tech.CurrentCivic;
                var b = Kit.Btn(researchList, (current ? "> " : "") + kind + ": " + T(r.nameMs, r.nameEn) + "  (" + r.cost.ToString("0") + ")", () =>
                {
                    sim.Tech.Select(index, sim.CurrentEra);
                    Rebuild();
                }, 760);
                b.GetComponentInChildren<Text>().alignment = TextAnchor.MiddleLeft;
                shown++;
            }
            UpdateStatus();
        }

        void UpdateStatus()
        {
            var sim = Sim;
            var db = sim.Db;
            sb.Clear();
            int t = sim.Tech.CurrentTech, c = sim.Tech.CurrentCivic;
            sb.Append(T("Teknologi: ", "Technology: ")).Append(t >= 0 ? T(db.Research[t].nameMs, db.Research[t].nameEn) + "  " + (int)(100 * sim.Tech.Progress[t] / Mathf.Max(1, (float)db.Research[t].cost)) + "%" : "-");
            sb.Append('\n').Append(T("Sivik: ", "Civic: ")).Append(c >= 0 ? T(db.Research[c].nameMs, db.Research[c].nameEn) + "  " + (int)(100 * sim.Tech.Progress[c] / Mathf.Max(1, (float)db.Research[c].cost)) + "%" : "-");
            researchStatus.text = sb.ToString();
        }
    }
}
