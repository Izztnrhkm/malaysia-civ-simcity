using System.Collections.Generic;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Economy window (web: src/ui/modals/Economy.tsx): tax rates per zone, labour and supply
    /// figures, the income / upkeep breakdown of the last turn, the goods table and the policies
    /// (policies.json) unlocked by finished civics. The widgets are built once; each tick only
    /// rewrites their numbers. The policy list is rebuilt when it changes.
    /// </summary>
    public sealed class EconomyPanel : ModalPanel
    {
        static readonly ZoneType[] Zones = { ZoneType.Residential, ZoneType.Commercial, ZoneType.Industrial };
        static readonly string[] ZoneKeys = { "zone.R", "zone.C", "zone.I" };
        static readonly string[] IncomeKeys = { "eco.taxR", "eco.taxC", "eco.taxI", "eco.exports", "eco.deals" };
        static readonly string[] ExpenseKeys = { "eco.upkeepBuildings", "eco.upkeepTransport", "eco.admin", "eco.infrastructure", "eco.advisors", "eco.imports" };
        /// <summary>Goods rows in the web GOODS order (rice, fish, timber, ...), as resource indices.</summary>
        static readonly int[] GoodIndices = BuildGoodIndices();

        readonly Text[] taxValues = new Text[3];
        readonly Text[] income = new Text[IncomeKeys.Length];
        readonly Text[] expenses = new Text[ExpenseKeys.Length];
        Text net, labour;
        readonly GameObject[] goodRows = new GameObject[ResourceInfo.Count];
        readonly Text[,] goodCells = new Text[ResourceInfo.Count, 6];
        RectTransform policyList;
        Text policySlots;
        int policySignature = -1;
        readonly System.Text.StringBuilder sb = new System.Text.StringBuilder(256);

        public EconomyPanel(HudContext context) : base(context) { }

        protected override string TitleKey => "panel.economy";
        protected override Vector2 HalfSize => new Vector2(620, 390);

        protected override void BuildBody()
        {
            // column 1: taxes, labour, loans
            var c1 = Kit.Column(Body, "Taxes & Labour", new Vector2(0, 0), new Vector2(0.3f, 1), Vector2.zero, Vector2.zero);
            c1.GetComponent<VerticalLayoutGroup>().spacing = 8;
            var taxes = Kit.Card(c1, "Taxes", HudKit.CardTint);
            Kit.Localize(Heading(taxes, ""), () => Loc.Get("eco.taxes"));
            for (int i = 0; i < 3; i++)
            {
                var zone = Zones[i];
                var row = Kit.HRow(taxes, "Tax " + zone, 36);
                var name = Kit.Line(row, "", FontSize - 3, 36);
                HudKit.Size(name, -1, -1).flexibleWidth = 1;
                string key = ZoneKeys[i];
                Kit.Localize(name, () => Loc.Get(key));
                Kit.Btn(row, "-", () => Tax(zone, -1), 40);
                taxValues[i] = Kit.Line(row, "", FontSize - 2, 36, TextAnchor.MiddleCenter);
                HudKit.Size(taxValues[i], 56, -1);
                Kit.Btn(row, "+", () => Tax(zone, 1), 40);
            }
            var lab = Kit.Card(c1, "Labour", HudKit.CardTint);
            Kit.Localize(Heading(lab, ""), () => Loc.Get("eco.labour"));
            labour = Kit.Para(lab, "", FontSize - 4);
            var loan = Kit.Card(c1, "Loan", HudKit.CardTint);
            Kit.Localize(Heading(loan, ""), () => Loc.Get("eco.loan"));
            Kit.Localize(Kit.Para(loan, "", FontSize - 5), () => Loc.Get("unity.eco.noLoans"));

            // column 2: budget
            var c2 = Kit.Card(Body, "Budget", HudKit.CardTint);
            HudKit.Stretch(c2, new Vector2(0.315f, 0), new Vector2(0.6f, 1), Vector2.zero, Vector2.zero);
            var inc = Heading(c2, "");
            inc.color = HudKit.GoodColor;
            Kit.Localize(inc, () => Loc.Get("eco.income"));
            for (int i = 0; i < IncomeKeys.Length; i++) income[i] = BudgetRow(c2, IncomeKeys[i]);
            var exp = Heading(c2, "");
            exp.color = HudKit.BadColor;
            Kit.Localize(exp, () => Loc.Get("eco.expenses"));
            for (int i = 0; i < ExpenseKeys.Length; i++) expenses[i] = BudgetRow(c2, ExpenseKeys[i]);
            var hint = Kit.Para(c2, "", FontSize - 7);
            hint.color = new Color(Kit.TextColor.r, Kit.TextColor.g, Kit.TextColor.b, 0.7f);
            Kit.Localize(hint, () => Loc.Get("eco.infrastructure.hint"));
            net = BudgetRow(c2, null);
            net.fontStyle = FontStyle.Bold;

            // column 3: goods and policies (scrolls)
            var c3 = Kit.ScrollList(Body, "Goods & Policies", new Vector2(0.615f, 0), new Vector2(1, 1), Vector2.zero, Vector2.zero, 8);
            var goods = Kit.Card(c3, "Goods", HudKit.CardTint, 8);
            var head = GoodsRow(goods, "Header");
            string[] heads = { "eco.goods", "eco.stock", "eco.produced", "eco.used", "eco.exported", "eco.priceCol" };
            for (int k = 0; k < heads.Length; k++)
            {
                string key = heads[k];
                head[k].color = Kit.AccentColor;
                Kit.Localize(head[k], () => Loc.Get(key));
            }
            for (int g = 0; g < GoodIndices.Length; g++)
            {
                int r = GoodIndices[g];
                var cells = GoodsRow(goods, ((ResourceType)r).ToString());
                goodRows[r] = cells[0].transform.parent.gameObject;
                for (int k = 0; k < 6; k++) goodCells[r, k] = cells[k];
            }
            var pol = Kit.Card(c3, "Policies", HudKit.CardTint, 8);
            Kit.Localize(Heading(pol, ""), () => Loc.Get("civic.policies"));
            policySlots = Kit.Line(pol, "", FontSize - 4, 24);
            policyList = Kit.Card(pol, "List", null, 0);
            policyList.GetComponent<VerticalLayoutGroup>().spacing = 6;
        }

        static int[] BuildGoodIndices()
        {
            var ids = ResourceInfo.GoodIds;
            var result = new int[ids.Length];
            for (int i = 0; i < ids.Length; i++) result[i] = (int)ResourceInfo.FromGood(ids[i]);
            return result;
        }

        Text BudgetRow(Transform parent, string key)
        {
            var row = Kit.HRow(parent, key ?? "Net", 26);
            var name = Kit.Line(row, "", FontSize - 4, 26);
            HudKit.Size(name, -1, -1).flexibleWidth = 1;
            if (key != null) Kit.Localize(name, () => Loc.Get(key));
            else Kit.Localize(name, () => Loc.Get("eco.net") + " " + Loc.Get("top.perTick"));
            var value = Kit.Line(row, "", FontSize - 4, 26, TextAnchor.MiddleRight);
            HudKit.Size(value, 110, -1);
            if (key == null) name.fontStyle = FontStyle.Bold;
            return value;
        }

        Text[] GoodsRow(Transform parent, string name)
        {
            var row = Kit.HRow(parent, name, 24, 4);
            var cells = new Text[6];
            for (int k = 0; k < 6; k++)
            {
                cells[k] = Kit.Line(row, "", FontSize - 7, 24, k == 0 ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight);
                if (k == 0) HudKit.Size(cells[k], -1, -1).flexibleWidth = 1;
                else HudKit.Size(cells[k], 62, -1);
            }
            return cells;
        }

        // ------------------------------------------------------------ refresh

        public override void Refresh()
        {
            policySignature = -1;
            UpdateFigures();
            HudKit.ScrollToTop((RectTransform)policyList.parent.parent);
        }

        public override void OnEconomy(EconomySnapshot s)
        {
            if (IsOpen) UpdateFigures();
        }

        public override void OnBind(GameSimulation sim)
        {
            if (IsOpen) Refresh();
        }

        void UpdateFigures()
        {
            var sim = Sim;
            if (sim == null) return;
            var e = sim.Economy;
            var b = e.Budget;
            int era = sim.CurrentEra;

            taxValues[0].text = sim.TaxR.ToString("0") + "%";
            taxValues[1].text = sim.TaxC.ToString("0") + "%";
            taxValues[2].text = sim.TaxI.ToString("0") + "%";

            sb.Clear();
            sb.Append(Loc.Get("eco.workers")).Append(": ").Append(HudFormat.Fmt(e.Workers)).Append("  ·  ").Append(Loc.Get("eco.jobs")).Append(": ").Append(HudFormat.Fmt(e.Jobs));
            sb.Append('\n').Append(Loc.Get("eco.unemployment")).Append(": ").Append((e.Unemployment * 100).ToString("0.0")).Append('%');
            sb.Append('\n').Append(Loc.Get("eco.food")).Append(": ").Append((e.FoodSatisfaction * 100).ToString("0")).Append('%');
            sb.Append('\n').Append(Loc.Get("eco.exportCap")).Append(": ").Append(e.ExportCapacity.ToString("0.#")).Append("  ·  ").Append(Loc.Get("eco.storage")).Append(": ").Append(HudFormat.Fmt(e.Storage));
            if (era >= 3)
                sb.Append('\n').Append(Loc.Get("eco.utilities")).Append(": ").Append(Loc.Get("unity.eco.power")).Append(' ').Append(HudFormat.Fmt(e.PowerSupply)).Append('/').Append(HudFormat.Fmt(e.PowerDemand))
                  .Append("  ·  ").Append(Loc.Get("unity.eco.water")).Append(' ').Append(HudFormat.Fmt(e.WaterSupply)).Append('/').Append(HudFormat.Fmt(e.WaterDemand));
            labour.text = sb.ToString();

            income[0].text = HudFormat.Fmt(b.taxR);
            income[1].text = HudFormat.Fmt(b.taxC);
            income[2].text = HudFormat.Fmt(b.taxI);
            income[3].text = HudFormat.Fmt(b.exports);
            income[4].text = HudFormat.Fmt(b.deals);
            expenses[0].text = "-" + HudFormat.Fmt(b.upkeepBuildings);
            expenses[1].text = "-" + HudFormat.Fmt(b.upkeepTransport);
            expenses[2].text = "-" + HudFormat.Fmt(b.admin);
            expenses[3].text = "-" + HudFormat.Fmt(b.infrastructure);
            expenses[4].text = "-" + HudFormat.Fmt(b.advisors);
            expenses[5].text = "-" + HudFormat.Fmt(b.imports);
            net.text = (b.Net >= 0 ? "+" : "") + HudFormat.Fmt(b.Net);
            net.color = b.Net >= 0 ? HudKit.GoodColor : HudKit.BadColor;

            var priceMult = sim.Events.View.PriceMult;
            for (int g = 0; g < GoodIndices.Length; g++)
            {
                int r = GoodIndices[g];
                var rt = (ResourceType)r;
                double price = e.BasePrice(rt, era);
                double stock = sim.Stock.amounts[r];
                bool show = price > 0 || stock > 0;   // web: tradable this era or in stock
                if (goodRows[r].activeSelf != show) goodRows[r].SetActive(show);
                if (!show) continue;
                goodCells[r, 0].text = Malay ? ResourceInfo.NameMs(rt) : ResourceInfo.NameEn(rt);
                goodCells[r, 1].text = HudFormat.Fmt(stock);
                goodCells[r, 2].text = e.Production.amounts[r].ToString("0.#");
                goodCells[r, 3].text = e.Consumption.amounts[r].ToString("0.#");
                goodCells[r, 4].text = e.Exported.amounts[r].ToString("0.#");
                goodCells[r, 5].text = (price * (priceMult[r] > 0 ? priceMult[r] : 1)).ToString("0.#");
            }

            int sig = PolicySignature(sim);
            if (sig != policySignature)
            {
                policySignature = sig;
                RebuildPolicies(sim);
            }
        }

        /// <summary>Changes when a policy is unlocked, adopted or revoked, or the language or era changes.</summary>
        int PolicySignature(GameSimulation sim)
        {
            int h = sim.CurrentEra * 31 + (Malay ? 7 : 3);
            var pols = sim.Db.Policies;
            for (int i = 0; i < pols.Length; i++)
            {
                if (SimCommands.IsPolicyUnlocked(sim, pols[i].id)) h = h * 17 + i + 1;
                if (sim.Policies.Contains(pols[i].id)) h = h * 13 + i + 101;
            }
            return h;
        }

        void RebuildPolicies(GameSimulation sim)
        {
            HudKit.ClearChildren(policyList);
            policySlots.text = Loc.Format("unity.eco.policySlots", "used", sim.Policies.Count, "max", SimCommands.PolicySlots(sim));
            int shown = 0;
            foreach (var p in sim.Db.Policies)
            {
                if (!SimCommands.IsPolicyUnlocked(sim, p.id)) continue;
                shown++;
                bool on = sim.Policies.Contains(p.id);
                var card = Kit.Card(policyList, p.id, on ? new Color(0.08f, 0.3f, 0.16f, 0.55f) : new Color(0, 0, 0, 0.18f), 8);
                Kit.Para(card, "<b>" + T(p.nameMs, p.nameEn) + "</b>", FontSize - 4);
                Kit.Para(card, T(p.descMs, p.descEn), FontSize - 6);
                var row = Kit.HRow(card, "Action", 32);
                Kit.Spacer(row, 0);
                row.GetChild(0).GetComponent<LayoutElement>().flexibleWidth = 1;
                string id = p.id;
                var b = Kit.Btn(row, Loc.Get(on ? "civic.revoke" : "civic.adopt"), () => TogglePolicy(id), 120);
                b.GetComponentInChildren<Text>().fontSize = FontSize - 5;
                Kit.SetSelected(b, !on);
            }
            if (shown == 0) Kit.Para(policyList, Loc.Get("civic.noPolicies"), FontSize - 5);
        }

        // ------------------------------------------------------------ actions

        void Tax(ZoneType z, int delta)
        {
            var sim = Sim;
            if (sim == null || ctx.Economy == null) return;
            ctx.Economy.SetTax(z, (z == ZoneType.Residential ? sim.TaxR : z == ZoneType.Commercial ? sim.TaxC : sim.TaxI) + delta);
            ctx.Economy.Publish();
        }

        void TogglePolicy(string id)
        {
            var sim = Sim;
            if (sim == null) return;
            if (sim.Policies.Contains(id)) SimCommands.RevokePolicy(sim, id);
            else
            {
                string err = SimCommands.AdoptPolicy(sim, id);
                if (err != null) ctx.ShowMessage(Loc.Get(err));
            }
            ctx.Economy?.Publish();
            UpdateFigures();
        }
    }
}
