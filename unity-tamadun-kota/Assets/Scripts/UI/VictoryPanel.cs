using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// The Developed Nation victory window (web: the victory modal in src/ui/App.tsx). Opened by
    /// the UIManager when the simulation raises OnVictory; not for a loaded game that had already
    /// won. Play continues after it is closed.
    /// </summary>
    public sealed class VictoryPanel : ModalPanel
    {
        public VictoryPanel(HudContext context) : base(context) { }

        protected override string TitleKey => "era.victory";
        protected override Vector2 HalfSize => new Vector2(440, 190);

        protected override void BuildBody()
        {
            var col = Kit.Column(Body, "Victory", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);
            col.GetComponent<VerticalLayoutGroup>().spacing = 16;
            Kit.Localize(Kit.Para(col, "", FontSize - 3), () => Loc.Get("era.victoryBody"));
            var keep = Kit.Btn(col, () => Loc.Get("era.keepPlaying"), Close, 0);
            keep.GetComponent<LayoutElement>().preferredHeight = 46;
            Kit.SetSelected(keep, true);
        }

        public override void Refresh() { }
    }
}
