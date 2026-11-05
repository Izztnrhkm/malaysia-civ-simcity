using System;
using TamadunKota.Core;
using TamadunKota.Data;
using TamadunKota.Simulation;
using TamadunKota.Systems;
using UnityEngine;

namespace TamadunKota.UI
{
    /// <summary>
    /// What every HUD panel shares: the widget kit, the scene managers the UIManager found, the
    /// bound simulation, the last economy snapshot and the other panels (for cross-panel actions
    /// such as "open the Sejarahpedia at this entry").
    /// </summary>
    public sealed class HudContext
    {
        public readonly HudKit Kit;
        public GridPlacementSystem Placement;
        public TimeManager Time;
        public EconomyManager Economy;
        public EraManager EraManager;
        public SaveLoadManager SaveLoad;
        public BuildingCatalog Catalog;

        public GameSimulation Sim;
        public EconomySnapshot Snap;

        /// <summary>Shows a short centred message (set by the UIManager to its MessageBanner).</summary>
        public Action<string> ShowMessage = _ => { };
        /// <summary>Opens the Settings window (null until it exists).</summary>
        public Action OpenSettings;

        // panels, assigned by the UIManager as it builds them
        public TopBarPanel TopBar;
        public ToolBarPanel ToolBar;
        public BuildPalettePanel Palette;
        public NoticeListPanel Notices;
        public MessageBanner Message;
        public InspectorPanel Inspector;
        public ResearchPanel Research;
        public SaveLoadPanel SaveLoadMenu;
        public CrisisPanel Crisis;
        public MainMenuPanel MainMenu;

        public HudContext(HudKit kit) { Kit = kit; }

        /// <summary>The open HUD window, if any (only one at a time; Esc closes it).</summary>
        public IHudModal ActiveModal { get; private set; }

        /// <summary>Called by a window as it opens: closes the window that was open before.</summary>
        public void ModalOpening(IHudModal modal)
        {
            var previous = ActiveModal;
            if (previous != null && previous != modal && previous.IsOpen) previous.Close();
            ActiveModal = modal;
        }

        public void ModalClosed(IHudModal modal)
        {
            if (ActiveModal == modal) ActiveModal = null;
        }

        public bool Malay => GameRoot.Instance == null || GameRoot.Instance.malay;
        public string T(string ms, string en) => Malay ? ms : en;
        public string Currency => Economy != null ? Economy.Currency : "";
    }

    /// <summary>Number and date formatting shared by the panels.</summary>
    public static class HudFormat
    {
        static readonly string[] MonthsMs = { "Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis" };
        static readonly string[] MonthsEn = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };

        public static string MonthName(int m, bool malay)
        {
            m = Mathf.Clamp(m, 0, 11);
            return malay ? MonthsMs[m] : MonthsEn[m];
        }

        /// <summary>Compact number: 12345 -> "12k", 2500000 -> "2.5M".</summary>
        public static string Fmt(double v)
        {
            double a = Math.Abs(v);
            if (a >= 1e6) return (v / 1e6).ToString("0.0") + "M";
            if (a >= 1e4) return (v / 1e3).ToString("0") + "k";
            return v.ToString("0");
        }
    }

    /// <summary>
    /// One part of the HUD. Plain C# (not a MonoBehaviour), so the generated scene only needs the
    /// UIManager component; the UIManager forwards its lifecycle and events to every panel.
    /// </summary>
    public abstract class HudPanel
    {
        protected readonly HudContext ctx;
        protected HudPanel(HudContext context) { ctx = context; }

        protected HudKit Kit => ctx.Kit;
        protected GameSimulation Sim => ctx.Sim;
        protected bool Malay => ctx.Malay;
        protected int FontSize => ctx.Kit.FontSize;
        protected string T(string ms, string en) => ctx.T(ms, en);

        /// <summary>Create the panel's widgets under the canvas root.</summary>
        public abstract void Build(RectTransform root);
        /// <summary>A new or loaded simulation was bound (may be null).</summary>
        public virtual void OnBind(GameSimulation sim) { }
        /// <summary>The language changed; static labels are already relabelled by the kit.</summary>
        public virtual void OnLanguage() { }
        /// <summary>A new economy snapshot was published (once per tick).</summary>
        public virtual void OnEconomy(EconomySnapshot s) { }
        /// <summary>Called every frame while a simulation is bound. Must not allocate.</summary>
        public virtual void Tick() { }
    }
}
