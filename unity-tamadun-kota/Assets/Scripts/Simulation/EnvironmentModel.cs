using System;

namespace TamadunKota.Simulation
{
    /// <summary>Service coverage, pollution and land value from environment.ts, with reusable buffers.</summary>
    public sealed class EnvironmentModel
    {
        static readonly string[] Kinds = { "faith", "education", "health", "safety", "leisure" };
        static readonly int[] IndustrialPollution = { 0, 5, 7, 8, 3 };
        readonly GameDatabase db;
        readonly byte[][] services = new byte[5][];
        readonly float[] source, temporary, blurred, second;
        public double AverageLandValue { get; private set; }

        public EnvironmentModel(GameDatabase db, CityState city)
        {
            this.db = db;
            int n = city.Zone.Length;
            source = new float[n]; temporary = new float[n]; blurred = new float[n]; second = new float[n];
            for (int k = 0; k < services.Length; k++) services[k] = new byte[n];
            ComputeWaterDistance(city);
        }

        public static void ComputeWaterDistance(CityState city)
        {
            int[] queue = new int[city.Zone.Length];
            int head = 0, tail = 0, w = city.Grid.Width, h = city.Grid.Height;
            for (int i = 0; i < queue.Length; i++)
            {
                bool water = TerrainTypes.IsWater(city.Map.Terrain[i]);
                city.WaterDistance[i] = water ? (byte)0 : (byte)255;
                if (water) queue[tail++] = i;
            }
            while (head < tail)
            {
                int i = queue[head++], x = i % w, y = i / w;
                int d = city.WaterDistance[i] + 1;
                if (d >= 255) continue;
                if (x + 1 < w) Visit(i + 1, d);
                if (x > 0) Visit(i - 1, d);
                if (y + 1 < h) Visit(i + w, d);
                if (y > 0) Visit(i - w, d);
            }
            void Visit(int i, int d) { if (city.WaterDistance[i] > d) { city.WaterDistance[i] = (byte)d; queue[tail++] = i; } }
        }

        public void Compute(CityState city, int era, EffectTotals fx)
        {
            int w = city.Grid.Width, h = city.Grid.Height;
            for (int k = 0; k < services.Length; k++) Array.Clear(services[k], 0, source.Length);
            Array.Clear(source, 0, source.Length);
            for (int i = 0; i < source.Length; i++)
            {
                if (city.Zone[i] == (byte)ZoneType.Industrial) source[i] += city.Density[i] * IndustrialPollution[era] * 4;
                if (city.Transport[i] == (byte)TransportType.Highway) source[i] += 20;
            }
            foreach (var b in city.Buildings)
            {
                var d = db.Buildings[b.defIndex];
                double eff = Math.Max(0.3, b.efficiency == 0 ? 1 : b.efficiency);
                int kind = Array.IndexOf(Kinds, d.serviceKind);
                if (kind >= 0 && d.serviceRadius > 0)
                {
                    double cx = b.x + (b.cells - 1) / 2.0, cy = b.y + (b.cells - 1) / 2.0;
                    int r = d.serviceRadius;
                    for (int y = Math.Max(0, (int)Math.Floor(cy - r)); y <= Math.Min(h - 1, Math.Ceiling(cy + r)); y++)
                        for (int x = Math.Max(0, (int)Math.Floor(cx - r)); x <= Math.Min(w - 1, Math.Ceiling(cx + r)); x++)
                        {
                            double distance = Math.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                            if (distance > r) continue;
                            int i = y * w + x;
                            services[kind][i] = (byte)Math.Min(100, services[kind][i] + d.serviceStrength * eff * (1 - distance / r * 0.6));
                        }
                }
                if (d.pollution <= 0) continue;
                double per = d.pollution * 6 * eff / (b.cells * b.cells);
                for (int dy = 0; dy < b.cells; dy++) for (int dx = 0; dx < b.cells; dx++)
                    if (city.Grid.InBounds(b.x + dx, b.y + dy))
                    {
                        int i = (b.y + dy) * w + b.x + dx;
                        source[i] = (float)(source[i] + per);
                    }
            }
            for (int i = 0; i < source.Length; i++)
            {
                int sum = 0;
                for (int k = 0; k < services.Length; k++) sum += services[k][i];
                city.Coverage[i] = (byte)Math.Min(255, sum / 2);
            }
            Blur(source, blurred, w, h);
            Blur(blurred, second, w, h);
            foreach (var b in city.Buildings)
            {
                double strength = -db.Buildings[b.defIndex].pollution;
                if (strength <= 0) continue;
                double cx = b.x + b.cells / 2.0, cy = b.y + b.cells / 2.0;
                for (int y = Math.Max(0, (int)Math.Floor(cy - 9)); y < Math.Min(h, cy + 9); y++)
                    for (int x = Math.Max(0, (int)Math.Floor(cx - 9)); x < Math.Min(w, cx + 9); x++)
                    {
                        double distance = Math.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
                        if (distance < 9) { int i = y * w + x; second[i] = (float)Math.Max(0, second[i] - strength * (1 - distance / 9)); }
                    }
            }
            double mult = Math.Max(0.1, 1 + fx.Pollution), total = 0;
            int zoned = 0;
            for (int i = 0; i < source.Length; i++)
            {
                city.Pollution[i] = (byte)Math.Min(255, second[i] * 4.0 * mult);
                byte t = city.Map.Terrain[i];
                if (TerrainTypes.IsWater(t)) { city.LandValue[i] = 0; continue; }
                int wd = city.WaterDistance[i];
                double value = 45 + (wd <= 3 ? 30 - wd * 6 : 0);
                if (t == (byte)TerrainType.Hill) value += 8;
                if (t == (byte)TerrainType.Mangrove) value -= 15;
                value += city.Coverage[i] * 0.45 + (city.Access[i] != 0 ? 12 : -10) + era * 6 - city.Pollution[i] * 0.75;
                value = Math.Max(0, Math.Min(255, value));
                city.LandValue[i] = (byte)value;
                if (city.Zone[i] != 0) { total += value; zoned++; }
            }
            AverageLandValue = zoned == 0 ? 0 : total / zoned;
        }

        void Blur(float[] input, float[] output, int w, int h)
        {
            for (int y = 0; y < h; y++)
            {
                double sum = 0;
                for (int x = -2; x <= 2; x++) sum += input[y * w + Math.Max(0, Math.Min(w - 1, x))];
                for (int x = 0; x < w; x++)
                {
                    temporary[y * w + x] = (float)(sum / 5);
                    sum += (double)input[y * w + Math.Min(w - 1, x + 3)] - input[y * w + Math.Max(0, x - 2)];
                }
            }
            for (int x = 0; x < w; x++)
            {
                double sum = 0;
                for (int y = -2; y <= 2; y++) sum += temporary[Math.Max(0, Math.Min(h - 1, y)) * w + x];
                for (int y = 0; y < h; y++)
                {
                    output[y * w + x] = (float)(sum / 5);
                    sum += (double)temporary[Math.Min(h - 1, y + 3) * w + x] - temporary[Math.Max(0, y - 2) * w + x];
                }
            }
        }
    }
}
