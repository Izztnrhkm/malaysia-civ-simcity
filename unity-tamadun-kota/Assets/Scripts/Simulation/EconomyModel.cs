// C# port of the web game's economy (src/core/sim/economy.ts), demand and zone growth
// (zoning.ts) and happiness (environment.ts). TransportModel provides delivery costs.
// Every buffer is preallocated: Tick() performs no heap allocations.
using System;

namespace TamadunKota.Simulation
{
    /// <summary>Additive modifiers from research, civics, policies and advisors.</summary>
    public sealed class EffectTotals
    {
        public readonly double[] Production = new double[ResourceInfo.Count];
        public double ProductionAll, ExportCap, ExportPrice, Tax, Research, Culture, Happiness, Pollution, Growth, Upkeep, Construction, RelationGain;

        public void Reset()
        {
            Array.Clear(Production, 0, Production.Length);
            ProductionAll = ExportCap = ExportPrice = Tax = Research = Culture = Happiness = Pollution = Growth = Upkeep = Construction = RelationGain = 0;
        }

        public void Add(EffectRecord e)
        {
            if (e == null) return;
            foreach (var p in e.production) Production[(int)ResourceInfo.FromGood(p.key)] += p.value;
            ProductionAll += e.productionAll;
            ExportCap += e.exportCap;
            ExportPrice += e.exportPrice;
            Tax += e.tax;
            Research += e.research;
            Culture += e.culture;
            Happiness += e.happiness;
            Pollution += e.pollution;
            Growth += e.growth;
            Upkeep += e.upkeep;
            Construction += e.construction;
            RelationGain += e.relationGain;
        }

        public double ConstructionMult => Math.Max(0.3, 1 + Construction);
    }

    /// <summary>Temporary modifiers from historical events and crisis decisions.</summary>
    public sealed class ActiveEffect
    {
        public string id;
        public int ticksLeft;
        public double productionMult = 1;
        public double exportCapMult = 1;
        public double happiness;
        public double research;
        public bool flood;
        public readonly double[] priceMult = NewPriceMult();

        static double[] NewPriceMult()
        {
            var a = new double[ResourceInfo.Count];
            for (int i = 0; i < a.Length; i++) a[i] = 1;
            return a;
        }
    }

    [Serializable]
    public struct Budget
    {
        public double taxR, taxC, taxI, exports, deals, upkeepBuildings, upkeepTransport, imports, admin, infrastructure, advisors;
        public double Income => taxR + taxC + taxI + exports + deals;
        public double Expenses => upkeepBuildings + upkeepTransport + imports + admin + infrastructure + advisors;
        public double Net => Income - Expenses;
    }

    public sealed class EconomyModel
    {
        public const double FoodPerCapita = 0.012;
        public const double WorkerShare = 0.55;
        public const double BaseStorage = 300;
        public const double BaseResearch = 1;
        public const double BaseCulture = 0.5;
        public static readonly double[] AdminPerCapita = { 0, 0.004, 0.02, 0.07, 0.12 };
        /// <summary>Late-game rebalance (eras 3-4): capital depreciation, network maintenance, size-dependent upkeep.</summary>
        public static readonly double[] InfraDepreciation = { 0, 0, 0, 0.0006, 0.0015 };
        public static readonly double[] InfraNetwork = { 0, 0, 0, 0.5, 1.5 };
        public static readonly double[] InfraUrban = { 0, 0, 0, 0.1, 0.5 };
        static readonly int[] DensityJobsI = { 0, 4, 12, 30, 70 };

        readonly GameDatabase db;
        // per-building cached effects (indexed by BuildingRecord index)
        readonly double[][] produces;
        readonly double[][] consumes;
        readonly int[] zoneCapacityR = new int[5];
        readonly int[] zoneCapacityC = new int[5];
        readonly int[] zoneCapacityI = new int[5];
        readonly double[] price = new double[ResourceInfo.Count];
        readonly double[] reserve = new double[ResourceInfo.Count];
        readonly int[] sellOrder = new int[ResourceInfo.Count];

