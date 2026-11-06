using System.Collections.Generic;
using System.Text;
using TamadunKota.Core;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace TamadunKota.UI
{
    /// <summary>
    /// Diplomacy window (web: src/ui/modals/Diplomacy.tsx) over GameSimulation.Diplomacy: the
    /// partners of the current era with their relation, the selected partner's goods, envoy and
    /// knowledge exchange, the deal form, and the open offers and active deals. The partner list,
    /// the goods chips and the offer / deal rows are rebuilt only when their contents change;
    /// each economy tick rewrites the texts and relation bars.
    /// </summary>
    public sealed class DiplomacyPanel : ModalPanel
    {
        /// <summary>Quantity per turn and duration steps for the deal steppers (web defaults 2 and 24).</summary>
        static readonly int[] QuantitySteps = { 1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500 };
        static readonly int[] DurationSteps = { 6, 12, 18, 24, 36, 48, 60, 84, 120 };
        const float TopHeight = 420;

        sealed class PartnerRow
        {
            public PartnerView partner;
            public Button button;
            public Image barFill;
        }

        RectTransform partnerList, detail, goodsRow, offerList, dealList, dealCard;
        readonly List<PartnerRow> partnerRows = new List<PartnerRow>(8);
        readonly List<PartnerView> active = new List<PartnerView>(8);
        Text nameText, descText, relationValue, buysText, priceText, qtyText, durText, noPartner;
        Image relationFill;
        Button envoy, exchange;
        readonly List<(Button button, string good)> goodButtons = new List<(Button, string)>(8);
        readonly List<string> wanted = new List<string>(8);
        readonly List<Text> offerTexts = new List<Text>(4), dealTexts = new List<Text>(8);
        string selected, good;
        int qtyIndex = 1, durIndex = 3;
        int partnerSignature = -1, goodsSignature = -1, offerSignature = -1, dealSignature = -1;
        readonly StringBuilder sb = new StringBuilder(256);

        public DiplomacyPanel(HudContext context) : base(context) { }

        protected override string TitleKey => "panel.diplomacy";
        protected override Vector2 HalfSize => new Vector2(620, 390);

        // ------------------------------------------------------------ construction

        protected override void BuildBody()
        {
            var top = new GameObject("Top", typeof(RectTransform)).GetComponent<RectTransform>();
            top.SetParent(Body, false);
            HudKit.Stretch(top, new Vector2(0, 1), Vector2.one, new Vector2(0, -TopHeight), Vector2.zero);
            partnerList = Kit.ScrollList(top, "Partners", Vector2.zero, new Vector2(0, 1), Vector2.zero, new Vector2(270, 0), 6);

            detail = Kit.Card(top, "Partner", HudKit.CardTint, 12);
            HudKit.Stretch(detail, Vector2.zero, Vector2.one, new Vector2(286, 0), Vector2.zero);
            detail.GetComponent<VerticalLayoutGroup>().spacing = 6;
            nameText = Kit.Para(detail, "", FontSize + 2, Kit.AccentColor);
            nameText.fontStyle = FontStyle.Bold;
            descText = Kit.Para(detail, "", FontSize - 5);

            var rel = Kit.HRow(detail, "Relation", 24, 10);
            var relLabel = Kit.Line(rel, "", FontSize - 4, 24);
            HudKit.Size(relLabel, 120, -1);
            Kit.Localize(relLabel, () => Loc.Get("dip.relation"));
            var relationBar = RelationBar(rel, out relationFill);
            HudKit.Size(relationBar, -1, 12).flexibleWidth = 1;
            relationValue = Kit.Line(rel, "", FontSize - 4, 24, TextAnchor.MiddleRight);
            HudKit.Size(relationValue, 50, -1);
            buysText = Kit.Para(detail, "", FontSize - 5);

            var actions = Kit.HRow(detail, "Actions", 40, 8);
            envoy = Kit.Btn(actions, "", () => Apply(Sim?.SendEnvoy(selected)), 330);
            exchange = Kit.Btn(actions, "", () => Apply(Sim?.ToggleExchange(selected)), 330);

            dealCard = Kit.Card(detail, "Deal", new Color(0, 0, 0, 0.25f), 10);
            dealCard.GetComponent<VerticalLayoutGroup>().spacing = 6;
            Kit.Localize(Heading(dealCard, ""), () => Loc.Get("dip.deal"));
            goodsRow = Kit.HRow(dealCard, "Goods", 34, 6);
            var form = Kit.HRow(dealCard, "Terms", 36, 6);
            qtyText = Stepper(form, () => Loc.Get("dip.qty"), d => qtyIndex = Mathf.Clamp(qtyIndex + d, 0, QuantitySteps.Length - 1));
            Kit.Spacer(form, 12);
            durText = Stepper(form, () => Loc.Get("dip.duration"), d => durIndex = Mathf.Clamp(durIndex + d, 0, DurationSteps.Length - 1));
            var bottom = Kit.HRow(dealCard, "Propose", 38, 10);
            priceText = Kit.Line(bottom, "", FontSize - 4, 38);
            HudKit.Size(priceText, -1, -1).flexibleWidth = 1;
            var propose = Kit.Btn(bottom, () => Loc.Get("dip.deal"), Propose, 200);
            Kit.SetSelected(propose, true);

            noPartner = Kit.Label(top, "None", FontSize - 4, TextAnchor.MiddleCenter);
            HudKit.Stretch(noPartner.rectTransform, Vector2.zero, Vector2.one, new Vector2(286, 0), Vector2.zero);
            Kit.Localize(noPartner, () => Loc.Get("err.noPartner"));

            // bottom: offers and active deals
            var lists = new GameObject("Lists", typeof(RectTransform)).GetComponent<RectTransform>();
            lists.SetParent(Body, false);
            HudKit.Stretch(lists, Vector2.zero, Vector2.one, Vector2.zero, new Vector2(0, -TopHeight - 14));
            offerList = ListColumn(lists, 0f, 0.495f, "dip.offers");
            dealList = ListColumn(lists, 0.505f, 1f, "dip.deals");
        }

        RectTransform ListColumn(RectTransform parent, float x0, float x1, string titleKey)
        {
            var title = Kit.Label(parent, titleKey, FontSize - 2, TextAnchor.MiddleLeft);
            title.color = Kit.AccentColor;
            title.fontStyle = FontStyle.Bold;
            HudKit.Stretch(title.rectTransform, new Vector2(x0, 1), new Vector2(x1, 1), new Vector2(0, -30), Vector2.zero);
            Kit.Localize(title, () => Loc.Get(titleKey));
            return Kit.ScrollList(parent, titleKey, new Vector2(x0, 0), new Vector2(x1, 1), Vector2.zero, new Vector2(0, -34), 4);
        }

        /// <summary>A "label  [-] value [+]" stepper; returns the value text.</summary>
        Text Stepper(RectTransform row, System.Func<string> label, System.Action<int> step)
        {
            var l = Kit.Line(row, "", FontSize - 5, 36);
            HudKit.Size(l, 150, -1);
            Kit.Localize(l, label);
            Kit.Btn(row, "-", () => { step(-1); UpdateDeal(); }, 36);
            var value = Kit.Line(row, "", FontSize - 3, 36, TextAnchor.MiddleCenter);
            HudKit.Size(value, 56, -1);
            Kit.Btn(row, "+", () => { step(1); UpdateDeal(); }, 36);
            return value;
        }

        /// <summary>A relation bar: -100..100 maps to an empty..full fill.</summary>
        static RectTransform RelationBar(Transform parent, out Image fill)
        {
            var bg = new GameObject("Bar", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
            bg.transform.SetParent(parent, false);
            var bgImage = bg.GetComponent<Image>();
            bgImage.color = new Color(0, 0, 0, 0.4f);
            bgImage.raycastTarget = false;
            var f = new GameObject("Fill", typeof(RectTransform), typeof(Image));
            f.transform.SetParent(bg.transform, false);
            fill = f.GetComponent<Image>();
            fill.raycastTarget = false;
            HudKit.Stretch(fill.rectTransform, Vector2.zero, new Vector2(0.5f, 1), Vector2.zero, Vector2.zero);
            return (RectTransform)bg.transform;
        }

        static void SetRelation(Image fill, double relation)
        {
            float pct = Mathf.Clamp01((float)(relation + 100) / 200f);
            var rt = fill.rectTransform;
            if (rt.anchorMax.x != pct) rt.anchorMax = new Vector2(pct, 1);
            fill.color = relation >= 30 ? HudKit.GoodColor : relation >= 0 ? new Color(0.99f, 0.83f, 0.30f) : HudKit.BadColor;
        }

        // ------------------------------------------------------------ refresh

        public override void Refresh()
        {
            partnerSignature = goodsSignature = offerSignature = dealSignature = -1;
            UpdateAll();
            HudKit.ScrollToTop(partnerList);
        }

        public override void OnEconomy(EconomySnapshot s)
        {
            if (IsOpen) UpdateAll();
        }

        public override void OnBind(GameSimulation sim)
        {
            selected = null;
            good = null;
            if (IsOpen) Refresh();
        }

        void UpdateAll()
        {
            var sim = Sim;
            if (sim == null) return;
            UpdatePartners(sim);
            UpdateDetail(sim);
            UpdateOffers(sim);
            UpdateDeals(sim);
        }

        void UpdatePartners(GameSimulation sim)
        {
            active.Clear();
            var all = sim.Diplomacy.Partners;
            int sig = Malay ? 1 : 2;
            for (int i = 0; i < all.Count; i++)
                if (all[i].Active) { active.Add(all[i]); sig = sig * 31 + i + 1; }
            var current = selected != null ? sim.Diplomacy.FindPartner(selected) : null;
            if (current == null || !current.Active) selected = active.Count > 0 ? active[0].Id : null;

            if (sig != partnerSignature)
            {
                partnerSignature = sig;
                HudKit.ClearChildren(partnerList);
                partnerRows.Clear();
                for (int i = 0; i < active.Count; i++) partnerRows.Add(BuildPartnerRow(active[i]));
            }
            for (int i = 0; i < partnerRows.Count; i++)
            {
                var row = partnerRows[i];
                SetRelation(row.barFill, row.partner.Relation);
                Kit.SetSelected(row.button, row.partner.Id == selected);
            }
        }

        PartnerRow BuildPartnerRow(PartnerView p)
        {
            var row = new PartnerRow { partner = p };
            string id = p.Id;
            row.button = Kit.Btn(partnerList, "", () => { selected = id; UpdateAll(); }, 0);
            var le = row.button.GetComponent<LayoutElement>();
            le.preferredHeight = 56;
            le.minHeight = 56;
            var label = row.button.GetComponentInChildren<Text>();
            label.alignment = TextAnchor.UpperLeft;
            label.fontSize = FontSize - 4;
            label.fontStyle = FontStyle.Bold;
            label.text = T(p.NameMs, p.NameEn);
            HudKit.Stretch(label.rectTransform, Vector2.zero, Vector2.one, new Vector2(30, 18), new Vector2(-8, -6));

            var swatch = new GameObject("Colour", typeof(RectTransform), typeof(Image)).GetComponent<Image>();
            swatch.transform.SetParent(row.button.transform, false);
            swatch.color = ParseColor(p.Color);
            swatch.raycastTarget = false;
            HudKit.Stretch(swatch.rectTransform, new Vector2(0, 1), new Vector2(0, 1), new Vector2(10, -22), new Vector2(22, -10));

            var bar = RelationBar(row.button.transform, out row.barFill);
            HudKit.Stretch(bar, Vector2.zero, new Vector2(1, 0), new Vector2(10, 8), new Vector2(-10, 16));
            return row;
        }

        static Color ParseColor(string hex) =>
            !string.IsNullOrEmpty(hex) && ColorUtility.TryParseHtmlString(hex, out var c) ? c : new Color(0.7f, 0.7f, 0.7f);

        void UpdateDetail(GameSimulation sim)
        {
            var p = selected != null ? sim.Diplomacy.FindPartner(selected) : null;
            detail.gameObject.SetActive(p != null);
            noPartner.gameObject.SetActive(p == null);
            if (p == null) return;

            nameText.text = T(p.NameMs, p.NameEn);
            descText.text = T(p.DescriptionMs, p.DescriptionEn);
            SetRelation(relationFill, p.Relation);
            relationValue.text = Mathf.RoundToInt((float)p.Relation).ToString();

            // goods this partner buys that trade in this era (web: isTradable)
            wanted.Clear();
            sb.Clear();
            sb.Append(Loc.Get("dip.buys")).Append(": ");
            int gsig = p.Id.GetHashCode() * 7 + (Malay ? 1 : 2);
            for (int i = 0; i < p.Buys.Count; i++)
            {
                var b = p.Buys[i];
                if (b.PriceMultiplier == 0 || sim.Diplomacy.DealPrice(p.Id, b.Good) <= 0) continue;
                if (wanted.Count > 0) sb.Append(",  ");
                sb.Append(GoodName(b.Good)).Append(" x").Append(b.PriceMultiplier.ToString("0.##"));
                wanted.Add(b.Good);
                gsig = gsig * 31 + i + 1;
            }
            if (wanted.Count == 0) sb.Append('-');
            buysText.text = sb.ToString();

            double money = sim.Stock[ResourceType.Treasury];
            if (p.EnvoyCooldown > 0)
                HudKit.SetLabel(envoy, Loc.Get("dip.cooldown") + " (" + p.EnvoyCooldown + ")");
            else
                HudKit.SetLabel(envoy, Loc.Get("dip.envoy") + " (" + ctx.Currency + HudFormat.Fmt(sim.Diplomacy.EnvoyPrice) + ")");
            envoy.interactable = p.EnvoyCooldown <= 0 && money >= sim.Diplomacy.EnvoyPrice;
            HudKit.SetLabel(exchange, Loc.Get("dip.exchange") + ": " + Loc.Get(p.Exchange ? "dip.exchangeOn" : "dip.exchangeOff"));
            exchange.interactable = p.Exchange || p.Relation >= DiplomacyState.ExchangeMinRelation;
            Kit.SetSelected(exchange, p.Exchange);

            if (gsig != goodsSignature)
            {
                goodsSignature = gsig;
                HudKit.ClearChildren(goodsRow);
                goodButtons.Clear();
                for (int i = 0; i < wanted.Count; i++)
                {
                    string g = wanted[i];
                    var b = Kit.Btn(goodsRow, GoodName(g), () => { good = g; UpdateDeal(); }, 120);
                    b.GetComponentInChildren<Text>().fontSize = FontSize - 6;
                    goodButtons.Add((b, g));
                }
            }
            dealCard.gameObject.SetActive(wanted.Count > 0);
            UpdateDeal();
        }

        /// <summary>The good, quantity, duration and price of the deal form.</summary>
        void UpdateDeal()
        {
            var sim = Sim;
            if (sim == null || selected == null) return;
            if (good == null || !wanted.Contains(good)) good = wanted.Count > 0 ? wanted[0] : null;
            for (int i = 0; i < goodButtons.Count; i++) Kit.SetSelected(goodButtons[i].button, goodButtons[i].good == good);
            qtyText.text = QuantitySteps[qtyIndex].ToString();
            durText.text = DurationSteps[durIndex].ToString();
            priceText.text = good == null ? "" :
                Loc.Get("dip.price") + ": " + ctx.Currency + sim.Diplomacy.DealPrice(selected, good).ToString("0.0") + " / " + GoodName(good);
        }

        void Propose()
        {
            if (good == null) return;
            Apply(Sim?.ProposeDeal(selected, good, QuantitySteps[qtyIndex], DurationSteps[durIndex]));
        }

        void UpdateOffers(GameSimulation sim)
        {
            var offers = sim.Diplomacy.Offers;
            int sig = Malay ? 1 : 2;
            for (int i = 0; i < offers.Count; i++) sig = sig * 31 + offers[i].Id;
            if (sig != offerSignature)
            {
                offerSignature = sig;
                HudKit.ClearChildren(offerList);
                offerTexts.Clear();
                if (offers.Count == 0) Kit.Para(offerList, Loc.Get("dip.noOffers"), FontSize - 5);
                for (int i = 0; i < offers.Count; i++)
                {
                    int id = offers[i].Id;
                    var row = Kit.HRow(offerList, "Offer", 40, 6);
                    var text = Kit.Line(row, "", FontSize - 6, 40);
                    text.horizontalOverflow = HorizontalWrapMode.Wrap;
                    HudKit.Size(text, -1, -1).flexibleWidth = 1;
                    offerTexts.Add(text);
                    var accept = Kit.Btn(row, Loc.Get("dip.accept"), () => Apply(Sim?.AcceptOffer(id)), 100);
                    Kit.SetSelected(accept, true);
                    Kit.Btn(row, Loc.Get("dip.decline"), () => Apply(Sim?.DeclineOffer(id)), 100);
                }
            }
            for (int i = 0; i < offers.Count && i < offerTexts.Count; i++)
            {
                var o = offers[i];
                sb.Clear();
                sb.Append("<b>").Append(PartnerName(sim, o.Partner)).Append("</b>: ");
                if (o.Kind == OfferKind.Deal && o.Good != null)
                    sb.Append(GoodName(o.Good)).Append(' ').Append(o.Quantity.ToString("0.#")).Append(Loc.Get("top.perTick"))
                      .Append(" x ").Append(o.Duration.ToString("0")).Append(" @ ").Append(ctx.Currency).Append(o.Price.ToString("0.0"));
                else if (o.Kind == OfferKind.Investment)
                    sb.Append(Loc.Get("dip.investment")).Append(' ').Append(ctx.Currency).Append(HudFormat.Fmt(o.Money));
                else
                    sb.Append(Loc.Get("dip.exchange"));
                offerTexts[i].text = sb.ToString();
            }
        }

        void UpdateDeals(GameSimulation sim)
        {
            var deals = sim.Diplomacy.Deals;
            int sig = Malay ? 1 : 2;
            for (int i = 0; i < deals.Count; i++) sig = sig * 31 + deals[i].Id;
            if (sig != dealSignature)
            {
                dealSignature = sig;
                HudKit.ClearChildren(dealList);
                dealTexts.Clear();
                if (deals.Count == 0) Kit.Para(dealList, Loc.Get("dip.noDeals"), FontSize - 5);
                for (int i = 0; i < deals.Count; i++)
                {
                    int id = deals[i].Id;
                    var row = Kit.HRow(dealList, "Deal", 40, 6);
                    var text = Kit.Line(row, "", FontSize - 6, 40);
                    text.horizontalOverflow = HorizontalWrapMode.Wrap;
                    HudKit.Size(text, -1, -1).flexibleWidth = 1;
                    dealTexts.Add(text);
                    Kit.Btn(row, Loc.Get("dip.cancel"), () => Apply(Sim?.CancelDeal(id)), 100);
                }
            }
            for (int i = 0; i < deals.Count && i < dealTexts.Count; i++)
            {
                var d = deals[i];
                sb.Clear();
                sb.Append("<b>").Append(PartnerName(sim, d.Partner)).Append("</b>: ").Append(GoodName(d.Good)).Append(' ')
                  .Append(d.Quantity.ToString("0.#")).Append(" @ ").Append(ctx.Currency).Append(d.Price.ToString("0.0"))
                  .Append(",  ").Append(d.Remaining.ToString("0")).Append(' ').Append(Loc.Get("dip.remaining"));
                if (d.Missed > 0) sb.Append("  <color=#F28073>").Append(T("terlepas ", "missed ")).Append(d.Missed).Append("</color>");
                dealTexts[i].text = sb.ToString();
            }
        }

        /// <summary>Show a failed command's reason, then update the treasury and this window.</summary>
        void Apply(CommandResult? result)
        {
            if (result == null) return;
            var r = result.Value;
            if (!r.Ok && !string.IsNullOrEmpty(r.Reason)) ctx.ShowMessage(Loc.Get(r.Reason));
            ctx.Economy?.Publish();
            UpdateAll();
        }

        string GoodName(string goodId)
        {
            var r = ResourceInfo.FromGood(goodId);
            return Malay ? ResourceInfo.NameMs(r) : ResourceInfo.NameEn(r);
        }

        string PartnerName(GameSimulation sim, string id)
        {
            var p = sim.Diplomacy.FindPartner(id);
            return p == null ? id : T(p.NameMs, p.NameEn);
        }
    }
}
