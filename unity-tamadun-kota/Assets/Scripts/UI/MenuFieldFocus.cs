using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>A visible keyboard focus ring for menu fields and sliders.</summary>
    public sealed class MenuFieldFocus : MonoBehaviour, ISelectHandler, IDeselectHandler
    {
        RectTransform ring;
        public void Initialize()
        {
            ring = new GameObject("Keyboard Focus", typeof(RectTransform)).GetComponent<RectTransform>();
            ring.SetParent(transform, false);
            HudKit.Stretch(ring, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            Edge(Vector2.zero, new Vector2(1, 0), Vector2.zero, new Vector2(0, 3));
            Edge(new Vector2(0, 1), Vector2.one, new Vector2(0, -3), Vector2.zero);
            Edge(Vector2.zero, new Vector2(0, 1), Vector2.zero, new Vector2(3, 0));
            Edge(new Vector2(1, 0), Vector2.one, new Vector2(-3, 0), Vector2.zero);
            ring.gameObject.SetActive(false);
        }
        void Edge(Vector2 min, Vector2 max, Vector2 insetMin, Vector2 insetMax)
        {
            var image = new GameObject("Edge", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
            image.transform.SetParent(ring, false);
            image.color = MenuTheme.Brass;
            image.raycastTarget = false;
            HudKit.Stretch(image.rectTransform, min, max, insetMin, insetMax);
        }
        public void OnSelect(BaseEventData data) { if (ring != null) ring.gameObject.SetActive(true); }
        public void OnDeselect(BaseEventData data) { if (ring != null) ring.gameObject.SetActive(false); }
        void OnDisable() { if (ring != null) ring.gameObject.SetActive(false); }
    }
}
