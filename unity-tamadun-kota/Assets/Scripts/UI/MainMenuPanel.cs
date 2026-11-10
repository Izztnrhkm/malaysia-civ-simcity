using System.Collections.Generic;
using TamadunKota.Core;
using TamadunKota.Simulation;
using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// New game setup with state identity, leader, geographic region, city name and starting date.
    /// Continue and Load preserve the saved identity. The open menu pauses the clock.
    /// </summary>
    public sealed class MainMenuPanel : HudPanel
    {
        /// <summary>
        /// Show the menu when the HUD starts. Never shown in batch mode (headless PlayMode tests);
        /// tests that run in a window can set this to false before the scene loads.
        /// </summary>
        public static bool ShowOnStartup = true;

        static readonly string[] Names = { "Kota Baharu", "Bandar Seri Selat", "Kuala Muara", "Pengkalan Emas", "Bandar Hilir", "Kuala Damai" };

        RectTransform overlay, mainView, newView;
        Button resumeButton, continueButton, langMs, langEn;
        Text continueInfo, startError;
        Button startButton;
        LeaderProfileView profile;
        InputField cityInput, seedInput;
        readonly List<Button> scenarioButtons = new List<Button>(4);
        readonly List<string> scenarioIds = new List<string>(4);
        readonly List<Button> stateButtons = new List<Button>(13);
        readonly List<string> stateIds = new List<string>(13);
        string stateId = "melaka";
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
            var window = Kit.Panel(overlay, "Window", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-650, -415), new Vector2(650, 415));

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
            mainView = Kit.Column(window, "Main", new Vector2(0.2f, 0), new Vector2(0.8f, 1), new Vector2(24, 20), new Vector2(-24, -116));
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
            newView = new GameObject("New Game", typeof(RectTransform)).GetComponent<RectTransform>();
            newView.SetParent(window, false);
            HudKit.Stretch(newView, Vector2.zero, Vector2.one, new Vector2(24, 20), new Vector2(-24, -110));
            var nameRow = Kit.Row(newView, "City and Seed", new Vector2(0, 1), Vector2.one, new Vector2(0, -42), Vector2.zero);
            Kit.Localize(Fixed(Kit.Line(nameRow, "", FontSize - 4, 36), 120), () => Loc.Get("menu.cityName"));
            cityInput = Kit.Input(nameRow, Names[0], "", 0);
            cityInput.GetComponent<LayoutElement>().flexibleWidth = 1;
            cityInput.characterLimit = 40;
            Kit.Localize(Fixed(Kit.Line(nameRow, "", FontSize - 4, 36), 100), () => Loc.Get("menu.seed"));
            seedInput = Kit.Input(nameRow, "42", "", 140, InputField.ContentType.IntegerNumber);
            seedInput.characterLimit = 9;
            Kit.Btn(nameRow, () => Loc.Get("menu.random"), () => seedInput.text = Random.Range(1, 100000).ToString(), 110);

            var heading = Kit.Label(newView, "Choose a State", FontSize - 2, TextAnchor.MiddleLeft);
            HudKit.Stretch(heading.rectTransform, new Vector2(0, 1), Vector2.one, new Vector2(0, -76), new Vector2(0, -46));
            Kit.Localize(heading, () => Loc.Get("leader.chooseState"));
            var list = Kit.ScrollList(newView, "States", Vector2.zero, new Vector2(0.2f, 1), new Vector2(0, 138), new Vector2(-10, -80), 5);
            var details = new GameObject("Selected Leader", typeof(RectTransform)).GetComponent<RectTransform>();
            details.SetParent(newView, false);
            HudKit.Stretch(details, new Vector2(0.2f, 0), Vector2.one, new Vector2(8, 138), new Vector2(0, -80));
            profile = new LeaderProfileView(ctx, details);

            var db = GameRoot.Instance != null ? GameRoot.Instance.Db : null;
            if (db != null)
            {
                foreach (var state in db.States)
                {
                    var rec = state;
                    var button = Kit.Btn(list, () => T(rec.nameMs, rec.nameEn), () => SelectState(rec.id), 0);
                    button.GetComponent<LayoutElement>().preferredHeight = 42;
                    button.GetComponentInChildren<Text>().fontSize = FontSize - 3;
                    stateButtons.Add(button);
                    stateIds.Add(rec.id);
                }
            }
            var scenHeading = Kit.Label(newView, "Starting Date", FontSize - 3, TextAnchor.MiddleLeft);
            HudKit.Stretch(scenHeading.rectTransform, Vector2.zero, new Vector2(1, 0), new Vector2(0, 106), new Vector2(0, 134));
            Kit.Localize(scenHeading, () => Loc.Get("leader.startingDate"));
            var scenRow = Kit.Row(newView, "Scenarios", Vector2.zero, new Vector2(1, 0), new Vector2(0, 62), new Vector2(0, 106));
            if (db != null)
            {
                foreach (var s in db.Scenarios)
                {
                    var rec = s;
                    var b = Kit.Btn(scenRow, () => ScenarioTitle(rec), () => SelectScenario(rec.id), 0);
                    b.GetComponent<LayoutElement>().flexibleWidth = 1;
                    var t = b.GetComponentInChildren<Text>();
                    t.fontSize = FontSize - 4;
                    scenarioButtons.Add(b);
                    scenarioIds.Add(rec.id);
                }
            }
            var actions = Kit.Row(newView, "Actions", Vector2.zero, new Vector2(1, 0), Vector2.zero, new Vector2(0, 48));
            startError = Kit.Line(actions, "", FontSize - 5, 40);
            startError.color = HudKit.BadColor;
            HudKit.Size(startError, 0, -1).flexibleWidth = 1;
            startButton = Kit.Btn(actions, () => Loc.Get("menu.start"), StartGame, 220);
            Kit.SetSelected(startButton, true);
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
            profile.Release();
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
            if (!show) profile.Release();
            mainView.gameObject.SetActive(!show);
            newView.gameObject.SetActive(show);
            startError.text = "";
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
            if (newView.gameObject.activeSelf) RefreshState();
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
        }

        string ScenarioTitle(ScenarioRecord record)
        {
            if (record.id == "melaka_1400") return "1400 · " + Loc.Get("leader.scenario.campaign");
            if (record.id == "larut_1875") return "1875 · " + Loc.Get("leader.scenario.tin");
            if (record.id == "msc_1996") return "1996 · " + Loc.Get("leader.scenario.digital");
            return T(record.nameMs, record.nameEn);
        }

        void SelectState(string id)
        {
            stateId = id;
            startError.text = "";
            RefreshState();
        }

        void RefreshState()
        {
            var db = GameRoot.Instance != null ? GameRoot.Instance.Db : null;
            var state = db?.StateById(stateId);
            var leader = state != null ? db.LeaderById(state.leaderId) : null;
            for (int i = 0; i < stateButtons.Count; i++) Kit.SetSelected(stateButtons[i], stateIds[i] == stateId);
            startButton.interactable = state != null && leader != null;
            profile.Show(state, leader);
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
            var state = root.Db.StateById(stateId);
            if (state == null) return;
            string name = cityInput.text.Trim();
            if (!int.TryParse(seedInput.text, out int seed) || seed == 0) seed = Random.Range(1, 100000);
            try
            {
                root.NewGame(new GameSetup { stateId = state.id, leaderId = state.leaderId, mapId = state.mapId,
                    scenarioId = scenario, seed = seed }, name.Length > 0 ? name : Names[0]);
                Hide();
            }
            catch (System.Exception error)
            {
                Debug.LogException(error);
                startError.text = Loc.Get("leader.startFailed");
            }
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

        public override void Dispose() => profile.Release();
    }
}
