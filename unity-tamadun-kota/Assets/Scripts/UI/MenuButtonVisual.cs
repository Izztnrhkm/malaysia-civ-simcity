using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    public sealed class MenuButtonVisual : MonoBehaviour, ISelectHandler, IDeselectHandler, IPointerEnterHandler, IPointerExitHandler
    {
        bool primary, chosen, focused, hovered;
        Button button;
        Image image, marker;
        Text[] labels;

        public void Configure(bool emphasize, bool selected)
        {
            button = GetComponent<Button>();
            image = GetComponent<Image>();
            labels = GetComponentsInChildren<Text>();
            primary = emphasize;
            chosen = selected;
            if (marker == null)
            {
                marker = new GameObject("Focus", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
                marker.transform.SetParent(transform, false);
                HudKit.Stretch(marker.rectTransform, Vector2.zero, new Vector2(0, 1), Vector2.zero, new Vector2(4, 0));
                marker.raycastTarget = false;
            }
            Paint();
        }

        void OnEnable() { if (button != null) Paint(); }
        void OnDisable() { focused = hovered = false; }
        public void Refresh() => Paint();
        void Paint()
        {
            if (button == null) return;
            bool available = button.interactable;
            image.color = !available ? new Color32(28, 49, 51, 255) : primary ? MenuTheme.Brass :
                focused || hovered || chosen ? new Color32(42, 82, 79, 255) : MenuTheme.Teal;
            foreach (var label in labels) label.color = !available ? new Color32(151, 167, 161, 255) : primary ? MenuTheme.Ink : MenuTheme.Ivory;
            marker.color = primary ? MenuTheme.Ink : MenuTheme.Brass;
            marker.enabled = available && (focused || hovered || chosen);
        }
        public void OnSelect(BaseEventData data) { focused = true; Paint(); }
        public void OnDeselect(BaseEventData data) { focused = false; Paint(); }
        public void OnPointerEnter(PointerEventData data) { hovered = true; Paint(); }
        public void OnPointerExit(PointerEventData data) { hovered = false; Paint(); }
    }
}