        // outputs of the last tick
        public readonly ResourceLedger Production = new ResourceLedger();
        public readonly ResourceLedger Consumption = new ResourceLedger();
        public readonly ResourceLedger Exported = new ResourceLedger();
        public Budget Budget;
        public double Population, Workers, Jobs, Unemployment, StaffRatio, PowerRatio = 1, WaterRatio = 1;
        public double PowerSupply, PowerDemand, WaterSupply, WaterDemand;
        public double FoodSatisfaction = 1, ExportCapacity, Storage = BaseStorage;
        public double ResearchPerTick, CulturePerTick, Happiness = 60;
        public double DemandR = 50, DemandC, DemandI;
        public int CJobs, IJobs, ZonedR, ZonedC, ZonedI;
        public double BuildingHappiness;

        public EconomyModel(GameDatabase db)
        {
            this.db = db;
            produces = new double[db.Buildings.Length][];
            consumes = new double[db.Buildings.Length][];
            for (int i = 0; i < db.Buildings.Length; i++)
            {
                produces[i] = new double[ResourceInfo.Count];
                consumes[i] = new double[ResourceInfo.Count];
                foreach (var p in db.Buildings[i].produces) produces[i][(int)ResourceInfo.FromGood(p.key)] += p.value;
                foreach (var c in db.Buildings[i].consumes) consumes[i][(int)ResourceInfo.FromGood(c.key)] += c.value;
            }
            foreach (var z in db.Zones)
            {
                int[] t = z.zone == "R" ? zoneCapacityR : z.zone == "C" ? zoneCapacityC : zoneCapacityI;
                if (z.density >= 0 && z.density < t.Length) t[z.density] = z.capacity;
            }
        }

        /// <summary>Base world price of a resource in an era (0 if not traded yet).</summary>
        public double BasePrice(ResourceType r, int era)
        {
            string id = r == ResourceType.Food ? "padi" : GoodIdFor(r);
            if (id == null) return 0;
            foreach (var g in db.Goods)
                if (g.id == id)
                {
                    double p = g.prices[Math.Max(0, Math.Min(3, era - 1))];
                    return p < 0 ? 0 : p;
                }
            return 0;
        }

        static string GoodIdFor(ResourceType r)
        {
            switch (r)
            {
                case ResourceType.Timber: return "kayu";
                case ResourceType.Fish: return "ikan";
                case ResourceType.Spices: return "rempah";
                case ResourceType.Iron: return "besi";
                case ResourceType.Tin: return "timah";
                case ResourceType.Rubber: return "getah";
                case ResourceType.PalmOil: return "sawit";
                case ResourceType.Goods: return "barang";
                case ResourceType.Electronics: return "elektronik";
                case ResourceType.Digital: return "digital";
                default: return null;
            }
        }

        public void ComputePopulation(CityState city)
        {
            double pop = 0;
            int c = 0, ind = 0, zr = 0, zc = 0, zi = 0;
            for (int i = 0; i < city.Zone.Length; i++)
            {
                byte z = city.Zone[i];
                if (z == 0) continue;
                int d = city.Density[i];
                if (z == (byte)ZoneType.Residential) { pop += zoneCapacityR[d]; zr++; }
                else if (z == (byte)ZoneType.Commercial) { c += zoneCapacityC[d]; zc++; }
                else { ind += zoneCapacityI[d]; zi++; }
            }
            Population = pop;
            CJobs = c;
            IJobs = ind;
            ZonedR = zr;
            ZonedC = zc;
            ZonedI = zi;
        }

