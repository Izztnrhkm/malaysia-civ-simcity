using System.Text;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Top bar (resources on the left, population / happiness / date / era on the right) and the
    /// controls row under it: speed, the window buttons (research, era & timeline, economy,
    /// advisors, save/load, menu), language, the
    /// "Greybox / Full 3D Art" toggle and the demand / tax status.
    /// </summary>
    public sealed class TopBarPanel : HudPanel
    {
        Text resourceText, dateText, statusText, artToggleLabel;
        readonly StringBuilder sb = new StringBuilder(256);

        /// <summary>The scene's art toggle (from the setup menu) or the one created here.</summary>
        public Button ArtToggleButton { get; private set; }

        public TopBarPanel(HudContext context, Button sceneArtToggle) : base(context) { ArtToggleButton = sceneArtToggle; }

        public override void Build(RectTransform root)
        {
            var top = Kit.Panel(root, "Top Bar", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -64), Vector2.zero);
            resourceText = Kit.Label(top, "Resources", FontSize, TextAnchor.MiddleLeft);
            HudKit.Stretch(resourceText.rectTransform, new Vector2(0, 0), new Vector2(0.62f, 1), new Vector2(16, 0), Vector2.zero);
            dateText = Kit.Label(top, "Date", FontSize, TextAnchor.MiddleRight);
            HudKit.Stretch(dateText.rectTransform, new Vector2(0.62f, 0), new Vector2(1, 1), Vector2.zero, new Vector2(-16, 0));

            // second row: speed + options
            var bar = Kit.Row(root, "Controls", new Vector2(0, 1), new Vector2(1, 1), new Vector2(8, -112), new Vector2(-8, -68));
            Kit.Btn(bar, "II", () => ctx.Time?.SetSpeed(0), 52);
            Kit.Btn(bar, ">", () => ctx.Time?.SetSpeed(1), 52);
            Kit.Btn(bar, ">>", () => ctx.Time?.SetSpeed(2), 52);
            Kit.Btn(bar, ">>>", () => ctx.Time?.SetSpeed(3), 60);
            Kit.Spacer(bar, 16);
            Kit.Btn(bar, () => T("Kajian", "Research"), () => ctx.Research.Toggle(), 130);
            Kit.Btn(bar, () => Loc.Get("unity.top.era"), () => ctx.EraWindow.Toggle(), 80);
            Kit.Btn(bar, () => Loc.Get("panel.economy"), () => ctx.EconomyWindow.Toggle(), 110);
            Kit.Btn(bar, () => Loc.Get("unity.top.advisors"), () => ctx.Advisors.Toggle(), 120);
            Kit.Btn(bar, () => T("Simpan/Muat", "Save/Load"), () => ctx.SaveLoadMenu.Toggle(), 150);
            Kit.Btn(bar, () => "BM / EN", () => GameRoot.Instance?.SetLanguage(!Malay), 110);
            Kit.Btn(bar, () => Loc.Get("unity.menu.button"), () => ctx.MainMenu.Show(true), 80);
            Kit.Spacer(bar, 16);
            if (ArtToggleButton == null) ArtToggleButton = Kit.Btn(bar, "", null, 220);
            else ArtToggleButton.transform.SetParent(bar, false);
            // The setup menu wires a persistent listener (ArtModeToggle.Toggle) visible in the
            // Inspector; only add a runtime one when the button has none, or it would toggle twice.
            if (ArtToggleButton.onClick.GetPersistentEventCount() == 0)
            {
                ArtToggleButton.onClick.RemoveAllListeners();
                ArtToggleButton.onClick.AddListener(ArtMode.Toggle);
            }
            artToggleLabel = ArtToggleButton.GetComponentInChildren<Text>();
            OnArtMode(ArtMode.Greybox);
            statusText = Kit.Label(bar, "Status", FontSize - 2, TextAnchor.MiddleLeft);
            statusText.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
        }

        public override void OnLanguage() => OnArtMode(ArtMode.Greybox);

        public void OnArtMode(bool greybox)
        {
            if (artToggleLabel != null)
                artToggleLabel.text = greybox ? T("Seni 3D Penuh", "Full 3D Art") : T("Mod Greybox", "Greybox Mode");
        }

        public override void OnEconomy(EconomySnapshot s)
        {
            string cur = ctx.Currency;
            sb.Clear();
            sb.Append(cur).Append(' ').Append(HudFormat.Fmt(s.treasury));
            sb.Append(s.netIncome >= 0 ? "  (+" : "  (").Append(HudFormat.Fmt(s.netIncome)).Append(")");
            sb.Append("   ").Append(T("Makanan ", "Food ")).Append(HudFormat.Fmt(s.food));
            sb.Append("   ").Append(T("Kayu ", "Timber ")).Append(HudFormat.Fmt(s.timber));
            sb.Append("   ").Append(T("Bijih timah ", "Tin ")).Append(HudFormat.Fmt(s.tin));
            sb.Append("   ").Append(T("Getah ", "Rubber ")).Append(HudFormat.Fmt(s.rubber));
            sb.Append("   ").Append(T("Tenaga ", "Energy ")).Append(HudFormat.Fmt(s.energy));
            sb.Append("   ").Append(T("Teknologi ", "Tech ")).Append(HudFormat.Fmt(s.tech));
            resourceText.text = sb.ToString();

            var sim = Sim;
            var era = sim != null ? sim.EraDef : null;
            sb.Clear();
            sb.Append(T("Penduduk ", "Pop ")).Append(HudFormat.Fmt(s.population));
            sb.Append("   ").Append(T("Gembira ", "Happy ")).Append(((int)s.happiness).ToString()).Append('%');
            sb.Append("   ").Append(HudFormat.MonthName(s.month, Malay)).Append(' ').Append(s.year.ToString());
            if (era != null) sb.Append("   ").Append(T(era.shortMs, era.shortEn));
            dateText.text = sb.ToString();

            sb.Clear();
            sb.Append("R ").Append(((int)s.demandR).ToString()).Append("  C ").Append(((int)s.demandC).ToString()).Append("  I ").Append(((int)s.demandI).ToString());
            if (sim != null) sb.Append("   ").Append(T("Cukai ", "Tax ")).Append(sim.TaxR.ToString("0")).Append('/').Append(sim.TaxC.ToString("0")).Append('/').Append(sim.TaxI.ToString("0")).Append('%');
            statusText.text = sb.ToString();
        }
    }
}
