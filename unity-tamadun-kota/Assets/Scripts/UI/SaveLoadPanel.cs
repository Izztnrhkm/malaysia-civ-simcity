using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>Four stable slot rows keep operation feedback and keyboard focus visible.</summary>
    public sealed class SaveLoadPanel : HudPanel, IHudModal
    {
        MenuShell shell;
        readonly Text[] names = new Text[SaveLoadManager.SlotCount];
        readonly Text[] metadata = new Text[SaveLoadManager.SlotCount];
        readonly Button[] saves = new Button[SaveLoadManager.SlotCount];
        readonly Button[] loads = new Button[SaveLoadManager.SlotCount];
        Text intro, status;
        Button back;
        string statusKey;
        bool failed;

        public SaveLoadPanel(HudContext context) : base(context) { }
        public bool IsOpen => shell != null && shell.Root.gameObject.activeSelf;
        public RectTransform MenuRoot => shell?.Root;

        public override void Build(RectTransform root)
        {
            shell = new MenuShell(ctx, root, "Save Load", "unity.menu.saveLoad", "unity.menu.yourCities");
            var column = MenuTheme.Column(shell.Content, "Slots", 12);
            HudKit.Stretch(column, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            intro = MenuTheme.Line(ctx, column, () => "", 24, 40);
            intro.color = MenuTheme.Muted;
            for (int i = 0; i < SaveLoadManager.SlotCount; i++)
            {
                int slot = i;
                var row = Kit.HRow(column, "Slot " + slot, 108);
                row.gameObject.AddComponent<Image>().color = new Color(0.06f, 0.17f, 0.18f, 0.95f);
                var tag = MenuTheme.Line(ctx, row, () => MenuTheme.SlotName(slot), 24, 108);
                tag.alignment = TextAnchor.MiddleLeft;
                tag.color = MenuTheme.Brass;
                HudKit.Size(tag, 190, -1);
                var summary = MenuTheme.Column(row, "Summary", 4);
                summary.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
                summary.GetComponent<VerticalLayoutGroup>().padding = new RectOffset(8, 12, 4, 4);
                names[slot] = MenuTheme.Line(ctx, summary, () => "", 24, 54);
                metadata[slot] = MenuTheme.Line(ctx, summary, () => "", 20, 40);
                metadata[slot].color = MenuTheme.Muted;
                saves[slot] = MenuTheme.Button(ctx, row, "Save Slot " + slot, () => Loc.Get("save.save"), () => Save(slot), 150);
                loads[slot] = MenuTheme.Button(ctx, row, "Load Slot " + slot, () => Loc.Get("save.load"), () => Load(slot), 150);
            }
            status = MenuTheme.Line(ctx, column, () => "", 24, 72);
            back = MenuTheme.Button(ctx, shell.Footer, "Back", () => Loc.Get("unity.menu.back"), Close, 180);
            HudKit.Stretch((RectTransform)back.transform, new Vector2(1, 0), Vector2.one, new Vector2(-180, 0), Vector2.zero);
        }

        public void Toggle() { if (IsOpen) Close(); else Open(); }

        public void Open()
        {
            var origin = ctx.MainMenu != null && ctx.MainMenu.IsOpen ?
                (ctx.MainMenu.IsPauseMenu ? MenuOrigin.Pause : MenuOrigin.Startup) : MenuOrigin.Gameplay;
            Open(origin);
        }

        public void Open(MenuOrigin origin)
        {
            ctx.ModalOpening(this);
            ctx.Menu.Begin(origin);
            statusKey = null;
            failed = false;
            shell.Show(ctx.Menu.Origin != MenuOrigin.Startup);
            Refresh();
            for (int i = 0; i < loads.Length; i++) if (loads[i].interactable) { MenuSession.Focus(loads[i]); return; }
            MenuSession.Focus(ctx.Menu.HasEnteredCity ? saves[1] : back);
        }

        public void Close()
        {
            if (!IsOpen) return;
            shell.Root.gameObject.SetActive(false);
            ctx.ModalClosed(this);
            if (EventSystem.current != null) EventSystem.current.SetSelectedGameObject(null);
            ctx.Menu.ReturnFromUtility();
        }

        public override void OnLanguage() { if (IsOpen) Refresh(); }

        void Refresh()
        {
            shell.RefreshLanguage(Malay);
            shell.Heading.text = Loc.Get(ctx.Menu.HasEnteredCity ? "unity.menu.saveLoad" : "menu.load");
            intro.text = Loc.Get(ctx.Menu.HasEnteredCity ? "unity.menu.saveHint" : "unity.menu.loadHint");
            for (int i = 0; i < names.Length; i++)
            {
                var info = ctx.SaveLoad != null ? ctx.SaveLoad.Info(i) : default;
                names[i].text = info.exists ? info.cityName : Loc.Get("unity.menu.emptySlot");
                metadata[i].text = info.exists ? MenuTheme.SaveMetadata(info) : Loc.Get("unity.menu.emptySlotHint");
                saves[i].gameObject.SetActive(ctx.Menu.HasEnteredCity);
                saves[i].interactable = ctx.SaveLoad != null && ctx.Sim != null;
                loads[i].interactable = info.exists;
                saves[i].GetComponent<MenuButtonVisual>().Refresh();
                loads[i].GetComponent<MenuButtonVisual>().Refresh();
            }
            status.text = statusKey == null ? "" : Loc.Get(statusKey);
            status.color = failed ? MenuTheme.Error : MenuTheme.Brass;
            if (ctx.SaveLoad == null) { status.text = Loc.Get("unity.menu.storageUnavailable"); status.color = MenuTheme.Error; }
            MenuSession.ConfigureNavigation(MenuRoot);
        }

        void Save(int slot)
        {
            if (!ctx.Menu.HasEnteredCity || ctx.SaveLoad == null) return;
            bool ok = ctx.SaveLoad.Save(slot);
            failed = !ok;
            statusKey = ok ? "unity.menu.saved" : "unity.menu.saveFailed";
            Refresh();
        }

        void Load(int slot)
        {
            if (ctx.SaveLoad == null) return;
            if (ctx.SaveLoad.Load(slot))
            {
                ctx.Menu.EnterCity();
                ctx.MainMenu?.OnLoaded();
                Close();
            }
            else
            {
                failed = true;
                statusKey = "unity.menu.loadFailed";
                Refresh();
            }
        }
    }
}