        /// <summary>
        /// One economy tick. Mutates the stockpile and treasury in <paramref name="stock"/>.
        /// </summary>
        public void Tick(CityState city, ResourceLedger stock, int era, EffectTotals fx, ActiveEffectsView events, double taxR, double taxC, double taxI, bool[] researched, double advisorUpkeep, DiplomacyState diplomacy = null)
        {
            EraRecord eraDef = db.Era(era);
            Production.Clear();
            Consumption.Clear();
            Exported.Clear();
            Budget = default;
            ComputePopulation(city);

            // ---- labour ----
            double bJobs = 0;
            for (int k = 0; k < city.Buildings.Count; k++) bJobs += db.Buildings[city.Buildings[k].defIndex].jobs;
            Workers = Population * WorkerShare;
            Jobs = CJobs + IJobs + bJobs;
            double employed = Math.Min(Workers, Jobs);
            StaffRatio = Jobs > 0 ? employed / Jobs : 1;
            Unemployment = Workers > 0 ? (Workers - employed) / Workers : 0;

            // ---- utilities: Energy and water matter from era 3 ----
            PowerSupply = 0;
            PowerDemand = Population * 0.03 + CJobs * 0.05 + IJobs * 0.08;
            WaterSupply = 0;
            WaterDemand = Population * 0.03 + IJobs * 0.05;
            for (int k = 0; k < city.Buildings.Count; k++)
            {
                var d = db.Buildings[city.Buildings[k].defIndex];
                double staff = d.jobs > 0 ? StaffRatio : 1;
                if (d.power > 0) PowerSupply += d.power * staff; else PowerDemand -= d.power;
                if (d.water > 0) WaterSupply += d.water * staff; else WaterDemand -= d.water;
            }
            PowerRatio = era < 3 || PowerDemand <= 0 ? 1 : Math.Min(1, PowerSupply / PowerDemand);
            WaterRatio = era < 3 || WaterDemand <= 0 ? 1 : Math.Min(1, WaterSupply / WaterDemand);
            stock[ResourceType.Energy] = PowerSupply - PowerDemand;

            // ---- production ----
            double research = 0, culture = 0, rawExportCap = 0;
            bool hasHub = false;
            BuildingHappiness = 0;
            Storage = BaseStorage;
            for (int k = 0; k < city.Buildings.Count; k++)
            {
                var b = city.Buildings[k];
                var d = db.Buildings[b.defIndex];
                double staff = d.jobs > 0 ? StaffRatio : 1;
                bool needsUtil = d.power < 0 || d.water < 0;
                double util = era >= 3 && needsUtil ? Math.Min(PowerRatio, WaterRatio) : 1;
                Storage += d.storage;
                if (d.exportHub) hasHub = true;
                rawExportCap += d.exportCapacity * staff;
                research += d.research * staff * util;
                culture += d.culture * staff;
                BuildingHappiness += d.happiness;
                double eff = staff * util;
                double[] prod = produces[b.defIndex];
                double[] cons = consumes[b.defIndex];
                bool producer = false;
                for (int r = 0; r < prod.Length; r++) if (prod[r] > 0) { producer = true; break; }
                if (producer)
                {
                    int centre = (b.y + b.cells / 2) * city.Grid.Width + b.x + b.cells / 2;
                    eff *= TransportModel.CostToEfficiency(city.Network.Cost[centre], era);
                    if (events.Flood && FloodRisk(city, b) && !FloodGuarded(city, b)) eff *= 0.5;
                    eff *= SiteFactor(city, b, d.placement);
                    double f = 1;
                    for (int r = 0; r < cons.Length; r++)
                    {
                        double need = cons[r] * eff;
                        if (need > 0) f = Math.Min(f, stock.amounts[r] / need);
                    }
                    eff *= Math.Max(0, Math.Min(1, f));
                    for (int r = 0; r < cons.Length; r++)
                    {
                        if (cons[r] <= 0) continue;
                        double used = cons[r] * eff;
                        stock.amounts[r] -= used;
                        Consumption.amounts[r] += used;
                    }
                    for (int r = 0; r < prod.Length; r++)
                    {
                        if (prod[r] <= 0) continue;
                        double outp = prod[r] * eff * ProdMult(fx, events, r);
                        stock.amounts[r] += outp;
                        Production.amounts[r] += outp;
                    }
                }
                b.efficiency = eff;
            }

            // industrial zones: output per job by era
            double iUtil = era >= 3 ? Math.Min(PowerRatio, WaterRatio) : 1;
            IndustrialOutput(era, researched, out double perGoods, out double perElec, out double perDigital);
            for (int i = 0; i < city.Zone.Length; i++)
            {
                if (city.Zone[i] != (byte)ZoneType.Industrial || city.Density[i] == 0) continue;
                double jobsHere = DensityJobsI[city.Density[i]] * StaffRatio * TransportModel.CostToEfficiency(city.Network.Cost[i], era) * iUtil;
                AddOutput(stock, ResourceType.Goods, jobsHere * perGoods, fx, events);
                AddOutput(stock, ResourceType.Electronics, jobsHere * perElec, fx, events);
                AddOutput(stock, ResourceType.Digital, jobsHere * perDigital, fx, events);
            }

            // ---- food ----
            double foodNeed = Population * FoodPerCapita;
            double take = Math.Min(stock[ResourceType.Food], foodNeed);
            stock.Add(ResourceType.Food, -take);
            Consumption.Add(ResourceType.Food, take);
            double foodGot = take;
            double fish = Math.Min(stock[ResourceType.Fish], Math.Max(0, foodNeed - foodGot));
            stock.Add(ResourceType.Fish, -fish);
            Consumption.Add(ResourceType.Fish, fish);
            foodGot += fish;
            if (foodGot < foodNeed - 1e-6 && hasHub)
            {
                double unit = BasePrice(ResourceType.Food, era) * 1.5;
                double afford = Math.Max(0, Math.Min(foodNeed - foodGot, stock[ResourceType.Treasury] / Math.Max(1e-6, unit)));
                Budget.imports += afford * unit;
                foodGot += afford;
            }
            FoodSatisfaction = foodNeed > 0 ? Math.Min(1, foodGot / foodNeed) : 1;

            // commercial demand for manufactured goods
            double cGoodsNeed = CJobs * 0.01;
            double cGoodsTake = Math.Min(stock[ResourceType.Goods], cGoodsNeed);
            stock.Add(ResourceType.Goods, -cGoodsTake);
            Consumption.Add(ResourceType.Goods, cGoodsTake);
            double cGoodsFactor = cGoodsNeed > 0 ? 0.8 + 0.4 * (cGoodsTake / cGoodsNeed) : 1;

            // ---- exports: surplus at world prices, highest price first ----
            ExportCapacity = hasHub ? rawExportCap * Math.Max(0, 1 + fx.ExportCap) * events.ExportCapMult : 0;
            double capLeft = ExportCapacity;
            if (diplomacy != null) capLeft = diplomacy.SettleDeals(stock, Exported, capLeft, events, ref Budget);
            int nSell = 0;
            for (int g = 0; g < ResourceInfo.GoodIds.Length; g++)
            {
                int r = (int)ResourceInfo.FromGood(ResourceInfo.GoodIds[g]);
                price[r] = BasePrice((ResourceType)r, era) * events.PriceMult[r] * (1 + fx.ExportPrice);
                reserve[r] = 0;
                if (price[r] > 0) sellOrder[nSell++] = r;
            }
            // reserve inputs for consumers and food for six ticks
            for (int k = 0; k < city.Buildings.Count; k++)
            {
                double[] cons = consumes[city.Buildings[k].defIndex];
                for (int r = 0; r < cons.Length; r++) reserve[r] += cons[r] * 4;
            }
            reserve[(int)ResourceType.Food] = foodNeed * 6;
            reserve[(int)ResourceType.Fish] = foodNeed * 6;
            reserve[(int)ResourceType.Goods] += cGoodsNeed * 4;
            // insertion sort by price (descending) - tiny array, no allocation
            for (int a = 1; a < nSell; a++)
            {
                int v = sellOrder[a];
                int j = a - 1;
                while (j >= 0 && price[sellOrder[j]] < price[v]) { sellOrder[j + 1] = sellOrder[j]; j--; }
                sellOrder[j + 1] = v;
            }
            for (int s = 0; s < nSell && capLeft > 0; s++)
            {
                int r = sellOrder[s];
                double surplus = stock.amounts[r] - reserve[r];
                if (surplus <= 0) continue;
                double q = Math.Min(surplus, capLeft);
                stock.amounts[r] -= q;
                capLeft -= q;
                Exported.amounts[r] += q;
                Budget.exports += q * price[r];
            }
            stock.ClampGoods(Storage);

            // ---- taxes ----
            double taxMult = Math.Max(0, 1 + fx.Tax);
            double wealth = eraDef.wealth * (0.6 + 0.4 * FoodSatisfaction);
            Budget.taxR = Population * (taxR / 100) * wealth * taxMult;
            Budget.taxC = CJobs * StaffRatio * (taxC / 100) * wealth * 3 * cGoodsFactor * taxMult;
            Budget.taxI = IJobs * StaffRatio * (taxI / 100) * wealth * 2.5 * taxMult;

            // ---- upkeep ----
            double upMult = Math.Max(0.2, 1 + fx.Upkeep);
            double capital = 0;
            for (int k = 0; k < city.Buildings.Count; k++)
            {
                var d = db.Buildings[city.Buildings[k].defIndex];
                Budget.upkeepBuildings += d.upkeep * upMult;
                capital += d.cost;
            }
            for (int i = 0; i < city.Transport.Length; i++)
            {
                int t = city.Transport[i];
                if (t != 0) Budget.upkeepTransport += db.Transports[t - 1].upkeep * upMult;
            }
            Budget.admin = Population * eraDef.wealth * AdminPerCapita[era] * upMult;
            Budget.infrastructure = era < 3 ? 0 : (capital * InfraDepreciation[era] + Budget.upkeepTransport * InfraNetwork[era] + Budget.upkeepBuildings * InfraUrban[era] * Math.Log(1 + Population / 8000) / Math.Log(2)) * upMult;
            Budget.advisors = advisorUpkeep;
            stock.Add(ResourceType.Treasury, Budget.Net);

            // ---- knowledge and culture ----
            ResearchPerTick = (BaseResearch + Population / 250 + research) * Math.Max(0, 1 + fx.Research) + events.Research;
            CulturePerTick = (BaseCulture + Population / 400 + culture) * Math.Max(0, 1 + fx.Culture);
            stock.Add(ResourceType.Tech, ResearchPerTick);
            stock.Add(ResourceType.Culture, CulturePerTick);

            // ---- happiness (smoothed towards its target) ----
            double h = ComputeHappinessTarget(city, era, fx, events, taxR, taxC, taxI);
            Happiness += (h - Happiness) * 0.15;

            // ---- RCI demand (port of computeDemand) ----
            double pioneer = 45 * Math.Exp(-Population / 700);
            double jobsGap = Math.Max(-1, Math.Min(1, (Jobs - Workers) / Math.Max(30, Workers))) * 55;
            double dR = pioneer + jobsGap + (Happiness - 50) * 0.8 + (FoodSatisfaction - 1) * 60 - (taxR - 9) * 3;
            if (dR > 0) dR *= 1 + fx.Growth;
            double cTarget = Population * eraDef.commercialRatio;
            double dC = (cTarget - CJobs) / Math.Max(10, cTarget) * 100 - (taxC - 9) * 3 + Unemployment * 30;
            double iTarget = Population * eraDef.industrialRatio + ExportCapacity * 0.3;
            double dI = (iTarget - IJobs) / Math.Max(10, iTarget) * 100 - (taxI - 9) * 3 + Unemployment * 40;
            DemandR = Clamp100(dR);
            DemandC = Clamp100(dC);
            DemandI = Clamp100(dI);
        }

