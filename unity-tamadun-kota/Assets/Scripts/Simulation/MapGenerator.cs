// Bit-exact C# port of the web game's seeded map generator
// (src/core/rng.ts, src/core/noise.ts, src/core/map/terrain.ts): the same seed
// produces the same Straits of Melaka coastline, river, rainforest and tin fields.
using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    /// <summary>Terrain codes (same values as the web game's T constants).</summary>
    public enum TerrainType : byte
    {
        Deep = 0, Sea = 1, Shallow = 2, Beach = 3, Mangrove = 4, River = 5, Plain = 6, Jungle = 7, Hill = 8, Mountain = 9,
    }

    public static class TerrainTypes
    {
        public static bool IsWater(byte t) => t <= (byte)TerrainType.Shallow || t == (byte)TerrainType.River;
        public static bool IsSea(byte t) => t <= (byte)TerrainType.Shallow;
        public static bool IsLand(byte t) => !IsWater(t);
    }

    /// <summary>Deterministic mulberry32 PRNG, identical to src/core/rng.ts.</summary>
    public sealed class Rng
    {
        uint s;
        public Rng(uint seed) { s = seed != 0 ? seed : 0x9e3779b9u; }
        public uint State { get => s; set => s = value; }

        public double Next()
        {
            unchecked
            {
                s += 0x6d2b79f5u;
                uint t = s;
                t = (uint)((int)(t ^ (t >> 15)) * (int)(t | 1u));
                t ^= t + (uint)((int)(t ^ (t >> 7)) * (int)(t | 61u));
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }

        public double Range(double min, double max) => min + (max - min) * Next();
        public int Int(int min, int maxInclusive) => (int)Math.Floor(Range(min, maxInclusive + 1));
        public bool Chance(double p) => Next() < p;

        /// <summary>Stateless integer hash in [0,1), identical to hash2 in rng.ts.</summary>
        public static double Hash2(int x, int y, int seed = 0)
        {
            unchecked
            {
                int h = x * 374761393 + y * 668265263 + seed * (int)2246822519u;
                h = (h ^ (int)((uint)h >> 13)) * 1274126177;
                h ^= (int)((uint)h >> 16);
                return (uint)h / 4294967296.0;
            }
        }
    }

    public static class Noise
    {
        static double Smooth(double t) => t * t * (3 - 2 * t);
        static double Lerp(double a, double b, double t) => a + (b - a) * t;

        public static double Value(double x, double y, int seed)
        {
            int xi = (int)Math.Floor(x);
            int yi = (int)Math.Floor(y);
            double xf = Smooth(x - xi);
            double yf = Smooth(y - yi);
            double a = Rng.Hash2(xi, yi, seed);
            double b = Rng.Hash2(xi + 1, yi, seed);
            double c = Rng.Hash2(xi, yi + 1, seed);
            double d = Rng.Hash2(xi + 1, yi + 1, seed);
            return Lerp(Lerp(a, b, xf), Lerp(c, d, xf), yf);
        }

        public static double Fbm(double x, double y, int seed, int octaves = 4, double lacunarity = 2, double gain = 0.5)
        {
            double amp = 1, freq = 1, sum = 0, norm = 0;
            for (int i = 0; i < octaves; i++)
            {
                sum += amp * Value(x * freq, y * freq, seed + i * 1013);
                norm += amp;
                amp *= gain;
                freq *= lacunarity;
            }
            return sum / norm;
        }

        public static double Clamp(double v, double lo, double hi) => v < lo ? lo : v > hi ? hi : v;

        public static double SmoothStep(double e0, double e1, double x)
        {
            double t = Clamp((x - e0) / (e1 - e0), 0, 1);
            return t * t * (3 - 2 * t);
        }

        /// <summary>JavaScript Math.round semantics (halves round towards +infinity).</summary>
        public static double JsRound(double v) => Math.Floor(v + 0.5);
    }

    /// <summary>Static map layers (terrain, elevation 0..255, fertility, tin richness).</summary>
    public sealed class MapData
    {
        public const int SeaLevel = 77;
        public readonly int Width, Height, Seed;
        public readonly byte[] Terrain, Elevation, Fertility, Tin;
        public int MouthX, MouthY;

        public MapData(int width, int height, int seed)
        {
            Width = width;
            Height = height;
            Seed = seed;
            int n = width * height;
            Terrain = new byte[n];
            Elevation = new byte[n];
            Fertility = new byte[n];
            Tin = new byte[n];
        }

        public bool InBounds(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height;
        public byte TerrainAt(int x, int y) => Terrain[y * Width + x];

        static readonly int[] DX = { 1, -1, 0, 0 };
        static readonly int[] DY = { 0, 0, 1, -1 };

        public bool IsCoastal(int x, int y)
        {
            if (TerrainTypes.IsWater(TerrainAt(x, y))) return false;
            for (int k = 0; k < 4; k++)
            {
                int nx = x + DX[k], ny = y + DY[k];
                if (InBounds(nx, ny) && TerrainTypes.IsSea(TerrainAt(nx, ny))) return true;
            }
            return false;
        }

        public bool IsRiverside(int x, int y)
        {
            if (TerrainTypes.IsWater(TerrainAt(x, y))) return false;
            for (int k = 0; k < 4; k++)
            {
                int nx = x + DX[k], ny = y + DY[k];
                if (InBounds(nx, ny) && TerrainAt(nx, ny) == (byte)TerrainType.River) return true;
            }
            return false;
        }

        /// <summary>BFS distance (capped at 255) to tiles matching the predicate.</summary>
        public byte[] DistanceField(Func<byte, bool> pred)
        {
            int n = Width * Height;
            var dist = new byte[n];
            var queue = new int[n];
            int head = 0, tail = 0;
            for (int i = 0; i < n; i++)
            {
                dist[i] = 255;
                if (pred(Terrain[i])) { dist[i] = 0; queue[tail++] = i; }
            }
            while (head < tail)
            {
                int i = queue[head++];
                int x = i % Width, y = i / Width;
                int d = dist[i] + 1;
                if (d >= 255) continue;
                for (int k = 0; k < 4; k++)
                {
                    int nx = x + DX[k], ny = y + DY[k];
                    if (!InBounds(nx, ny)) continue;
                    int j = ny * Width + nx;
                    if (dist[j] > d) { dist[j] = (byte)d; queue[tail++] = j; }
                }
            }
            return dist;
        }

        /// <summary>FNV-1a fingerprint of terrain + elevation (used to check the port against the web game).</summary>
        public uint Fingerprint()
        {
            uint h = 2166136261u;
            unchecked
            {
                for (int i = 0; i < Terrain.Length; i++) h = (h ^ Terrain[i]) * 16777619u;
                for (int i = 0; i < Elevation.Length; i++) h = (h ^ Elevation[i]) * 16777619u;
            }
            return h;
        }
    }

    public static class MapGenerator
    {
        static readonly int[] DX = { 1, -1, 0, 0 };
        static readonly int[] DY = { 0, 0, 1, -1 };

        static byte ToByte(double e) => (byte)Noise.Clamp(Noise.JsRound(e * 255), 0, 255);

        public static MapData Generate(int width, int height, int seed)
        {
            var map = new MapData(width, height, seed);
            var rng = new Rng((uint)(seed ^ 0x51a7));
            var elev = new float[width * height];
            int W = width, H = height;

            // 1. elevation field: seabed to the west, plains, the main range to the east
            for (int y = 0; y < H; y++)
            {
                double coast = W * (0.2 + 0.09 * (Noise.Fbm(0.5, y / 22.0, seed + 11, 3) - 0.5) * 2);
                double ridgeX = W * (0.82 + 0.07 * (Noise.Fbm(3.1, y / 30.0, seed + 23, 3) - 0.5) * 2);
                for (int x = 0; x < W; x++)
                {
                    double n = Noise.Fbm(x / 18.0, y / 18.0, seed + 5, 5);
                    double inland = (x - coast) / W;
                    double e;
                    if (inland < 0) e = 0.3 + inland * 2.2 + (n - 0.5) * 0.08;
                    else
                    {
                        double ramp = Noise.SmoothStep(0, 0.6, inland) * 0.17;
                        double rx = (x - ridgeX) / (W * 0.12);
                        double ridge = Math.Exp(-(rx * rx)) * (0.2 + 0.26 * Noise.Fbm(x / 9.0, y / 9.0, seed + 41, 3));
                        e = Math.Max(0.312, 0.318 + ramp + ridge + (n - 0.5) * 0.1);
                    }
                    elev[y * W + x] = (float)e;
                }
            }
            // offshore islands
            int islands = 2 + rng.Int(0, 2);
            for (int k = 0; k < islands; k++)
            {
                double cx = rng.Range(W * 0.03, W * 0.13);
                double cy = rng.Range(H * 0.1, H * 0.9);
                double r = rng.Range(2.2, 4.5);
                for (int y = (int)Math.Floor(cy - r - 1); y <= cy + r + 1; y++)
                    for (int x = (int)Math.Floor(cx - r - 1); x <= cx + r + 1; x++)
                    {
                        if (!map.InBounds(x, y)) continue;
                        double dx = x - cx, dy = y - cy;
                        double d = Math.Sqrt(dx * dx + dy * dy) / r;
                        if (d < 1) elev[y * W + x] = (float)Math.Max(elev[y * W + x], 0.36 - d * 0.06 + (1 - d) * 0.08);
                    }
            }
            for (int i = 0; i < elev.Length; i++) map.Elevation[i] = ToByte(elev[i]);

            // 2. base classification
            for (int i = 0; i < elev.Length; i++)
            {
                int b = map.Elevation[i];
                TerrainType t;
                if (b < MapData.SeaLevel - 30) t = TerrainType.Deep;
                else if (b < MapData.SeaLevel - 10) t = TerrainType.Sea;
                else if (b < MapData.SeaLevel) t = TerrainType.Shallow;
                else if (b < 162) t = TerrainType.Plain;
                else if (b < 205) t = TerrainType.Hill;
                else t = TerrainType.Mountain;
                map.Terrain[i] = (byte)t;
            }
            // beaches: low land touching the sea
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int i = y * W + x;
                    if (map.Terrain[i] != (byte)TerrainType.Plain || map.Elevation[i] > MapData.SeaLevel + 12) continue;
                    for (int k = 0; k < 4; k++)
                    {
                        int nx = x + DX[k], ny = y + DY[k];
                        if (map.InBounds(nx, ny) && TerrainTypes.IsSea(map.Terrain[ny * W + nx])) { map.Terrain[i] = (byte)TerrainType.Beach; break; }
                    }
                }

            // 3. river by steepest descent with a westward bias
            var path = CarveRiver(map, rng);
            var mouth = path[path.Count - 1];
            map.MouthX = mouth.x;
            map.MouthY = mouth.y;

            // 4. mangrove around the estuary
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int i = y * W + x;
                    byte t = map.Terrain[i];
                    if (t != (byte)TerrainType.Plain && t != (byte)TerrainType.Beach) continue;
                    double dm = Math.Sqrt((x - mouth.x) * (double)(x - mouth.x) + (y - mouth.y) * (double)(y - mouth.y));
                    bool low = map.Elevation[i] < MapData.SeaLevel + 20;
                    if (low && dm < 7 + Noise.Fbm(x / 4.0, y / 4.0, seed + 77, 2) * 4) map.Terrain[i] = (byte)TerrainType.Mangrove;
                }

            // 5. fertility from distance to the river (alluvium)
            var riverDist = map.DistanceField(t => t == (byte)TerrainType.River);
            for (int i = 0; i < elev.Length; i++)
            {
                byte t = map.Terrain[i];
                if (TerrainTypes.IsWater(t)) continue;
                double near = Math.Exp(-riverDist[i] / 7.0);
                double flat = t == (byte)TerrainType.Plain ? 1 : t == (byte)TerrainType.Hill ? 0.35 : t == (byte)TerrainType.Mountain ? 0.05 : 0.5;
                int x = i % W, y = i / W;
                map.Fertility[i] = ToByte(Noise.Clamp((0.25 + 0.75 * near) * flat * (0.7 + 0.5 * Noise.Fbm(x / 7.0, y / 7.0, seed + 99, 2)), 0, 1));
            }

            // 6. tin: foothills and the alluvial valley at their feet (the Kinta / Larut pattern)
            var hillDist = map.DistanceField(t => t == (byte)TerrainType.Hill || t == (byte)TerrainType.Mountain);
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int i = y * W + x;
                    byte t = map.Terrain[i];
                    bool eligible = (t == (byte)TerrainType.Hill && map.Elevation[i] < 192) || (t == (byte)TerrainType.Plain && hillDist[i] <= 3);
                    if (!eligible) continue;
                    double v = Noise.Fbm(x / 6.0, y / 6.0, seed + 131, 3);
                    if (v > 0.52) map.Tin[i] = ToByte(Noise.Clamp((v - 0.52) * 4.5, 0.15, 1));
                }

            // 7. rainforest on undeveloped plains
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    int i = y * W + x;
                    if (map.Terrain[i] != (byte)TerrainType.Plain) continue;
                    double moist = Noise.Fbm(x / 10.0, y / 10.0, seed + 201, 3);
                    bool nearRiver = riverDist[i] < 3;
                    if (moist > 0.47 && !nearRiver && map.Tin[i] == 0) map.Terrain[i] = (byte)TerrainType.Jungle;
                }
            return map;
        }

        static List<(int x, int y)> CarveRiver(MapData map, Rng rng)
        {
            int W = map.Width, H = map.Height;
            int sx = (int)Math.Floor(W * 0.8), sy = (int)Math.Floor(H * 0.5);
            int best = -1;
            for (int k = 0; k < 60; k++)
            {
                int x = rng.Int((int)Math.Floor(W * 0.68), W - 3);
                int y = rng.Int((int)Math.Floor(H * 0.3), (int)Math.Floor(H * 0.7));
                int e = map.Elevation[y * W + x];
                if (e > best) { best = e; sx = x; sy = y; }
            }
            var path = new List<(int x, int y)>();
            var visited = new bool[W * H];
            int cx0 = sx, cy0 = sy;
            double drift = 0;
            for (int step = 0; step < W * 6; step++)
            {
                path.Add((cx0, cy0));
                visited[cy0 * W + cx0] = true;
                if (TerrainTypes.IsSea(map.Terrain[cy0 * W + cx0])) break;
                drift += rng.Range(-0.3, 0.3);
                if (rng.Chance(0.04)) drift = -drift;
                drift = Noise.Clamp(drift, -1, 1);
                double bestScore = double.PositiveInfinity;
                int nx = cx0 - 1, ny = cy0;
                for (int k = 0; k < 4; k++)
                {
                    int cx = cx0 + DX[k], cy = cy0 + DY[k];
                    if (!map.InBounds(cx, cy) || visited[cy * W + cx]) continue;
                    int e = map.Elevation[cy * W + cx];
                    double score = e * 1.2 + DX[k] * 9 - DY[k] * drift * 12 + rng.Range(0, 7) + (cy < 2 || cy > H - 3 ? 200 : 0);
                    if (score < bestScore) { bestScore = score; nx = cx; ny = cy; }
                }
                if (!map.InBounds(nx, ny)) break;
                cx0 = nx;
                cy0 = ny;
            }
            int ly = path[path.Count - 1].y;
            int lx = path[path.Count - 1].x;
            while (!TerrainTypes.IsSea(map.Terrain[ly * W + lx]) && lx > 0)
            {
                lx -= 1;
                path.Add((lx, ly));
            }
            int total = path.Count;
            for (int idx = 0; idx < total; idx++)
            {
                var (px, py) = path[idx];
                int i = py * W + px;
                if (TerrainTypes.IsSea(map.Terrain[i])) continue;
                map.Terrain[i] = (byte)TerrainType.River;
                map.Elevation[i] = (byte)Math.Min(map.Elevation[i], Math.Max(MapData.SeaLevel + 2, map.Elevation[i] - 12));
                if (idx > total * 0.72)
                {
                    int nyy = py + 1;
                    if (map.InBounds(px, nyy) && !TerrainTypes.IsSea(map.Terrain[nyy * W + px])) map.Terrain[nyy * W + px] = (byte)TerrainType.River;
                }
            }
            return path;
        }
    }
}
