using TamadunKota.Simulation;
using UnityEngine;

namespace TamadunKota.UI
{
    /// <summary>Bottom tool row: inspect, transport, R/C/I zones and bulldoze (tax rates are in the Economy window).</summary>
    public sealed class ToolBarPanel : HudPanel
    {
        public ToolBarPanel(HudContext context) : base(context) { }

        public override void Build(RectTransform root)
        {
            var tools = Kit.Row(root, "Tools", new Vector2(0, 0), new Vector2(1, 0), new Vector2(8, 128), new Vector2(-8, 176));
            Kit.Btn(tools, () => T("Periksa", "Inspect"), () => ctx.Placement?.Cancel(), 110);
            Kit.Btn(tools, () => T("Jalan", "Road"), () => SelectTransport("road"), 90);
            Kit.Btn(tools, () => T("Kereta api", "Rail"), () => SelectTransport("rail"), 110);
            Kit.Btn(tools, () => T("Lebuh raya", "Highway"), () => SelectTransport("highway"), 120);
            Kit.Btn(tools, () => "MRT", () => SelectTransport("mrt"), 70);
            Kit.Spacer(tools, 12);
            Kit.Btn(tools, () => T("Zon K", "Zone R"), () => ctx.Placement?.SelectZone(ZoneType.Residential), 100);
            Kit.Btn(tools, () => T("Zon P", "Zone C"), () => ctx.Placement?.SelectZone(ZoneType.Commercial), 100);
            Kit.Btn(tools, () => T("Zon I", "Zone I"), () => ctx.Placement?.SelectZone(ZoneType.Industrial), 100);
            Kit.Spacer(tools, 12);
            Kit.Btn(tools, () => T("Roboh", "Bulldoze"), () => ctx.Placement?.SelectBulldoze(), 110);
        }

        void SelectTransport(string key)
        {
            var sim = Sim;
            if (sim == null || ctx.Placement == null) return;
            if (!sim.Tech.IsTransportUnlocked(key, sim.CurrentEra))
            {
                ctx.ShowMessage(T("Belum dibuka", "Not unlocked yet"));
                return;
            }
            ctx.Placement.SelectTransport(key);
        }
    }
}
