using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    public readonly struct CommandResult
    {
        public bool Ok { get; }
        public string Reason { get; }
        public double Cost { get; }
        internal CommandResult(bool ok, string reason = null, double cost = 0) { Ok = ok; Reason = reason; Cost = cost; }
    }

    public readonly struct PartnerGood
    {
        public string Good { get; }
        public double PriceMultiplier { get; }
        internal PartnerGood(string good, double multiplier) { Good = good; PriceMultiplier = multiplier; }
    }

    public sealed class PartnerView
    {
        readonly GameSimulation sim;
        internal readonly PartnerRecord Definition;
        internal PartnerView(GameSimulation sim, PartnerRecord definition)
        {
            this.sim = sim; Definition = definition;
            var buys = new PartnerGood[definition.buys.Length];
            for (int i = 0; i < buys.Length; i++) buys[i] = new PartnerGood(definition.buys[i].key, definition.buys[i].value);
            Buys = Array.AsReadOnly(buys);
        }
        public string Id => Definition.id;
        public string NameMs => Definition.nameMs;
        public string NameEn => Definition.nameEn;
        public string DescriptionMs => Definition.descMs;
        public string DescriptionEn => Definition.descEn;
        public string Color => Definition.color;
        public double KnowledgePerTick => Definition.knowledge * sim.CurrentEra;
        public IReadOnlyList<PartnerGood> Buys { get; }
        public double Relation => sim.Relations.TryGetValue(Id, out var value) ? value : Definition.baseRelation;
        public int EnvoyCooldown { get; internal set; }
        public bool Exchange { get; internal set; }
        public bool Active => Array.IndexOf(Definition.eras, sim.CurrentEra) >= 0 &&
            (string.IsNullOrEmpty(Definition.requiresEvent) || sim.Events.Fired.Contains(Definition.requiresEvent));
        internal bool Known => sim.Relations.ContainsKey(Id);
        internal void SetRelation(double value) => sim.Relations[Id] = value;
    }

    // Value types keep offer generation and deal settlement allocation-free. Setters are internal.
    public struct TradeDeal
    {
        public int Id { get; internal set; }
        public string Partner { get; internal set; }
        public string Good { get; internal set; }
        public double Quantity { get; internal set; }
        public double Price { get; internal set; }
        public double Remaining { get; internal set; }
        public double Delivered { get; internal set; }
        public int Missed { get; internal set; }
    }

    public enum OfferKind { Deal, Investment, Exchange }

    public struct DiplomaticOffer
    {
        public int Id { get; internal set; }
        public string Partner { get; internal set; }
        public OfferKind Kind { get; internal set; }
        public string Good { get; internal set; }
        public double Quantity { get; internal set; }
        public double Price { get; internal set; }
        public double Duration { get; internal set; }
        public double Money { get; internal set; }
        public int Expires { get; internal set; }
    }

    /// <summary>Partners, deals and offers from diplomacy.ts. Commands live on GameSimulation.</summary>
    public sealed class DiplomacyState
    {
        public const int MaxDealsPerPartner = 2;
        public const double ExchangeMinRelation = 25;
        static readonly double[] EnvoyCost = { 0, 150, 400, 1500, 4000 };
        static readonly double[] ExchangeCost = { 0, 3, 8, 30, 80 };
        readonly GameSimulation sim;
        readonly PartnerView[] partners;
        readonly int[] active, wanted;
        readonly List<TradeDeal> deals;
        readonly List<DiplomaticOffer> offers = new List<DiplomaticOffer>(3);
        readonly ResourceLedger offerProduction = new ResourceLedger();
        public IReadOnlyList<PartnerView> Partners { get; }
        public IReadOnlyList<TradeDeal> Deals { get; }
        public IReadOnlyList<DiplomaticOffer> Offers { get; }
        public int NextId { get; internal set; } = 1;
        public double EnvoyPrice => EnvoyCost[sim.CurrentEra];
        public double ExchangePrice => ExchangeCost[sim.CurrentEra];

        internal DiplomacyState(GameSimulation sim)
        {
            this.sim = sim;
            partners = new PartnerView[sim.Db.Partners.Length];
            active = new int[partners.Length]; wanted = new int[ResourceInfo.GoodIds.Length];
            for (int i = 0; i < partners.Length; i++) partners[i] = new PartnerView(sim, sim.Db.Partners[i]);
            deals = new List<TradeDeal>(partners.Length * 2 + 3);
            Partners = Array.AsReadOnly(partners); Deals = deals.AsReadOnly(); Offers = offers.AsReadOnly();
            EnsurePartners();
        }

        public PartnerView FindPartner(string id)
        {
            for (int i = 0; i < partners.Length; i++) if (partners[i].Id == id) return partners[i];
            return null;
        }

        internal void EnsurePartners()
        {
            for (int i = 0; i < partners.Length; i++)
            {
                var p = partners[i];
                if (p.Active && !p.Known) p.SetRelation(p.Definition.baseRelation);
            }
        }

        public double DealPrice(string partnerId, string good)
        {
            var p = FindPartner(partnerId);
            if (p == null) return 0;
            double mult = 0;
            foreach (var buy in p.Definition.buys) if (buy.key == good) { mult = buy.value; break; }
            return BasePrice(good) * mult * (1 + (p.Known ? p.Relation : 0) / 300) * (1 + sim.Effects.ExportPrice);
        }

        double BasePrice(string good)
        {
            foreach (var g in sim.Db.Goods) if (g.id == good) return Math.Max(0, g.prices[sim.CurrentEra - 1]);
            return 0;
        }

        internal CommandResult SendEnvoy(string id)
        {
            EnsurePartners();
            var p = FindPartner(id);
            if (p == null || !p.Active || !p.Known) return new CommandResult(false, "err.noPartner");
            if (p.EnvoyCooldown > 0) return new CommandResult(false, "err.cooldown");
            double cost = EnvoyCost[sim.CurrentEra];
            if (sim.Stock[ResourceType.Treasury] < cost) return new CommandResult(false, "err.money");
            sim.Stock.Add(ResourceType.Treasury, -cost);
            int office = sim.Db.BuildingIndex("syahbandar");
            p.SetRelation(Math.Min(100, p.Relation + 12 + (office >= 0 && sim.City.HasBuilding(office) ? 4 : 0)));
            p.EnvoyCooldown = 8;
            return new CommandResult(true, cost: cost);
        }

        internal CommandResult ProposeDeal(string id, string good, double quantity, double duration)
        {
            var p = FindPartner(id);
            if (p == null || !p.Active || !p.Known) return new CommandResult(false, "err.noPartner");
            bool buys = false;
            foreach (var b in p.Definition.buys) if (b.key == good && b.value != 0) { buys = true; break; }
            if (!buys || BasePrice(good) == 0) return new CommandResult(false, "err.notWanted");
            if (double.IsNaN(quantity) || double.IsInfinity(quantity) || double.IsNaN(duration) || double.IsInfinity(duration) || quantity <= 0 || duration <= 0)
                return new CommandResult(false, "err.invalid");
            int count = 0;
            for (int i = 0; i < deals.Count; i++) if (deals[i].Partner == id) count++;
            if (count >= MaxDealsPerPartner) return new CommandResult(false, "err.tooManyDeals");
            if (p.Relation < -20) return new CommandResult(false, "err.relation");
            deals.Add(new TradeDeal { Id = NextId++, Partner = id, Good = good, Quantity = quantity, Price = DealPrice(id, good), Remaining = duration });
            p.SetRelation(Math.Min(100, p.Relation + 3));
            return new CommandResult(true);
        }

        internal CommandResult CancelDeal(int id)
        {
            for (int i = 0; i < deals.Count; i++) if (deals[i].Id == id)
            {
                var p = FindPartner(deals[i].Partner);
                deals.RemoveAt(i);
                if (p != null && p.Known) p.SetRelation(Math.Max(-100, p.Relation - 10));
                return new CommandResult(true);
            }
            return new CommandResult(false, "err.invalid");
        }

        internal CommandResult ToggleExchange(string id)
        {
            var p = FindPartner(id);
            if (p == null || !p.Known) return new CommandResult(false, "err.noPartner");
            if (!p.Exchange && p.Relation < ExchangeMinRelation) return new CommandResult(false, "err.relation");
            p.Exchange = !p.Exchange;
            return new CommandResult(true);
        }

        internal CommandResult ResolveOffer(int id, bool accept)
        {
            for (int i = 0; i < offers.Count; i++) if (offers[i].Id == id)
            {
                var o = offers[i];
                offers.RemoveAt(i);
                var p = FindPartner(o.Partner);
                if (!accept) { if (p != null && p.Known) p.SetRelation(Math.Max(-100, p.Relation - 2)); }
                else if (o.Kind == OfferKind.Deal)
                    deals.Add(new TradeDeal { Id = NextId++, Partner = o.Partner, Good = o.Good, Quantity = o.Quantity, Price = o.Price, Remaining = o.Duration });
                else if (o.Kind == OfferKind.Investment)
                {
                    sim.Stock.Add(ResourceType.Treasury, o.Money);
                    if (p != null && p.Known) p.SetRelation(Math.Min(100, p.Relation + 5));
                }
                else if (p != null && p.Known) p.Exchange = true;
                return new CommandResult(true);
            }
            return new CommandResult(false, "err.invalid");
        }

        internal double SettleDeals(ResourceLedger stock, ResourceLedger exported, double capacity, ActiveEffectsView effects, ref Budget budget)
        {
            for (int i = 0; i < deals.Count; i++)
            {
                var d = deals[i];
                var resource = ResourceInfo.FromGood(d.Good);
                double give = Math.Max(0, Math.Min(d.Quantity, Math.Min(stock[resource], capacity)));
                stock.Add(resource, -give); exported.Add(resource, give); capacity -= give;
                budget.deals += give * d.Price * Math.Sqrt(effects.PriceMult[(int)resource]);
                d.Delivered += give; d.Remaining--;
                var p = FindPartner(d.Partner);
                if (give + 1e-6 < d.Quantity)
                {
                    d.Missed++;
                    if (p != null && p.Known) p.SetRelation(Math.Max(-100, p.Relation - 0.6));
                }
                else if (p != null && p.Known) p.SetRelation(Math.Min(100, p.Relation + 0.04));
                deals[i] = d;
            }
            for (int i = deals.Count - 1; i >= 0; i--) if (deals[i].Remaining <= 0) deals.RemoveAt(i);
            return capacity;
        }

        // The web tick publishes new derived production after diplomacy has run.
        internal void CaptureProduction() => offerProduction.CopyFrom(sim.Economy.Production);

        internal double Tick()
        {
            EnsurePartners();
            int count = 0;
            double knowledge = 0;
            for (int i = 0; i < partners.Length; i++)
            {
                var p = partners[i];
                if (!p.Active) continue;
                active[count++] = i;
                p.SetRelation(Math.Max(-100, Math.Min(100, p.Relation + (p.Definition.baseRelation - p.Relation) * 0.004 + sim.Effects.RelationGain)));
                if (p.EnvoyCooldown > 0) p.EnvoyCooldown--;
                if (!p.Exchange) continue;
                double cost = ExchangeCost[sim.CurrentEra];
                if (p.Relation < ExchangeMinRelation || sim.Stock[ResourceType.Treasury] < cost) p.Exchange = false;
                else { sim.Stock.Add(ResourceType.Treasury, -cost); knowledge += p.Definition.knowledge * sim.CurrentEra; }
            }
            for (int i = offers.Count - 1; i >= 0; i--)
                if (offers[i].Expires <= sim.Tick || FindPartner(offers[i].Partner)?.Active != true) offers.RemoveAt(i);
            if (offers.Count >= 3 || sim.Tick <= 12 || !sim.Rng.Chance(0.03)) return knowledge;
            // pick consumes a random value even when the active set is empty, as in TypeScript.
            int selected = (int)Math.Floor(sim.Rng.Next() * count);
            if (count == 0) return knowledge;
            var partner = partners[active[selected]];
            if (partner.Relation < -10) return knowledge;
            var offer = new DiplomaticOffer { Partner = partner.Id, Expires = sim.Tick + 12 };
            bool freeTrade = sim.CurrentEra >= 4 || sim.Tech.IsDone("zon_perdagangan_bebas");
            if (sim.CurrentEra >= 3 && freeTrade && partner.Relation >= 30 && sim.Rng.Chance(0.4))
            {
                offer.Kind = OfferKind.Investment;
                offer.Money = Noise.JsRound(sim.EraDef.wealth * 8000 * (1 + partner.Relation / 100));
            }
            else
            {
                int goodsCount = 0;
                var buys = partner.Definition.buys;
                for (int i = 0; i < buys.Length; i++)
                    if (BasePrice(buys[i].key) > 0 && offerProduction[ResourceInfo.FromGood(buys[i].key)] > 0.5) wanted[goodsCount++] = i;
                if (goodsCount == 0) return knowledge;
                string good = buys[wanted[(int)Math.Floor(sim.Rng.Next() * goodsCount)]].key;
                offer.Kind = OfferKind.Deal; offer.Good = good; offer.Duration = 24;
                offer.Quantity = Math.Max(1, Noise.JsRound(offerProduction[ResourceInfo.FromGood(good)] * sim.Rng.Range(0.3, 0.6)));
                offer.Price = DealPrice(partner.Id, good) * 1.08;
            }
            offer.Id = NextId++;
            offers.Add(offer);
            sim.Post(NoticeKind.Info, "Tawaran rakan dagang", "Trade partner offer", partner.NameMs, partner.NameEn, partner.Id);
            return knowledge;
        }

        internal void Restore(TradeDeal[] savedDeals, DiplomaticOffer[] savedOffers)
        {
            deals.Clear(); offers.Clear();
            if (savedDeals != null) deals.AddRange(savedDeals);
            if (savedOffers != null) offers.AddRange(savedOffers);
            // Tick never needs to grow the offer buffer, even after loading a legacy save.
            if (offers.Capacity < 3) offers.Capacity = 3;
            for (int i = 0; i < deals.Count; i++) NextId = Math.Max(NextId, deals[i].Id + 1);
            for (int i = 0; i < offers.Count; i++) NextId = Math.Max(NextId, offers[i].Id + 1);
            EnsurePartners();
        }
    }
}
