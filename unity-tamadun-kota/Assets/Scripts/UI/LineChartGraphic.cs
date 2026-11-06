using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// One small-multiple time-series chart for the timeline (web: Timeline.tsx Panel): tinted era
    /// bands, three horizontal gridlines (min, middle, max), the series line and an optional
    /// hover crosshair. Data lives in preallocated arrays; call <see cref="SetVerticesDirty"/>
    /// after changing it. Drawing writes straight into the VertexHelper, so it does not allocate.
    /// </summary>
    public sealed class LineChartGraphic : MaskableGraphic
    {
        public const int Capacity = 512;

        public readonly double[] Values = new double[Capacity];
        public readonly int[] Eras = new int[Capacity];
        public int Count;
        public double Min, Max = 1;
        /// <summary>Hovered sample index, or -1.</summary>
        public int Hover = -1;

        public Color LineColor = Color.white;
        public Color GridColor = new Color(0.97f, 0.93f, 0.78f, 0.12f);
        public Color CrosshairColor = new Color(0.97f, 0.93f, 0.78f, 0.45f);
        public float LineWidth = 2f;
        /// <summary>Band tint per era (index 1..4).</summary>
        public readonly Color[] EraBands =
        {
            Color.clear,
            new Color(0.79f, 0.59f, 0.17f, 0.12f),
            new Color(0.22f, 0.53f, 0.90f, 0.12f),
            new Color(0.10f, 0.62f, 0.44f, 0.12f),
            new Color(0.56f, 0.52f, 0.91f, 0.14f),
        };

        public float XAt(int i, Rect r) => Count <= 1 ? r.xMin : r.xMin + i / (float)(Count - 1) * r.width;

        public float YAt(double v, Rect r)
        {
            double span = Max - Min;
            float f = span <= 0 ? 0 : (float)((v - Min) / span);
            return r.yMin + Mathf.Clamp01(f) * r.height;
        }

        /// <summary>Nearest sample to a local x position (in this graphic's rect), or -1.</summary>
        public int IndexAt(float localX)
        {
            if (Count == 0) return -1;
            var r = rectTransform.rect;
            if (Count == 1 || r.width <= 0) return 0;
            int i = Mathf.RoundToInt((localX - r.xMin) / r.width * (Count - 1));
            return Mathf.Clamp(i, 0, Count - 1);
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            var r = rectTransform.rect;
            if (Count == 0) return;

            // era bands
            int start = 0;
            for (int i = 1; i <= Count; i++)
            {
                if (i < Count && Eras[i] == Eras[start]) continue;
                int era = Eras[start];
                if (era > 0 && era < EraBands.Length)
                {
                    float x0 = XAt(start, r), x1 = i < Count ? XAt(i, r) : r.xMax;
                    Quad(vh, new Vector2(x0, r.yMin), new Vector2(Mathf.Max(x0 + 1, x1), r.yMax), EraBands[era]);
                }
                start = i;
            }

            // gridlines
            for (int k = 0; k <= 2; k++)
            {
                float y = r.yMin + r.height * k * 0.5f;
                Quad(vh, new Vector2(r.xMin, y - 0.5f), new Vector2(r.xMax, y + 0.5f), GridColor);
            }

            // the series
            if (Count == 1)
            {
                float y = YAt(Values[0], r);
                Quad(vh, new Vector2(r.xMin, y - LineWidth), new Vector2(r.xMin + 2 * LineWidth, y + LineWidth), LineColor);
            }
            for (int i = 1; i < Count; i++)
                Segment(vh, new Vector2(XAt(i - 1, r), YAt(Values[i - 1], r)), new Vector2(XAt(i, r), YAt(Values[i], r)), LineWidth, LineColor);

            // crosshair and point
            if (Hover >= 0 && Hover < Count)
            {
                float x = XAt(Hover, r), y = YAt(Values[Hover], r);
                Quad(vh, new Vector2(x - 0.5f, r.yMin), new Vector2(x + 0.5f, r.yMax), CrosshairColor);
                Quad(vh, new Vector2(x - 4, y - 4), new Vector2(x + 4, y + 4), LineColor);
            }
        }

        static void Quad(VertexHelper vh, Vector2 min, Vector2 max, Color c)
        {
            int n = vh.currentVertCount;
            vh.AddVert(new Vector3(min.x, min.y), c, Vector2.zero);
            vh.AddVert(new Vector3(min.x, max.y), c, Vector2.zero);
            vh.AddVert(new Vector3(max.x, max.y), c, Vector2.zero);
            vh.AddVert(new Vector3(max.x, min.y), c, Vector2.zero);
            vh.AddTriangle(n, n + 1, n + 2);
            vh.AddTriangle(n + 2, n + 3, n);
        }

        static void Segment(VertexHelper vh, Vector2 a, Vector2 b, float width, Color c)
        {
            Vector2 d = b - a;
            float len = d.magnitude;
            if (len < 1e-4f) return;
            Vector2 n = new Vector2(-d.y, d.x) / len * (width * 0.5f);
            // extend a little along the segment so consecutive segments overlap at the joints
            Vector2 e = d / len * (width * 0.35f);
            int i = vh.currentVertCount;
            vh.AddVert(a - e - n, c, Vector2.zero);
            vh.AddVert(a - e + n, c, Vector2.zero);
            vh.AddVert(b + e + n, c, Vector2.zero);
            vh.AddVert(b + e - n, c, Vector2.zero);
            vh.AddTriangle(i, i + 1, i + 2);
            vh.AddTriangle(i + 2, i + 3, i);
        }
    }
}
