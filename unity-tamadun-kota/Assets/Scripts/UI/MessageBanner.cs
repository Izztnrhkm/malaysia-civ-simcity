using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>Short centred message above the tool row (placement errors, saves, era changes), hidden after 3 s.</summary>
    public sealed class MessageBanner : HudPanel
    {
        Text messageText;
        float messageUntil;

        public MessageBanner(HudContext context) : base(context) { }

        public override void Build(RectTransform root)
        {
            messageText = Kit.Label(root, "Message", FontSize + 2, TextAnchor.MiddleCenter);
            HudKit.Stretch(messageText.rectTransform, new Vector2(0.2f, 0), new Vector2(0.8f, 0), new Vector2(0, 186), new Vector2(0, 226));
            messageText.color = Kit.AccentColor;
            messageText.enabled = false;
        }

        public void Show(string msg)
        {
            if (messageText == null || string.IsNullOrEmpty(msg)) return;
            messageText.text = msg;
            messageText.enabled = true;
            messageUntil = Time.unscaledTime + 3f;
        }

        public override void Tick()
        {
            if (messageText != null && messageText.enabled && Time.unscaledTime > messageUntil) messageText.enabled = false;
        }
    }
}
