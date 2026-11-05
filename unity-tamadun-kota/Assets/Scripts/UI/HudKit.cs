using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Widget factory shared by every HUD panel: panels, rows, columns, labels, buttons and
    /// spacers in the HUD's style (colours and font size come from the UIManager's Style fields).
    /// Buttons created with a label function are relabelled when the language changes.
    /// </summary>
    public sealed class HudKit
    {
        public readonly Font Font;
        public readonly Color PanelColor, ButtonColor, AccentColor, TextColor;
        public readonly int FontSize;

        readonly List<(Text text, Func<string> label)> localized = new List<(Text, Func<string>)>();

        public HudKit(Color panelColor, Color buttonColor, Color accentColor, Color textColor, int fontSize)
        {
            Font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            PanelColor = panelColor;
            ButtonColor = buttonColor;
            AccentColor = accentColor;
            TextColor = textColor;
            FontSize = fontSize;
        }

        public RectTransform Panel(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            Stretch(rt, aMin, aMax, oMin, oMax);
            go.GetComponent<Image>().color = PanelColor;
            return rt;
        }

        public RectTransform Row(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax)
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

        public RectTransform Column(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax)
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

        public static void Stretch(RectTransform rt, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax)
        {
            rt.anchorMin = aMin;
            rt.anchorMax = aMax;
            rt.offsetMin = oMin;
            rt.offsetMax = oMax;
        }

        public Text Label(Transform parent, string name, int size, TextAnchor anchor)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>();
            t.font = Font;
            t.fontSize = size;
            t.color = TextColor;
            t.alignment = anchor;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Truncate;
            t.raycastTarget = false;
            return t;
        }

        public void Spacer(Transform parent, float width)
        {
            var go = new GameObject("Spacer", typeof(RectTransform), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            go.GetComponent<LayoutElement>().preferredWidth = width;
        }

        public Button Btn(Transform parent, string label, UnityAction onClick, float width)
        {
            var go = new GameObject("Button " + label, typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = ButtonColor;
            var le = go.GetComponent<LayoutElement>();
            le.preferredWidth = width;
            le.minWidth = width;
            le.preferredHeight = 40;
            var b = go.GetComponent<Button>();
            var colors = b.colors;
            colors.highlightedColor = new Color(1.25f, 1.25f, 1.1f, 1f);
            colors.pressedColor = AccentColor;
            b.colors = colors;
            if (onClick != null) b.onClick.AddListener(onClick);
            var t = Label(go.transform, "Label", FontSize - 2, TextAnchor.MiddleCenter);
            Stretch(t.rectTransform, Vector2.zero, Vector2.one, new Vector2(4, 2), new Vector2(-4, -2));
            t.text = label;
            return b;
        }

        /// <summary>
        /// A button whose label is re-evaluated when the language changes. Use it for buttons that
        /// live as long as the HUD; rebuilt lists take a plain string and are rebuilt instead.
        /// </summary>
        public Button Btn(Transform parent, Func<string> label, UnityAction onClick, float width)
        {
            var b = Btn(parent, label(), onClick, width);
            var t = b.GetComponentInChildren<Text>();
            localized.Add((t, label));
            return b;
        }

        /// <summary>Register any label for relabelling on language change.</summary>
        public void Localize(Text text, Func<string> label)
        {
            text.text = label();
            localized.Add((text, label));
        }

        /// <summary>Re-evaluate every localized label (and forget the ones that were destroyed).</summary>
        public void Relabel()
        {
            for (int i = localized.Count - 1; i >= 0; i--)
            {
                var (text, label) = localized[i];
                if (text == null) localized.RemoveAt(i);
                else text.text = label();
            }
        }

        public static void ClearChildren(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(t.GetChild(i).gameObject);
        }
    }
}
