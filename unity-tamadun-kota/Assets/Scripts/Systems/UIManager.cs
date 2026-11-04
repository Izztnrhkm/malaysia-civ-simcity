using System.Collections.Generic;
using System.Text;
using TamadunKota.Core;
using TamadunKota.Data;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace TamadunKota.Systems
{
    /// <summary>
    /// The in-game HUD, built from code with uGUI so the scene needs no hand-made prefabs:
    /// resource bar (Treasury, Food, Timber, Tin, Rubber, Energy, Tech), date / era / population,
    /// speed controls, tool bar (inspect, transport, R/C/I zones, bulldoze), a build palette of
    /// the buildings unlocked in the current era, research picker, era advance, crisis dialog,
    /// notices, building inspector with its Sejarahpedia summary, BM/EN toggle, save/load and
    /// the "Greybox / Full 3D Art" toggle.
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

        Font font;
        Text resourceText, dateText, statusText, messageText, inspectorText, artToggleLabel, researchStatus;
        RectTransform palette, researchList, noticeList, crisisPanel, researchPanel, inspectorPanel, savePanel;
        Text crisisTitle, crisisBody;
        RectTransform crisisChoices;
        readonly List<Text> noticeTexts = new List<Text>();
        readonly Queue<string> notices = new Queue<string>();
        readonly StringBuilder sb = new StringBuilder(256);
        float messageUntil;
        int paletteSignature = -1;
        string shownCrisis;
        bool crisisPaused;
        GameSimulation sim;
        EconomySnapshot snap;

        bool Malay => GameRoot.Instance == null || GameRoot.Instance.malay;
        string T(string ms, string en) => Malay ? ms : en;

        // ------------------------------------------------------------ lifecycle

        void Awake()
        {
            font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
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
            if (sim != null) sim.NoticePosted -= OnNotice;
            sim = s;
            paletteSignature = -1;
            if (sim != null) sim.NoticePosted += OnNotice;
        }

        void Update()
        {
            if (sim == null) return;
            if (messageText != null && messageText.enabled && Time.unscaledTime > messageUntil) messageText.enabled = false;
            int sig = PaletteSignature();
            if (sig != paletteSignature)
            {
                paletteSignature = sig;
                RebuildPalette();
            }
            UpdateCrisis();
            if (researchPanel != null && researchPanel.gameObject.activeSelf) UpdateResearchStatus();
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

            // top bar
            var top = Panel(root, "Top Bar", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -64), Vector2.zero);
            resourceText = Label(top, "Resources", fontSize, TextAnchor.MiddleLeft);
            Stretch(resourceText.rectTransform, new Vector2(0, 0), new Vector2(0.62f, 1), new Vector2(16, 0), Vector2.zero);
            dateText = Label(top, "Date", fontSize, TextAnchor.MiddleRight);
            Stretch(dateText.rectTransform, new Vector2(0.62f, 0), new Vector2(1, 1), Vector2.zero, new Vector2(-16, 0));

            // second row: speed + options
            var bar = Row(root, "Controls", new Vector2(0, 1), new Vector2(1, 1), new Vector2(8, -112), new Vector2(-8, -68));
            Btn(bar, "II", () => time?.SetSpeed(0), 52);
            Btn(bar, ">", () => time?.SetSpeed(1), 52);
            Btn(bar, ">>", () => time?.SetSpeed(2), 52);
            Btn(bar, ">>>", () => time?.SetSpeed(3), 60);
            Spacer(bar, 16);
            Btn(bar, () => T("Kajian", "Research"), ToggleResearch, 130);
            Btn(bar, () => T("Maju Era", "Advance Era"), AdvanceEra, 150);
            Btn(bar, () => T("Simpan/Muat", "Save/Load"), ToggleSave, 150);
            Btn(bar, () => "BM / EN", () => GameRoot.Instance?.SetLanguage(!Malay), 110);
            Spacer(bar, 16);
            if (artToggleButton == null) artToggleButton = Btn(bar, "", null, 220);
            else artToggleButton.transform.SetParent(bar, false);
            // The setup menu wires a persistent listener (ArtModeToggle.Toggle) visible in the
            // Inspector; only add a runtime one when the button has none, or it would toggle twice.
            if (artToggleButton.onClick.GetPersistentEventCount() == 0)
            {
                artToggleButton.onClick.RemoveAllListeners();
                artToggleButton.onClick.AddListener(ArtMode.Toggle);
            }
            artToggleLabel = artToggleButton.GetComponentInChildren<Text>();
            OnArtMode(ArtMode.Greybox);
            statusText = Label(bar, "Status", fontSize - 2, TextAnchor.MiddleLeft);
            statusText.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;

            // bottom: tools + palette
            var tools = Row(root, "Tools", new Vector2(0, 0), new Vector2(1, 0), new Vector2(8, 128), new Vector2(-8, 176));
            Btn(tools, () => T("Periksa", "Inspect"), () => placement?.Cancel(), 110);
            Btn(tools, () => T("Jalan", "Road"), () => SelectTransport("road"), 90);
            Btn(tools, () => T("Kereta api", "Rail"), () => SelectTransport("rail"), 110);
            Btn(tools, () => T("Lebuh raya", "Highway"), () => SelectTransport("highway"), 120);
            Btn(tools, () => "MRT", () => SelectTransport("mrt"), 70);
            Spacer(tools, 12);
            Btn(tools, () => T("Zon K", "Zone R"), () => placement?.SelectZone(ZoneType.Residential), 100);
            Btn(tools, () => T("Zon P", "Zone C"), () => placement?.SelectZone(ZoneType.Commercial), 100);
            Btn(tools, () => T("Zon I", "Zone I"), () => placement?.SelectZone(ZoneType.Industrial), 100);
            Spacer(tools, 12);
            Btn(tools, () => T("Roboh", "Bulldoze"), () => placement?.SelectBulldoze(), 110);
            Spacer(tools, 12);
            Btn(tools, () => T("Cukai K +", "Tax R +"), () => Tax(ZoneType.Residential, 1), 110);
            Btn(tools, () => T("Cukai K -", "Tax R -"), () => Tax(ZoneType.Residential, -1), 110);

            var paletteBg = Panel(root, "Build Palette", new Vector2(0, 0), new Vector2(1, 0), new Vector2(8, 8), new Vector2(-8, 120));
            var scrollGo = new GameObject("Scroll", typeof(RectTransform), typeof(Image), typeof(Mask), typeof(ScrollRect));
            var scrollRt = (RectTransform)scrollGo.transform;
            scrollRt.SetParent(paletteBg, false);
            Stretch(scrollRt, Vector2.zero, Vector2.one, new Vector2(6, 6), new Vector2(-6, -6));
            scrollGo.GetComponent<Image>().color = new Color(0, 0, 0, 0.01f);
            scrollGo.GetComponent<Mask>().showMaskGraphic = false;
            palette = new GameObject("Content", typeof(RectTransform)).GetComponent<RectTransform>();
            palette.SetParent(scrollRt, false);
            palette.anchorMin = new Vector2(0, 0);
            palette.anchorMax = new Vector2(0, 1);
            palette.pivot = new Vector2(0, 0.5f);
            palette.offsetMin = Vector2.zero;
            palette.offsetMax = Vector2.zero;
            var h = palette.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = 6;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = true;
            palette.gameObject.AddComponent<ContentSizeFitter>().horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            var sr = scrollGo.GetComponent<ScrollRect>();
            sr.content = palette;
            sr.horizontal = true;
            sr.vertical = false;
            sr.scrollSensitivity = 30;

            // notices (left)
            noticeList = Column(root, "Notices", new Vector2(0, 1), new Vector2(0, 1), new Vector2(8, -420), new Vector2(460, -124));
            for (int i = 0; i < 5; i++)
            {
                var t = Label(noticeList, "Notice" + i, fontSize - 3, TextAnchor.UpperLeft);
                t.gameObject.AddComponent<LayoutElement>().preferredHeight = 56;
                noticeTexts.Add(t);
            }

            // centre message
            messageText = Label(root, "Message", fontSize + 2, TextAnchor.MiddleCenter);
            Stretch(messageText.rectTransform, new Vector2(0.2f, 0), new Vector2(0.8f, 0), new Vector2(0, 186), new Vector2(0, 226));
            messageText.color = accentColor;
            messageText.enabled = false;

            // inspector (right)
            inspectorPanel = Panel(root, "Inspector", new Vector2(1, 1), new Vector2(1, 1), new Vector2(-460, -520), new Vector2(-8, -124));
            inspectorText = Label(inspectorPanel, "Text", fontSize - 3, TextAnchor.UpperLeft);
            Stretch(inspectorText.rectTransform, Vector2.zero, Vector2.one, new Vector2(12, 12), new Vector2(-12, -12));
            inspectorText.horizontalOverflow = HorizontalWrapMode.Wrap;
            inspectorPanel.gameObject.SetActive(false);

            // research
            researchPanel = Panel(root, "Research", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-420, -330), new Vector2(420, 330));
            researchStatus = Label(researchPanel, "Status", fontSize - 2, TextAnchor.UpperLeft);
            Stretch(researchStatus.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(12, -70), new Vector2(-12, -8));
            researchList = Column(researchPanel, "List", Vector2.zero, Vector2.one, new Vector2(12, 12), new Vector2(-12, -76));
            researchPanel.gameObject.SetActive(false);

            // save / load
            savePanel = Panel(root, "Save Load", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-300, -170), new Vector2(300, 170));
            savePanel.gameObject.SetActive(false);

            // crisis dialog
            crisisPanel = Panel(root, "Crisis", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-430, -260), new Vector2(430, 260));
            crisisTitle = Label(crisisPanel, "Title", fontSize + 6, TextAnchor.UpperLeft);
            crisisTitle.color = accentColor;
            Stretch(crisisTitle.rectTransform, new Vector2(0, 1), new Vector2(1, 1), new Vector2(16, -56), new Vector2(-16, -12));
            crisisBody = Label(crisisPanel, "Body", fontSize - 1, TextAnchor.UpperLeft);
            Stretch(crisisBody.rectTransform, new Vector2(0, 0.5f), new Vector2(1, 1), new Vector2(16, 0), new Vector2(-16, -60));
            crisisChoices = Column(crisisPanel, "Choices", Vector2.zero, new Vector2(1, 0.5f), new Vector2(16, 16), new Vector2(-16, -8));
            crisisPanel.gameObject.SetActive(false);
        }

        // ------------------------------------------------------------ widgets

        RectTransform Panel(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            Stretch(rt, aMin, aMax, oMin, oMax);
            go.GetComponent<Image>().color = panelColor;
            return rt;
        }

        RectTransform Row(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax)
        {
            var rt = Panel(parent, name, aMin, aMax, oMin, oMax);
            var h = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = 6;
            h.padding = new RectOffset(6, 6, 4, 4);
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = true;
            return rt;
        }

        RectTransform Column(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            Stretch(rt, aMin, aMax, oMin, oMax);
            var v = go.AddComponent<VerticalLayoutGroup>();
            v.spacing = 4;
            v.childControlWidth = true;
            v.childControlHeight = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            return rt;
        }

        static void Stretch(RectTransform rt, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax)
        {
            rt.anchorMin = aMin;
            rt.anchorMax = aMax;
            rt.offsetMin = oMin;
            rt.offsetMax = oMax;
        }

        Text Label(Transform parent, string name, int size, TextAnchor anchor)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>();
            t.font = font;
            t.fontSize = size;
            t.color = textColor;
            t.alignment = anchor;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Truncate;
            t.raycastTarget = false;
            return t;
        }

        void Spacer(Transform parent, float width)
        {
            var go = new GameObject("Spacer", typeof(RectTransform), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            go.GetComponent<LayoutElement>().preferredWidth = width;
        }

        Button Btn(Transform parent, string label, UnityEngine.Events.UnityAction onClick, float width)
        {
            var go = new GameObject("Button " + label, typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = buttonColor;
            var le = go.GetComponent<LayoutElement>();
            le.preferredWidth = width;
            le.minWidth = width;
            le.preferredHeight = 40;
            var b = go.GetComponent<Button>();
            var colors = b.colors;
            colors.highlightedColor = new Color(1.25f, 1.25f, 1.1f, 1f);
            colors.pressedColor = accentColor;
            b.colors = colors;
            if (onClick != null) b.onClick.AddListener(onClick);
            var t = Label(go.transform, "Label", fontSize - 2, TextAnchor.MiddleCenter);
            Stretch(t.rectTransform, Vector2.zero, Vector2.one, new Vector2(4, 2), new Vector2(-4, -2));
            t.text = label;
            return b;
        }

        /// <summary>A button whose label is re-evaluated when the language changes.</summary>
        Button Btn(Transform parent, System.Func<string> label, UnityEngine.Events.UnityAction onClick, float width)
        {
            var b = Btn(parent, label(), onClick, width);
            var t = b.GetComponentInChildren<Text>();
            localized.Add((t, label));
            return b;
        }

        readonly List<(Text text, System.Func<string> label)> localized = new List<(Text, System.Func<string>)>();

        static void ClearChildren(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--) Destroy(t.GetChild(i).gameObject);
        }

        // ------------------------------------------------------------ HUD updates

        void OnEconomy(EconomySnapshot s)
        {
            snap = s;
            string cur = economy != null ? economy.Currency : "";
            sb.Clear();
            sb.Append(cur).Append(' ').Append(Fmt(s.treasury));
            sb.Append(s.netIncome >= 0 ? "  (+" : "  (").Append(Fmt(s.netIncome)).Append(")");
            sb.Append("   ").Append(T("Makanan ", "Food ")).Append(Fmt(s.food));
            sb.Append("   ").Append(T("Kayu ", "Timber ")).Append(Fmt(s.timber));
            sb.Append("   ").Append(T("Bijih timah ", "Tin ")).Append(Fmt(s.tin));
            sb.Append("   ").Append(T("Getah ", "Rubber ")).Append(Fmt(s.rubber));
            sb.Append("   ").Append(T("Tenaga ", "Energy ")).Append(Fmt(s.energy));
            sb.Append("   ").Append(T("Teknologi ", "Tech ")).Append(Fmt(s.tech));
            resourceText.text = sb.ToString();

            var era = sim != null ? sim.EraDef : null;
            sb.Clear();
            sb.Append(T("Penduduk ", "Pop ")).Append(Fmt(s.population));
            sb.Append("   ").Append(T("Gembira ", "Happy ")).Append(((int)s.happiness).ToString()).Append('%');
            sb.Append("   ").Append(MonthName(s.month)).Append(' ').Append(s.year.ToString());
            if (era != null) sb.Append("   ").Append(T(era.shortMs, era.shortEn));
            dateText.text = sb.ToString();

            sb.Clear();
            sb.Append("R ").Append(((int)s.demandR).ToString()).Append("  C ").Append(((int)s.demandC).ToString()).Append("  I ").Append(((int)s.demandI).ToString());
            if (sim != null) sb.Append("   ").Append(T("Cukai ", "Tax ")).Append(sim.TaxR.ToString("0")).Append('/').Append(sim.TaxC.ToString("0")).Append('/').Append(sim.TaxI.ToString("0")).Append('%');
            statusText.text = sb.ToString();
        }

        static readonly string[] MonthsMs = { "Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis" };
        static readonly string[] MonthsEn = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
        string MonthName(int m) { m = Mathf.Clamp(m, 0, 11); return Malay ? MonthsMs[m] : MonthsEn[m]; }

        static string Fmt(double v)
        {
            double a = System.Math.Abs(v);
            if (a >= 1e6) return (v / 1e6).ToString("0.0") + "M";
            if (a >= 1e4) return (v / 1e3).ToString("0") + "k";
            return v.ToString("0");
        }

        void OnLanguage(bool malay)
        {
            foreach (var (text, label) in localized) if (text != null) text.text = label();
            OnArtMode(ArtMode.Greybox);
            paletteSignature = -1;
            if (economy != null) OnEconomy(economy.Current);
            if (researchPanel.gameObject.activeSelf) RebuildResearch();
            shownCrisis = null;
        }

        void OnArtMode(bool greybox)
        {
            if (artToggleLabel != null)
                artToggleLabel.text = greybox ? T("Seni 3D Penuh", "Full 3D Art") : T("Mod Greybox", "Greybox Mode");
        }

        void ShowMessage(string msg)
        {
            if (messageText == null || string.IsNullOrEmpty(msg)) return;
            messageText.text = msg;
            messageText.enabled = true;
            messageUntil = Time.unscaledTime + 3f;
        }

        void OnNotice(Notice n)
        {
            string line = Malay ? n.titleMs : n.titleEn;
            notices.Enqueue(line);
            while (notices.Count > noticeTexts.Count) notices.Dequeue();
            int i = 0;
            foreach (var s in notices) noticeTexts[i++].text = s;
            for (; i < noticeTexts.Count; i++) noticeTexts[i].text = "";
        }

        void OnEra(int era)
        {
            paletteSignature = -1;
            var e = sim != null ? sim.EraDef : null;
            if (e != null) ShowMessage(T("Era baharu: " + e.nameMs, "New era: " + e.nameEn));
        }

        void OnAchievement(string id) => ShowMessage(T("Pencapaian: ", "Achievement: ") + id);
        void OnSaved(int slot) => ShowMessage(T("Disimpan ke slot ", "Saved to slot ") + slot);
        void OnLoaded(int slot) => ShowMessage(T("Dimuat dari slot ", "Loaded slot ") + slot);

        void SelectTransport(string key)
        {
            if (sim == null || placement == null) return;
            if (!sim.Tech.IsTransportUnlocked(key, sim.CurrentEra))
            {
                ShowMessage(T("Belum dibuka", "Not unlocked yet"));
                return;
            }
            placement.SelectTransport(key);
        }

        void Tax(ZoneType z, int delta)
        {
            if (sim == null || economy == null) return;
            economy.SetTax(z, (z == ZoneType.Residential ? sim.TaxR : z == ZoneType.Commercial ? sim.TaxC : sim.TaxI) + delta);
            OnEconomy(economy.Current);
        }

        // ------------------------------------------------------------ build palette

        int PaletteSignature()
        {
            int h = sim.CurrentEra * 7919 + (Malay ? 1 : 0);
            var done = sim.Tech.Done;
            for (int i = 0; i < done.Length; i++) if (done[i]) h = h * 31 + i;
            return h;
        }

        void RebuildPalette()
        {
            if (palette == null || catalog == null) return;
            ClearChildren(palette);
            var db = sim.Db;
            for (int i = 0; i < db.Buildings.Length; i++)
            {
                var rec = db.Buildings[i];
                if (!sim.IsUnlocked(i)) continue;
                if (rec.obsoleteAfterEra > 0 && sim.CurrentEra > rec.obsoleteAfterEra) continue;
                var data = catalog.Find(rec.id);
                if (data == null) continue;
                string cur = economy != null ? economy.Currency : "";
                var b = Btn(palette, data.DisplayName(Malay) + "\n" + cur + Fmt(rec.cost), () => placement?.SelectBuilding(data), 168);
                b.GetComponentInChildren<Text>().fontSize = fontSize - 4;
            }
        }

        // ------------------------------------------------------------ inspector

        void Inspect(int x, int y)
        {
            if (sim == null) return;
            var city = sim.City;
            var g = city.Grid;
            if (!g.InBounds(x, y)) { inspectorPanel.gameObject.SetActive(false); return; }
            int i = g.Index(x, y);
            sb.Clear();
            int id = city.BuildingAt[i];
            if (id >= 0)
            {
                var b = city.FindBuilding(id);
                var rec = b != null ? sim.Db.Buildings[b.defIndex] : null;
                if (rec != null)
                {
                    sb.Append("<b>").Append(T(rec.nameMs, rec.nameEn)).Append("</b>\n");
                    sb.Append(T(rec.descMs, rec.descEn)).Append("\n\n");
                    sb.Append(T("Pekerja: ", "Jobs: ")).Append(rec.jobs).Append("   ").Append(T("Kecekapan: ", "Efficiency: ")).Append((int)(b.efficiency * 100)).Append("%\n\n");
                    var entry = sim.Db.Entry(rec.entryId);
                    if (entry != null) sb.Append("<b>Sejarahpedia: ").Append(T(entry.titleMs, entry.titleEn)).Append("</b>\n").Append(T(entry.summaryMs, entry.summaryEn));
                }
            }
            else if (city.Zone[i] != 0)
            {
                string[] zMs = { "", "Kediaman", "Perniagaan", "Perindustrian" };
                string[] zEn = { "", "Residential", "Commercial", "Industrial" };
                sb.Append("<b>").Append(T("Zon ", "Zone: ")).Append(T(zMs[city.Zone[i]], zEn[city.Zone[i]])).Append("</b>\n");
                sb.Append(T("Kepadatan ", "Density ")).Append(city.Density[i]).Append("\n");
                sb.Append(city.HasAccess(x, y, 1) ? T("Ada akses jalan", "Has road access") : T("Tiada akses jalan", "No road access"));
            }
            else if (city.Transport[i] != 0)
            {
                sb.Append("<b>").Append(((TransportType)city.Transport[i]).ToString()).Append("</b>");
            }
            else
            {
                var t = (TerrainType)sim.Map.Terrain[i];
                sb.Append("<b>").Append(t.ToString()).Append("</b>\n");
                sb.Append(T("Kesuburan ", "Fertility ")).Append(sim.Map.Fertility[i]).Append("   ").Append(T("Timah ", "Tin ")).Append(sim.Map.Tin[i]);
            }
            sb.Append("\n\n<size=").Append(fontSize - 6).Append(">").Append(T("Petak ", "Cell ")).Append(x).Append(", ").Append(y)
              .Append("  (").Append(((TerrainType)sim.Map.Terrain[i]).ToString()).Append(")</size>");
            inspectorText.supportRichText = true;
            inspectorText.text = sb.ToString();
            inspectorPanel.gameObject.SetActive(true);
        }

        // ------------------------------------------------------------ research

        void ToggleResearch()
        {
            bool show = !researchPanel.gameObject.activeSelf;
            researchPanel.gameObject.SetActive(show);
            if (show) RebuildResearch();
        }

        void RebuildResearch()
        {
            if (sim == null) return;
            ClearChildren(researchList);
            var db = sim.Db;
            int shown = 0;
            for (int i = 0; i < db.Research.Length && shown < 12; i++)
            {
                if (!sim.Tech.CanResearch(i, sim.CurrentEra)) continue;
                var r = db.Research[i];
                int index = i;
                string kind = r.IsTech ? T("Teknologi", "Tech") : T("Sivik", "Civic");
                bool current = index == sim.Tech.CurrentTech || index == sim.Tech.CurrentCivic;
                var b = Btn(researchList, (current ? "> " : "") + kind + ": " + T(r.nameMs, r.nameEn) + "  (" + r.cost.ToString("0") + ")", () =>
                {
                    sim.Tech.Select(index, sim.CurrentEra);
                    RebuildResearch();
                }, 760);
                b.GetComponentInChildren<Text>().alignment = TextAnchor.MiddleLeft;
                shown++;
            }
            UpdateResearchStatus();
        }

        void UpdateResearchStatus()
        {
            var db = sim.Db;
            sb.Clear();
            int t = sim.Tech.CurrentTech, c = sim.Tech.CurrentCivic;
            sb.Append(T("Teknologi: ", "Technology: ")).Append(t >= 0 ? T(db.Research[t].nameMs, db.Research[t].nameEn) + "  " + (int)(100 * sim.Tech.Progress[t] / Mathf.Max(1, (float)db.Research[t].cost)) + "%" : "-");
            sb.Append('\n').Append(T("Sivik: ", "Civic: ")).Append(c >= 0 ? T(db.Research[c].nameMs, db.Research[c].nameEn) + "  " + (int)(100 * sim.Tech.Progress[c] / Mathf.Max(1, (float)db.Research[c].cost)) + "%" : "-");
            researchStatus.text = sb.ToString();
        }

        // ------------------------------------------------------------ era

        void AdvanceEra()
        {
            if (sim == null) return;
            if (eraManager != null ? eraManager.TryAdvance() : sim.AdvanceEra()) return;
            sb.Clear();
            sb.Append(T("Belum cukup syarat: ", "Requirements not met: "));
            foreach (var r in sim.Era.Requirements(sim.Tech, sim.Economy.Population, sim.City))
            {
                if (r.met) continue;
                string name = r.id;
                int ri = sim.Db.ResearchIndex(r.id);
                if (ri >= 0) name = T(sim.Db.Research[ri].nameMs, sim.Db.Research[ri].nameEn);
                else { var b = sim.Db.Building(r.id); if (b != null) name = T(b.nameMs, b.nameEn); }
                if (r.kind == "population") name = T("Penduduk ", "Population ") + Fmt(r.current) + "/" + Fmt(r.target);
                sb.Append(name).Append("; ");
            }
            ShowMessage(sb.ToString());
        }

        // ------------------------------------------------------------ save / load

        void ToggleSave()
        {
            bool show = !savePanel.gameObject.activeSelf;
            savePanel.gameObject.SetActive(show);
            if (!show) return;
            ClearChildren(savePanel);
            var col = Column(savePanel, "Slots", Vector2.zero, Vector2.one, new Vector2(12, 12), new Vector2(-12, -12));
            if (saveLoad == null) { Label(col, "None", fontSize, TextAnchor.MiddleCenter).text = "SaveLoadManager missing"; return; }
            for (int s = 0; s < SaveLoadManager.SlotCount; s++)
            {
                int slot = s;
                var info = saveLoad.Info(slot);
                var row = Row((RectTransform)col, "Slot" + slot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                row.gameObject.AddComponent<LayoutElement>().preferredHeight = 56;
                var l = Label(row, "Info", fontSize - 3, TextAnchor.MiddleLeft);
                l.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
                l.text = (slot == 0 ? T("Auto/Pantas", "Auto/Quick") : T("Slot ", "Slot ") + slot) + ": " +
                         (info.exists ? info.cityName + " " + info.year + " (Era " + info.era + ")" : T("kosong", "empty"));
                Btn(row, T("Simpan", "Save"), () => { saveLoad.Save(slot); ToggleSave(); }, 100);
                var load = Btn(row, T("Muat", "Load"), () => { saveLoad.Load(slot); ToggleSave(); }, 100);
                load.interactable = info.exists;
            }
        }

        // ------------------------------------------------------------ crisis

        void UpdateCrisis()
        {
            string id = sim.Events.PendingCrisis;
            if (id == shownCrisis) return;
            shownCrisis = id;
            if (string.IsNullOrEmpty(id))
            {
                crisisPanel.gameObject.SetActive(false);
                if (crisisPaused) { time?.PopPause(); crisisPaused = false; }
                return;
            }
            int ci = sim.Db.CrisisIndex(id);
            if (ci < 0) return;
            var c = sim.Db.Crises[ci];
            crisisTitle.text = T(c.nameMs, c.nameEn);
            crisisBody.text = T(c.descMs, c.descEn);
            ClearChildren(crisisChoices);
            string cur = economy != null ? economy.Currency : "";
            for (int k = 0; k < c.choices.Length; k++)
            {
                int choice = k;
                var ch = c.choices[k];
                var b = Btn(crisisChoices, T(ch.nameMs, ch.nameEn) + (ch.cost > 0 ? "  (" + cur + Fmt(ch.cost) + ")" : "") + "\n" + T(ch.descMs, ch.descEn), () =>
                {
                    if (!sim.ResolveCrisis(choice)) ShowMessage(T("Wang tidak cukup", "Not enough money"));
                }, 800);
                var t = b.GetComponentInChildren<Text>();
                t.fontSize = fontSize - 4;
                t.alignment = TextAnchor.MiddleLeft;
                b.GetComponent<LayoutElement>().preferredHeight = 64;
            }
            crisisPanel.gameObject.SetActive(true);
            if (!crisisPaused) { time?.PushPause(); crisisPaused = true; }
        }
    }
}
