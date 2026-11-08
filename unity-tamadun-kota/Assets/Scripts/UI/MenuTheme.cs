using System;
using System.Globalization;
using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>Menu-only styling; the gameplay widget kit keeps its existing appearance.</summary>
    public static class MenuTheme
    {
        public static readonly Color Ink = new Color32(9, 35, 39, 255);
        public static readonly Color Teal = new Color32(20, 55, 57, 255);
        public static readonly Color Brass = new Color32(218, 181, 115, 255);
        public static readonly Color Ivory = new Color32(248, 239, 219, 255);
        public static readonly Color Muted = new Color32(194, 205, 197, 255);
        public static readonly Color Error = new Color32(255, 178, 158, 255);
        static Font heading;

        public static Text Text(HudContext ctx, Transform parent, string name, int size = 24, bool display = false)
        {
            var t = ctx.Kit.Label(parent, name, size, TextAnchor.UpperLeft);
            t.color = Ivory;
            t.supportRichText = false;
            if (display)
            {
                if (heading == null) heading = Resources.Load<Font>("Menu/CormorantGaramond-SemiBold");
                if (heading != null) t.font = heading;
            }
            return t;
        }

        public static Text Line(HudContext ctx, Transform parent, Func<string> label, int size, float height, bool display = false)
        {
            var t = Text(ctx, parent, "Text", size, display);
            HudKit.Size(t, -1, height);
            ctx.Kit.Localize(t, label);
            return t;
        }

        public static Button Button(HudContext ctx, Transform parent, string name, Func<string> label, UnityAction click, float width = 0, bool primary = false)
        {
            var b = ctx.Kit.Btn(parent, label, click, width);
            b.name = name;
            HudKit.Size(b, width > 0 ? width : -1, 58);
            b.GetComponentInChildren<Text>().fontSize = 24;
            b.transition = Selectable.Transition.None;
            var visual = b.gameObject.AddComponent<MenuButtonVisual>();
            visual.Configure(primary, false);
            return b;
        }

        public static void Emphasis(Button button, bool primary, bool selected = false) => button.GetComponent<MenuButtonVisual>().Configure(primary, selected);

        public static RectTransform Column(Transform parent, string name, float spacing = 12)
        {
            var rt = new GameObject(name, typeof(RectTransform), typeof(VerticalLayoutGroup)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            var group = rt.GetComponent<VerticalLayoutGroup>();
            group.spacing = spacing;
            group.childControlWidth = true;
            group.childControlHeight = true;
            group.childForceExpandWidth = true;
            group.childForceExpandHeight = false;
            return rt;
        }

        public static string SlotName(int slot) => slot == 0 ? Loc.Get("unity.menu.autoSlot") : Loc.Format("unity.menu.slot", "slot", slot);

        public static string SaveDate(string value)
        {
            if (!DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var date)) return "";
            var culture = CultureInfo.GetCultureInfo(Loc.Get("unity.menu.dateCulture"));
            return date.ToLocalTime().ToString("dd MMM yyyy  HH:mm", culture);
        }

        public static string SaveMetadata(SaveSlotInfo info) =>
            Loc.Format("unity.menu.saveMetadata", "era", info.era, "year", info.year) + "   ·   " + SaveDate(info.savedAt);
    }

    /// <summary>A full-screen menu with a safe content area and a stable footer.</summary>
    public sealed class MenuShell
    {
        public readonly RectTransform Root, Header, Content, Footer;
        readonly RawImage panorama;
        readonly Image ground;
        readonly MenuScrim scrim;
        public readonly Text Heading, Kicker;

        public MenuShell(HudContext ctx, RectTransform parent, string name, string titleKey, string kickerKey)
        {
            Root = new GameObject(name, typeof(RectTransform), typeof(Image)).GetComponent<RectTransform>();
            Root.SetParent(parent, false);
            HudKit.Stretch(Root, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            ground = Root.GetComponent<Image>();
            ground.color = MenuTheme.Ink;
            var picture = new GameObject("Panorama", typeof(RectTransform), typeof(RawImage), typeof(AspectRatioFitter));
            picture.transform.SetParent(Root, false);
            panorama = picture.GetComponent<RawImage>();
            // EnvelopeParent crops the sea rather than the skyline on ultrawide displays.
            panorama.rectTransform.pivot = new Vector2(0.5f, 1);
            panorama.texture = Resources.Load<Texture2D>("Menu/heritage-panorama");
            panorama.raycastTarget = false;
            var aspect = picture.GetComponent<AspectRatioFitter>();
            aspect.aspectMode = AspectRatioFitter.AspectMode.EnvelopeParent;
            aspect.aspectRatio = panorama.texture != null ? (float)panorama.texture.width / panorama.texture.height : 16f / 9f;
            scrim = new GameObject("Contrast Scrim", typeof(RectTransform), typeof(MenuScrim)).GetComponent<MenuScrim>();
            scrim.transform.SetParent(Root, false);
            HudKit.Stretch(scrim.rectTransform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            scrim.raycastTarget = false;

            Header = Rect(Root, "Header");
            Content = Rect(Root, "Content");
            Footer = Rect(Root, "Footer");
            var layout = Root.gameObject.AddComponent<MenuSafeLayout>();
            layout.Initialize(Header, Content, Footer);
            Kicker = MenuTheme.Text(ctx, Header, "Kicker", 20);
            Kicker.color = MenuTheme.Brass;
            ctx.Kit.Localize(Kicker, () => Loc.Get(kickerKey));
            HudKit.Stretch(Kicker.rectTransform, new Vector2(0, 1), Vector2.one, new Vector2(0, -28), new Vector2(-240, 0));
            Heading = MenuTheme.Text(ctx, Header, "Heading", 64, true);
            ctx.Kit.Localize(Heading, () => Loc.Get(titleKey));
            HudKit.Stretch(Heading.rectTransform, Vector2.zero, Vector2.one, new Vector2(-3, -3), new Vector2(-240, -24));
            var languages = ctx.Kit.HRow(Header, "Language", 58);
            HudKit.Stretch(languages, new Vector2(1, 1), Vector2.one, new Vector2(-184, -64), Vector2.zero);
            languages.GetComponent<LayoutElement>().ignoreLayout = true;
            var ms = MenuTheme.Button(ctx, languages, "Language BM", () => "BM", () => TamadunKota.Core.GameRoot.Instance?.SetLanguage(true), 80);
            var en = MenuTheme.Button(ctx, languages, "Language EN", () => "EN", () => TamadunKota.Core.GameRoot.Instance?.SetLanguage(false), 80);
            languageMs = ms; languageEn = en;
            var version = MenuTheme.Text(ctx, Footer, "Version", 20);
            version.text = "Tamadun & Kota  ·  " + Application.version;
            version.color = MenuTheme.Muted;
            HudKit.Stretch(version.rectTransform, Vector2.zero, new Vector2(0.5f, 1), Vector2.zero, Vector2.zero);
            for (int i = 0; i < 7; i++)
            {
                var motif = new GameObject("Songket", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
                motif.transform.SetParent(Header, false);
                motif.color = new Color(MenuTheme.Brass.r, MenuTheme.Brass.g, MenuTheme.Brass.b, 0.55f);
                motif.raycastTarget = false;
                HudKit.Stretch(motif.rectTransform, Vector2.zero, Vector2.zero, new Vector2(4 + i * 19, -12), new Vector2(11 + i * 19, -5));
                motif.rectTransform.localRotation = Quaternion.Euler(0, 0, 45);
            }
            Root.gameObject.SetActive(false);
        }

        readonly Button languageMs, languageEn;
        public void RefreshLanguage(bool malay)
        {
            MenuTheme.Emphasis(languageMs, false, malay);
            MenuTheme.Emphasis(languageEn, false, !malay);
        }

        public void Show(bool inGame, bool dense = true)
        {
            panorama.gameObject.SetActive(!inGame && panorama.texture != null);
            ground.color = inGame ? new Color(0.025f, 0.08f, 0.085f, 0.5f) : MenuTheme.Ink;
            scrim.Dense = dense;
            scrim.SetVerticesDirty();
            Root.SetAsLastSibling();
            Root.gameObject.SetActive(true);
        }

        static RectTransform Rect(Transform parent, string name)
        {
            var rt = new GameObject(name, typeof(RectTransform)).GetComponent<RectTransform>();
            rt.SetParent(parent, false);
            return rt;
        }
    }

}
