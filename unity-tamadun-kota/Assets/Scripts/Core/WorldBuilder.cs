using System.Collections.Generic;
using TamadunKota.Simulation;
using UnityEngine;

namespace TamadunKota.Core
{
    /// <summary>
    /// Builds the Unity Terrain (heights, painted layers, trees) and the sea from the
    /// simulation's MapData. 1 unit = 1 metre; each map tile is one 4 m grid cell, so the
    /// default 128-tile map is 512 x 512 m. Sea level is y = 0.
    /// </summary>
    public class WorldBuilder : MonoBehaviour
    {
        public const float BaseDepth = 12f;
        public const float HeightRange = 60f;

        public Terrain terrain;
        public Transform water;
        public Material waterMaterial;
        [Tooltip("Prefabs named tree_rainforest, tree_mangrove, tree_coconut ...")]
        public GameObject[] treePrefabs = new GameObject[0];
        [Range(0, 2)] public int treesPerJungleTile = 1;

        MapData map;
        GridSpec grid;
        int terrainSignature;
        float nextTreeCheck;
        bool runtimeCopy;

        void OnEnable()
        {
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged += Rebuild;
        }

        void OnDisable()
        {
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged -= Rebuild;
        }

        void Start()
        {
            if (GameRoot.Instance != null && GameRoot.Instance.Sim != null) Rebuild(GameRoot.Instance.Sim);
        }

        void Update()
        {
            // rainforest cleared by building, roads or zoning: refresh trees at most every 2 s
            if (map == null || Time.unscaledTime < nextTreeCheck) return;
            nextTreeCheck = Time.unscaledTime + 2f;
            int sig = Signature(map.Terrain);
            if (sig != terrainSignature) RebuildTrees();
        }

        static int Signature(byte[] t)
        {
            unchecked
            {
                int h = 17;
                for (int i = 0; i < t.Length; i++) h = h * 31 + t[i];
                return h;
            }
        }

        /// <summary>Terrain height in metres above sea level at the centre of a tile.</summary>
        public static float TileHeight(byte terrainType, byte elevation)
        {
            float e = elevation;
            switch ((TerrainType)terrainType)
            {
                case TerrainType.Deep: return -9f;
                case TerrainType.Sea: return -6f;
                case TerrainType.Shallow: return -2.5f;
                case TerrainType.River: return -2f;
                case TerrainType.Beach: return 0.5f;
                case TerrainType.Mangrove: return 0.3f;
                case TerrainType.Hill: return 5f + Mathf.Clamp01((e - 162f) / 43f) * 8f;
                case TerrainType.Mountain: return 14f + Mathf.Clamp01((e - 205f) / 50f) * 30f;
                default: return 0.8f + Mathf.Clamp01((e - MapData.SeaLevel) / 85f) * 3f;
            }
        }

        public void Rebuild(GameSimulation sim)
        {
            map = sim.Map;
            grid = sim.City.Grid;
            if (terrain == null) terrain = GetComponentInChildren<Terrain>();
            if (terrain == null)
            {
                var go = Terrain.CreateTerrainGameObject(new TerrainData());
                go.name = "Terrain";
                go.transform.SetParent(transform, false);
                terrain = go.GetComponent<Terrain>();
            }
            if (!runtimeCopy && Application.isPlaying && terrain.terrainData != null)
            {
                // work on a copy so Play mode never rewrites the TerrainData asset saved with the scene
                terrain.terrainData = Instantiate(terrain.terrainData);
                var tc = terrain.GetComponent<TerrainCollider>();
                if (tc != null) tc.terrainData = terrain.terrainData;
                runtimeCopy = true;
            }
            int ground = LayerMask.NameToLayer("Ground");
            if (ground >= 0) terrain.gameObject.layer = ground;
            BuildHeights();
            BuildLayers();
            RebuildTrees();
            BuildWater();
        }

