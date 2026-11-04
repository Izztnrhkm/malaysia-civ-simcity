using System;
using System.Collections.Generic;

namespace TamadunKota.Simulation
{
    /// <summary>
    /// A* over transport cells (roads, rails, MRT) or water cells (ships). All search buffers
    /// are allocated once per grid size, so repeated path queries do not allocate.
    /// </summary>
    public sealed class RoadGraph
    {
        readonly int width, height;
        readonly float[] g;
        readonly int[] parent;
        readonly int[] stamp;
        readonly int[] heap;
        readonly float[] heapKey;
        int heapCount, generation;
        static readonly int[] DX = { 1, -1, 0, 0 };
        static readonly int[] DY = { 0, 0, 1, -1 };

        public RoadGraph(int width, int height)
        {
            this.width = width;
            this.height = height;
            int n = width * height;
            g = new float[n];
            parent = new int[n];
            stamp = new int[n];
            heap = new int[n * 4];
            heapKey = new float[n * 4];
        }

        /// <summary>
        /// Find a path between two cells over cells accepted by <paramref name="walkable"/>.
        /// The path (start..goal, as cell indices) is written into <paramref name="path"/>.
        /// </summary>
        public bool FindPath(int start, int goal, Func<int, bool> walkable, List<int> path, int maxExpanded = 20000)
        {
            path.Clear();
            if (start < 0 || goal < 0 || start >= g.Length || goal >= g.Length) return false;
            if (!walkable(start) || !walkable(goal)) return false;
            generation++;
            heapCount = 0;
            Visit(start, 0, -1);
            Push(start, Heuristic(start, goal));
            int expanded = 0;
            while (heapCount > 0 && expanded++ < maxExpanded)
            {
                int cur = Pop();
                if (cur == goal)
                {
                    for (int c = goal; c != -1; c = parent[c]) path.Add(c);
                    path.Reverse();
                    return true;
                }
                int x = cur % width, y = cur / width;
                for (int k = 0; k < 4; k++)
                {
                    int nx = x + DX[k], ny = y + DY[k];
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    int nb = ny * width + nx;
                    if (!walkable(nb)) continue;
                    float ng = g[cur] + 1;
                    if (stamp[nb] == generation && g[nb] <= ng) continue;
                    Visit(nb, ng, cur);
                    Push(nb, ng + Heuristic(nb, goal));
                }
            }
            return false;
        }

        void Visit(int i, float cost, int from)
        {
            stamp[i] = generation;
            g[i] = cost;
            parent[i] = from;
        }

        float Heuristic(int a, int b) => Math.Abs(a % width - b % width) + Math.Abs(a / width - b / width);

        void Push(int item, float key)
        {
            if (heapCount >= heap.Length) return;
            int i = heapCount++;
            heap[i] = item;
            heapKey[i] = key;
            while (i > 0)
            {
                int p = (i - 1) >> 1;
                if (heapKey[p] <= heapKey[i]) break;
                Swap(i, p);
                i = p;
            }
        }

        int Pop()
        {
            int top = heap[0];
            heapCount--;
            heap[0] = heap[heapCount];
            heapKey[0] = heapKey[heapCount];
            int i = 0;
            while (true)
            {
                int l = i * 2 + 1, r = l + 1, m = i;
                if (l < heapCount && heapKey[l] < heapKey[m]) m = l;
                if (r < heapCount && heapKey[r] < heapKey[m]) m = r;
                if (m == i) break;
                Swap(i, m);
                i = m;
            }
            return top;
        }

        void Swap(int a, int b)
        {
            (heap[a], heap[b]) = (heap[b], heap[a]);
            (heapKey[a], heapKey[b]) = (heapKey[b], heapKey[a]);
        }
    }
}
