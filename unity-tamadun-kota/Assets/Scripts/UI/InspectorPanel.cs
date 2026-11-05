using System.Text;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>Right-hand inspector for the clicked cell: building (with its Sejarahpedia summary), zone, transport or terrain.</summary>
    public sealed class InspectorPanel : HudPanel
    {
        static readonly string[] ZoneMs = { "", "Kediaman", "Perniagaan", "Perindustrian" };
        static readonly string[] ZoneEn = { "", "Residential", "Commercial", "Industrial" };

        RectTransform inspectorPanel;
        Text inspectorText;
        readonly StringBuilder sb = new StringBuilder(256);

        public InspectorPanel(HudContext context) : base(context) { }

        public override void Build(RectTransform root)
        {
            inspectorPanel = Kit.Panel(root, "Inspector", new Vector2(1, 1), new Vector2(1, 1), new Vector2(-460, -520), new Vector2(-8, -124));
            inspectorText = Kit.Label(inspectorPanel, "Text", FontSize - 3, TextAnchor.UpperLeft);
            HudKit.Stretch(inspectorText.rectTransform, Vector2.zero, Vector2.one, new Vector2(12, 12), new Vector2(-12, -12));
            inspectorText.horizontalOverflow = HorizontalWrapMode.Wrap;
            inspectorPanel.gameObject.SetActive(false);
        }

        public void Inspect(int x, int y)
        {
            var sim = Sim;
            if (sim == null) return;
            var city = sim.City;
            var g = city.Grid;
            if (!g.InBounds(x, y)) { inspectorPanel.gameObject.SetActive(false); return; }
            int i = g.Index(x, y);
            sb.Clear();
            int id = city.BuildingAt[i];
            if (id >= 0)
            {
                var b = city.FindBuilding(id);
                var rec = b != null ? sim.Db.Buildings[b.defIndex] : null;
                if (rec != null)
                {
                    sb.Append("<b>").Append(T(rec.nameMs, rec.nameEn)).Append("</b>\n");
                    sb.Append(T(rec.descMs, rec.descEn)).Append("\n\n");
                    sb.Append(T("Pekerja: ", "Jobs: ")).Append(rec.jobs).Append("   ").Append(T("Kecekapan: ", "Efficiency: ")).Append((int)(b.efficiency * 100)).Append("%\n\n");
                    var entry = sim.Db.Entry(rec.entryId);
                    if (entry != null) sb.Append("<b>Sejarahpedia: ").Append(T(entry.titleMs, entry.titleEn)).Append("</b>\n").Append(T(entry.summaryMs, entry.summaryEn));
                }
            }
            else if (city.Zone[i] != 0)
            {
                sb.Append("<b>").Append(T("Zon ", "Zone: ")).Append(T(ZoneMs[city.Zone[i]], ZoneEn[city.Zone[i]])).Append("</b>\n");
                sb.Append(T("Kepadatan ", "Density ")).Append(city.Density[i]).Append("\n");
                sb.Append(city.HasAccess(x, y, 1) ? T("Ada akses jalan", "Has road access") : T("Tiada akses jalan", "No road access"));
            }
            else if (city.Transport[i] != 0)
            {
                sb.Append("<b>").Append(((TransportType)city.Transport[i]).ToString()).Append("</b>");
            }
            else
            {
                var t = (TerrainType)sim.Map.Terrain[i];
                sb.Append("<b>").Append(t.ToString()).Append("</b>\n");
                sb.Append(T("Kesuburan ", "Fertility ")).Append(sim.Map.Fertility[i]).Append("   ").Append(T("Timah ", "Tin ")).Append(sim.Map.Tin[i]);
            }
            sb.Append("\n\n<size=").Append(FontSize - 6).Append(">").Append(T("Petak ", "Cell ")).Append(x).Append(", ").Append(y)
              .Append("  (").Append(((TerrainType)sim.Map.Terrain[i]).ToString()).Append(")</size>");
            inspectorText.supportRichText = true;
            inspectorText.text = sb.ToString();
            inspectorPanel.gameObject.SetActive(true);
        }
    }
}
