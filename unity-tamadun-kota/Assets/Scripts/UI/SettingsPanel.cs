using TamadunKota.Core;
using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Player settings kept in PlayerPrefs: language, master / music / ambience volume, art mode
    /// and edge scrolling. The UIManager applies them before it builds the HUD, so every label
    /// starts in the saved language and art mode.
    /// </summary>
    public static class HudSettings
    {
        const string KeyMalay = "tk.settings.malay";
        const string KeyVolume = "tk.settings.volume";
        const string KeyMusic = "tk.settings.music";
        const string KeyAmbience = "tk.settings.ambience";
        const string KeyGreybox = "tk.settings.greybox";
        const string KeyEdge = "tk.settings.edgeScroll";

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
        public static void SaveVolume(float v) => PlayerPrefs.SetFloat(KeyVolume, v);
        public static void SaveMusic(float v) => PlayerPrefs.SetFloat(KeyMusic, v);
        public static void SaveAmbience(float v) => PlayerPrefs.SetFloat(KeyAmbience, v);
        public static void SaveGreybox(bool greybox) => PlayerPrefs.SetInt(KeyGreybox, greybox ? 1 : 0);
        public static void SaveEdgeScroll(bool on) => PlayerPrefs.SetInt(KeyEdge, on ? 1 : 0);
        public static void Flush() => PlayerPrefs.Save();
    }

    /// <summary>
    /// Settings window (web: src/ui/modals/Settings.tsx): language BM / EN, master, music and
    /// ambience volume, Full 3D Art / Greybox, edge scrolling, the controls and Back to main menu.
    /// </summary>
    public sealed class SettingsPanel : ModalPanel
    {
        AudioAtmosphereManager audio;
        RTSCameraController cam;
        Button langMs, langEn, artFull, artGrey, edgeOn, edgeOff;
        Slider volume, music, ambience;
        Text volumeValue, musicValue, ambienceValue;
        bool refreshing;

        public SettingsPanel(HudContext context) : base(context) { }

        protected override string TitleKey => "panel.settings";
        protected override Vector2 HalfSize => new Vector2(400, 350);

        public override void Build(RectTransform root)
        {
            audio = Object.FindAnyObjectByType<AudioAtmosphereManager>();
            cam = Object.FindAnyObjectByType<RTSCameraController>();
            base.Build(root);
        }

        protected override void BuildBody()
        {
            var col = Kit.Column(Body, "Settings", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            col.GetComponent<VerticalLayoutGroup>().spacing = 10;

            var lang = Row(col, () => Loc.Get("settings.language"));
            langMs = Kit.Btn(lang, "Bahasa Melayu", () => SetLanguage(true), 180);
            langEn = Kit.Btn(lang, "English", () => SetLanguage(false), 180);

            volume = SliderRow(col, () => Loc.Get("unity.settings.volume"), out volumeValue, v =>
            {
                AudioListener.volume = v;
                HudSettings.SaveVolume(v);
            });
            music = SliderRow(col, () => Loc.Get("unity.settings.music"), out musicValue, v =>
            {
                if (audio != null) audio.musicVolume = v;
                HudSettings.SaveMusic(v);
            });
            ambience = SliderRow(col, () => Loc.Get("unity.settings.ambience"), out ambienceValue, v =>
            {
                if (audio != null) audio.ambienceVolume = v;
                HudSettings.SaveAmbience(v);
            });

            var art = Row(col, () => Loc.Get("unity.settings.artMode"));
            artFull = Kit.Btn(art, () => Loc.Get("unity.settings.fullArt"), () => ArtMode.Set(false), 180);
            artGrey = Kit.Btn(art, () => Loc.Get("unity.settings.greybox"), () => ArtMode.Set(true), 180);

            var edge = Row(col, () => Loc.Get("unity.settings.edgeScroll"));
            edgeOn = Kit.Btn(edge, () => Loc.Get("unity.settings.on"), () => SetEdge(true), 180);
            edgeOff = Kit.Btn(edge, () => Loc.Get("unity.settings.off"), () => SetEdge(false), 180);

            Kit.Localize(Heading(col, ""), () => Loc.Get("settings.controls"));
            Kit.Localize(Kit.Para(col, "", FontSize - 5), () => Loc.Get("unity.settings.controls.body"));

            var menu = Kit.Btn(col, () => Loc.Get("settings.mainMenu"), () => { Close(); ctx.MainMenu.Show(true); }, 0);
            menu.GetComponent<LayoutElement>().preferredHeight = 44;
        }

        RectTransform Row(RectTransform parent, System.Func<string> label)
        {
            var row = Kit.HRow(parent, "Row", 40);
            var l = Kit.Line(row, "", FontSize - 3, 40);
            HudKit.Size(l, 300, -1);
            Kit.Localize(l, label);
            return row;
        }

        Slider SliderRow(RectTransform parent, System.Func<string> label, out Text value, UnityEngine.Events.UnityAction<float> onChange)
        {
            var row = Row(parent, label);
            var text = Kit.Line(row, "", FontSize - 4, 40, TextAnchor.MiddleRight);
            var s = Kit.Slider(row, 1, v =>
            {
                text.text = Mathf.RoundToInt(v * 100) + "%";
                if (!refreshing) onChange(v);
            }, 300);
            text.transform.SetAsLastSibling();
            HudKit.Size(text, 60, -1);
            value = text;
            return s;
        }

        /// <summary>Saved by the UIManager on every language change (menu buttons included).</summary>
        static void SetLanguage(bool malay) => GameRoot.Instance?.SetLanguage(malay);

        void SetEdge(bool on)
        {
            if (cam != null) cam.edgeScrolling = on;
            HudSettings.SaveEdgeScroll(on);
            Refresh();
        }

        /// <summary>The art mode changed (here, from the top bar button or the G key): remember it.</summary>
        public void OnArtMode(bool greybox)
        {
            HudSettings.SaveGreybox(greybox);
            if (IsOpen) Refresh();
        }

        public override void Close()
        {
            HudSettings.Flush();
            base.Close();
        }

        public override void Refresh()
        {
            refreshing = true;
            Kit.SetSelected(langMs, Malay);
            Kit.SetSelected(langEn, !Malay);
            volume.value = AudioListener.volume;
            volumeValue.text = Mathf.RoundToInt(volume.value * 100) + "%";
            music.interactable = audio != null;
            ambience.interactable = audio != null;
            if (audio != null)
            {
                music.value = audio.musicVolume;
                ambience.value = audio.ambienceVolume;
            }
            musicValue.text = Mathf.RoundToInt(music.value * 100) + "%";
            ambienceValue.text = Mathf.RoundToInt(ambience.value * 100) + "%";
            Kit.SetSelected(artFull, !ArtMode.Greybox);
            Kit.SetSelected(artGrey, ArtMode.Greybox);
            bool edge = cam == null || cam.edgeScrolling;
            edgeOn.interactable = cam != null;
            edgeOff.interactable = cam != null;
            Kit.SetSelected(edgeOn, edge);
            Kit.SetSelected(edgeOff, !edge);
            refreshing = false;
        }
    }
}
