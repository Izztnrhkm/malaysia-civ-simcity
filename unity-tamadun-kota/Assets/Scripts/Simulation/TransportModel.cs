using System;

namespace TamadunKota.Simulation
{
    /// <summary>Multimodal delivery costs and access, ported from transport.ts. Buffers are reused.</summary>
    public sealed class TransportModel
    {
        public const byte Road = 1, Rail = 2, Mrt = 4, Water = 8, AllModes = 15;
        public readonly byte[] Modes;
        public readonly float[] RoadStep;
        public readonly double[] Cost;
        readonly double[] previous;
        readonly int[] heap, position;
        readonly GameDatabase db;
        int count;

        public TransportModel(int size, GameDatabase db)
        {
            this.db = db;
            Modes = new byte[size]; RoadStep = new float[size]; Cost = new double[size];
            previous = new double[size]; heap = new int[size]; position = new int[size];
        }

        public static double CostToEfficiency(double cost, int era) => double.IsInfinity(cost) || double.IsNaN(cost)
            ? 0.25 : Math.Max(0.25, Math.Min(1, 1 - cost / (era == 1 ? 70 : era == 2 ? 90 : 110) * 0.75));

        public void Rebuild(CityState city)
        {
            count = 0;
            Array.Clear(city.Access, 0, city.Access.Length);
            for (int i = 0; i < Modes.Length; i++)
            {
                Modes[i] = TerrainTypes.IsWater(city.Map.Terrain[i]) ? Water : (byte)0;
                RoadStep[i] = 0; Cost[i] = double.PositiveInfinity; position[i] = -1;
                int t = city.Transport[i];
                if (t == 1 || t == 3)
                {
                    Modes[i] |= Road;
                    RoadStep[i] = (float)(db == null ? (t == 1 ? 2 : 1) : db.Transports[t - 1].step);
                }
                else if (t == 2) Modes[i] |= Rail;
                else if (t == 4) Modes[i] |= Mrt;
            }
            if (db != null) foreach (var b in city.Buildings)
            {
                var d = db.Buildings[b.defIndex];
                bool hub = d.exportHub || d.market;
                if (!d.transfer && !hub) continue;
                for (int dy = 0; dy < b.cells; dy++) for (int dx = 0; dx < b.cells; dx++)
                {
                    int x = b.x + dx, y = b.y + dy;
                    if (!city.Grid.InBounds(x, y)) continue;
                    int i = y * city.Grid.Width + x;
                    if (d.transfer) { Modes[i] = AllModes; RoadStep[i] = 1; }
                    else if (d.market) { Modes[i] |= Road; RoadStep[i] = 1; }
                    if (hub && Cost[i] != 0) { Cost[i] = 0; PushOrDecrease(i); }
                }
            }
            int w = city.Grid.Width, h = city.Grid.Height;
            for (int i = 0; i < Modes.Length; i++)
            {
                int radius = (Modes[i] & Road) != 0 ? 3 : Modes[i] == Water ? 1 : -1;
                int cx = i % w, cy = i / w;
                for (int y = Math.Max(0, cy - radius); y <= Math.Min(h - 1, cy + radius); y++)
                    for (int x = Math.Max(0, cx - radius); x <= Math.Min(w - 1, cx + radius); x++) city.Access[y * w + x] = 1;
            }
            while (count > 0)
            {
                int i = Pop(), x = i % w, y = i / w;
                if (x + 1 < w) Relax(city, i, i + 1);
                if (x > 0) Relax(city, i, i - 1);
                if (y + 1 < h) Relax(city, i, i + w);
                if (y > 0) Relax(city, i, i - w);
            }
            for (int pass = 0; pass < 3; pass++)
            {
                Array.Copy(Cost, previous, Cost.Length);
                for (int i = 0; i < Cost.Length; i++)
                {
                    if (Modes[i] != 0) continue;
                    int x = i % w, y = i / w;
                    if (x + 1 < w) Walk(i, i + 1, pass);
                    if (x > 0) Walk(i, i - 1, pass);
                    if (y + 1 < h) Walk(i, i + w, pass);
                    if (y > 0) Walk(i, i - w, pass);
                }
            }
        }

        void Walk(int i, int j, int pass)
        {
            if (Modes[j] == Water && pass > 0) return;
            Cost[i] = Math.Min(Cost[i], previous[j] + 3);
        }

        void Relax(CityState city, int i, int j)
        {
            int shared = Modes[i] & Modes[j];
            if (shared == 0) return;
            double step = double.PositiveInfinity;
            if ((shared & Road) != 0) step = RoadStep[j] == 0 ? 2 : RoadStep[j];
            if ((shared & Rail) != 0) step = Math.Min(step, 0.6);
            if ((shared & Mrt) != 0) step = Math.Min(step, 0.4);
            if ((shared & Water) != 0) step = Math.Min(step, city.Map.Terrain[j] == (byte)TerrainType.River ? 1 : 0.7);
            double next = Cost[i] + step;
            if (next >= Cost[j]) return;
            Cost[j] = next;
            PushOrDecrease(j);
        }

        void PushOrDecrease(int i)
        {
            int k = position[i];
            if (k < 0) { k = count++; heap[k] = i; position[i] = k; }
            while (k > 0)
            {
                int p = (k - 1) / 2;
                if (Cost[heap[p]] <= Cost[i]) break;
                heap[k] = heap[p]; position[heap[k]] = k; k = p;
            }
            heap[k] = i; position[i] = k;
        }

        int Pop()
        {
            int top = heap[0], last = heap[--count];
            position[top] = -1;
            if (count == 0) return top;
            int k = 0;
            while (k * 2 + 1 < count)
            {
                int c = k * 2 + 1;
                if (c + 1 < count && Cost[heap[c + 1]] < Cost[heap[c]]) c++;
                if (Cost[last] <= Cost[heap[c]]) break;
                heap[k] = heap[c]; position[heap[k]] = k; k = c;
            }
            heap[k] = last; position[last] = k;
            return top;
        }
    }
}
