using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Horizontally scrolling palette of the buildings unlocked in the current era. Rebuilt only
    /// when the era, the finished research or the language changes (checked with a cheap
    /// signature every frame, no allocations).
    /// </summary>
    public sealed class BuildPalettePanel : HudPanel
    {
        RectTransform palette;
        int signature = -1;

        public BuildPalettePanel(HudContext context) : base(context) { }

        /// <summary>Force a rebuild on the next frame.</summary>
        public void Invalidate() => signature = -1;

        public override void Build(RectTransform root)
        {
            var paletteBg = Kit.Panel(root, "Build Palette", new Vector2(0, 0), new Vector2(1, 0), new Vector2(8, 8), new Vector2(-8, 120));
            var scrollGo = new GameObject("Scroll", typeof(RectTransform), typeof(Image), typeof(Mask), typeof(ScrollRect));
            var scrollRt = (RectTransform)scrollGo.transform;
            scrollRt.SetParent(paletteBg, false);
            HudKit.Stretch(scrollRt, Vector2.zero, Vector2.one, new Vector2(6, 6), new Vector2(-6, -6));
            scrollGo.GetComponent<Image>().color = new Color(0, 0, 0, 0.01f);
            scrollGo.GetComponent<Mask>().showMaskGraphic = false;
            palette = new GameObject("Content", typeof(RectTransform)).GetComponent<RectTransform>();
            palette.SetParent(scrollRt, false);
            palette.anchorMin = new Vector2(0, 0);
            palette.anchorMax = new Vector2(0, 1);
            palette.pivot = new Vector2(0, 0.5f);
            palette.offsetMin = Vector2.zero;
            palette.offsetMax = Vector2.zero;
            var h = palette.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = 6;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = true;
            palette.gameObject.AddComponent<ContentSizeFitter>().horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            var sr = scrollGo.GetComponent<ScrollRect>();
            sr.content = palette;
            sr.horizontal = true;
            sr.vertical = false;
            sr.scrollSensitivity = 30;
        }

        public override void OnBind(GameSimulation sim) => signature = -1;
        public override void OnLanguage() => signature = -1;

        public override void Tick()
        {
            int sig = Signature();
            if (sig == signature) return;
            signature = sig;
            Rebuild();
        }

        int Signature()
        {
            var sim = Sim;
            int h = sim.CurrentEra * 7919 + (Malay ? 1 : 0);
            var done = sim.Tech.Done;
            for (int i = 0; i < done.Length; i++) if (done[i]) h = h * 31 + i;
            return h;
        }

        void Rebuild()
        {
            if (palette == null || ctx.Catalog == null) return;
            HudKit.ClearChildren(palette);
            var sim = Sim;
            var db = sim.Db;
            for (int i = 0; i < db.Buildings.Length; i++)
            {
                var rec = db.Buildings[i];
                if (!sim.IsUnlocked(i)) continue;
                if (rec.obsoleteAfterEra > 0 && sim.CurrentEra > rec.obsoleteAfterEra) continue;
                var data = ctx.Catalog.Find(rec.id);
                if (data == null) continue;
                string cur = ctx.Currency;
                var b = Kit.Btn(palette, data.DisplayName(Malay) + "\n" + cur + HudFormat.Fmt(rec.cost), () => ctx.Placement?.SelectBuilding(data), 168);
                b.GetComponentInChildren<Text>().fontSize = FontSize - 4;
            }
        }
    }
}
