using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    public sealed class MenuSafeLayout : MonoBehaviour
    {
        RectTransform header, content, footer;
        public void Initialize(RectTransform h, RectTransform c, RectTransform f) { header = h; content = c; footer = f; Apply(); }
        void OnRectTransformDimensionsChange() { if (header != null) Apply(); }
        void Apply()
        {
            var rt = (RectTransform)transform;
            float width = Mathf.Max(600, Mathf.Min(1760, rt.rect.width - 160));
            HudKit.Stretch(header, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(-width / 2, -150), new Vector2(width / 2, -36));
            HudKit.Stretch(content, new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(-width / 2, 104), new Vector2(width / 2, -190));
            HudKit.Stretch(footer, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(-width / 2, 28), new Vector2(width / 2, 86));
        }
    }
}