        public double ComputeHappinessTarget(CityState city, int era, EffectTotals fx, ActiveEffectsView events, double taxR, double taxC, double taxI)
        {
            double h = 55 + (FoodSatisfaction - 1) * 45 - Unemployment * 45;
            double coverage = 0, pollution = 0;
            int occupied = 0;
            for (int i = 0; i < city.Zone.Length; i++)
                if (city.Zone[i] == (byte)ZoneType.Residential && city.Density[i] > 0)
                { coverage += city.Coverage[i]; pollution += city.Pollution[i]; occupied++; }
            h += Math.Min(30, (occupied > 0 ? coverage / occupied : 60) * 0.15);
            h -= (occupied > 0 ? pollution / occupied : 0) * 0.18;
            h -= (taxR - 9) * 1.6 + (taxC - 9) * 0.5 + (taxI - 9) * 0.5;
            h += fx.Happiness + events.Happiness + Math.Min(20, BuildingHappiness);
            if (era >= 3) h -= (1 - Math.Min(PowerRatio, WaterRatio)) * 25;
            return Math.Max(0, Math.Min(100, h));
        }

        static double Clamp100(double v) => v < -100 ? -100 : v > 100 ? 100 : v;

        double ProdMult(EffectTotals fx, ActiveEffectsView events, int r) => Math.Max(0, 1 + fx.Production[r] + fx.ProductionAll) * events.ProductionMult;

