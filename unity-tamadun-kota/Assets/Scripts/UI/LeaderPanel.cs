using TamadunKota.Simulation;
using UnityEngine;

namespace TamadunKota.UI
{
    /// <summary>The player's fixed state identity and historical leader.</summary>
    public sealed class LeaderPanel : ModalPanel
    {
        LeaderProfileView profile;
        public LeaderPanel(HudContext context) : base(context) { }
        protected override string TitleKey => "leader.panel";
        protected override Vector2 HalfSize => new Vector2(560, 385);
        protected override void BuildBody() => profile = new LeaderProfileView(ctx, Body);
        public override void Refresh() => profile.Show(Sim?.State, Sim?.Leader);
        public override void OnBind(GameSimulation sim) { if (IsOpen) Refresh(); }
        public override void Close() { profile.Release(); base.Close(); }
        public override void Dispose() => profile.Release();
    }
}
