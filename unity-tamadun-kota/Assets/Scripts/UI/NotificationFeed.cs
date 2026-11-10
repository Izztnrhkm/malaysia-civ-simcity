using System;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Bottom-left notification feed for the engine's notices:
    /// events, era changes, crises, finished research. Up to five cards, newest on top; each
    /// stays for <see cref="VisibleSeconds"/> (hovering restarts the timer), then fades out.
    /// Cards are pooled: a notice only rewrites texts, and the frame update only sets alpha.
    /// </summary>
    public sealed class NotificationFeed : HudPanel
    {
        public const int MaxCards = 5;
        public const float VisibleSeconds = 9f;
        public const float FadeSeconds = 1.5f;
        const float CardHeight = 82;

        sealed class Card
        {
            public RectTransform rt;
            public CanvasGroup group;
            public Image background, stripe;
            public Text title, body;
            public Button more;
            public HoverFlag hover;
            public Notice notice;
            public string entryId;
            public float shownAt;
            public bool active;
        }

        readonly Card[] cards = new Card[MaxCards];
        RectTransform list;

        public NotificationFeed(HudContext context) : base(context) { }

        public override void Build(RectTransform root)
        {
            list = new GameObject("Notifications", typeof(RectTransform)).GetComponent<RectTransform>();
            list.SetParent(root, false);
            HudKit.Stretch(list, Vector2.zero, Vector2.zero, new Vector2(8, 184), new Vector2(452, 184 + MaxCards * (CardHeight + 6)));
            var v = list.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 6;
            v.childAlignment = TextAnchor.LowerLeft;
            v.childControlWidth = true;
            v.childControlHeight = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            for (int i = 0; i < MaxCards; i++) cards[i] = BuildCard(i);
        }

        Card BuildCard(int i)
        {
            var c = new Card();
            var go = new GameObject("Notice" + i, typeof(RectTransform), typeof(Image), typeof(CanvasGroup), typeof(LayoutElement), typeof(HoverFlag));
            c.rt = (RectTransform)go.transform;
            c.rt.SetParent(list, false);
            c.background = go.GetComponent<Image>();
            c.background.color = Kit.PanelColor;
            c.group = go.GetComponent<CanvasGroup>();
            c.hover = go.GetComponent<HoverFlag>();
            var le = go.GetComponent<LayoutElement>();
            le.preferredHeight = CardHeight;
            le.minHeight = CardHeight;

            c.stripe = new GameObject("Stripe", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
            c.stripe.transform.SetParent(c.rt, false);
            HudKit.Stretch(c.stripe.rectTransform, Vector2.zero, new Vector2(0, 1), Vector2.zero, new Vector2(5, 0));
            c.stripe.raycastTarget = false;

            c.title = Kit.Label(c.rt, "Title", FontSize - 4, TextAnchor.UpperLeft);
            c.title.fontStyle = FontStyle.Bold;
            HudKit.Stretch(c.title.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(14, -30), new Vector2(-40, -6));
            c.body = Kit.Label(c.rt, "Body", FontSize - 7, TextAnchor.UpperLeft);
            HudKit.Stretch(c.body.rectTransform, Vector2.zero, Vector2.one, new Vector2(14, 26), new Vector2(-10, -30));

            var close = Kit.Btn(c.rt, "x", () => Dismiss(c), 28);
            HudKit.Stretch((RectTransform)close.transform, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-34, -32), new Vector2(-6, -4));
            close.GetComponent<Image>().color = new Color(0, 0, 0, 0);
            c.more = Kit.Btn(c.rt, "", () => { if (c.entryId != null) ctx.OpenEntry?.Invoke(c.entryId); }, 0);
            HudKit.Stretch((RectTransform)c.more.transform, new Vector2(0, 0), new Vector2(0, 0), new Vector2(10, 3), new Vector2(250, 25));
            c.more.GetComponent<Image>().color = new Color(0, 0, 0, 0);
            var mt = c.more.GetComponentInChildren<Text>();
            mt.fontSize = FontSize - 7;
            mt.alignment = TextAnchor.MiddleLeft;
            mt.color = Kit.AccentColor;
            Kit.Localize(mt, () => "> " + Loc.Get("info.readMore"));

            go.SetActive(false);
            return c;
        }

        public void OnNotice(Notice n)
        {
            // reuse a free card, else the oldest one
            Card c = null;
            for (int i = 0; i < cards.Length; i++) if (!cards[i].active) { c = cards[i]; break; }
            if (c == null)
            {
                c = cards[0];
                for (int i = 1; i < cards.Length; i++) if (cards[i].shownAt < c.shownAt) c = cards[i];
            }
            c.notice = n;
            c.entryId = ResolveEntry(n);
            Color k = KindColor(n.kind);
            c.stripe.color = k;
            c.title.color = n.kind == NoticeKind.Era ? Kit.AccentColor : Kit.TextColor;
            c.background.color = n.kind == NoticeKind.Era ? new Color(0.22f, 0.16f, 0.05f, 0.92f) : Kit.PanelColor;
            FillTexts(c);
            c.shownAt = Time.unscaledTime;
            c.active = true;
            c.group.alpha = 1;
            c.rt.SetAsFirstSibling();   // newest on top
            c.rt.gameObject.SetActive(true);
        }

        void FillTexts(Card c)
        {
            c.title.text = Malay ? c.notice.titleMs : c.notice.titleEn;
            c.body.text = Malay ? c.notice.bodyMs : c.notice.bodyEn;
            c.more.gameObject.SetActive(c.entryId != null && ctx.OpenEntry != null);
        }

        public override void OnLanguage()
        {
            for (int i = 0; i < cards.Length; i++) if (cards[i].active) FillTexts(cards[i]);
        }

        public override void OnBind(GameSimulation sim)
        {
            for (int i = 0; i < cards.Length; i++) Dismiss(cards[i]);
        }

        void Dismiss(Card c)
        {
            c.active = false;
            if (c.rt != null) c.rt.gameObject.SetActive(false);   // null while the scene unloads
        }

        public override void Tick()
        {
            float now = Time.unscaledTime;
            for (int i = 0; i < cards.Length; i++)
            {
                var c = cards[i];
                if (!c.active) continue;
                if (c.hover.Hovered) c.shownAt = Mathf.Max(c.shownAt, now - VisibleSeconds);
                float age = now - c.shownAt;
                float alpha = age <= VisibleSeconds ? 1f : 1f - (age - VisibleSeconds) / FadeSeconds;
                if (alpha <= 0f) { Dismiss(c); continue; }
                if (c.group.alpha != alpha) c.group.alpha = alpha;
            }
        }

        Color KindColor(NoticeKind kind)
        {
            switch (kind)
            {
                case NoticeKind.Good: return HudKit.GoodColor;
                case NoticeKind.Bad: return HudKit.BadColor;
                case NoticeKind.Event: return Kit.AccentColor;
                case NoticeKind.Era: return Kit.AccentColor;
                default: return HudKit.InfoColor;
            }
        }

        /// <summary>
        /// The Sejarahpedia entry a notice is about. Notices carry no ids yet (see the Requests in
        /// docs/TEAM_PLAN.md), so this matches them to their records once, when they arrive.
        /// </summary>
        string ResolveEntry(Notice n)
        {
            var sim = Sim;
            if (sim == null) return null;
            var db = sim.Db;
            string id = null;
            switch (n.kind)
            {
                case NoticeKind.Era:
                    id = sim.EraDef.entryId;
                    break;
                case NoticeKind.Bad:
                    int ci = db.CrisisIndex(sim.Events.PendingCrisis);
                    if (ci >= 0) id = db.Crises[ci].entryId;
                    break;
                case NoticeKind.Event:
                    foreach (var ev in db.Events) if (ev.nameEn == n.titleEn) { id = ev.entryId; break; }
                    break;
                case NoticeKind.Good:
                    foreach (var r in db.Research)
                        if (!string.IsNullOrEmpty(r.nameEn) && n.titleEn != null && n.titleEn.EndsWith(": " + r.nameEn, StringComparison.Ordinal)) { id = r.entryId; break; }
                    break;
            }
            return !string.IsNullOrEmpty(id) && db.Entry(id) != null ? id : null;
        }
    }
}
