using System.Collections.Generic;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>The last five engine notices (titles only), top left under the controls row.</summary>
    public sealed class NoticeListPanel : HudPanel
    {
        readonly List<Text> noticeTexts = new List<Text>();
        readonly Queue<string> notices = new Queue<string>();

        public NoticeListPanel(HudContext context) : base(context) { }

        public override void Build(RectTransform root)
        {
            var noticeList = Kit.Column(root, "Notices", new Vector2(0, 1), new Vector2(0, 1), new Vector2(8, -420), new Vector2(460, -124));
            for (int i = 0; i < 5; i++)
            {
                var t = Kit.Label(noticeList, "Notice" + i, FontSize - 3, TextAnchor.UpperLeft);
                t.gameObject.AddComponent<LayoutElement>().preferredHeight = 56;
                noticeTexts.Add(t);
            }
        }

        public void OnNotice(Notice n)
        {
            string line = Malay ? n.titleMs : n.titleEn;
            notices.Enqueue(line);
            while (notices.Count > noticeTexts.Count) notices.Dequeue();
            int i = 0;
            foreach (var s in notices) noticeTexts[i++].text = s;
            for (; i < noticeTexts.Count; i++) noticeTexts[i].text = "";
        }
    }
}