        void AddOutput(ResourceLedger stock, ResourceType r, double q, EffectTotals fx, ActiveEffectsView events)
        {
            if (q <= 0) return;
            double outp = q * ProdMult(fx, events, (int)r);
            stock.Add(r, outp);
            Production.Add(r, outp);
        }

        /// <summary>Industrial zone output per job, by era and research (port of industrialOutput).</summary>
        void IndustrialOutput(int era, bool[] researched, out double goods, out double elec, out double digital)
        {
            goods = elec = digital = 0;
            bool Has(string id) { int i = db.ResearchIndex(id); return i >= 0 && researched != null && researched[i]; }
            switch (era)
            {
                case 1: goods = 0.04; break;
                case 2: goods = 0.05; break;
                case 3:
                    if (Has("semikonduktor")) { goods = 0.03; elec = 0.008; } else goods = 0.04;
                    break;
                default:
                    if (Has("internet")) { goods = 0.015; elec = 0.012; digital = 0.006; } else { goods = 0.02; elec = 0.012; }
                    break;
            }
        }

        /// <summary>Terrain quality for resource buildings (port of siteFactor).</summary>
        public static double SiteFactor(CityState city, PlacedBuilding b, string placement)
        {
            if (placement != "tin" && placement != "fertile") return 1;
            double sum = 0;
            int n = 0;
            for (int dy = 0; dy < b.cells; dy++)
                for (int dx = 0; dx < b.cells; dx++)
                {
                    if (!city.Grid.InBounds(b.x + dx, b.y + dy)) continue;
                    int i = (b.y + dy) * city.Grid.Width + b.x + dx;
                    sum += placement == "tin" ? city.Map.Tin[i] : city.Map.Fertility[i];
                    n++;
                }
            double avg = n > 0 ? sum / n / 255 : 0;
            return placement == "tin" ? 0.4 + 1.2 * avg : 0.5 + avg;
        }

