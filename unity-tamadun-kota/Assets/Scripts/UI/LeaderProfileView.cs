using System;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>Shared leader preview, passive descriptions and geographic credits.</summary>
    public sealed class LeaderProfileView
    {
        readonly HudContext ctx;
        readonly RectTransform details;
        readonly LeaderPreview preview;
        readonly Text previewStatus;
        Texture2D mapTexture;
        string shownLeader;

        public LeaderProfileView(HudContext context, RectTransform parent)
        {
            ctx = context;
            var slot = new GameObject("Leader Preview Slot", typeof(RectTransform)).GetComponent<RectTransform>();
            slot.SetParent(parent, false);
            HudKit.Stretch(slot, Vector2.zero, new Vector2(0.4f, 1), new Vector2(0, 42), new Vector2(-10, 0));
            var portrait = new GameObject("3D Leader", typeof(RectTransform), typeof(RawImage), typeof(AspectRatioFitter), typeof(LeaderPreview));
            portrait.transform.SetParent(slot, false);
            var rt = (RectTransform)portrait.transform;
            HudKit.Stretch(rt, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var fit = portrait.GetComponent<AspectRatioFitter>();
            fit.aspectRatio = 2f / 3f;
            fit.aspectMode = AspectRatioFitter.AspectMode.FitInParent;
            portrait.GetComponent<RawImage>().color = Color.white;
            preview = portrait.GetComponent<LeaderPreview>();
            previewStatus = ctx.Kit.Label(rt, "Preview Status", ctx.Kit.FontSize - 4, TextAnchor.MiddleCenter);
            HudKit.Stretch(previewStatus.rectTransform, Vector2.zero, Vector2.one, new Vector2(10, 0), new Vector2(-10, 0));
            var controls = ctx.Kit.Row(parent, "Preview Controls", Vector2.zero, new Vector2(0.4f, 0), Vector2.zero, new Vector2(-10, 36));
            ctx.Kit.Btn(controls, "<", () => preview.Rotate(-25), 40);
            ctx.Kit.Btn(controls, () => Loc.Get("leader.greet"), preview.Greet, 110);
            ctx.Kit.Btn(controls, ">", () => preview.Rotate(25), 40);
            details = ctx.Kit.ScrollList(parent, "Leader Details", new Vector2(0.4f, 0), Vector2.one, new Vector2(8, 0), Vector2.zero, 8);
        }

        string T(string ms, string en) => ctx.T(ms, en);

        public void Show(StateRecord state, LeaderRecord leader)
        {
            HudKit.ClearChildren(details);
            ReleaseMap();
            if (state == null || leader == null)
            {
                preview.Release();
                shownLeader = null;
                ctx.Kit.Para(details, Loc.Get("leader.legacy"), ctx.Kit.FontSize);
                previewStatus.text = "";
                return;
            }
            var kit = ctx.Kit;
            int size = kit.FontSize;
            kit.Para(details, "<b>" + T(state.nameMs, state.nameEn) + "</b>", size + 3, kit.AccentColor);
            kit.Para(details, "<b>" + leader.name + "</b>", size + 1);
            kit.Para(details, T(leader.titleMs, leader.titleEn), size - 4);
            kit.Para(details, T(state.descMs, state.descEn), size - 4);
            kit.Para(details, "<b>" + Loc.Get("leader.statePassive") + "</b>\n" + T(state.abilityMs, state.abilityEn), size - 3, HudKit.GoodColor);
            kit.Para(details, "<b>" + Loc.Get("leader.leaderPassive") + "</b>\n" + T(leader.abilityMs, leader.abilityEn), size - 3, HudKit.GoodColor);
            kit.Para(details, T(leader.bioMs, leader.bioEn), size - 4);
            if (leader.interpretive) kit.Para(details, Loc.Get("leader.interpretive"), size - 6, kit.AccentColor);
            if (leader.sources != null && leader.sources.Length > 0)
            {
                var row = kit.HRow(details, "Historical Sources", 28, 5);
                foreach (var source in leader.sources)
                {
                    var link = source;
                    var b = kit.Btn(row, Loc.Get("leader.source"), () => OpenSource(link.url), 94);
                    b.GetComponentInChildren<Text>().fontSize = size - 5;
                }
            }
            try
            {
                var map = GameDataLoader.LoadMap(state.mapId);
                kit.Para(details, "<b>" + Loc.Get("leader.region") + ": " + T(map.regionMs, map.regionEn) + "</b>", size - 3);
                mapTexture = Resources.Load<Texture2D>(map.previewResource);
                if (mapTexture != null)
                {
                    var slot = new GameObject("Map Preview Slot", typeof(RectTransform), typeof(LayoutElement)).GetComponent<RectTransform>();
                    slot.SetParent(details, false);
                    HudKit.Size(slot, -1, 190);
                    var go = new GameObject("Regional Map", typeof(RectTransform), typeof(RawImage), typeof(AspectRatioFitter));
                    go.transform.SetParent(slot, false);
                    go.GetComponent<RawImage>().texture = mapTexture;
                    go.GetComponent<RawImage>().raycastTarget = false;
                    var fit = go.GetComponent<AspectRatioFitter>();
                    fit.aspectRatio = 1;
                    fit.aspectMode = AspectRatioFitter.AspectMode.FitInParent;
                }
                kit.Para(details, map.attribution, size - 7);
                if (map.sources != null)
                    foreach (var source in map.sources)
                    {
                        string url = source;
                        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != "http" && uri.Scheme != "https")) continue;
                        var button = kit.Btn(details, uri.Host, () => OpenSource(url), 0);
                        button.GetComponent<LayoutElement>().preferredHeight = 28;
                        button.GetComponentInChildren<Text>().fontSize = size - 6;
                    }
            }
            catch (Exception error)
            {
                Debug.LogWarning(error.Message);
                kit.Para(details, Loc.Get("leader.mapUnavailable"), size - 4, HudKit.BadColor);
            }
            if (shownLeader != leader.id || !preview.HasModel) preview.Show(leader);
            shownLeader = leader.id;
            previewStatus.text = preview.HasModel ? "" : Loc.Get("leader.previewUnavailable");
            HudKit.ScrollToTop(details);
        }

        static void OpenSource(string value)
        {
            if (Uri.TryCreate(value, UriKind.Absolute, out var uri) && (uri.Scheme == "http" || uri.Scheme == "https")) Application.OpenURL(value);
        }

        void ReleaseMap()
        {
            if (mapTexture != null) Resources.UnloadAsset(mapTexture);
            mapTexture = null;
        }

        public void Release()
        {
            preview.Release();
            ReleaseMap();
            shownLeader = null;
            Resources.UnloadUnusedAssets();
        }
    }
}