        void BuildHeights()
        {
            var data = terrain.terrainData;
            int res = 513;
            data.heightmapResolution = res;
            data.size = new Vector3(grid.WorldWidth, HeightRange, grid.WorldDepth);
            terrain.transform.position = new Vector3(0, -BaseDepth, 0);
            var tileH = new float[map.Width * map.Height];
            for (int i = 0; i < tileH.Length; i++) tileH[i] = TileHeight(map.Terrain[i], map.Elevation[i]);
            var heights = new float[res, res];
            for (int z = 0; z < res; z++)
                for (int x = 0; x < res; x++)
                {
                    // sample tile centres bilinearly so plateaus meet with short slopes
                    float tx = x / (float)(res - 1) * map.Width - 0.5f;
                    float tz = z / (float)(res - 1) * map.Height - 0.5f;
                    int x0 = Mathf.Clamp(Mathf.FloorToInt(tx), 0, map.Width - 1), z0 = Mathf.Clamp(Mathf.FloorToInt(tz), 0, map.Height - 1);
                    int x1 = Mathf.Min(map.Width - 1, x0 + 1), z1 = Mathf.Min(map.Height - 1, z0 + 1);
                    float fx = Mathf.Clamp01(tx - x0), fz = Mathf.Clamp01(tz - z0);
                    // flatten the inner part of each tile so 4 m building lots stay level
                    fx = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(0.3f, 0.7f, fx));
                    fz = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(0.3f, 0.7f, fz));
                    float h = Mathf.Lerp(Mathf.Lerp(tileH[z0 * map.Width + x0], tileH[z0 * map.Width + x1], fx), Mathf.Lerp(tileH[z1 * map.Width + x0], tileH[z1 * map.Width + x1], fx), fz);
                    heights[z, x] = Mathf.Clamp01((h + BaseDepth) / HeightRange);
                }
            data.SetHeights(0, 0, heights);
            var col = terrain.GetComponent<TerrainCollider>();
            if (col != null) col.terrainData = data;
        }

        static Texture2D Solid(Color c)
        {
            var t = new Texture2D(4, 4, TextureFormat.RGBA32, false);
            var px = new Color32[16];
            for (int i = 0; i < px.Length; i++) px[i] = c;
            t.SetPixels32(px);
            t.Apply();
            return t;
        }

        static TerrainLayer Layer(string name, Color c)
        {
            return new TerrainLayer { name = name, diffuseTexture = Solid(c), tileSize = new Vector2(8, 8), smoothness = 0.05f };
        }

        void BuildLayers()
        {
            var data = terrain.terrainData;
            data.terrainLayers = new[]
            {
                Layer("Sand", new Color(0.86f, 0.79f, 0.58f)),
                Layer("Grass", new Color(0.41f, 0.62f, 0.30f)),
                Layer("Rainforest", new Color(0.18f, 0.40f, 0.20f)),
                Layer("Rock", new Color(0.52f, 0.50f, 0.44f)),
                Layer("Mud", new Color(0.42f, 0.38f, 0.27f)),
            };
            int res = 256;
            data.alphamapResolution = res;
            var alpha = new float[res, res, 5];
            for (int z = 0; z < res; z++)
                for (int x = 0; x < res; x++)
                {
                    int tx = Mathf.Min(map.Width - 1, x * map.Width / res);
                    int tz = Mathf.Min(map.Height - 1, z * map.Height / res);
                    int i = tz * map.Width + tx;
                    int layer;
                    switch ((TerrainType)map.Terrain[i])
                    {
                        case TerrainType.Beach:
                        case TerrainType.Shallow:
                        case TerrainType.Sea:
                        case TerrainType.Deep: layer = 0; break;
                        case TerrainType.Jungle: layer = 2; break;
                        case TerrainType.Hill:
                        case TerrainType.Mountain: layer = 3; break;
                        case TerrainType.Mangrove:
                        case TerrainType.River: layer = 4; break;
                        default: layer = 1; break;
                    }
                    alpha[z, x, layer] = 1f;
                }
            data.SetAlphamaps(0, 0, alpha);
        }

        GameObject TreePrefab(string name)
        {
            foreach (var p in treePrefabs) if (p != null && p.name == name) return p;
            return null;
        }

        public void RebuildTrees()
        {
            if (map == null || terrain == null) return;
            terrainSignature = Signature(map.Terrain);
            var data = terrain.terrainData;
            string[] names = { "tree_rainforest", "tree_mangrove", "tree_coconut", "tree_rainforest_small" };
            var protos = new List<TreePrototype>();
            var protoIndex = new int[names.Length];
            for (int k = 0; k < names.Length; k++)
            {
                var p = TreePrefab(names[k]);
                protoIndex[k] = -1;
                if (p == null) continue;
                protoIndex[k] = protos.Count;
                protos.Add(new TreePrototype { prefab = p });
            }
            data.treePrototypes = protos.ToArray();
            if (protos.Count == 0)
            {
                data.treeInstances = new TreeInstance[0];
                return;
            }
            var trees = new List<TreeInstance>(8192);
            for (int y = 0; y < map.Height; y++)
                for (int x = 0; x < map.Width; x++)
                {
                    var t = (TerrainType)map.Terrain[y * map.Width + x];
                    double r1 = Rng.Hash2(x, y, 31), r2 = Rng.Hash2(x, y, 32);
                    int kind = -1, count = 0;
                    if (t == TerrainType.Jungle) { kind = 0; count = treesPerJungleTile + (r2 > 0.5 ? 1 : 0); }
                    else if (t == TerrainType.Mangrove) { kind = 1; count = 2; }
                    else if (t == TerrainType.Beach && r1 < 0.35) { kind = 2; count = 1; }
                    else if (t == TerrainType.Hill && r1 < 0.5) { kind = 3; count = 1; }
                    if (kind < 0 || protoIndex[kind] < 0) continue;
                    for (int c = 0; c < count; c++)
                    {
                        float jx = (float)Rng.Hash2(x, y, 40 + c), jz = (float)Rng.Hash2(x, y, 50 + c);
                        float nx = (x + 0.15f + 0.7f * jx) / map.Width, nz = (y + 0.15f + 0.7f * jz) / map.Height;
                        float s = 0.8f + 0.5f * (float)r1;
                        trees.Add(new TreeInstance
                        {
                            position = new Vector3(nx, data.GetInterpolatedHeight(nx, nz) / data.size.y, nz),
                            prototypeIndex = protoIndex[kind],
                            widthScale = s,
                            heightScale = s * (0.9f + 0.3f * (float)r2),
                            rotation = (float)(r2 * Mathf.PI * 2),
                            color = Color.white,
                            lightmapColor = Color.white,
                        });
                    }
                }
            data.treeInstances = trees.ToArray();
            terrain.Flush();
        }

        void BuildWater()
        {
            if (water == null)
            {
                var go = GameObject.CreatePrimitive(PrimitiveType.Plane);
                go.name = "Straits of Melaka (Water)";
                go.transform.SetParent(transform, false);
                var col = go.GetComponent<Collider>();
                if (col != null) Destroy(col);
                int wl = LayerMask.NameToLayer("Water");
                if (wl >= 0) go.layer = wl;
                water = go.transform;
            }
            // Unity's plane is 10 x 10 m; cover the map plus a generous margin of open sea
            float margin = 600f;
            water.position = new Vector3(grid.WorldWidth * 0.5f, 0f, grid.WorldDepth * 0.5f);
            water.localScale = new Vector3((grid.WorldWidth + margin * 2) / 10f, 1f, (grid.WorldDepth + margin * 2) / 10f);
            var r = water.GetComponent<Renderer>();
            if (r != null && waterMaterial != null) r.sharedMaterial = waterMaterial;
        }

        /// <summary>Ground height (world y) at a world position, never below sea level for placement.</summary>
        public float GroundHeight(float worldX, float worldZ)
        {
            if (terrain == null) return 0f;
            float h = terrain.SampleHeight(new Vector3(worldX, 0, worldZ)) + terrain.transform.position.y;
            return Mathf.Max(0f, h);
        }

        /// <summary>Highest ground under a footprint, so buildings never sink into slopes.</summary>
        public float FootprintHeight(int cellX, int cellY, int cells)
        {
            float best = 0;
            for (int dy = 0; dy <= cells; dy++)
                for (int dx = 0; dx <= cells; dx++)
                    best = Mathf.Max(best, GroundHeight((cellX + dx) * grid.CellSize, (cellY + dy) * grid.CellSize));
            return best;
        }
    }
}
