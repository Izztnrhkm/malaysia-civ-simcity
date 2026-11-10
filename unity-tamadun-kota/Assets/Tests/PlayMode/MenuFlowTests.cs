using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using NUnit.Framework;
using TamadunKota.Core;
using TamadunKota.Simulation;
using TamadunKota.Systems;
using TamadunKota.UI;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace TamadunKota.Tests
{
    /// <summary>Exercises the real menu widgets. Save files and touched preferences are restored.</summary>
    public sealed class MenuFlowTests
    {
        static readonly string[] IntKeys = { "tk.settings.malay", "tk.settings.greybox", "tk.settings.edgeScroll" };
        static readonly string[] FloatKeys = { "tk.settings.volume", "tk.settings.music", "tk.settings.ambience" };
        readonly Dictionary<string, byte[]> files = new Dictionary<string, byte[]>();
        readonly Dictionary<string, int?> integers = new Dictionary<string, int?>();
        readonly Dictionary<string, float?> floats = new Dictionary<string, float?>();
        HudContext ctx;
        GameRoot root;
        bool startup, prepared, art;
        float listenerVolume;

        [UnitySetUp]
        public IEnumerator SetUp()
        {
            ctx = null;
            root = null;
            prepared = false;
            startup = MainMenuPanel.ShowOnStartup;
            MainMenuPanel.ShowOnStartup = false;
            foreach (var key in IntKeys) { integers[key] = PlayerPrefs.HasKey(key) ? PlayerPrefs.GetInt(key) : (int?)null; PlayerPrefs.DeleteKey(key); }
            foreach (var key in FloatKeys) { floats[key] = PlayerPrefs.HasKey(key) ? PlayerPrefs.GetFloat(key) : (float?)null; PlayerPrefs.DeleteKey(key); }
            listenerVolume = AudioListener.volume;
            art = ArtMode.Greybox;
            SceneManager.LoadScene("MainGame", LoadSceneMode.Single);
            yield return null;
            yield return null;
            root = GameRoot.Instance;
            var ui = Object.FindAnyObjectByType<UIManager>();
            Assert.NotNull(ui);
            ctx = (HudContext)typeof(UIManager).GetField("ctx", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(ui);
            ctx.Time.SetSpeed(1);
            ctx.SaveLoad.autosaveEveryTicks = 0;
            if (SteamworksManager.Instance != null && SteamworksManager.Instance.CloudAvailable)
                Assert.Ignore("Menu I/O tests require Steam Cloud to be disabled so player cloud files stay untouched.");
            prepared = true;
            for (int slot = 0; slot < SaveLoadManager.SlotCount; slot++)
            {
                string path = ctx.SaveLoad.PathFor(slot);
                foreach (var file in new[] { path, path + ".tmp" })
                {
                    files[file] = File.Exists(file) ? File.ReadAllBytes(file) : null;
                    if (File.Exists(file)) File.Delete(file);
                }
            }
            ctx.MainMenu.Show(false);
        }

        [UnityTearDown]
        public IEnumerator TearDown()
        {
            if (ctx != null)
            {
                ctx.Settings.Close();
                ctx.SaveLoadMenu.Close();
                ctx.MainMenu.Hide();
                ctx.Menu.End();
                // Stop listeners before restoring preferences and prevent an autosave during teardown.
                Object.FindAnyObjectByType<UIManager>().enabled = false;
                ctx.SaveLoad.autosaveEveryTicks = 0;
                ctx.Time.SetSpeed(0);
            }
            if (prepared) foreach (var file in files)
            {
                if (file.Value == null) { if (File.Exists(file.Key)) File.Delete(file.Key); }
                else { Directory.CreateDirectory(Path.GetDirectoryName(file.Key)); File.WriteAllBytes(file.Key, file.Value); }
            }
            foreach (var item in integers) { if (item.Value.HasValue) PlayerPrefs.SetInt(item.Key, item.Value.Value); else PlayerPrefs.DeleteKey(item.Key); }
            foreach (var item in floats) { if (item.Value.HasValue) PlayerPrefs.SetFloat(item.Key, item.Value.Value); else PlayerPrefs.DeleteKey(item.Key); }
            PlayerPrefs.Save();
            AudioListener.volume = listenerVolume;
            ArtMode.Set(art);
            MainMenuPanel.ShowOnStartup = startup;
            files.Clear(); integers.Clear(); floats.Clear(); prepared = false;
            yield return null;
        }

        [Test]
        public void StartupBlocksGameplayAndOffersLoadingOnly()
        {
            Assert.IsTrue(ctx.Menu.Active);
            Assert.IsFalse(ctx.Menu.HasEnteredCity);
            Assert.IsTrue(ctx.Time.Paused);
            Assert.IsFalse(ctx.Time.keyboardShortcuts);
            Assert.IsFalse(ctx.SaveLoad.keyboardShortcuts);
            Assert.IsFalse(ctx.Placement.enabled);
            Assert.IsFalse(Object.FindAnyObjectByType<RTSCameraController>().enabled);
            Assert.IsFalse(Button(ctx.MainMenu.MenuRoot, "Continue").interactable);
            Assert.AreEqual("New Game", EventSystem.current.currentSelectedGameObject.name);
            Click(ctx.MainMenu.MenuRoot, "Load Cities");
            for (int i = 0; i < SaveLoadManager.SlotCount; i++)
            {
                Assert.IsFalse(Find<Button>(ctx.SaveLoadMenu.MenuRoot, "Save Slot " + i).gameObject.activeSelf);
                Assert.IsFalse(Button(ctx.SaveLoadMenu.MenuRoot, "Load Slot " + i).interactable);
            }
            Click(ctx.SaveLoadMenu.MenuRoot, "Back");
            Assert.IsTrue(ctx.MainMenu.IsOpen);
            Assert.IsTrue(ctx.Time.Paused);
        }

        [UnityTest]
        public IEnumerator EveryChapterStartsAndLanguageChangesKeepTheForm()
        {
            foreach (var scenario in root.Db.Scenarios)
            {
                ctx.MainMenu.Show(false);
                Click(ctx.MainMenu.MenuRoot, "New Game");
                var name = Find<InputField>(ctx.MainMenu.MenuRoot, "City Name");
                var seed = Find<InputField>(ctx.MainMenu.MenuRoot, "Map Seed");
                name.text = new string('W', 40);
                seed.text = "12345";
                Click(ctx.MainMenu.MenuRoot, "Scenario " + scenario.id);
                root.SetLanguage(false);
                root.SetLanguage(true);
                Assert.AreEqual(new string('W', 40), name.text);
                Assert.AreEqual("12345", seed.text);
                Click(ctx.MainMenu.MenuRoot, "Start City");
                Assert.AreEqual(scenario.era, root.Sim.CurrentEra);
                Assert.AreEqual(12345, root.seed);
                Assert.AreEqual(new string('W', 40), root.cityName);
                Assert.IsTrue(ctx.Menu.HasEnteredCity);
                Assert.IsFalse(ctx.Menu.Active);
                Assert.IsFalse(ctx.MainMenu.IsOpen);
                Assert.IsFalse(ctx.Time.Paused);
                var map = root.Sim.Map;
                int dx = map.MouthX < map.Width / 2 ? 8 : -8;
                root.Sim.City.Grid.CellCenter(Mathf.Clamp(map.MouthX + dx, 0, map.Width - 1), map.MouthY, out float x, out float z);
                var camera = Object.FindAnyObjectByType<RTSCameraController>();
                Assert.That(camera.transform.position.x, Is.EqualTo(x).Within(0.01f));
                Assert.That(camera.transform.position.z, Is.EqualTo(z).Within(0.01f));
                yield return null;
            }
        }

        [Test]
        public void BackAndEscapeRespectStartupPauseAndDirectGameplayOrigins()
        {
            Click(ctx.MainMenu.MenuRoot, "New Game");
            ctx.MainMenu.OnEscape();
            Assert.IsTrue(Button(ctx.MainMenu.MenuRoot, "New Game").gameObject.activeInHierarchy);
            ctx.MainMenu.OnEscape();
            Assert.IsTrue(ctx.MainMenu.IsOpen, "Esc cannot expose the placeholder startup city.");
            Click(ctx.MainMenu.MenuRoot, "Settings");
            Click(ctx.Settings.MenuRoot, "Back");
            Assert.IsFalse(ctx.MainMenu.IsPauseMenu);
            Assert.IsTrue(ctx.MainMenu.IsOpen);
            StartCity();
            ctx.Settings.Open();
            Click(ctx.Settings.MenuRoot, "Back");
            Assert.IsFalse(ctx.MainMenu.IsOpen);
            Assert.IsFalse(ctx.Time.Paused);
            ctx.MainMenu.Show(true);
            Click(ctx.MainMenu.MenuRoot, "Settings");
            ctx.Settings.Close();
            Assert.IsTrue(ctx.MainMenu.IsOpen);
            Assert.IsTrue(ctx.Time.Paused);
            Assert.AreEqual("Resume", EventSystem.current.currentSelectedGameObject.name);
            ctx.MainMenu.OnEscape();
            Assert.IsFalse(ctx.Time.Paused);
        }

        [UnityTest]
        public IEnumerator RepeatedMenuAndTextFocusCyclesRestoreTheOriginalInputState()
        {
            StartCity();
            var camera = Object.FindAnyObjectByType<RTSCameraController>();
            camera.enabled = false;
            ctx.Time.keyboardShortcuts = false;
            ctx.SaveLoad.keyboardShortcuts = true;
            ctx.Time.PushPause();
            for (int i = 0; i < 12; i++)
            {
                ctx.MainMenu.Show(true);
                Click(ctx.MainMenu.MenuRoot, "New Game");
                var input = Find<InputField>(ctx.MainMenu.MenuRoot, "City Name");
                EventSystem.current.SetSelectedGameObject(input.gameObject);
                input.ActivateInputField();
                yield return null;
                ctx.MainMenu.OnEscape();
                Click(ctx.MainMenu.MenuRoot, "Settings");
                ctx.Settings.Close();
                ctx.MainMenu.Hide();
                Assert.IsFalse(camera.enabled);
                Assert.IsFalse(ctx.Time.keyboardShortcuts);
                Assert.IsTrue(ctx.SaveLoad.keyboardShortcuts);
                Assert.IsTrue(ctx.Placement.enabled);
                Assert.IsFalse(TextFocus.Active);
                Assert.IsTrue(ctx.Time.Paused, "The external pause must remain.");
            }
            ctx.Time.PopPause();
            Assert.IsFalse(ctx.Time.Paused, "No menu pause may leak across navigation.");
        }

        [Test]
        public void SettingsApplyImmediatelyPersistAndStayInTheirSection()
        {
            Click(ctx.MainMenu.MenuRoot, "Settings");
            Click(ctx.Settings.MenuRoot, "Settings Category 1");
            Find<Slider>(ctx.Settings.MenuRoot, "Master Volume").value = 0.37f;
            Find<Slider>(ctx.Settings.MenuRoot, "Music Volume").value = 0.41f;
            Find<Slider>(ctx.Settings.MenuRoot, "Ambience Volume").value = 0.52f;
            Assert.That(AudioListener.volume, Is.EqualTo(0.37f).Within(0.001));
            root.SetLanguage(false);
            Assert.IsTrue(Find<RectTransform>(ctx.Settings.MenuRoot, "Settings Section 1").gameObject.activeSelf);
            Click(ctx.Settings.MenuRoot, "Settings Category 0");
            Click(ctx.Settings.MenuRoot, "Edge Off");
            Click(ctx.Settings.MenuRoot, "Settings Category 2");
            Click(ctx.Settings.MenuRoot, "Greybox Art");
            ctx.Settings.Close();
            var audio = Object.FindAnyObjectByType<AudioAtmosphereManager>();
            var camera = Object.FindAnyObjectByType<RTSCameraController>();
            AudioListener.volume = 1;
            camera.edgeScrolling = true;
            HudSettings.ApplyScene(audio, camera);
            Assert.That(AudioListener.volume, Is.EqualTo(0.37f).Within(0.001));
            Assert.That(audio.musicVolume, Is.EqualTo(0.41f).Within(0.001));
            Assert.That(audio.ambienceVolume, Is.EqualTo(0.52f).Within(0.001));
            Assert.IsFalse(camera.edgeScrolling);
            Assert.IsTrue(ArtMode.Greybox);
            Assert.IsTrue(ctx.MainMenu.IsOpen);
            Assert.IsTrue(ctx.Time.Paused);
        }

        [Test]
        public void SavesRefreshTheirRowsAndContinueUsesTheNewestSlot()
        {
            StartCity();
            root.cityName = "Older City";
            ctx.SaveLoadMenu.Open();
            Click(ctx.SaveLoadMenu.MenuRoot, "Save Slot 1");
            Assert.IsTrue(ctx.SaveLoadMenu.IsOpen);
            Assert.IsTrue(ctx.SaveLoadMenu.MenuRoot.GetComponentsInChildren<Text>().Any(t => t.text == root.cityName));
            Stamp(1, "2020-01-01T00:00:00Z");
            root.cityName = "Newest City";
            Click(ctx.SaveLoadMenu.MenuRoot, "Save Slot 2");
            Stamp(2, "2021-01-01T00:00:00Z");
            ctx.SaveLoadMenu.Close();
            ctx.MainMenu.Show(false);
            Assert.AreEqual("Continue", EventSystem.current.currentSelectedGameObject.name);
            Click(ctx.MainMenu.MenuRoot, "Continue");
            Assert.AreEqual("Newest City", root.cityName);
            Assert.IsFalse(ctx.Menu.Active);
            Assert.IsFalse(ctx.MainMenu.IsOpen);
        }

        [Test]
        public void UnreadableSlotsAreDisabledAndLoadFailuresLeaveARecoveryPath()
        {
            WriteSave(1, 999);
            Directory.CreateDirectory(Path.GetDirectoryName(ctx.SaveLoad.PathFor(2)));
            File.WriteAllText(ctx.SaveLoad.PathFor(2), "not json");
            Click(ctx.MainMenu.MenuRoot, "Load Cities");
            Assert.IsFalse(Button(ctx.SaveLoadMenu.MenuRoot, "Load Slot 2").interactable);
            Assert.IsTrue(Button(ctx.SaveLoadMenu.MenuRoot, "Load Slot 1").interactable);
            LogAssert.Expect(LogType.Error, new Regex(@"\[Load\]"));
            Click(ctx.SaveLoadMenu.MenuRoot, "Load Slot 1");
            Assert.IsTrue(ctx.SaveLoadMenu.IsOpen);
            Assert.IsTrue(ctx.Time.Paused);
            Assert.IsTrue(ctx.SaveLoadMenu.MenuRoot.GetComponentsInChildren<Text>().Any(t => t.text == Loc.Get("unity.menu.loadFailed")));
            WriteSave(1, SaveGame.CurrentVersion);
            Click(ctx.SaveLoadMenu.MenuRoot, "Load Slot 1");
            Assert.IsFalse(ctx.SaveLoadMenu.IsOpen);
            Assert.IsFalse(ctx.MainMenu.IsOpen);
            Assert.IsFalse(ctx.Menu.Active);
        }

        [Test]
        public void SaveFailuresKeepTheSlotListOpen()
        {
            StartCity();
            ctx.SaveLoadMenu.Open();
            string temporary = ctx.SaveLoad.PathFor(1) + ".tmp";
            if (Directory.Exists(temporary)) Assert.Ignore("An existing temporary directory must stay untouched.");
            Directory.CreateDirectory(temporary);
            try
            {
                LogAssert.Expect(LogType.Error, new Regex(@"\[Save\]"));
                Click(ctx.SaveLoadMenu.MenuRoot, "Save Slot 1");
                Assert.IsTrue(ctx.SaveLoadMenu.IsOpen);
                Assert.IsTrue(ctx.Time.Paused);
                Assert.IsTrue(ctx.SaveLoadMenu.MenuRoot.GetComponentsInChildren<Text>().Any(t => t.text == Loc.Get("unity.menu.saveFailed")));
            }
            finally { Directory.Delete(temporary); }
        }

        [UnityTest, Category("MenuVisualReview")]
        public IEnumerator CaptureMenusAtTheCurrentTargetViewport()
        {
            if (Application.isBatchMode) Assert.Ignore("Screenshot review requires a rendered Game view or player.");
            string viewport = Screen.width + "x" + Screen.height;
            if (viewport != "1280x720" && viewport != "1920x1080" && viewport != "2560x1080")
                Assert.Ignore("Set the Game view or player to one of the three target resolutions, then rerun this test.");
            Assert.NotNull(Resources.Load<Font>("Menu/CormorantGaramond-SemiBold"));
            Assert.NotNull(Resources.Load<Texture2D>("Menu/heritage-panorama"));
            foreach (bool malay in new[] { true, false })
            {
                root.SetLanguage(malay);
                string prefix = viewport + "-" + (malay ? "bm" : "en");
                ctx.MainMenu.Show(false);
                yield return Capture(prefix + "-title", ctx.MainMenu.MenuRoot);
                Click(ctx.MainMenu.MenuRoot, "New Game");
                Find<InputField>(ctx.MainMenu.MenuRoot, "City Name").text = new string('W', 40);
                foreach (var scenario in root.Db.Scenarios)
                {
                    Click(ctx.MainMenu.MenuRoot, "Scenario " + scenario.id);
                    yield return Capture(prefix + "-" + scenario.id, ctx.MainMenu.MenuRoot);
                }
                ctx.MainMenu.OnEscape();
                Click(ctx.MainMenu.MenuRoot, "Load Cities");
                yield return Capture(prefix + "-empty-slots", ctx.SaveLoadMenu.MenuRoot);
                ctx.SaveLoadMenu.Close();
                Click(ctx.MainMenu.MenuRoot, "Settings");
                for (int i = 0; i < 4; i++)
                {
                    Click(ctx.Settings.MenuRoot, "Settings Category " + i);
                    yield return Capture(prefix + "-settings-" + i, ctx.Settings.MenuRoot);
                }
                ctx.Settings.Close();
                WriteSave(1, SaveGame.CurrentVersion);
                WriteSave(2, 999);
                File.WriteAllText(ctx.SaveLoad.PathFor(3), "not json");
                ctx.MainMenu.Show(false);
                yield return Capture(prefix + "-title-saved", ctx.MainMenu.MenuRoot);
                Click(ctx.MainMenu.MenuRoot, "Load Cities");
                yield return Capture(prefix + "-mixed-slots", ctx.SaveLoadMenu.MenuRoot);
                LogAssert.Expect(LogType.Error, new Regex(@"\[Load\]"));
                Click(ctx.SaveLoadMenu.MenuRoot, "Load Slot 2");
                yield return Capture(prefix + "-load-error", ctx.SaveLoadMenu.MenuRoot);
                ctx.SaveLoadMenu.Close();
                for (int slot = 1; slot < SaveLoadManager.SlotCount; slot++) File.Delete(ctx.SaveLoad.PathFor(slot));
            }
            StartCity();
            foreach (bool malay in new[] { true, false })
            {
                root.SetLanguage(malay);
                string prefix = viewport + "-" + (malay ? "bm" : "en");
                ctx.MainMenu.Show(true);
                yield return Capture(prefix + "-pause", ctx.MainMenu.MenuRoot);
                Click(ctx.MainMenu.MenuRoot, "Load Cities");
                Click(ctx.SaveLoadMenu.MenuRoot, "Save Slot 1");
                yield return Capture(prefix + "-saved", ctx.SaveLoadMenu.MenuRoot);
                ctx.SaveLoadMenu.Close();
                ctx.MainMenu.Hide();
            }
        }

        static IEnumerator Capture(string name, RectTransform menu)
        {
            Canvas.ForceUpdateCanvases();
            yield return new WaitForEndOfFrame();
            foreach (var control in menu.GetComponentsInChildren<Selectable>())
            {
                if (!control.IsInteractable()) continue;
                var corners = new Vector3[4];
                ((RectTransform)control.transform).GetWorldCorners(corners);
                Assert.GreaterOrEqual(corners[0].x, -1, control.name);
                Assert.GreaterOrEqual(corners[0].y, -1, control.name);
                Assert.LessOrEqual(corners[2].x, Screen.width + 1, control.name);
                Assert.LessOrEqual(corners[2].y, Screen.height + 1, control.name);
                Assert.GreaterOrEqual(corners[2].x - corners[0].x, 44, control.name);
                Assert.GreaterOrEqual(corners[2].y - corners[0].y, 44, control.name);
                var navigation = control.navigation;
                if (navigation.selectOnDown != null) Assert.IsTrue(navigation.selectOnDown.transform.IsChildOf(menu));
            }
            foreach (var text in menu.GetComponentsInChildren<Text>())
                if (text.text.Length > 0 && text.verticalOverflow == VerticalWrapMode.Truncate)
                    Assert.LessOrEqual(text.preferredHeight, text.rectTransform.rect.height + 2, "Clipped text: " + text.name + " = " + text.text);
            string directory = Environment.GetEnvironmentVariable("TAMADUN_MENU_REVIEW_DIR") ??
                Path.GetFullPath(Path.Combine(Application.dataPath, "..", "ci", ".cache", "menu-review"));
            Directory.CreateDirectory(directory);
            string template = Path.Combine(Application.dataPath, "Tests", "PlayMode", "MenuReviewEvidence.json");
            string report = Path.Combine(directory, "evidence.json");
            if (!File.Exists(report) && File.Exists(template)) File.Copy(template, report);
            // Read the finished frame with the project's existing Core and ImageConversion modules.
            var previousTarget = RenderTexture.active;
            var texture = new Texture2D(Screen.width, Screen.height, TextureFormat.RGB24, false);
            try
            {
                RenderTexture.active = null;
                texture.ReadPixels(new Rect(0, 0, Screen.width, Screen.height), 0, 0, false);
                texture.Apply(false, false);
                File.WriteAllBytes(Path.Combine(directory, name + ".png"), texture.EncodeToPNG());
            }
            finally
            {
                RenderTexture.active = previousTarget;
                Object.Destroy(texture);
            }
        }

        void StartCity()
        {
            Click(ctx.MainMenu.MenuRoot, "New Game");
            Click(ctx.MainMenu.MenuRoot, "Scenario melaka_1400");
            Click(ctx.MainMenu.MenuRoot, "Start City");
        }
        void Stamp(int slot, string date)
        {
            string path = ctx.SaveLoad.PathFor(slot);
            var save = JsonUtility.FromJson<SaveGame>(File.ReadAllText(path));
            save.savedAt = date;
            File.WriteAllText(path, JsonUtility.ToJson(save));
        }
        void WriteSave(int slot, int version)
        {
            var save = SaveCodec.Capture(root.Sim, "Test City", root.seed);
            save.version = version;
            string path = ctx.SaveLoad.PathFor(slot);
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            File.WriteAllText(path, JsonUtility.ToJson(save));
        }
        static T Find<T>(RectTransform parent, string name) where T : Component =>
            parent.GetComponentsInChildren<T>(true).Single(t => t.name == name);
        static Button Button(RectTransform parent, string name) => Find<Button>(parent, name);
        static void Click(RectTransform parent, string name)
        {
            var button = Button(parent, name);
            Assert.IsTrue(button.gameObject.activeInHierarchy, "Hidden button " + name);
            Assert.IsTrue(button.interactable, "Disabled button " + name);
            button.onClick.Invoke();
        }
    }
}
