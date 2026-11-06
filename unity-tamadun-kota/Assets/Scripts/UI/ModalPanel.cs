using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>A HUD window that only one of can be open at a time (Esc closes it).</summary>
    public interface IHudModal
    {
        bool IsOpen { get; }
        void Close();
    }

    /// <summary>
    /// Centred window with a title bar and a close button, like the web game's Modal. Opening it
    /// closes any other modal and brings it to the front. Subclasses fill <see cref="Body"/> in
    /// <see cref="BuildBody"/> and refresh their content in <see cref="Refresh"/>.
    /// </summary>
    public abstract class ModalPanel : HudPanel, IHudModal
    {
        protected RectTransform Window, Body;
        Text titleText;

        protected ModalPanel(HudContext context) : base(context) { }

        /// <summary>Localization key of the window title.</summary>
        protected abstract string TitleKey { get; }
        protected abstract Vector2 HalfSize { get; }
        protected abstract void BuildBody();
        /// <summary>Rebuild or update the content (on open, on language change, after actions).</summary>
        public abstract void Refresh();

        public bool IsOpen => Window != null && Window.gameObject.activeSelf;

        public override void Build(RectTransform root)
        {
            var half = HalfSize;
            Window = Kit.Panel(root, GetType().Name, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), -half, half);
            var bar = new GameObject("Title Bar", typeof(RectTransform), typeof(Image));
            var barRt = (RectTransform)bar.transform;
            barRt.SetParent(Window, false);
            HudKit.Stretch(barRt, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, -48), Vector2.zero);
            bar.GetComponent<Image>().color = new Color(Kit.AccentColor.r * 0.3f, Kit.AccentColor.g * 0.25f, Kit.AccentColor.b * 0.12f, 0.95f);
            titleText = Kit.Label(barRt, "Title", FontSize + 2, TextAnchor.MiddleLeft);
            titleText.color = Kit.AccentColor;
            titleText.fontStyle = FontStyle.Bold;
            HudKit.Stretch(titleText.rectTransform, Vector2.zero, Vector2.one, new Vector2(16, 0), new Vector2(-64, 0));
            Kit.Localize(titleText, () => Loc.Get(TitleKey));
            var close = Kit.Btn(barRt, "X", Close, 40);
            HudKit.Stretch((RectTransform)close.transform, new Vector2(1, 0.5f), new Vector2(1, 0.5f), new Vector2(-48, -18), new Vector2(-8, 18));
            close.GetComponent<LayoutElement>().ignoreLayout = true;

            Body = new GameObject("Body", typeof(RectTransform)).GetComponent<RectTransform>();
            Body.SetParent(Window, false);
            HudKit.Stretch(Body, Vector2.zero, Vector2.one, new Vector2(16, 16), new Vector2(-16, -60));
            BuildBody();
            Window.gameObject.SetActive(false);
        }

        public virtual void Open()
        {
            ctx.ModalOpening(this);
            Window.SetAsLastSibling();
            Window.gameObject.SetActive(true);
            Refresh();
        }

        public virtual void Close()
        {
            if (!IsOpen) return;
            Window.gameObject.SetActive(false);
            ctx.ModalClosed(this);
            // drop keyboard focus from fields in the closed window
            if (EventSystem.current != null) EventSystem.current.SetSelectedGameObject(null);
        }

        public void Toggle()
        {
            if (IsOpen) Close();
            else Open();
        }

        public override void OnLanguage()
        {
            if (IsOpen) Refresh();
        }

        /// <summary>A section heading inside the body.</summary>
        protected Text Heading(Transform parent, string text)
        {
            var t = Kit.Line(parent, text, FontSize - 1, 30);
            t.color = Kit.AccentColor;
            t.fontStyle = FontStyle.Bold;
            return t;
        }
    }
}
