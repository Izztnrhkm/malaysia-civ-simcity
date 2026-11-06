using System.Text;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Bottom tool row: inspect, transport, R/C/I zones and bulldoze, then the R/C/I demand and tax
    /// status (tax rates are set in the Economy window).
    /// </summary>
    public sealed class ToolBarPanel : HudPanel
    {
        Text statusText;
        readonly StringBuilder sb = new StringBuilder(96);

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
            Kit.Spacer(tools, 16);
            statusText = Kit.Label(tools, "Status", FontSize - 2, TextAnchor.MiddleLeft);
            statusText.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
        }

        public override void OnEconomy(EconomySnapshot s)
        {
            var sim = Sim;
            sb.Clear();
            sb.Append(Loc.Get("top.demand")).Append(":  R ").Append(((int)s.demandR).ToString()).Append("  C ").Append(((int)s.demandC).ToString()).Append("  I ").Append(((int)s.demandI).ToString());
            if (sim != null) sb.Append("     ").Append(T("Cukai ", "Tax ")).Append(sim.TaxR.ToString("0")).Append('/').Append(sim.TaxC.ToString("0")).Append('/').Append(sim.TaxI.ToString("0")).Append('%');
            statusText.text = sb.ToString();
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
