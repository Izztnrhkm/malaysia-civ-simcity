using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    /// <summary>
    /// The world grid: 1 Unity unit = 1 metre. Each cell is <see cref="CellSize"/> metres
    /// (4 m by default, the footprint of a small building); medium buildings cover 8 x 8 m
    /// (2 x 2 cells) and landmarks 16 x 16 m (4 x 4 cells). Cell (0,0) starts at the origin,
    /// x grows east and y (world z) grows south, matching the web game's tile layout.
    /// </summary>
    public readonly struct GridSpec
    {
        public readonly int Width;
        public readonly int Height;
        public readonly float CellSize;

        public GridSpec(int width, int height, float cellSize = 4f)
        {
            if (width <= 0 || height <= 0) throw new ArgumentOutOfRangeException(nameof(width));
            if (cellSize <= 0) throw new ArgumentOutOfRangeException(nameof(cellSize));
            Width = width;
            Height = height;
            CellSize = cellSize;
        }

        public float WorldWidth => Width * CellSize;
        public float WorldDepth => Height * CellSize;
        public int CellCount => Width * Height;

        public bool InBounds(int x, int y) => x >= 0 && y >= 0 && x < Width && y < Height;
        public int Index(int x, int y) => y * Width + x;

        /// <summary>World X/Z (metres) to the containing cell. Points outside give out-of-bounds cells.</summary>
        public void WorldToCell(float worldX, float worldZ, out int x, out int y)
        {
            x = (int)Math.Floor(worldX / CellSize);
            y = (int)Math.Floor(worldZ / CellSize);
        }

        /// <summary>World X/Z of a cell's centre.</summary>
        public void CellCenter(int x, int y, out float worldX, out float worldZ)
        {
            worldX = (x + 0.5f) * CellSize;
            worldZ = (y + 0.5f) * CellSize;
        }

        /// <summary>World X/Z of the centre of a square footprint whose top-left cell is (x, y).</summary>
        public void FootprintCenter(int x, int y, int cells, out float worldX, out float worldZ)
        {
            worldX = (x + cells * 0.5f) * CellSize;
            worldZ = (y + cells * 0.5f) * CellSize;
        }

        /// <summary>Cells covered by a footprint in metres (4 m -> 1, 8 m -> 2, 16 m -> 4).</summary>
        public int FootprintCells(int meters) => Math.Max(1, (int)Math.Round(meters / CellSize));

        /// <summary>Top-left cell of a footprint centred under the cursor cell.</summary>
        public void FootprintOrigin(int cursorX, int cursorY, int cells, out int x, out int y)
        {
            int o = (cells - 1) / 2;
            x = cursorX - o;
            y = cursorY - o;
        }
    }

    public static class GridPaths
    {
        /// <summary>
        /// L-shaped road/rail path between two cells: horizontal first, then vertical (the
        /// web game's linePath rule). Results go into <paramref name="cells"/> (cleared first)
        /// so dragging does not allocate.
        /// </summary>
        public static void LinePath(int x0, int y0, int x1, int y1, List<(int x, int y)> cells)
        {
            cells.Clear();
            int sx = Math.Sign(x1 - x0), sy = Math.Sign(y1 - y0);
            int x = x0, y = y0;
            cells.Add((x, y));
            while (x != x1) { x += sx; cells.Add((x, y)); }
            while (y != y1) { y += sy; cells.Add((x, y)); }
        }

        /// <summary>All cells of the rectangle spanned by two corners (inclusive).</summary>
        public static void Rect(int x0, int y0, int x1, int y1, List<(int x, int y)> cells)
        {
            cells.Clear();
            for (int y = Math.Min(y0, y1); y <= Math.Max(y0, y1); y++)
                for (int x = Math.Min(x0, x1); x <= Math.Max(x0, x1); x++) cells.Add((x, y));
        }
    }
}
