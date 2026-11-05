using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    public enum TransportType : byte { None = 0, Road = 1, Rail = 2, Highway = 3, Mrt = 4 }
    public enum ZoneType : byte { None = 0, Residential = 1, Commercial = 2, Industrial = 3 }

    /// <summary>Why a placement was refused (mirrors the web game's err.* reasons).</summary>
    public enum PlacementResult
    {
        Ok, OutOfBounds, Occupied, Terrain, Locked, Unique, Money, NeedCoast, NeedWater, NeedRiver, NeedTin, NeedFertile, NeedForest, NeedRail, Nothing,
    }

    [Serializable]
    public class PlacedBuilding
    {
        public int id;
        public int defIndex;
        public int x, y;
        /// <summary>Footprint edge in cells (1, 2 or 4).</summary>
        public int cells;
        /// <summary>Quarter turns (0..3) of the visual, chosen to face roads or water.</summary>
        public int rotation;
        public int builtTick;
        public double efficiency = 1;
    }

    /// <summary>
    /// Everything placed on the grid: buildings, roads/rails, zones and lot development.
    /// Cell layers are flat arrays (index = y * width + x).
    /// </summary>
    public sealed class CityState
    {
        public const double ZoneCost = 5;
        public const double ClearJungleCost = 15;

        public readonly MapData Map;
        public readonly GridSpec Grid;
        public readonly int[] BuildingAt;
        public readonly byte[] Transport;
        public readonly byte[] Zone;
        public readonly byte[] Density;
        /// <summary>Era (1..4) in which a lot last developed; drives its architecture.</summary>
        public readonly byte[] Style;
        /// <summary>1 when a cell is within reach of the transport network.</summary>
        public readonly byte[] Access;
        public readonly byte[] Coverage, Pollution, LandValue, WaterDistance;
        public readonly TransportModel Network;
        public readonly List<PlacedBuilding> Buildings = new List<PlacedBuilding>(256);
        public int NextId = 1;
        /// <summary>Incremented on every change so views know to refresh.</summary>
        public int Version;

        static readonly int[] DX = { 1, -1, 0, 0 };
        static readonly int[] DY = { 0, 0, 1, -1 };

        public CityState(MapData map, float cellSize = 4f, GameDatabase database = null)
        {
            Map = map;
            Grid = new GridSpec(map.Width, map.Height, cellSize);
            int n = map.Width * map.Height;
            BuildingAt = new int[n];
            for (int i = 0; i < n; i++) BuildingAt[i] = -1;
            Transport = new byte[n];
            Zone = new byte[n];
            Density = new byte[n];
            Style = new byte[n];
            Access = new byte[n];
            Coverage = new byte[n]; Pollution = new byte[n]; LandValue = new byte[n]; WaterDistance = new byte[n];
            Network = new TransportModel(n, database);
            RecomputeAccess();
        }

        public PlacedBuilding FindBuilding(int id)
        {
            for (int i = 0; i < Buildings.Count; i++) if (Buildings[i].id == id) return Buildings[i];
            return null;
        }

        public bool HasBuilding(int defIndex)
        {
            for (int i = 0; i < Buildings.Count; i++) if (Buildings[i].defIndex == defIndex) return true;
            return false;
        }

        // ------------------------------------------------------------ buildings

        /// <summary>Port of checkBuilding: terrain, adjacency and resource rules plus cost.</summary>
        public PlacementResult CanPlace(BuildingRecord def, int defIndex, int x, int y, bool unlocked, double money, double constructionMult, out double cost)
        {
            cost = 0;
            if (!unlocked) return PlacementResult.Locked;
            if (def.landmark && HasBuilding(defIndex)) return PlacementResult.Unique;
            int s = Grid.FootprintCells(def.footprintMeters);
            int jungle = 0;
            bool coastal = false, riverside = false, forest = false, rail = false;
            double tin = 0, fert = 0;
            for (int dy = 0; dy < s; dy++)
                for (int dx = 0; dx < s; dx++)
                {
                    int tx = x + dx, ty = y + dy;
                    if (!Grid.InBounds(tx, ty)) return PlacementResult.OutOfBounds;
                    int i = ty * Grid.Width + tx;
                    byte t = Map.Terrain[i];
                    if (TerrainTypes.IsWater(t) || t == (byte)TerrainType.Mountain) return PlacementResult.Terrain;
                    if (BuildingAt[i] != -1 || Transport[i] != 0) return PlacementResult.Occupied;
                    if (t == (byte)TerrainType.Jungle) { jungle++; forest = true; }
                    if (Map.IsCoastal(tx, ty)) coastal = true;
                    if (Map.IsRiverside(tx, ty)) riverside = true;
                    tin += Map.Tin[i];
                    fert += t == (byte)TerrainType.Hill ? 0 : Map.Fertility[i];
                    for (int k = 0; k < 4; k++)
                    {
                        int nx = tx + DX[k], ny = ty + DY[k];
                        if (!Grid.InBounds(nx, ny)) continue;
                        int j = ny * Grid.Width + nx;
                        if (Map.Terrain[j] == (byte)TerrainType.Jungle) forest = true;
                        if (Transport[j] == (byte)TransportType.Rail) rail = true;
                    }
                }
            double area = s * s;
            switch (def.placement)
            {
                case "coast": if (!coastal) return PlacementResult.NeedCoast; break;
                case "water": if (!coastal && !riverside) return PlacementResult.NeedWater; break;
                case "river": if (!riverside) return PlacementResult.NeedRiver; break;
                case "tin": if (tin / area < 40) return PlacementResult.NeedTin; break;
                case "fertile": if (fert / area < 105) return PlacementResult.NeedFertile; break;
                case "forest": if (!forest) return PlacementResult.NeedForest; break;
                case "rail": if (!rail) return PlacementResult.NeedRail; break;
            }
            cost = Math.Round(def.cost * constructionMult + (def.placement == "forest" ? 0 : jungle * ClearJungleCost));
            if (money < cost) return PlacementResult.Money;
            return PlacementResult.Ok;
        }

        public PlacedBuilding Place(BuildingRecord def, int defIndex, int x, int y, int tick)
        {
            int s = Grid.FootprintCells(def.footprintMeters);
            var b = new PlacedBuilding { id = NextId++, defIndex = defIndex, x = x, y = y, cells = s, builtTick = tick };
            for (int dy = 0; dy < s; dy++)
                for (int dx = 0; dx < s; dx++)
                {
                    int i = (y + dy) * Grid.Width + x + dx;
                    BuildingAt[i] = b.id;
                    Zone[i] = 0;
                    Density[i] = 0;
                    if (Map.Terrain[i] == (byte)TerrainType.Jungle && def.placement != "forest") Map.Terrain[i] = (byte)TerrainType.Plain;
                }
            b.rotation = FacingFor(def.placement, x, y, s);
            Buildings.Add(b);
            Version++;
            RecomputeAccess();
            return b;
        }

        /// <summary>Restore a building from a save without cost checks.</summary>
        public PlacedBuilding Restore(int id, int defIndex, int x, int y, int cells, int rotation, int builtTick)
        {
            var b = new PlacedBuilding { id = id, defIndex = defIndex, x = x, y = y, cells = cells, rotation = rotation, builtTick = builtTick };
            for (int dy = 0; dy < cells; dy++)
                for (int dx = 0; dx < cells; dx++)
                    if (Grid.InBounds(x + dx, y + dy)) BuildingAt[(y + dy) * Grid.Width + x + dx] = id;
            Buildings.Add(b);
            NextId = Math.Max(NextId, id + 1);
            Version++;
            return b;
        }

        /// <summary>Quarter turn so the front faces water (waterside buildings) or an adjacent road.</summary>
        public int FacingFor(string placement, int x, int y, int s)
        {
            bool wantsWater = placement == "coast" || placement == "water" || placement == "river";
            // check the four sides: +y (south) = 0, +x = 1, -y = 2, -x = 3
            for (int side = 0; side < 4; side++)
            {
                for (int k = 0; k < s; k++)
                {
                    int cx, cy;
                    switch (side)
                    {
                        case 0: cx = x + k; cy = y + s; break;
                        case 1: cx = x + s; cy = y + k; break;
                        case 2: cx = x + k; cy = y - 1; break;
                        default: cx = x - 1; cy = y + k; break;
                    }
                    if (!Grid.InBounds(cx, cy)) continue;
                    int i = cy * Grid.Width + cx;
                    if (wantsWater ? TerrainTypes.IsWater(Map.Terrain[i]) : Transport[i] != 0) return side;
                }
            }
            return 0;
        }

        // ------------------------------------------------------------ transport and zones

        /// <summary>Port of transportTileCost: -1 when the tile cannot carry this transport.</summary>
        public double TransportTileCost(TransportRecord def, int x, int y, double constructionMult)
        {
            if (!Grid.InBounds(x, y)) return -1;
            int i = y * Grid.Width + x;
            byte t = Map.Terrain[i];
            if (TerrainTypes.IsSea(t) || BuildingAt[i] != -1) return -1;
            if (Transport[i] == def.id) return 0;
            double c = def.cost;
            if (t == (byte)TerrainType.River) c *= 3;
            if (t == (byte)TerrainType.Mountain) c *= 3;
            if (t == (byte)TerrainType.Hill) c *= 1.4;
            if (t == (byte)TerrainType.Jungle) c += ClearJungleCost;
            return Math.Round(c * constructionMult);
        }

        public double PathCost(TransportRecord def, List<(int x, int y)> path, double constructionMult)
        {
            double total = 0;
            for (int k = 0; k < path.Count; k++)
            {
                double c = TransportTileCost(def, path[k].x, path[k].y, constructionMult);
                if (c > 0) total += c;
            }
            return total;
        }

        /// <summary>Lay transport along a path; returns tiles changed (cost is charged by the caller).</summary>
        public int BuildTransport(TransportRecord def, List<(int x, int y)> path, double constructionMult)
        {
            int changed = 0;
            for (int k = 0; k < path.Count; k++)
            {
                var (x, y) = path[k];
                if (TransportTileCost(def, x, y, constructionMult) <= 0) continue;
                int i = y * Grid.Width + x;
                Transport[i] = (byte)def.id;
                Zone[i] = 0;
                Density[i] = 0;
                if (Map.Terrain[i] == (byte)TerrainType.Jungle) Map.Terrain[i] = (byte)TerrainType.Plain;
                changed++;
            }
            if (changed > 0)
            {
                Version++;
                RecomputeAccess();
            }
            return changed;
        }

        public bool CanZone(int x, int y, ZoneType zone)
        {
            if (!Grid.InBounds(x, y)) return false;
            int i = y * Grid.Width + x;
            byte t = Map.Terrain[i];
            if (TerrainTypes.IsWater(t) || t == (byte)TerrainType.Mountain) return false;
            if (BuildingAt[i] != -1 || Transport[i] != 0) return false;
            return Zone[i] != (byte)zone;
        }

        public double ZoneCostFor(List<(int x, int y)> cells, ZoneType zone, double constructionMult)
        {
            double total = 0;
            for (int k = 0; k < cells.Count; k++)
            {
                var (x, y) = cells[k];
                if (!CanZone(x, y, zone)) continue;
                total += ZoneCost + (Map.Terrain[y * Grid.Width + x] == (byte)TerrainType.Jungle ? ClearJungleCost : 0);
            }
            return Math.Round(total * constructionMult);
        }

        public int ApplyZone(List<(int x, int y)> cells, ZoneType zone)
        {
            int n = 0;
            for (int k = 0; k < cells.Count; k++)
            {
                var (x, y) = cells[k];
                if (!CanZone(x, y, zone)) continue;
                int i = y * Grid.Width + x;
                Zone[i] = (byte)zone;
                Density[i] = 0;
                if (Map.Terrain[i] == (byte)TerrainType.Jungle) Map.Terrain[i] = (byte)TerrainType.Plain;
                n++;
            }
            if (n > 0) Version++;
            return n;
        }

        /// <summary>Port of bulldoze. Removes buildings, transport, zones or clears rainforest; returns the cost.</summary>
        public double Bulldoze(List<(int x, int y)> cells, BuildingRecord[] defs, List<PlacedBuilding> removed)
        {
            removed.Clear();
            double total = 0;
            for (int k = 0; k < cells.Count; k++)
            {
                var (x, y) = cells[k];
                if (!Grid.InBounds(x, y)) continue;
                int i = y * Grid.Width + x;
                if (BuildingAt[i] != -1)
                {
                    var b = FindBuilding(BuildingAt[i]);
                    if (b != null && !removed.Contains(b)) removed.Add(b);
                    continue;
                }
                if (Transport[i] != 0) { total += 2; Transport[i] = 0; }
                else if (Zone[i] != 0) { total += 1; Zone[i] = 0; Density[i] = 0; }
                else if (Map.Terrain[i] == (byte)TerrainType.Jungle) { total += ClearJungleCost; Map.Terrain[i] = (byte)TerrainType.Plain; }
            }
            foreach (var b in removed)
            {
                total += Math.Round(defs[b.defIndex].cost * 0.05);
                Buildings.Remove(b);
                for (int dy = 0; dy < b.cells; dy++)
                    for (int dx = 0; dx < b.cells; dx++)
                    {
                        int i = (b.y + dy) * Grid.Width + b.x + dx;
                        if (Grid.InBounds(b.x + dx, b.y + dy) && BuildingAt[i] == b.id) BuildingAt[i] = -1;
                    }
            }
            Version++;
            RecomputeAccess();
            return total;
        }

        // ------------------------------------------------------------ access

        /// <summary>Chebyshev distance to road-like nodes; water has a radius of one.</summary>
        public const int AccessRange = 3;

        /// <summary>Refresh multimodal delivery costs and zone access after a network change.</summary>
        public void RecomputeAccess()
        {
            Network.Rebuild(this);
        }

        /// <summary>True if any cell of a footprint is served by the network.</summary>
        public bool HasAccess(int x, int y, int cells)
        {
            for (int dy = 0; dy < cells; dy++)
                for (int dx = 0; dx < cells; dx++)
                    if (Grid.InBounds(x + dx, y + dy) && Access[(y + dy) * Grid.Width + x + dx] != 0) return true;
            return false;
        }
    }
}
