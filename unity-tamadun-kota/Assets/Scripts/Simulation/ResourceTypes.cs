using System;

namespace TamadunKota.Simulation
{
    /// <summary>
    /// City resources. The GDD's headline resources are Timber, Tin, Rubber, Food, Energy,
    /// Tech and Treasury (Kupang / Straits dollar / Ringgit); the remaining goods of the web
    /// game are kept so trade and production chains stay intact.
    /// </summary>
    public enum ResourceType
    {
        Treasury = 0,
        Food = 1,
        Timber = 2,
        Spices = 3,
        Iron = 4,
        Tin = 5,
        Rubber = 6,
        PalmOil = 7,
        Goods = 8,
        Electronics = 9,
        Digital = 10,
        Energy = 11,
        Tech = 12,
        Culture = 13,
        // Appended so version-one save indices remain valid.
        Fish = 14,
    }

    public static class ResourceInfo
    {
        public const int Count = 15;

        /// <summary>Tradable goods in the order of the web game's GOODS list. Food is rice; Fish is separate.</summary>
        public static readonly string[] GoodIds = { "padi", "ikan", "kayu", "rempah", "besi", "timah", "getah", "sawit", "barang", "elektronik", "digital" };

        public static ResourceType FromGood(string good)
        {
            switch (good)
            {
                case "padi": return ResourceType.Food;
                case "ikan": return ResourceType.Fish;
                case "kayu": return ResourceType.Timber;
                case "rempah": return ResourceType.Spices;
                case "besi": return ResourceType.Iron;
                case "timah": return ResourceType.Tin;
                case "getah": return ResourceType.Rubber;
                case "sawit": return ResourceType.PalmOil;
                case "barang": return ResourceType.Goods;
                case "elektronik": return ResourceType.Electronics;
                case "digital": return ResourceType.Digital;
                default: throw new ArgumentException("Unknown good " + good);
            }
        }

        /// <summary>True for stockpiled, sellable goods (not treasury, energy, tech or culture).</summary>
        public static bool IsGood(ResourceType r) => (r >= ResourceType.Food && r <= ResourceType.Digital) || r == ResourceType.Fish;

        public static string NameEn(ResourceType r)
        {
            switch (r)
            {
                case ResourceType.PalmOil: return "Palm Oil";
                default: return r.ToString();
            }
        }

        public static string NameMs(ResourceType r)
        {
            switch (r)
            {
                case ResourceType.Treasury: return "Perbendaharaan";
                case ResourceType.Food: return "Makanan";
                case ResourceType.Fish: return "Ikan";
                case ResourceType.Timber: return "Kayu";
                case ResourceType.Spices: return "Rempah";
                case ResourceType.Iron: return "Besi";
                case ResourceType.Tin: return "Bijih Timah";
                case ResourceType.Rubber: return "Getah";
                case ResourceType.PalmOil: return "Minyak Sawit";
                case ResourceType.Goods: return "Barangan";
                case ResourceType.Electronics: return "Elektronik";
                case ResourceType.Digital: return "Digital";
                case ResourceType.Energy: return "Tenaga";
                case ResourceType.Tech: return "Teknologi";
                default: return "Budaya";
            }
        }
    }

    /// <summary>Fixed-size resource amounts. A plain array so ticks never allocate.</summary>
    [Serializable]
    public sealed class ResourceLedger
    {
        public double[] amounts = new double[ResourceInfo.Count];

        public double this[ResourceType r]
        {
            get => amounts[(int)r];
            set => amounts[(int)r] = value;
        }

        public void Add(ResourceType r, double v) => amounts[(int)r] += v;
        public void Clear() => Array.Clear(amounts, 0, amounts.Length);
        public void CopyFrom(ResourceLedger other) => Array.Copy(other.amounts, amounts, amounts.Length);

        /// <summary>Clamp goods to [0, storage]; treasury may go negative (debt).</summary>
        public void ClampGoods(double storage)
        {
            for (int i = 0; i < amounts.Length; i++)
            {
                if (!ResourceInfo.IsGood((ResourceType)i)) continue;
                if (amounts[i] < 0) amounts[i] = 0;
                else if (amounts[i] > storage) amounts[i] = storage;
            }
        }
    }
}
