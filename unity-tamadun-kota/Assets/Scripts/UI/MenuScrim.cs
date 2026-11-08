using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>UI vertex gradient keeps contrast without another texture or shader.</summary>
    public sealed class MenuScrim : MaskableGraphic
    {
        public bool Dense;
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            var r = rectTransform.rect;
            float[] stops = { 0, 0.38f, 0.68f, 1 };
            for (int i = 0; i < stops.Length; i++)
            {
                float alpha = Dense ? 0.89f : i < 2 ? 0.92f : i == 2 ? 0.45f : 0.1f;
                var color = new Color(MenuTheme.Ink.r, MenuTheme.Ink.g, MenuTheme.Ink.b, alpha);
                float x = Mathf.Lerp(r.xMin, r.xMax, stops[i]);
                vh.AddVert(new Vector3(x, r.yMin), color, Vector2.zero);
                vh.AddVert(new Vector3(x, r.yMax), color, Vector2.zero);
                if (i == 0) continue;
                int n = i * 2;
                vh.AddTriangle(n - 2, n - 1, n);
                vh.AddTriangle(n, n - 1, n + 1);
            }
        }
    }
}
