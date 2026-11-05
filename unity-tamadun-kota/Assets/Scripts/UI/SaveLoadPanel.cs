using TamadunKota.Systems;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>Save / load slots (slot 0 is the autosave and F5/F9 quick slot).</summary>
    public sealed class SaveLoadPanel : HudPanel
    {
        RectTransform savePanel;

        public SaveLoadPanel(HudContext context) : base(context) { }

        public bool IsOpen => savePanel != null && savePanel.gameObject.activeSelf;

        public override void Build(RectTransform root)
        {
            savePanel = Kit.Panel(root, "Save Load", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-300, -170), new Vector2(300, 170));
            savePanel.gameObject.SetActive(false);
        }

        public void Toggle()
        {
            bool show = !savePanel.gameObject.activeSelf;
            savePanel.gameObject.SetActive(show);
            if (!show) return;
            HudKit.ClearChildren(savePanel);
            var col = Kit.Column(savePanel, "Slots", Vector2.zero, Vector2.one, new Vector2(12, 12), new Vector2(-12, -12));
            var saveLoad = ctx.SaveLoad;
            if (saveLoad == null) { Kit.Label(col, "None", FontSize, TextAnchor.MiddleCenter).text = "SaveLoadManager missing"; return; }
            for (int s = 0; s < SaveLoadManager.SlotCount; s++)
            {
                int slot = s;
                var info = saveLoad.Info(slot);
                var row = Kit.Row(col, "Slot" + slot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
                row.gameObject.AddComponent<LayoutElement>().preferredHeight = 56;
                var l = Kit.Label(row, "Info", FontSize - 3, TextAnchor.MiddleLeft);
                l.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
                l.text = (slot == 0 ? T("Auto/Pantas", "Auto/Quick") : T("Slot ", "Slot ") + slot) + ": " +
                         (info.exists ? info.cityName + " " + info.year + " (Era " + info.era + ")" : T("kosong", "empty"));
                Kit.Btn(row, T("Simpan", "Save"), () => { saveLoad.Save(slot); Toggle(); }, 100);
                var load = Kit.Btn(row, T("Muat", "Load"), () => { saveLoad.Load(slot); Toggle(); }, 100);
                load.interactable = info.exists;
            }
        }
    }
}
