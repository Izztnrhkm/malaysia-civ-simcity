using TamadunKota.Core;
using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    public static class HudSettings
    {
        const string KeyMalay = "tk.settings.malay", KeyVolume = "tk.settings.volume", KeyMusic = "tk.settings.music",
            KeyAmbience = "tk.settings.ambience", KeyGreybox = "tk.settings.greybox", KeyEdge = "tk.settings.edgeScroll";

        public static void ApplyLanguage()
        {
            var root = GameRoot.Instance;
            if (root != null && PlayerPrefs.HasKey(KeyMalay)) root.SetLanguage(PlayerPrefs.GetInt(KeyMalay) != 0);
        }

        public static void ApplyScene(AudioAtmosphereManager audio, RTSCameraController cam)
        {
            AudioListener.volume = PlayerPrefs.GetFloat(KeyVolume, 1f);
            if (audio != null)
            {
                audio.musicVolume = PlayerPrefs.GetFloat(KeyMusic, audio.musicVolume);
                audio.ambienceVolume = PlayerPrefs.GetFloat(KeyAmbience, audio.ambienceVolume);
            }
            if (PlayerPrefs.HasKey(KeyGreybox)) ArtMode.Set(PlayerPrefs.GetInt(KeyGreybox) != 0);
            if (cam != null && PlayerPrefs.HasKey(KeyEdge)) cam.edgeScrolling = PlayerPrefs.GetInt(KeyEdge) != 0;
        }
        public static void SaveLanguage(bool malay) => PlayerPrefs.SetInt(KeyMalay, malay ? 1 : 0);
        public static void SaveVolume(float value) => PlayerPrefs.SetFloat(KeyVolume, value);
        public static void SaveMusic(float value) => PlayerPrefs.SetFloat(KeyMusic, value);
        public static void SaveAmbience(float value) => PlayerPrefs.SetFloat(KeyAmbience, value);
        public static void SaveGreybox(bool greybox) => PlayerPrefs.SetInt(KeyGreybox, greybox ? 1 : 0);
        public static void SaveEdgeScroll(bool on) => PlayerPrefs.SetInt(KeyEdge, on ? 1 : 0);
        public static void Flush() => PlayerPrefs.Save();
    }

    /// <summary>Menu presentation of the existing settings, with live application and persistence.</summary>
    public sealed class SettingsPanel : ModalPanel
    {
        static readonly string[] SectionKeys = { "unity.settings.general", "unity.settings.audio", "unity.settings.graphics", "settings.controls" };
        readonly RectTransform[] sections = new RectTransform[4];
        readonly Button[] categories = new Button[4];
        MenuShell shell;
        AudioAtmosphereManager audio;
        RTSCameraController cam;
        Button langMs, langEn, artFull, artGrey, edgeOn, edgeOff;
        Slider volume, music, ambience;
        Text volumeValue, musicValue, ambienceValue;
        bool refreshing;
        int selectedSection;

        public SettingsPanel(HudContext context) : base(context) { }
        protected override string TitleKey => "panel.settings";
        protected override Vector2 HalfSize => new Vector2(700, 400);
        public RectTransform MenuRoot => shell?.Root;

        public override void Build(RectTransform root)
        {
            audio = Object.FindAnyObjectByType<AudioAtmosphereManager>();
            cam = Object.FindAnyObjectByType<RTSCameraController>();
            shell = new MenuShell(ctx, root, "Settings Menu", "panel.settings", "unity.settings.kicker");
            Window = shell.Root;
            Body = shell.Content;
            BuildBody();
            var back = MenuTheme.Button(ctx, shell.Footer, "Back", () => Loc.Get("unity.menu.back"), Close, 180);
            HudKit.Stretch((RectTransform)back.transform, new Vector2(1, 0), Vector2.one, new Vector2(-180, 0), Vector2.zero);
        }

        protected override void BuildBody()
        {
            var navigation = MenuTheme.Column(Body, "Settings Sections", 12);
            HudKit.Stretch(navigation, Vector2.zero, new Vector2(0.25f, 1), Vector2.zero, Vector2.zero);
            for (int i = 0; i < sections.Length; i++)
            {
                int section = i;
                categories[i] = MenuTheme.Button(ctx, navigation, "Settings Category " + i, () => Loc.Get(SectionKeys[section]), () => SelectSection(section));
                sections[i] = MenuTheme.Column(Body, "Settings Section " + i, 18);
                HudKit.Stretch(sections[i], new Vector2(0.31f, 0), Vector2.one, Vector2.zero, Vector2.zero);
                MenuTheme.Line(ctx, sections[i], () => Loc.Get(SectionKeys[section]), 38, 60, true);
            }
            var language = Field(sections[0], () => Loc.Get("settings.language"));
            langMs = MenuTheme.Button(ctx, language, "Settings BM", () => "Bahasa Melayu", () => GameRoot.Instance?.SetLanguage(true), 260);
            langEn = MenuTheme.Button(ctx, language, "Settings EN", () => "English", () => GameRoot.Instance?.SetLanguage(false), 260);
            var edge = Field(sections[0], () => Loc.Get("unity.settings.edgeScroll"));
            edgeOn = MenuTheme.Button(ctx, edge, "Edge On", () => Loc.Get("unity.settings.on"), () => SetEdge(true), 260);
            edgeOff = MenuTheme.Button(ctx, edge, "Edge Off", () => Loc.Get("unity.settings.off"), () => SetEdge(false), 260);
            volume = SliderRow(sections[1], "Master Volume", "unity.settings.volume", out volumeValue, value =>
            { AudioListener.volume = value; HudSettings.SaveVolume(value); });
            music = SliderRow(sections[1], "Music Volume", "unity.settings.music", out musicValue, value =>
            { if (audio != null) audio.musicVolume = value; HudSettings.SaveMusic(value); });
            ambience = SliderRow(sections[1], "Ambience Volume", "unity.settings.ambience", out ambienceValue, value =>
            { if (audio != null) audio.ambienceVolume = value; HudSettings.SaveAmbience(value); });
            var art = Field(sections[2], () => Loc.Get("unity.settings.artMode"));
            artFull = MenuTheme.Button(ctx, art, "Full Art", () => Loc.Get("unity.settings.fullArt"), () => SetArt(false), 260);
            artGrey = MenuTheme.Button(ctx, art, "Greybox Art", () => Loc.Get("unity.settings.greybox"), () => SetArt(true), 260);
            var note = MenuTheme.Line(ctx, sections[2], () => Loc.Get("unity.settings.artHint"), 24, 104);
            note.color = MenuTheme.Muted;
            MenuTheme.Line(ctx, sections[3], () => Loc.Get("unity.settings.controls.body"), 24, 300);
            var keyboard = MenuTheme.Line(ctx, sections[3], () => Loc.Get("unity.menu.keyboardHint"), 24, 100);
            keyboard.color = MenuTheme.Brass;
        }

        RectTransform Field(RectTransform parent, System.Func<string> label)
        {
            var column = MenuTheme.Column(parent, "Setting", 10);
            HudKit.Size(column, -1, 100);
            MenuTheme.Line(ctx, column, label, 24, 30);
            return Kit.HRow(column, "Options", 58, 12);
        }

        Slider SliderRow(RectTransform parent, string name, string key, out Text value, UnityEngine.Events.UnityAction<float> apply)
        {
            var row = Field(parent, () => Loc.Get(key));
            var s = Kit.Slider(row, 1, null, 0);
            s.name = name;
            var element = s.GetComponent<LayoutElement>();
            element.minWidth = 200;
            element.flexibleWidth = 1;
            element.minHeight = element.preferredHeight = 58;
            s.gameObject.AddComponent<Image>().color = Color.clear;
            s.gameObject.AddComponent<MenuFieldFocus>().Initialize();
            var text = MenuTheme.Line(ctx, row, () => "", 24, 58);
            text.alignment = TextAnchor.MiddleRight;
            HudKit.Size(text, 90, -1);
            s.onValueChanged.AddListener(v =>
            {
                text.text = Mathf.RoundToInt(v * 100) + "%";
                if (!refreshing) apply(v);
            });
            value = text;
            return s;
        }

        public override void Open()
        {
            var origin = ctx.MainMenu != null && ctx.MainMenu.IsOpen ?
                (ctx.MainMenu.IsPauseMenu ? MenuOrigin.Pause : MenuOrigin.Startup) : MenuOrigin.Gameplay;
            Open(origin);
        }

        public void Open(MenuOrigin origin)
        {
            ctx.ModalOpening(this);
            ctx.Menu.Begin(origin);
            shell.Show(ctx.Menu.Origin != MenuOrigin.Startup);
            Refresh();
            MenuSession.Focus(categories[selectedSection]);
        }

        public override void Close()
        {
            if (!IsOpen) return;
            HudSettings.Flush();
            base.Close();
            ctx.Menu.ReturnFromUtility();
        }

        void SelectSection(int section) { selectedSection = section; Refresh(); }
        void SetArt(bool greybox) { ArtMode.Set(greybox); HudSettings.SaveGreybox(greybox); Refresh(); }
        void SetEdge(bool enabled)
        {
            if (cam != null) cam.edgeScrolling = enabled;
            HudSettings.SaveEdgeScroll(enabled);
            Refresh();
        }

        public void OnArtMode(bool greybox) { HudSettings.SaveGreybox(greybox); if (IsOpen) Refresh(); }
        public override void Refresh()
        {
            refreshing = true;
            shell.RefreshLanguage(Malay);
            for (int i = 0; i < sections.Length; i++)
            {
                sections[i].gameObject.SetActive(i == selectedSection);
                MenuTheme.Emphasis(categories[i], false, i == selectedSection);
            }
            MenuTheme.Emphasis(langMs, false, Malay);
            MenuTheme.Emphasis(langEn, false, !Malay);
            volume.value = AudioListener.volume;
            volumeValue.text = Mathf.RoundToInt(volume.value * 100) + "%";
            music.interactable = ambience.interactable = audio != null;
            if (audio != null) { music.value = audio.musicVolume; ambience.value = audio.ambienceVolume; }
            musicValue.text = audio == null ? "—" : Mathf.RoundToInt(music.value * 100) + "%";
            ambienceValue.text = audio == null ? "—" : Mathf.RoundToInt(ambience.value * 100) + "%";
            MenuTheme.Emphasis(artFull, false, !ArtMode.Greybox);
            MenuTheme.Emphasis(artGrey, false, ArtMode.Greybox);
            edgeOn.interactable = edgeOff.interactable = cam != null;
            MenuTheme.Emphasis(edgeOn, false, cam == null || cam.edgeScrolling);
            MenuTheme.Emphasis(edgeOff, false, cam != null && !cam.edgeScrolling);
            refreshing = false;
            MenuSession.ConfigureNavigation(MenuRoot);
        }
    }
}
