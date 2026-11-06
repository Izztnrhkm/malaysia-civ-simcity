using System.Text;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Era progress and city timeline in one window (web: src/ui/modals/EraPanel.tsx and
    /// Timeline.tsx). Left: the current era, its introduction and Sejarahpedia link, the
    /// requirements to advance with their state, and Advance. Right: treasury, population and
    /// output over time as small multiples with era bands and a shared hover read-out, or the
    /// same history as a table. Milestones and victory wait for lane C (phase 2).
    /// </summary>
    public sealed class EraTimelinePanel : ModalPanel
    {
        const int MaxReqRows = 10;
        static readonly string[] SeriesKeys = { "timeline.treasury", "timeline.population", "timeline.output" };
        /// <summary>The web game's series colours (validated against its dark panel).</summary>
        static readonly Color[] SeriesColors =
        {
            new Color(0.79f, 0.52f, 0f), new Color(0.22f, 0.53f, 0.90f), new Color(0.10f, 0.62f, 0.44f),
        };

        Text eraName, eraSpan, eraIntro, reqTitle, nextEra;
        Button readMore, advance;
        readonly Text[] reqRows = new Text[MaxReqRows];

        RectTransform chartsView, tableView;
        readonly Text[] tableColumns = new Text[5];
        Button viewToggle, milestonesButton;
        bool showTable, showMilestones;
        MilestoneList milestones;
        RectTransform legend;
        Text header, victoryText;
        readonly LineChartGraphic[] charts = new LineChartGraphic[3];
        readonly HoverFlag[] chartHover = new HoverFlag[3];
        readonly Text[] chartValue = new Text[3];
        readonly Text[,] axis = new Text[3, 3];
        Text emptyText;
        int historyStamp = -1, hover = -1;
        readonly StringBuilder sb = new StringBuilder(512);

        public EraTimelinePanel(HudContext context) : base(context) { }

        protected override string TitleKey => "unity.panel.eraTimeline";
        protected override Vector2 HalfSize => new Vector2(620, 390);

        // ------------------------------------------------------------ construction

        protected override void BuildBody()
        {
            var left = Kit.Card(Body, "Era", HudKit.CardTint, 12);
            HudKit.Stretch(left, Vector2.zero, new Vector2(0.37f, 1), Vector2.zero, Vector2.zero);
            Kit.Localize(Kit.Line(left, "", FontSize - 6, 20), () => Loc.Get("era.current").ToUpperInvariant());
            eraName = Kit.Para(left, "", FontSize + 2, Kit.AccentColor);
            eraName.fontStyle = FontStyle.Bold;
            eraSpan = Kit.Para(left, "", FontSize - 5);
            eraIntro = Kit.Para(left, "", FontSize - 5);
            readMore = Kit.Btn(left, "", () => { var e = Sim?.EraDef; if (e != null) ctx.OpenEntry?.Invoke(e.entryId); }, 0);
            Kit.Localize(readMore.GetComponentInChildren<Text>(), () => "> " + Loc.Get("info.readMore"));
            readMore.GetComponentInChildren<Text>().fontSize = FontSize - 5;
            readMore.GetComponent<LayoutElement>().preferredHeight = 32;

            reqTitle = Kit.Line(left, "", FontSize - 2, 30);
            reqTitle.fontStyle = FontStyle.Bold;
            for (int i = 0; i < MaxReqRows; i++) reqRows[i] = Kit.Line(left, "", FontSize - 5, 24);
            nextEra = Kit.Para(left, "", FontSize - 5);
            advance = Kit.Btn(left, "", Advance, 0);
            Kit.Localize(advance.GetComponentInChildren<Text>(), () => Loc.Get("era.advance"));
            advance.GetComponent<LayoutElement>().preferredHeight = 46;
            Kit.SetSelected(advance, true);
            victoryText = Kit.Para(left, "", FontSize - 2, HudKit.GoodColor);
            victoryText.fontStyle = FontStyle.Bold;

            // right: charts or table
            var right = new GameObject("Timeline", typeof(RectTransform)).GetComponent<RectTransform>();
            right.SetParent(Body, false);
            HudKit.Stretch(right, new Vector2(0.39f, 0), Vector2.one, Vector2.zero, Vector2.zero);
            header = Kit.Label(right, "Header", FontSize - 2, TextAnchor.MiddleLeft);
            header.color = Kit.AccentColor;
            header.fontStyle = FontStyle.Bold;
            HudKit.Stretch(header.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -34), new Vector2(-346, 0));
            milestonesButton = Kit.Btn(right, () => Loc.Get("timeline.milestones"), () =>
            {
                showMilestones = !showMilestones;
                if (showMilestones) Sim?.Milestones.Refresh();   // values for a window opened between ticks
                historyStamp = -1;
                UpdateTimeline();
            }, 200);
            HudKit.Stretch((RectTransform)milestonesButton.transform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-336, -34), new Vector2(-136, 0));
            milestonesButton.GetComponentInChildren<Text>().fontSize = FontSize - 5;
            viewToggle = Kit.Btn(right, "", () =>
            {
                if (showMilestones) showMilestones = false;
                else showTable = !showTable;
                historyStamp = -1;
                UpdateTimeline();
            }, 130);
            HudKit.Stretch((RectTransform)viewToggle.transform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-130, -34), Vector2.zero);
            viewToggle.GetComponentInChildren<Text>().fontSize = FontSize - 5;

            chartsView = Kit.Column(right, "Charts", Vector2.zero, Vector2.one, new Vector2(0, 32), new Vector2(0, -42));
            chartsView.GetComponent<VerticalLayoutGroup>().spacing = 10;
            for (int s = 0; s < 3; s++) BuildChart(s);

            emptyText = Kit.Label(right, "Empty", FontSize - 4, TextAnchor.MiddleCenter);
            HudKit.Stretch(emptyText.rectTransform, Vector2.zero, Vector2.one, new Vector2(0, 32), new Vector2(0, -42));
            Kit.Localize(emptyText, () => Loc.Get("timeline.empty"));

            tableView = new GameObject("Table", typeof(RectTransform)).GetComponent<RectTransform>();
            tableView.SetParent(right, false);
            HudKit.Stretch(tableView, Vector2.zero, Vector2.one, new Vector2(0, 32), new Vector2(0, -42));
            var tableContent = Kit.ScrollList(tableView, "Rows", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var cols = Kit.HRow(tableContent, "Columns", 0, 12);
            var cle = cols.GetComponent<LayoutElement>();
            cle.preferredHeight = -1;
            cle.minHeight = -1;
            float[] widths = { 50, 70, 150, 150, 150 };
            for (int k = 0; k < tableColumns.Length; k++)
            {
                tableColumns[k] = Kit.Para(cols, "", FontSize - 6);
                tableColumns[k].alignment = k == 0 ? TextAnchor.UpperLeft : TextAnchor.UpperRight;
                HudKit.Size(tableColumns[k], widths[k], -1);
            }

            // era legend
            milestones = new MilestoneList(ctx, right, Vector2.zero, new Vector2(0, -42));

            legend = new GameObject("Legend", typeof(RectTransform)).GetComponent<RectTransform>();
            legend.SetParent(right, false);
            HudKit.Stretch(legend, Vector2.zero, new Vector2(1, 0), Vector2.zero, new Vector2(0, 26));
            var lh = legend.gameObject.AddComponent<HorizontalLayoutGroup>();
            lh.spacing = 6;
            lh.childControlWidth = true;
            lh.childControlHeight = true;
            lh.childForceExpandWidth = false;
            for (int era = 1; era <= 4; era++)
            {
                var sw = new GameObject("Swatch", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
                sw.transform.SetParent(legend, false);
                var c = charts[0].EraBands[era];
                sw.color = new Color(c.r, c.g, c.b, 0.6f);
                sw.raycastTarget = false;
                HudKit.Size(sw, 14, 14);
                int e = era;
                var l = Kit.Line(legend, "", FontSize - 7, 26);
                Kit.Localize(l, () => { var db = GameRoot.Instance?.Db; var rec = db?.Era(e); return rec == null ? "" : T(rec.shortMs, rec.shortEn); });
                HudKit.Size(l, 150, -1);
            }
        }

        void BuildChart(int s)
        {
            var block = Kit.Card(chartsView, SeriesKeys[s], null, 0);
            HudKit.Size(block, -1, -1).flexibleHeight = 1;
            var head = Kit.HRow(block, "Head", 24);
            var swatch = new GameObject("Swatch", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
            swatch.transform.SetParent(head, false);
            swatch.color = SeriesColors[s];
            swatch.raycastTarget = false;
            HudKit.Size(swatch, 14, 10);
            var name = Kit.Line(head, "", FontSize - 4, 24);
            name.fontStyle = FontStyle.Bold;
            HudKit.Size(name, -1, -1).flexibleWidth = 1;
            string key = SeriesKeys[s];
            Kit.Localize(name, () => Loc.Get(key));
            chartValue[s] = Kit.Line(head, "", FontSize - 5, 24, TextAnchor.MiddleRight);
            HudKit.Size(chartValue[s], 240, -1);

            var area = new GameObject("Area", typeof(RectTransform), typeof(LayoutElement)).GetComponent<RectTransform>();
            area.SetParent(block, false);
            var le = area.GetComponent<LayoutElement>();
            le.flexibleHeight = 1;
            le.minHeight = 80;
            var chartGo = new GameObject("Chart", typeof(RectTransform), typeof(CanvasRenderer), typeof(LineChartGraphic), typeof(HoverFlag));
            var chartRt = (RectTransform)chartGo.transform;
            chartRt.SetParent(area, false);
            HudKit.Stretch(chartRt, Vector2.zero, Vector2.one, new Vector2(70, 4), new Vector2(-8, -4));
            charts[s] = chartGo.GetComponent<LineChartGraphic>();
            charts[s].LineColor = SeriesColors[s];
            chartHover[s] = chartGo.GetComponent<HoverFlag>();
            for (int k = 0; k < 3; k++)
            {
                var a = Kit.Label(area, "Axis" + k, FontSize - 8, TextAnchor.MiddleRight);
                float f = k * 0.5f;
                HudKit.Stretch(a.rectTransform, new Vector2(0, f), new Vector2(0, f), new Vector2(0, -10 + 4 - 8 * f), new Vector2(64, 10 + 4 - 8 * f));
                a.color = new Color(Kit.TextColor.r, Kit.TextColor.g, Kit.TextColor.b, 0.6f);
                axis[s, k] = a;
            }
        }

        // ------------------------------------------------------------ refresh

        public override void Refresh()
        {
            if (showMilestones) Sim?.Milestones.Refresh();
            historyStamp = -1;
            UpdateEra();
            UpdateTimeline();
        }

        public override void OnEconomy(EconomySnapshot s)
        {
            if (!IsOpen) return;
            UpdateEra();
            UpdateTimeline();
        }

        public override void OnBind(GameSimulation sim)
        {
            if (IsOpen) Refresh();
        }

        void UpdateEra()
        {
            var sim = Sim;
            if (sim == null) return;
            var e = sim.EraDef;
            eraName.text = "Era " + e.id + ": " + T(e.nameMs, e.nameEn);
            eraSpan.text = T(e.spanMs, e.spanEn);
            eraIntro.text = T(e.introMs, e.introEn);
            readMore.gameObject.SetActive(ctx.OpenEntry != null && sim.Db.Entry(e.entryId) != null);

            bool last = sim.CurrentEra >= 4;
            reqTitle.text = Loc.Get(last ? "era.final" : "era.requirements");
            var reqs = sim.Era.Requirements(sim.Tech, sim.Economy.Population, sim.City);
            int n = 0;
            for (int i = 0; i < reqs.Count && n < MaxReqRows; i++, n++)
            {
                var r = reqs[i];
                sb.Clear();
                sb.Append(r.met ? "<color=#73DB8C>[x]</color>  " : "<color=#F28073>[ ]</color>  ");
                sb.Append("<size=").Append(FontSize - 7).Append('>').Append(Loc.Get("era.req." + r.kind).ToUpperInvariant()).Append("</size>  ");
                sb.Append(RequirementName(sim, r));
                if (r.kind == "population") sb.Append("  ").Append(HudFormat.Fmt(r.current)).Append(" / ").Append(HudFormat.Fmt(r.target));
                reqRows[i].text = sb.ToString();
                if (!reqRows[i].gameObject.activeSelf) reqRows[i].gameObject.SetActive(true);
            }
            for (int i = n; i < MaxReqRows; i++) if (reqRows[i].gameObject.activeSelf) reqRows[i].gameObject.SetActive(false);

            if (!last)
            {
                var ne = sim.Db.Era(sim.CurrentEra + 1);
                nextEra.text = Loc.Get("era.next") + ": <b>" + T(ne.nameMs, ne.nameEn) + "</b> (" + ne.startYear + ")";
            }
            nextEra.gameObject.SetActive(!last);
            advance.gameObject.SetActive(!last);
            advance.interactable = !last && sim.Era.CanAdvance(sim.Tech, sim.Economy.Population, sim.City);
            bool won = last && sim.Milestones.Victory;
            if (won) victoryText.text = Loc.Get("era.victory");
            victoryText.gameObject.SetActive(won);
        }

        string RequirementName(GameSimulation sim, EraRequirement r)
        {
            if (r.kind == "tech" || r.kind == "civic")
            {
                var rec = sim.Db.ResearchById(r.id);
                return rec != null ? T(rec.nameMs, rec.nameEn) : r.id;
            }
            if (r.kind == "landmark")
            {
                var b = sim.Db.Building(r.id);
                return b != null ? T(b.nameMs, b.nameEn) : r.id;
            }
            return Loc.Get("era.req.population");
        }

        void Advance()
        {
            var sim = Sim;
            if (sim == null) return;
            bool ok = ctx.EraManager != null ? ctx.EraManager.TryAdvance() : sim.AdvanceEra();
            if (ok) Close();
            else ctx.ShowMessage(Loc.Get("unity.era.cannot"));
        }

        // ------------------------------------------------------------ timeline

        void UpdateTimeline()
        {
            var sim = Sim;
            if (sim == null) return;
            var h = sim.History;
            int stamp = h.Count == 0 ? 0 : h.Count * 100003 + h[h.Count - 1].tick + (Malay ? 1 : 0);
            HudKit.SetLabel(viewToggle, Loc.Get(showTable || showMilestones ? "unity.timeline.charts" : "unity.timeline.table"));
            Kit.SetSelected(milestonesButton, showMilestones);
            header.text = Loc.Get(showMilestones ? "timeline.milestones" : "timeline.chart");
            milestones.Root.gameObject.SetActive(showMilestones);
            legend.gameObject.SetActive(!showMilestones);
            if (showMilestones)
            {
                emptyText.gameObject.SetActive(false);
                chartsView.gameObject.SetActive(false);
                tableView.gameObject.SetActive(false);
                milestones.Fill(sim);
                return;
            }
            bool empty = h.Count < 2;
            emptyText.gameObject.SetActive(empty);
            chartsView.gameObject.SetActive(!empty && !showTable);
            tableView.gameObject.SetActive(!empty && showTable);
            if (empty || stamp == historyStamp) return;
            historyStamp = stamp;
            if (showTable) FillTable(sim);
            else FillCharts(sim);
        }

        static double Sample(HistoryPoint p, int series) => series == 0 ? p.treasury : series == 1 ? p.population : p.output;

        void FillCharts(GameSimulation sim)
        {
            var h = sim.History;
            int count = Mathf.Min(h.Count, LineChartGraphic.Capacity);
            int offset = h.Count - count;
            for (int s = 0; s < 3; s++)
            {
                var c = charts[s];
                double min = 0, max = 1;
                for (int i = 0; i < count; i++)
                {
                    var p = h[offset + i];
                    double v = Sample(p, s);
                    c.Values[i] = v;
                    c.Eras[i] = p.era;
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
                c.Count = count;
                c.Min = min;
                c.Max = NiceMax(max);
                c.Hover = hover < count ? hover : -1;
                c.SetVerticesDirty();
                for (int k = 0; k < 3; k++) axis[s, k].text = Format(s, c.Min + (c.Max - c.Min) * k * 0.5);
            }
            UpdateValues();
        }

        /// <summary>Web niceMax: round the axis top up to 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 or 10 x 10^n.</summary>
        static double NiceMax(double v)
        {
            if (v <= 0) return 1;
            double p = System.Math.Pow(10, System.Math.Floor(System.Math.Log10(v)));
            double[] steps = NiceSteps;
            for (int i = 0; i < steps.Length; i++) if (steps[i] * p >= v) return steps[i] * p;
            return 10 * p;
        }

        static readonly double[] NiceSteps = { 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 };

        string Format(int series, double v) => series == 1 ? HudFormat.Fmt(v) : ctx.Currency + HudFormat.Fmt(v);

        void UpdateValues()
        {
            var h = Sim.History;
            int count = charts[0].Count;
            if (count == 0) return;
            int i = hover >= 0 && hover < count ? hover : count - 1;
            var p = h[h.Count - count + i];
            for (int s = 0; s < 3; s++)
                chartValue[s].text = (hover >= 0 ? p.year + ": " : "") + Format(s, Sample(p, s));
        }

        /// <summary>Newest first, one right-aligned text per column so the figures line up.</summary>
        void FillTable(GameSimulation sim)
        {
            var h = sim.History;
            for (int k = 0; k < tableColumns.Length; k++)
            {
                sb.Clear();
                sb.Append("<b>").Append(k == 0 ? "Era" : k == 1 ? Loc.Get("unity.timeline.year") : Loc.Get(SeriesKeys[k - 2])).Append("</b>");
                for (int i = h.Count - 1; i >= 0; i--)
                {
                    var p = h[i];
                    sb.Append('\n');
                    if (k == 0) sb.Append(p.era);
                    else if (k == 1) sb.Append(p.year);
                    else sb.Append(Format(k - 2, Sample(p, k - 2)));
                }
                tableColumns[k].text = sb.ToString();
            }
        }

        /// <summary>Hover read-out shared by the three charts (like the web crosshair).</summary>
        public override void Tick()
        {
            if (!IsOpen || showTable || !chartsView.gameObject.activeSelf) return;
            int next = -1;
            var mouse = Mouse.current;
            for (int s = 0; s < 3 && mouse != null; s++)
            {
                if (!chartHover[s].Hovered) continue;
                var rt = charts[s].rectTransform;
                if (RectTransformUtility.ScreenPointToLocalPointInRectangle(rt, mouse.position.ReadValue(), null, out var local))
                    next = charts[s].IndexAt(local.x);
                break;
            }
            if (next == hover) return;
            hover = next;
            for (int s = 0; s < 3; s++)
            {
                charts[s].Hover = hover;
                charts[s].SetVerticesDirty();
            }
            UpdateValues();
        }
    }
}
