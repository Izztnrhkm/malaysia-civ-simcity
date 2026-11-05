using System.Collections.Generic;
using TamadunKota.Core;
using TamadunKota.Simulation;
using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Main menu (web: src/ui/MainMenu.tsx): New game with city name, map seed and scenario
    /// (scenarios.json), Continue (newest save), Load, Settings and Quit, plus Resume when opened
    /// from the game. Shown over the running scene at startup, and pauses the clock while open.
    /// </summary>
    public sealed class MainMenuPanel : HudPanel
    {
        /// <summary>
        /// Show the menu when the HUD starts. Never shown in batch mode (headless PlayMode tests);
        /// tests that run in a window can set this to false before the scene loads.
        /// </summary>
        public static bool ShowOnStartup = true;

        static readonly string[] Names = { "Kota Baharu", "Bandar Seri Selat", "Kuala Muara", "Pengkalan Emas", "Bandar Hilir", "Kuala Damai" };

        RectTransform overlay, mainView, newView, objectives;
        Button resumeButton, continueButton, langMs, langEn;
        Text continueInfo, scenarioDesc;
        InputField cityInput, seedInput;
        readonly List<Button> scenarioButtons = new List<Button>(4);
        readonly List<string> scenarioIds = new List<string>(4);
        string scenario = "melaka_1400";
        int continueSlot = -1;
        bool paused, inGame;

        public MainMenuPanel(HudContext context) : base(context) { }

        public bool IsOpen => overlay != null && overlay.gameObject.activeSelf;

        public override void Build(RectTransform root)
        {
            overlay = new GameObject("Main Menu", typeof(RectTransform), typeof(Image)).GetComponent<RectTransform>();
            overlay.SetParent(root, false);
            HudKit.Stretch(overlay, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            overlay.GetComponent<Image>().color = new Color(0.02f, 0.05f, 0.06f, 0.72f);   // blocks clicks on the world
            var window = Kit.Panel(overlay, "Window", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-420, -390), new Vector2(420, 390));

            // header: title, subtitle, language
            var title = Kit.Label(window, "Title", FontSize + 20, TextAnchor.UpperLeft);
            title.color = Kit.AccentColor;
            title.fontStyle = FontStyle.Bold;
            HudKit.Stretch(title.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(24, -70), new Vector2(-180, -16));
            Kit.Localize(title, () => Loc.Get("app.title"));
            var subtitle = Kit.Label(window, "Subtitle", FontSize + 2, TextAnchor.UpperLeft);
            HudKit.Stretch(subtitle.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(26, -104), new Vector2(-180, -70));
            Kit.Localize(subtitle, () => Loc.Get("app.subtitle"));
            var lang = new GameObject("Language", typeof(RectTransform)).GetComponent<RectTransform>();
            lang.SetParent(window, false);
            HudKit.Stretch(lang, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-164, -60), new Vector2(-20, -20));
            var lh = lang.gameObject.AddComponent<HorizontalLayoutGroup>();
            lh.spacing = 6;
            lh.childControlWidth = true;
            lh.childControlHeight = true;
            lh.childForceExpandWidth = false;
            langMs = Kit.Btn(lang, "BM", () => GameRoot.Instance?.SetLanguage(true), 66);
            langEn = Kit.Btn(lang, "EN", () => GameRoot.Instance?.SetLanguage(false), 66);

            BuildMainView(window);
            BuildNewView(window);
            overlay.gameObject.SetActive(false);

            if (ShowOnStartup && !Application.isBatchMode) Show(false);
        }

        void BuildMainView(RectTransform window)
        {
            mainView = Kit.Column(window, "Main", Vector2.zero, Vector2.one, new Vector2(24, 20), new Vector2(-24, -116));
            mainView.GetComponent<VerticalLayoutGroup>().spacing = 8;
            Kit.Localize(Kit.Para(mainView, "", FontSize - 2), () => Loc.Get("menu.tagline"));
            Kit.Localize(Kit.Para(mainView, "", FontSize - 4), HowTo);

            resumeButton = MenuButton(() => Loc.Get("unity.menu.resume"), () => Hide());
            MenuButton(() => Loc.Get("menu.new"), () => ShowNew(true));
            continueButton = MenuButton(() => Loc.Get("menu.continue"), Continue);
            continueInfo = Kit.Line(mainView, "", FontSize - 5, 22, TextAnchor.MiddleCenter);
            MenuButton(() => Loc.Get("menu.load"), () => ctx.SaveLoadMenu?.Open());
            MenuButton(() => Loc.Get("unity.menu.settings"), () => ctx.OpenSettings?.Invoke());
            MenuButton(() => Loc.Get("unity.menu.quit"), Quit);
        }

        Button MenuButton(System.Func<string> label, UnityEngine.Events.UnityAction onClick)
        {
            var b = Kit.Btn(mainView, label, onClick, 0);
            var le = b.GetComponent<LayoutElement>();
            le.preferredHeight = 46;
            le.minHeight = 46;
            b.GetComponentInChildren<Text>().fontSize = FontSize;
            return b;
        }

        static string HowTo()
        {
            return "<b>" + Loc.Get("menu.howto") + "</b>\n1. " + Loc.Get("menu.howto.1") + "\n2. " + Loc.Get("menu.howto.2") +
                   "\n3. " + Loc.Get("menu.howto.3") + "\n4. " + Loc.Get("menu.howto.4");
        }

        void BuildNewView(RectTransform window)
        {
            newView = Kit.Column(window, "New Game", Vector2.zero, Vector2.one, new Vector2(24, 20), new Vector2(-24, -116));
            newView.GetComponent<VerticalLayoutGroup>().spacing = 8;

            var nameRow = Kit.HRow(newView, "City", 36);
            Kit.Localize(Fixed(Kit.Line(nameRow, "", FontSize - 3, 36), 170), () => Loc.Get("menu.cityName"));
            cityInput = Kit.Input(nameRow, Names[0], "", 0);
            cityInput.characterLimit = 40;

            var seedRow = Kit.HRow(newView, "Seed", 36);
            Kit.Localize(Fixed(Kit.Line(seedRow, "", FontSize - 3, 36), 170), () => Loc.Get("menu.seed"));
            seedInput = Kit.Input(seedRow, "42", "", 0, InputField.ContentType.IntegerNumber);
            seedInput.characterLimit = 9;
            Kit.Btn(seedRow, () => Loc.Get("menu.random"), () => seedInput.text = Random.Range(1, 100000).ToString(), 130);

            Kit.Localize(Kit.Line(newView, "", FontSize - 2, 28), () => "<b>" + Loc.Get("menu.scenario") + "</b>");
            var scenRow = Kit.HRow(newView, "Scenarios", 64);
            var db = GameRoot.Instance != null ? GameRoot.Instance.Db : null;
            if (db != null)
            {
                foreach (var s in db.Scenarios)
                {
                    var rec = s;
                    var b = Kit.Btn(scenRow, () => Malay ? rec.nameMs : rec.nameEn, () => SelectScenario(rec.id), 0);
                    b.GetComponent<LayoutElement>().flexibleWidth = 1;
                    var t = b.GetComponentInChildren<Text>();
                    t.fontSize = FontSize - 4;
                    scenarioButtons.Add(b);
                    scenarioIds.Add(rec.id);
                }
            }
            scenarioDesc = Kit.Para(newView, "", FontSize - 3);
            objectives = Kit.Card(newView, "Objectives", HudKit.CardTint, 8);

            var actions = Kit.HRow(newView, "Actions", 48);
            var start = Kit.Btn(actions, () => Loc.Get("menu.start"), StartGame, 0);
            start.GetComponent<LayoutElement>().flexibleWidth = 1;
            Kit.SetSelected(start, true);
            Kit.Btn(actions, () => Loc.Get("panel.close"), () => ShowNew(false), 160);
            newView.gameObject.SetActive(false);
        }

        static Text Fixed(Text t, float width)
        {
            HudKit.Size(t, width, -1);
            return t;
        }

        // ------------------------------------------------------------ show / hide

        /// <summary>Open the menu. <paramref name="fromGame"/> adds Resume.</summary>
        public void Show(bool fromGame)
        {
            inGame = fromGame;
            ctx.ActiveModal?.Close();
            overlay.SetAsLastSibling();
            overlay.gameObject.SetActive(true);
            if (!paused) { ctx.Time?.PushPause(); paused = true; }
            ShowNew(false);
        }

        public void Hide()
        {
            if (!IsOpen) return;
            overlay.gameObject.SetActive(false);
            if (paused) { ctx.Time?.PopPause(); paused = false; }
        }

        /// <summary>Esc with no window open: leave the menu if it was opened from the game.</summary>
        public void OnEscape()
        {
            if (IsOpen && inGame) Hide();
        }

        /// <summary>A game was loaded (from Continue or the Load window): back to the city.</summary>
        public void OnLoaded()
        {
            if (IsOpen) Hide();
        }

        void ShowNew(bool show)
        {
            mainView.gameObject.SetActive(!show);
            newView.gameObject.SetActive(show);
            Refresh();
        }

        public override void OnLanguage()
        {
            if (IsOpen) Refresh();
        }

        void Refresh()
        {
            Kit.SetSelected(langMs, Malay);
            Kit.SetSelected(langEn, !Malay);
            resumeButton.gameObject.SetActive(inGame);
            RefreshContinue();
            RefreshScenario();
        }

        void RefreshContinue()
        {
            continueSlot = -1;
            string newest = null;
            SaveSlotInfo best = default;
            var saveLoad = ctx.SaveLoad;
            if (saveLoad != null)
            {
                for (int s = 0; s < SaveLoadManager.SlotCount; s++)
                {
                    var info = saveLoad.Info(s);
                    if (!info.exists) continue;
                    if (newest == null || string.CompareOrdinal(info.savedAt ?? "", newest) > 0)
                    {
                        newest = info.savedAt ?? "";
                        continueSlot = s;
                        best = info;
                    }
                }
            }
            continueButton.interactable = continueSlot >= 0;
            continueInfo.text = continueSlot >= 0 ? best.cityName + "  " + best.year + "  (Era " + best.era + ")" : Loc.Get("unity.menu.noSaves");
        }

        void RefreshScenario()
        {
            var db = GameRoot.Instance != null ? GameRoot.Instance.Db : null;
            if (db == null) return;
            ScenarioRecord sel = null;
            foreach (var s in db.Scenarios) if (s.id == scenario) sel = s;
            if (sel == null && db.Scenarios.Length > 0) { sel = db.Scenarios[0]; scenario = sel.id; }
            for (int i = 0; i < scenarioButtons.Count; i++) Kit.SetSelected(scenarioButtons[i], scenarioIds[i] == scenario);
            if (sel == null) return;
            scenarioDesc.text = Malay ? sel.descMs : sel.descEn;
            HudKit.ClearChildren(objectives);
            Kit.Line(objectives, "<b>" + Loc.Get("menu.objectives") + "</b>", FontSize - 4, 24);
            var list = Malay ? sel.objectivesMs : sel.objectivesEn;
            foreach (var o in list) Kit.Para(objectives, "- " + o, FontSize - 4);
        }

        void SelectScenario(string id)
        {
            scenario = id;
            RefreshScenario();
        }

        // ------------------------------------------------------------ actions

        void StartGame()
        {
            var root = GameRoot.Instance;
            if (root == null) return;
            string name = cityInput.text.Trim();
            root.cityName = name.Length > 0 ? name : Names[0];
            if (!int.TryParse(seedInput.text, out int seed) || seed == 0) seed = Random.Range(1, 100000);
            root.NewGame(System.Math.Abs(seed), scenario);
            Hide();
        }

        void Continue()
        {
            if (continueSlot < 0 || ctx.SaveLoad == null) return;
            if (ctx.SaveLoad.Load(continueSlot)) Hide();
        }

        /// <summary>
        /// Quits the player. Unity ignores this in the Editor; the runtime assembly stays free of
        /// UnityEditor so the Steam compile check (which defines UNITY_EDITOR) builds.
        /// </summary>
        static void Quit() => Application.Quit();
    }
}
