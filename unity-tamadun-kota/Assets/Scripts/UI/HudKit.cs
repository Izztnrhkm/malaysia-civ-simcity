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

        // ------------------------------------------------------------ layout helpers for the panels

        /// <summary>A wrapping paragraph for vertical layouts: its height follows the text.</summary>
        public Text Para(Transform parent, string text, int size, Color? color = null)
        {
            var t = Label(parent, "Text", size, TextAnchor.UpperLeft);
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.supportRichText = true;
            t.text = text;
            if (color.HasValue) t.color = color.Value;
            return t;
        }

        /// <summary>A label with a fixed preferred height, for rows of figures.</summary>
        public Text Line(Transform parent, string text, int size, float height, TextAnchor anchor = TextAnchor.MiddleLeft)
        {
            var t = Label(parent, "Line", size, anchor);
            t.supportRichText = true;
            t.text = text;
            var le = t.gameObject.AddComponent<LayoutElement>();
            le.preferredHeight = height;
            le.minHeight = height;
            return t;
        }

        /// <summary>A transparent row for use inside vertical layouts.</summary>
        public RectTransform HRow(Transform parent, string name, float height, float spacing = 6)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(LayoutElement));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            var le = go.GetComponent<LayoutElement>();
            le.preferredHeight = height;
            le.minHeight = height;
            var h = go.AddComponent<HorizontalLayoutGroup>();
            h.spacing = spacing;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = true;
            return rt;
        }

        /// <summary>A vertical stack (tinted card when <paramref name="tint"/> is set) that sizes to its content.</summary>
        public RectTransform Card(Transform parent, string name, Color? tint, int padding = 10)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            if (tint.HasValue) go.AddComponent<Image>().color = tint.Value;
            var v = go.AddComponent<VerticalLayoutGroup>();
            v.spacing = 4;
            v.padding = new RectOffset(padding, padding, padding, padding);
            v.childControlWidth = true;
            v.childControlHeight = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            return rt;
        }

        /// <summary>
        /// A vertically scrolling list in the given rect. Returns the content transform: add
        /// children to it and they stack top-down; the content grows with them.
        /// </summary>
        public RectTransform ScrollList(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 oMin, Vector2 oMax, float spacing = 4)
        {
            var scrollGo = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Mask), typeof(ScrollRect));
            var scrollRt = (RectTransform)scrollGo.transform;
            scrollRt.SetParent(parent, false);
            Stretch(scrollRt, aMin, aMax, oMin, oMax);
            scrollGo.GetComponent<Image>().color = new Color(0, 0, 0, 0.01f);
            scrollGo.GetComponent<Mask>().showMaskGraphic = false;
            var content = new GameObject("Content", typeof(RectTransform)).GetComponent<RectTransform>();
            content.SetParent(scrollRt, false);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = Vector2.zero;
            content.offsetMax = Vector2.zero;
            var v = content.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = spacing;
            v.padding = new RectOffset(0, 8, 0, 0);
            v.childControlWidth = true;
            v.childControlHeight = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var sr = scrollGo.GetComponent<ScrollRect>();
            sr.content = content;
            sr.horizontal = false;
            sr.vertical = true;
            sr.movementType = ScrollRect.MovementType.Clamped;
            sr.scrollSensitivity = 30;
            return content;
        }

        /// <summary>Scroll a list made by <see cref="ScrollList"/> back to the top.</summary>
        public static void ScrollToTop(RectTransform content)
        {
            var sr = content.GetComponentInParent<ScrollRect>();
            if (sr != null) sr.verticalNormalizedPosition = 1;
        }

        /// <summary>A single-line text field.</summary>
        public InputField Input(Transform parent, string value, string placeholder, float width, InputField.ContentType type = InputField.ContentType.Standard)
        {
            var go = new GameObject("Input", typeof(RectTransform), typeof(Image), typeof(InputField), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = new Color(0, 0, 0, 0.45f);
            var le = go.GetComponent<LayoutElement>();
            le.preferredHeight = 36;
            le.minHeight = 36;
            if (width > 0) { le.preferredWidth = width; le.minWidth = width; }
            else le.flexibleWidth = 1;
            var ph = Label(go.transform, "Placeholder", FontSize - 3, TextAnchor.MiddleLeft);
            Stretch(ph.rectTransform, Vector2.zero, Vector2.one, new Vector2(8, 2), new Vector2(-8, -2));
            ph.text = placeholder;
            ph.fontStyle = FontStyle.Italic;
            ph.color = new Color(TextColor.r, TextColor.g, TextColor.b, 0.45f);
            var txt = Label(go.transform, "Text", FontSize - 3, TextAnchor.MiddleLeft);
            Stretch(txt.rectTransform, Vector2.zero, Vector2.one, new Vector2(8, 2), new Vector2(-8, -2));
            txt.supportRichText = false;
            txt.horizontalOverflow = HorizontalWrapMode.Overflow;
            var input = go.GetComponent<InputField>();
            input.textComponent = txt;
            input.placeholder = ph;
            input.contentType = type;
            input.lineType = InputField.LineType.SingleLine;
            input.text = value ?? "";
            return input;
        }

        /// <summary>A horizontal 0..1 slider.</summary>
        public Slider Slider(Transform parent, float value, UnityAction<float> onChange, float width)
        {
            var go = new GameObject("Slider", typeof(RectTransform), typeof(Slider), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            var le = go.GetComponent<LayoutElement>();
            le.preferredWidth = width;
            le.minWidth = width;
            le.preferredHeight = 28;
            var bg = new GameObject("Background", typeof(RectTransform), typeof(Image));
            bg.transform.SetParent(go.transform, false);
            Stretch((RectTransform)bg.transform, new Vector2(0, 0.35f), new Vector2(1, 0.65f), Vector2.zero, Vector2.zero);
            bg.GetComponent<Image>().color = new Color(0, 0, 0, 0.5f);
            var fillArea = new GameObject("Fill Area", typeof(RectTransform));
            fillArea.transform.SetParent(go.transform, false);
            Stretch((RectTransform)fillArea.transform, new Vector2(0, 0.35f), new Vector2(1, 0.65f), Vector2.zero, Vector2.zero);
            var fill = new GameObject("Fill", typeof(RectTransform), typeof(Image));
            fill.transform.SetParent(fillArea.transform, false);
            Stretch((RectTransform)fill.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            fill.GetComponent<Image>().color = AccentColor;
            var handleArea = new GameObject("Handle Area", typeof(RectTransform));
            handleArea.transform.SetParent(go.transform, false);
            Stretch((RectTransform)handleArea.transform, Vector2.zero, Vector2.one, new Vector2(8, 0), new Vector2(-8, 0));
            var handle = new GameObject("Handle", typeof(RectTransform), typeof(Image));
            handle.transform.SetParent(handleArea.transform, false);
            var hrt = (RectTransform)handle.transform;
            hrt.sizeDelta = new Vector2(16, 0);
            handle.GetComponent<Image>().color = TextColor;
            var s = go.GetComponent<Slider>();
            s.fillRect = (RectTransform)fill.transform;
            s.handleRect = hrt;
            s.targetGraphic = handle.GetComponent<Image>();
            s.direction = UnityEngine.UI.Slider.Direction.LeftToRight;
            s.minValue = 0;
            s.maxValue = 1;
            s.value = value;
            if (onChange != null) s.onValueChanged.AddListener(onChange);
            return s;
        }

        /// <summary>Mark a button as the selected one of a group (accent) or not.</summary>
        public void SetSelected(Button b, bool selected)
        {
            if (b == null) return;
            b.GetComponent<Image>().color = selected ? new Color(AccentColor.r * 0.55f, AccentColor.g * 0.45f, AccentColor.b * 0.2f, 1f) : ButtonColor;
        }

        public static void SetLabel(Button b, string text)
        {
            var t = b != null ? b.GetComponentInChildren<Text>() : null;
            if (t != null) t.text = text;
        }

        /// <summary>A fixed-size, non-stretching layout slot (e.g. a colour swatch).</summary>
        public static LayoutElement Size(Component c, float width, float height)
        {
            // not `??`: in the Editor a missing component is a fake-null object
            if (!c.TryGetComponent(out LayoutElement le)) le = c.gameObject.AddComponent<LayoutElement>();
            if (width >= 0) { le.preferredWidth = width; le.minWidth = width; }
            if (height >= 0) { le.preferredHeight = height; le.minHeight = height; }
            return le;
        }

        public static readonly Color CardTint = new Color(0, 0, 0, 0.22f);
        public static readonly Color GoodColor = new Color(0.45f, 0.86f, 0.55f, 1f);
        public static readonly Color BadColor = new Color(0.95f, 0.5f, 0.45f, 1f);
        public static readonly Color InfoColor = new Color(0.45f, 0.72f, 0.92f, 1f);
    }
}