        static bool FloodRisk(CityState city, PlacedBuilding b)
        {
            int cx = Math.Min(city.Grid.Width - 1, b.x + b.cells / 2), cy = Math.Min(city.Grid.Height - 1, b.y + b.cells / 2);
            int i = cy * city.Grid.Width + cx;
            if (city.Map.Elevation[i] >= MapData.SeaLevel + 14) return false;
            return city.WaterDistance[i] <= 2;
        }

        bool FloodGuarded(CityState city, PlacedBuilding b)
        {
            for (int k = 0; k < city.Buildings.Count; k++)
            {
                var o = city.Buildings[k];
                int r = db.Buildings[o.defIndex].floodGuard;
                if (r <= 0) continue;
                double dx = (o.x + o.cells * 0.5) - (b.x + b.cells * 0.5);
                double dy = (o.y + o.cells * 0.5) - (b.y + b.cells * 0.5);
                if (dx * dx + dy * dy <= r * r) return true;
            }
            return false;
        }

        /// <summary>Port of growZones: lots develop with demand, network access and utilities.</summary>
        public void GrowZones(CityState city, int era, int maxDensity, Rng rng, double growth, bool flood)
        {
            double growthMult = Math.Max(0.2, 1 + growth);
            bool utilitiesOk = era < 3 || Math.Min(PowerRatio, WaterRatio) >= 0.9;
            bool changed = false;
            for (int i = 0; i < city.Zone.Length; i++)
            {
                byte z = city.Zone[i];
                if (z == 0) continue;
                int d = city.Density[i];
                if (city.Access[i] == 0)
                {
                    if (d > 0 && rng.Chance(0.03)) { city.Density[i] = (byte)(d - 1); changed = true; }
                    continue;
                }
                int maxD = maxDensity;
                double lv = city.LandValue[i] + (z == (byte)ZoneType.Industrial ? city.Pollution[i] * 0.75 : z == (byte)ZoneType.Commercial ? city.Pollution[i] * 0.4 : 0);
                if (lv < 90) maxD = Math.Min(maxD, 2);
                else if (lv < 140) maxD = Math.Min(maxD, 3);
                if (!utilitiesOk) maxD = Math.Min(maxD, 2);
                if (z == (byte)ZoneType.Residential && city.Pollution[i] > 150) maxD = Math.Min(maxD, 1);
                if (flood && city.Map.Elevation[i] < MapData.SeaLevel + 14 && city.WaterDistance[i] <= 2) continue;
                double dem = z == (byte)ZoneType.Residential ? DemandR : z == (byte)ZoneType.Commercial ? DemandC : DemandI;
                if (d > maxD)
                {
                    if (rng.Chance(0.02)) { city.Density[i] = (byte)(d - 1); changed = true; }
                    continue;
                }
                if (dem > 0 && d < maxD)
                {
                    double p = 0.05 * (dem / 100) * (0.5 + lv / 255) * growthMult;
                    if (rng.Chance(p)) { d++; city.Style[i] = (byte)era; changed = true; }
                }
                else if (dem < -25 && d > 0)
                {
                    double p = 0.02 * ((-dem - 25) / 75);
                    if (rng.Chance(p)) { d--; changed = true; }
                }
                city.Density[i] = (byte)d;
            }
            if (changed) city.Version++;
        }
    }

    /// <summary>Aggregated view of the active event effects, refreshed when effects change.</summary>
    public sealed class ActiveEffectsView
    {
        public double ProductionMult = 1, ExportCapMult = 1, Happiness, Research;
        public bool Flood;
        public readonly double[] PriceMult = new double[ResourceInfo.Count];

        public ActiveEffectsView() { Reset(); }

        public void Reset()
        {
            ProductionMult = 1;
            ExportCapMult = 1;
            Happiness = 0;
            Research = 0;
            Flood = false;
            for (int i = 0; i < PriceMult.Length; i++) PriceMult[i] = 1;
        }

        public void Refresh(System.Collections.Generic.List<ActiveEffect> effects)
        {
            Reset();
            for (int k = 0; k < effects.Count; k++)
            {
                var e = effects[k];
                ProductionMult *= e.productionMult;
                ExportCapMult *= e.exportCapMult;
                Happiness += e.happiness;
                Research += e.research;
                if (e.flood) Flood = true;
                for (int i = 0; i < PriceMult.Length; i++) PriceMult[i] *= e.priceMult[i];
            }
        }
    }
}
