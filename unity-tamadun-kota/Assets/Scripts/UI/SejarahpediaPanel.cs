using System;
using System.Collections.Generic;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Sejarahpedia browser using the encyclopedia catalog: search
    /// and category filter on the left, the article on the right with summary, body, "in the game",
    /// related entries and sources. Opened from the top bar, the inspector, notifications and the
    /// era panel, and on every era change. List buttons are built once and filtered by toggling.
    /// </summary>
    public sealed class SejarahpediaPanel : ModalPanel
    {
        /// <summary>Encyclopedia category display order.</summary>
        static readonly string[] Categories = { "era", "trade", "economy", "society", "place", "event", "technology" };

        InputField search;
        readonly List<Button> categoryButtons = new List<Button>(8);
        RectTransform list, article;
        readonly List<(Button button, EntryRecord entry)> items = new List<(Button, EntryRecord)>(64);
        string category = "all";
        string selected;
        string[] haystackMs, haystackEn;

        public SejarahpediaPanel(HudContext context) : base(context) { }

        protected override string TitleKey => "panel.encyclopedia";
        protected override Vector2 HalfSize => new Vector2(620, 390);

        protected override void BuildBody()
        {
            var left = new GameObject("Browse", typeof(RectTransform)).GetComponent<RectTransform>();
            left.SetParent(Body, false);
            HudKit.Stretch(left, Vector2.zero, new Vector2(0, 1), Vector2.zero, new Vector2(330, 0));

            var searchRow = Kit.Column(left, "Search", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -38), Vector2.zero);
            search = Kit.Input(searchRow, "", Loc.Get("enc.search"), 0);
            search.onValueChanged.AddListener(_ => ApplyFilter());

            var chips = new GameObject("Categories", typeof(RectTransform)).GetComponent<RectTransform>();
            chips.SetParent(left, false);
            HudKit.Stretch(chips, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -146), new Vector2(0, -46));
            var grid = chips.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(106, 30);
            grid.spacing = new Vector2(6, 4);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 3;
            AddChip(chips, "all", () => Loc.Get("enc.all"));
            foreach (var c in Categories)
            {
                string id = c;
                AddChip(chips, id, () => Loc.Get("enc.cat." + id));
            }

            list = Kit.ScrollList(left, "Entries", Vector2.zero, Vector2.one, Vector2.zero, new Vector2(0, -154), 3);
            var db = GameRoot.Instance != null ? GameRoot.Instance.Db : null;
            if (db != null)
            {
                foreach (var e in db.Entries)
                {
                    var entry = e;
                    var b = Kit.Btn(list, "", () => Select(entry.id), 0);
                    var le = b.GetComponent<LayoutElement>();
                    le.preferredHeight = 50;
                    le.minHeight = 50;
                    var t = b.GetComponentInChildren<Text>();
                    t.alignment = TextAnchor.MiddleLeft;
                    t.supportRichText = true;
                    t.fontSize = FontSize - 5;
                    items.Add((b, entry));
                }
                haystackMs = new string[db.Entries.Length];
                haystackEn = new string[db.Entries.Length];
                for (int i = 0; i < db.Entries.Length; i++)
                {
                    var e = db.Entries[i];
                    haystackMs[i] = (e.titleMs + " " + e.titleEn + " " + e.summaryMs + " " + e.period).ToLowerInvariant();
                    haystackEn[i] = (e.titleMs + " " + e.titleEn + " " + e.summaryEn + " " + e.period).ToLowerInvariant();
                }
                if (db.Entries.Length > 0) selected = db.Entries[0].id;
            }

            article = Kit.ScrollList(Body, "Article", Vector2.zero, Vector2.one, new Vector2(350, 0), Vector2.zero, 8);
        }

        void AddChip(RectTransform parent, string id, Func<string> label)
        {
            var b = Kit.Btn(parent, label, () => { category = id; ApplyFilter(); }, 0);
            b.GetComponentInChildren<Text>().fontSize = FontSize - 7;
            categoryButtons.Add(b);
        }

        /// <summary>Open the browser at an entry (falls back to the current one if the id is unknown).</summary>
        public void OpenAt(string entryId)
        {
            var db = GameRoot.Instance != null ? GameRoot.Instance.Db : null;
            if (db != null && db.Entry(entryId) != null)
            {
                selected = entryId;
                category = "all";
                search.text = "";
            }
            Open();
        }

        void Select(string id)
        {
            selected = id;
            RefreshSelection();
            BuildArticle();
        }

        public override void Refresh()
        {
            search.placeholder.GetComponent<Text>().text = Loc.Get("enc.search");
            for (int i = 0; i < items.Count; i++)
            {
                var e = items[i].entry;
                HudKit.SetLabel(items[i].button, "<b>" + T(e.titleMs, e.titleEn) + "</b>\n<size=" + (FontSize - 8) + ">" + e.period + "</size>");
            }
            ApplyFilter();
            BuildArticle();
        }

        void ApplyFilter()
        {
            string needle = search.text.Trim().ToLowerInvariant();
            var hay = Malay ? haystackMs : haystackEn;
            for (int i = 0; i < items.Count; i++)
            {
                var e = items[i].entry;
                bool show = (category == "all" || e.category == category) && (needle.Length == 0 || (hay != null && hay[i].Contains(needle)));
                items[i].button.gameObject.SetActive(show);
            }
            for (int i = 0; i < categoryButtons.Count; i++)
                Kit.SetSelected(categoryButtons[i], (i == 0 ? "all" : Categories[i - 1]) == category);
            RefreshSelection();
        }

        void RefreshSelection()
        {
            for (int i = 0; i < items.Count; i++) Kit.SetSelected(items[i].button, items[i].entry.id == selected);
        }

        void BuildArticle()
        {
            HudKit.ClearChildren(article);
            var db = GameRoot.Instance != null ? GameRoot.Instance.Db : null;
            var e = db?.Entry(selected);
            if (e == null) return;

            string cat = Loc.Has("enc.cat." + e.category) ? Loc.Get("enc.cat." + e.category) : e.category;
            Kit.Para(article, (cat + "  ·  " + e.period).ToUpperInvariant(), FontSize - 7, Kit.AccentColor);
            var title = Kit.Para(article, T(e.titleMs, e.titleEn), FontSize + 8);
            title.fontStyle = FontStyle.Bold;
            Kit.Para(article, "<i>" + T(e.summaryMs, e.summaryEn) + "</i>", FontSize - 3);
            var body = T(e.bodyMs, e.bodyEn) ?? "";
            foreach (var para in body.Split(new[] { "\n\n" }, StringSplitOptions.RemoveEmptyEntries)) Kit.Para(article, para, FontSize - 4);

            var inGame = Kit.Card(article, "In Game", new Color(0.3f, 0.22f, 0.05f, 0.45f), 10);
            Kit.Para(inGame, "<b>" + Loc.Get("enc.inGame").ToUpperInvariant() + "</b>", FontSize - 7, Kit.AccentColor);
            Kit.Para(inGame, T(e.inGameMs, e.inGameEn), FontSize - 4);

            if (e.related.Length > 0)
            {
                Kit.Para(article, Loc.Get("enc.related") + ":", FontSize - 6);
                var rel = new GameObject("Related", typeof(RectTransform)).GetComponent<RectTransform>();
                rel.SetParent(article, false);
                var grid = rel.gameObject.AddComponent<GridLayoutGroup>();
                grid.cellSize = new Vector2(250, 30);
                grid.spacing = new Vector2(6, 4);
                grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                grid.constraintCount = 3;
                foreach (var r in e.related)
                {
                    var re = db.Entry(r);
                    if (re == null) continue;
                    string id = r;
                    Kit.Btn(rel, T(re.titleMs, re.titleEn), () => Select(id), 0).GetComponentInChildren<Text>().fontSize = FontSize - 7;
                }
            }

            Kit.Para(article, "<b>" + Loc.Get("enc.sources") + "</b>", FontSize - 5, Kit.AccentColor);
            foreach (var s in e.sources)
            {
                string url = s.url;
                var b = Kit.Btn(article, s.title, () => Application.OpenURL(url), 0);
                var t = b.GetComponentInChildren<Text>();
                t.alignment = TextAnchor.MiddleLeft;
                t.fontSize = FontSize - 6;
                t.color = HudKit.InfoColor;
                b.GetComponent<Image>().color = new Color(0, 0, 0, 0.15f);
                b.GetComponent<LayoutElement>().preferredHeight = 30;
            }
            var note = Kit.Para(article, Loc.Get("enc.disclaimer"), FontSize - 7);
            note.color = new Color(Kit.TextColor.r, Kit.TextColor.g, Kit.TextColor.b, 0.6f);
            HudKit.ScrollToTop(article);
        }
    }
}
