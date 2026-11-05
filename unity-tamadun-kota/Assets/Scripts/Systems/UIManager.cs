using System.Collections.Generic;
using TamadunKota.Core;
using TamadunKota.Data;
using TamadunKota.Simulation;
using TamadunKota.UI;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace TamadunKota.Systems
{
    /// <summary>
    /// The in-game HUD, built from code with uGUI so the scene needs no hand-made prefabs:
    /// resource bar (Treasury, Food, Timber, Tin, Rubber, Energy, Tech), date / era / population,
    /// speed controls, tool bar (inspect, transport, R/C/I zones, bulldoze), a build palette of
    /// the buildings unlocked in the current era, research picker, era advance, crisis dialog,
    /// notification feed, building inspector with its Sejarahpedia summary, BM/EN toggle, save/load,
    /// the "Greybox / Full 3D Art" toggle and the main menu (Esc closes the open window).
    ///
    /// Each part is a panel class in Assets/Scripts/UI (TamadunKota.UI); this component finds the
    /// scene managers, builds the panels in order and forwards events and the frame update to them.
    ///
    /// The setup menu creates the Canvas and the art toggle Button in the scene and assigns
    /// them here; anything left unassigned is created at runtime.
    /// </summary>
    public class UIManager : MonoBehaviour
    {
        [Header("Scene references (optional, created when missing)")]
        public Canvas canvas;
        public Button artToggleButton;
        public GridPlacementSystem placement;
        public TimeManager time;
        public EconomyManager economy;
        public EraManager eraManager;
        public SaveLoadManager saveLoad;
        public BuildingCatalog catalog;

        [Header("Style")]
        public Color panelColor = new Color(0.07f, 0.09f, 0.08f, 0.86f);
        public Color buttonColor = new Color(0.16f, 0.22f, 0.19f, 1f);
        public Color accentColor = new Color(0.93f, 0.72f, 0.25f, 1f);
        public Color textColor = new Color(0.95f, 0.93f, 0.86f, 1f);
        public int fontSize = 20;

        HudContext ctx;
        readonly List<HudPanel> panels = new List<HudPanel>(16);

        string T(string ms, string en) => ctx.T(ms, en);

        // ------------------------------------------------------------ lifecycle

        void Awake()
        {
            if (placement == null) placement = FindAnyObjectByType<GridPlacementSystem>();
            if (time == null) time = FindAnyObjectByType<TimeManager>();
            if (economy == null) economy = FindAnyObjectByType<EconomyManager>();
            if (eraManager == null) eraManager = FindAnyObjectByType<EraManager>();
            if (saveLoad == null) saveLoad = FindAnyObjectByType<SaveLoadManager>();
            if (catalog == null && GameRoot.Instance != null) catalog = GameRoot.Instance.catalog;
            EnsureEventSystem();
            Build();
        }

        void OnEnable()
        {
            if (economy != null) economy.Updated += OnEconomy;
            if (placement != null)
            {
                placement.Message += ShowMessage;
                placement.CellInspected += Inspect;
            }
            if (eraManager != null) eraManager.OnEraAdvanced += OnEra;
            if (saveLoad != null)
            {
                saveLoad.Saved += OnSaved;
                saveLoad.Loaded += OnLoaded;
                saveLoad.Failed += ShowMessage;
            }
            SteamworksManager.AchievementUnlocked += OnAchievement;
            ArtMode.Changed += OnArtMode;
            if (GameRoot.Instance != null)
            {
                GameRoot.Instance.SimulationChanged += Bind;
                GameRoot.Instance.LanguageChanged += OnLanguage;
                Bind(GameRoot.Instance.Sim);
            }
        }

        void OnDisable()
        {
            if (economy != null) economy.Updated -= OnEconomy;
            if (placement != null)
            {
                placement.Message -= ShowMessage;
                placement.CellInspected -= Inspect;
            }
            if (eraManager != null) eraManager.OnEraAdvanced -= OnEra;
            if (saveLoad != null)
            {
                saveLoad.Saved -= OnSaved;
                saveLoad.Loaded -= OnLoaded;
                saveLoad.Failed -= ShowMessage;
            }
            SteamworksManager.AchievementUnlocked -= OnAchievement;
            ArtMode.Changed -= OnArtMode;
            if (GameRoot.Instance != null)
            {
                GameRoot.Instance.SimulationChanged -= Bind;
                GameRoot.Instance.LanguageChanged -= OnLanguage;
            }
            Bind(null);
        }

        void Bind(GameSimulation s)
        {
            if (ctx.Sim != null) ctx.Sim.NoticePosted -= OnNotice;
            ctx.Sim = s;
            if (s != null) s.NoticePosted += OnNotice;
            for (int i = 0; i < panels.Count; i++) panels[i].OnBind(s);
        }

        void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.escapeKey.wasPressedThisFrame)
            {
                if (ctx.ActiveModal != null) ctx.ActiveModal.Close();
                else ctx.MainMenu.OnEscape();
            }
            if (ctx.Sim == null) return;
            for (int i = 0; i < panels.Count; i++) panels[i].Tick();
        }

        // ------------------------------------------------------------ construction

        static void EnsureEventSystem()
        {
            if (EventSystem.current != null || FindAnyObjectByType<EventSystem>() != null) return;
            new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
        }

        void Build()
        {
            if (canvas == null)
            {
                var go = new GameObject("HUD Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
                canvas = go.GetComponent<Canvas>();
                canvas.renderMode = RenderMode.ScreenSpaceOverlay;
                var scaler = go.GetComponent<CanvasScaler>();
                scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
                scaler.referenceResolution = new Vector2(1600, 900);
                scaler.matchWidthOrHeight = 0.5f;
            }
            var existingScaler = canvas.GetComponent<CanvasScaler>();
            if (existingScaler != null)
            {
                existingScaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
                existingScaler.referenceResolution = new Vector2(1600, 900);
                existingScaler.matchWidthOrHeight = 0.5f;
            }
            var root = (RectTransform)canvas.transform;

            var kit = new HudKit(panelColor, buttonColor, accentColor, textColor, fontSize);
            ctx = new HudContext(kit)
            {
                Placement = placement,
                Time = time,
                Economy = economy,
                EraManager = eraManager,
                SaveLoad = saveLoad,
                Catalog = catalog,
            };

            // Build order is draw order: later panels are drawn on top.
            Add(ctx.TopBar = new TopBarPanel(ctx, artToggleButton), root);
            artToggleButton = ctx.TopBar.ArtToggleButton;
            Add(ctx.ToolBar = new ToolBarPanel(ctx), root);
            Add(ctx.Palette = new BuildPalettePanel(ctx), root);
            Add(ctx.Feed = new NotificationFeed(ctx), root);
            Add(ctx.Message = new MessageBanner(ctx), root);
            Add(ctx.Inspector = new InspectorPanel(ctx), root);
            Add(ctx.Research = new ResearchPanel(ctx), root);
            Add(ctx.SaveLoadMenu = new SaveLoadPanel(ctx), root);
            Add(ctx.EconomyWindow = new EconomyPanel(ctx), root);
            Add(ctx.Advisors = new AdvisorsPanel(ctx), root);
            Add(ctx.Crisis = new CrisisPanel(ctx), root);
            ctx.ShowMessage = ctx.Message.Show;
            Add(ctx.MainMenu = new MainMenuPanel(ctx), root);   // last: drawn over the whole HUD
        }

        void Add(HudPanel panel, RectTransform root)
        {
            panel.Build(root);
            panels.Add(panel);
        }

        // ------------------------------------------------------------ events

        void OnEconomy(EconomySnapshot s)
        {
            ctx.Snap = s;
            for (int i = 0; i < panels.Count; i++) panels[i].OnEconomy(s);
        }

        void OnLanguage(bool malay)
        {
            ctx.Kit.Relabel();
            for (int i = 0; i < panels.Count; i++) panels[i].OnLanguage();
            if (economy != null) OnEconomy(economy.Current);
        }

        void OnArtMode(bool greybox) => ctx.TopBar.OnArtMode(greybox);

        void ShowMessage(string msg) => ctx.ShowMessage(msg);

        void OnNotice(Notice n) => ctx.Feed.OnNotice(n);

        void Inspect(int x, int y) => ctx.Inspector.Inspect(x, y);

        void OnEra(int era)
        {
            ctx.Palette.Invalidate();
            var e = ctx.Sim != null ? ctx.Sim.EraDef : null;
            if (e != null) ShowMessage(T("Era baharu: " + e.nameMs, "New era: " + e.nameEn));
        }

        void OnAchievement(string id) => ShowMessage(T("Pencapaian: ", "Achievement: ") + id);
        void OnSaved(int slot) => ShowMessage(T("Disimpan ke slot ", "Saved to slot ") + slot);
        void OnLoaded(int slot)
        {
            ShowMessage(T("Dimuat dari slot ", "Loaded slot ") + slot);
            ctx.MainMenu.OnLoaded();
        }
    }
}
