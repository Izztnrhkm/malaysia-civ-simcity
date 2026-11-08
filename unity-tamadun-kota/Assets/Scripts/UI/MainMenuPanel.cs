using System;
using System.Collections.Generic;
using TamadunKota.Core;
using TamadunKota.Simulation;
using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>The title, pause and scenario screens share one navigation session.</summary>
    public sealed class MainMenuPanel : HudPanel
    {
        public static bool ShowOnStartup = true;
        static readonly string[] Names = { "Kota Baharu", "Bandar Seri Selat", "Kuala Muara", "Pengkalan Emas", "Bandar Hilir", "Kuala Damai" };
        MenuShell shell;
        RectTransform mainView, newView;
        Button resume, newGame, continueButton, load, settings, quit, back, start;
        Text continueInfo, description, objectives, chapterTitle, feedback;
        InputField cityInput, seedInput;
        readonly List<Button> scenarioButtons = new List<Button>();
        readonly List<ScenarioRecord> scenarios = new List<ScenarioRecord>();
        string scenario = "melaka_1400", feedbackKey;
        int continueSlot = -1;
        bool inGame, settingUp;

        public MainMenuPanel(HudContext context) : base(context) { }
        public bool IsOpen => shell != null && shell.Root.gameObject.activeSelf;
        public bool IsPauseMenu => inGame;
        public RectTransform MenuRoot => shell?.Root;

        public override void Build(RectTransform root)
        {
            shell = new MenuShell(ctx, root, "Main Menu", "app.title", "app.subtitle");
            BuildMain();
            BuildNew();
            back = MenuTheme.Button(ctx, shell.Footer, "Back", () => Loc.Get("unity.menu.back"), () => ShowNew(false), 180);
            HudKit.Stretch((RectTransform)back.transform, new Vector2(1, 0), Vector2.one, new Vector2(-520, 0), new Vector2(-320, 0));
            start = MenuTheme.Button(ctx, shell.Footer, "Start City", () => Loc.Get("menu.start"), StartGame, 300, true);
            HudKit.Stretch((RectTransform)start.transform, new Vector2(1, 0), Vector2.one, new Vector2(-300, 0), Vector2.zero);
            if (ShowOnStartup && !Application.isBatchMode) Show(false);
        }

        void BuildMain()
        {
            mainView = MenuTheme.Column(shell.Content, "Title Navigation", 10);
            HudKit.Stretch(mainView, Vector2.zero, new Vector2(0.39f, 1), Vector2.zero, Vector2.zero);
            MenuTheme.Line(ctx, mainView, () => Loc.Get("unity.menu.tagline"), 30, 76, true);
            continueInfo = MenuTheme.Line(ctx, mainView, () => "", 20, 104);
            continueInfo.color = MenuTheme.Muted;
            resume = MenuTheme.Button(ctx, mainView, "Resume", () => Loc.Get("unity.menu.resume"), Hide, primary: true);
            newGame = MenuTheme.Button(ctx, mainView, "New Game", () => Loc.Get("menu.new"), () => ShowNew(true));
            continueButton = MenuTheme.Button(ctx, mainView, "Continue", () => Loc.Get("menu.continue"), Continue);
            load = MenuTheme.Button(ctx, mainView, "Load Cities", () => Loc.Get(inGame ? "unity.menu.saveLoad" : "menu.load"), () => ctx.SaveLoadMenu.Open());
            settings = MenuTheme.Button(ctx, mainView, "Settings", () => Loc.Get("unity.menu.settings"), () => ctx.Settings.Open());
            quit = MenuTheme.Button(ctx, mainView, "Quit", () => Loc.Get("unity.menu.quit"), () => Application.Quit());
            feedback = MenuTheme.Line(ctx, mainView, () => feedbackKey == null ? "" : Loc.Get(feedbackKey), 22, 64);
            feedback.color = MenuTheme.Error;
            erasBackdrop = new GameObject("Era Story Backdrop", typeof(RectTransform), typeof(Image)).GetComponent<RectTransform>();
            erasBackdrop.SetParent(shell.Content, false);
            HudKit.Stretch(erasBackdrop, new Vector2(0.58f, 0), new Vector2(1, 0), new Vector2(-20, -12), new Vector2(16, 140));
            erasBackdrop.GetComponent<Image>().color = new Color(0.03f, 0.1f, 0.11f, 0.76f);
            erasBackdrop.GetComponent<Image>().raycastTarget = false;
            var eras = MenuTheme.Text(ctx, shell.Content, "Era Story", 24);
            eras.alignment = TextAnchor.LowerRight;
            eras.color = MenuTheme.Ivory;
            ctx.Kit.Localize(eras, () => Loc.Get("unity.menu.eraStory"));
            HudKit.Stretch(eras.rectTransform, new Vector2(0.5f, 0), Vector2.one, new Vector2(40, 0), Vector2.zero);
            erasStory = eras;
        }

        Text erasStory;
        RectTransform erasBackdrop;
        void BuildNew()
        {
            newView = new GameObject("New Game Setup", typeof(RectTransform)).GetComponent<RectTransform>();
            newView.SetParent(shell.Content, false);
            HudKit.Stretch(newView, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            var chapters = MenuTheme.Column(newView, "Chapters", 16);
            HudKit.Stretch(chapters, Vector2.zero, new Vector2(0.37f, 1), Vector2.zero, Vector2.zero);
            MenuTheme.Line(ctx, chapters, () => Loc.Get("unity.menu.chooseChapter"), 24, 40);
            var db = GameRoot.Instance != null ? GameRoot.Instance.Db : null;
            if (db != null) foreach (var record in db.Scenarios)
            {
                var rec = record;
                var button = MenuTheme.Button(ctx, chapters, "Scenario " + rec.id, () => ScenarioTitle(rec), () => SelectScenario(rec.id));
                HudKit.Size(button, -1, 138);
                var label = button.GetComponentInChildren<Text>();
                label.alignment = TextAnchor.MiddleLeft;
                HudKit.Stretch(label.rectTransform, Vector2.zero, Vector2.one, new Vector2(124, 14), new Vector2(-18, -14));
                var year = MenuTheme.Text(ctx, button.transform, "Year", 38, true);
                year.text = rec.year.ToString();
                year.alignment = TextAnchor.MiddleCenter;
                HudKit.Stretch(year.rectTransform, Vector2.zero, new Vector2(0, 1), new Vector2(16, 0), new Vector2(112, 0));
                scenarioButtons.Add(button);
                scenarios.Add(rec);
            }
            var details = MenuTheme.Column(newView, "Chapter Details", 6);
            HudKit.Stretch(details, new Vector2(0.41f, 0), Vector2.one, Vector2.zero, Vector2.zero);
            chapterTitle = MenuTheme.Line(ctx, details, () => "", 36, 60, true);
            description = MenuTheme.Line(ctx, details, () => "", 22, 80);
            description.color = MenuTheme.Muted;
            var objectiveHeading = MenuTheme.Line(ctx, details, () => Loc.Get("menu.objectives"), 22, 22);
            objectiveHeading.color = MenuTheme.Brass;
            objectives = MenuTheme.Line(ctx, details, () => "", 22, 132);
            MenuTheme.Line(ctx, details, () => Loc.Get("menu.cityName"), 22, 24);
            cityInput = Kit.Input(details, Names[0], "", 0);
            cityInput.name = "City Name";
            cityInput.characterLimit = 40;
            StyleInput(cityInput);
            MenuTheme.Line(ctx, details, () => Loc.Get("menu.seed"), 22, 24);
            var seedRow = Kit.HRow(details, "Seed Controls", 58);
            seedInput = Kit.Input(seedRow, "42", "", 0, InputField.ContentType.IntegerNumber);
            seedInput.name = "Map Seed";
            seedInput.characterLimit = 9;
            StyleInput(seedInput);
            MenuTheme.Button(ctx, seedRow, "Random Seed", () => Loc.Get("menu.random"), () => seedInput.text = UnityEngine.Random.Range(1, 100000).ToString(), 190);
        }

        static void StyleInput(InputField input)
        {
            HudKit.Size(input, -1, 58);
            input.textComponent.fontSize = 24;
            input.textComponent.color = MenuTheme.Ivory;
            input.GetComponent<Image>().color = MenuTheme.Teal;
            input.selectionColor = new Color(0.85f, 0.71f, 0.45f, 0.4f);
            input.gameObject.AddComponent<MenuFieldFocus>().Initialize();
        }

        string ScenarioTitle(ScenarioRecord rec)
        {
            string value = Malay ? rec.nameMs : rec.nameEn;
            int colon = value.IndexOf(':');
            return colon >= 0 ? value.Substring(colon + 1).Trim() : value;
        }

        public void Show(bool fromGame)
        {
            ctx.ActiveModal?.Close();
            inGame = fromGame;
            ctx.Menu.Begin(fromGame ? MenuOrigin.Pause : MenuOrigin.Startup);
            feedbackKey = null;
            shell.Show(inGame, false);
            ShowNew(false);
        }

        public void Hide()
        {
            if (!IsOpen) return;
            shell.Root.gameObject.SetActive(false);
            ctx.Menu.End();
        }

        public void OnEscape()
        {
            if (!IsOpen) return;
            if (settingUp) ShowNew(false);
            else if (inGame) Hide();
        }

        public void OnLoaded()
        {
            ctx.Menu.EnterCity();
            Hide();
        }

        void ShowNew(bool show)
        {
            shell.Show(inGame, show);
            settingUp = show;
            mainView.gameObject.SetActive(!show);
            erasStory.gameObject.SetActive(!show);
            erasBackdrop.gameObject.SetActive(!show);
            newView.gameObject.SetActive(show);
            back.gameObject.SetActive(show);
            start.gameObject.SetActive(show);
            Refresh();
            FocusDefault();
        }

        public void FocusDefault()
        {
            MenuSession.ConfigureNavigation(MenuRoot);
            if (settingUp) MenuSession.Focus(start);
            else MenuSession.Focus(inGame ? resume : continueSlot >= 0 ? continueButton : newGame);
        }

        public override void OnLanguage() { if (IsOpen) Refresh(); }

        void Refresh()
        {
            shell.RefreshLanguage(Malay);
            shell.Heading.text = Loc.Get(settingUp ? "unity.menu.newChapter" : "app.title");
            shell.Kicker.text = Loc.Get(inGame ? "unity.menu.paused" : "app.subtitle");
            RefreshContinue();
            resume.gameObject.SetActive(inGame);
            continueButton.gameObject.SetActive(!inGame);
            MenuTheme.Emphasis(newGame, !inGame && continueSlot < 0);
            MenuTheme.Emphasis(continueButton, !inGame && continueSlot >= 0);
            if (inGame)
            {
                resume.transform.SetSiblingIndex(2);
                load.transform.SetSiblingIndex(3);
                settings.transform.SetSiblingIndex(4);
                newGame.transform.SetSiblingIndex(5);
                quit.transform.SetSiblingIndex(6);
            }
            else
            {
                continueButton.transform.SetSiblingIndex(2);
                newGame.transform.SetSiblingIndex(continueSlot >= 0 ? 3 : 2);
                load.transform.SetSiblingIndex(4);
                settings.transform.SetSiblingIndex(5);
                quit.transform.SetSiblingIndex(6);
            }
            feedback.text = feedbackKey == null ? "" : Loc.Get(feedbackKey);
            feedback.gameObject.SetActive(feedbackKey != null);
            RefreshScenario();
            MenuSession.ConfigureNavigation(MenuRoot);
        }

        void RefreshContinue()
        {
            continueSlot = -1;
            SaveSlotInfo newest = default;
            if (ctx.SaveLoad != null) for (int slot = 0; slot < SaveLoadManager.SlotCount; slot++)
            {
                var info = ctx.SaveLoad.Info(slot);
                if (!info.exists || (continueSlot >= 0 && string.CompareOrdinal(info.savedAt ?? "", newest.savedAt ?? "") <= 0)) continue;
                continueSlot = slot;
                newest = info;
            }
            continueButton.interactable = continueSlot >= 0;
            continueButton.GetComponent<MenuButtonVisual>().Refresh();
            continueInfo.text = inGame ? (GameRoot.Instance?.cityName ?? "") + "\n" + Loc.Get("unity.menu.pauseHint") :
                continueSlot < 0 ? Loc.Get("unity.menu.noSavesHint") : newest.cityName + "\n" + MenuTheme.SaveMetadata(newest);
        }

        void RefreshScenario()
        {
            ScenarioRecord selected = null;
            for (int i = 0; i < scenarios.Count; i++)
            {
                bool active = scenarios[i].id == scenario;
                MenuTheme.Emphasis(scenarioButtons[i], false, active);
                if (active) selected = scenarios[i];
            }
            start.interactable = selected != null;
            start.GetComponent<MenuButtonVisual>().Refresh();
            if (selected == null) return;
            chapterTitle.text = ScenarioTitle(selected);
            description.text = Malay ? selected.descMs : selected.descEn;
            var list = Malay ? selected.objectivesMs : selected.objectivesEn;
            objectives.text = "• " + string.Join("\n• ", list);
        }

        void SelectScenario(string id) { scenario = id; RefreshScenario(); }
        void StartGame()
        {
            var root = GameRoot.Instance;
            if (root == null) return;
            string name = cityInput.text.Trim();
            root.cityName = name.Length == 0 ? Names[0] : name;
            if (!int.TryParse(seedInput.text, out int seed) || seed == 0) seed = UnityEngine.Random.Range(1, 100000);
            root.NewGame((int)Math.Min(int.MaxValue, Math.Abs((long)seed)), scenario);
            ctx.Menu.EnterCity();
            Hide();
        }

        void Continue()
        {
            if (continueSlot < 0 || ctx.SaveLoad == null) return;
            if (ctx.SaveLoad.Load(continueSlot)) { ctx.Menu.EnterCity(); Hide(); }
            else { feedbackKey = "unity.menu.loadFailed"; Refresh(); }
        }
    }
}
