using System.Collections.Generic;
using TamadunKota.Data;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.Rendering;

namespace TamadunKota.Core
{
    /// <summary>
    /// Keeps GameObjects in step with the simulation: one BuildingView per placed building and
    /// per developed zoned lot, and one mesh per transport type (roads, rail, expressway, MRT)
    /// that samples the shared atlas. Syncs only when CityState.Version changes.
    /// </summary>
    public class CityView : MonoBehaviour
    {
        public WorldBuilder world;
        public BuildingCatalog catalog;
        [Tooltip("Material for transport meshes (normally the shared atlas material)")]
        public Material transportMaterial;

        readonly Dictionary<int, BuildingView> buildings = new Dictionary<int, BuildingView>();
        readonly Dictionary<int, BuildingView> lots = new Dictionary<int, BuildingView>();
        readonly Dictionary<int, int> lotKey = new Dictionary<int, int>();
        readonly List<int> scratch = new List<int>();
        readonly MeshFilter[] transportMeshes = new MeshFilter[5];
        int syncedVersion = -1;
        GameSimulation sim;
        Transform buildingRoot, lotRoot, transportRoot;

        public IEnumerable<BuildingView> AllViews()
        {
            foreach (var v in buildings.Values) yield return v;
            foreach (var v in lots.Values) yield return v;
        }

        void Awake()
        {
            buildingRoot = new GameObject("Buildings").transform;
            buildingRoot.SetParent(transform, false);
            lotRoot = new GameObject("Zoned Lots").transform;
            lotRoot.SetParent(transform, false);
            transportRoot = new GameObject("Transport").transform;
            transportRoot.SetParent(transform, false);
            if (catalog == null && GameRoot.Instance != null) catalog = GameRoot.Instance.catalog;
            if (transportMaterial == null && catalog != null) transportMaterial = catalog.atlasMaterial;
        }

        void OnEnable()
        {
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged += OnSimulationChanged;
        }

        void OnDisable()
        {
            if (GameRoot.Instance != null) GameRoot.Instance.SimulationChanged -= OnSimulationChanged;
        }

        void OnSimulationChanged(GameSimulation s)
        {
            Clear();
            sim = s;
            syncedVersion = -1;
        }

        void Clear()
        {
            foreach (var v in buildings.Values) if (v != null) Destroy(v.gameObject);
            foreach (var v in lots.Values) if (v != null) Destroy(v.gameObject);
            buildings.Clear();
            lots.Clear();
            lotKey.Clear();
        }

        void LateUpdate()
        {
            if (sim == null && GameRoot.Instance != null) sim = GameRoot.Instance.Sim;
            if (sim == null || sim.City.Version == syncedVersion) return;
            syncedVersion = sim.City.Version;
            Sync();
        }

        public void ForceSync()
        {
            syncedVersion = -1;
        }

        void Sync()
        {
            var city = sim.City;
            var grid = city.Grid;
            int era = sim.CurrentEra;

            // ---- buildings ----
            scratch.Clear();
            foreach (var id in buildings.Keys) if (city.FindBuilding(id) == null) scratch.Add(id);
            foreach (var id in scratch) { Destroy(buildings[id].gameObject); buildings.Remove(id); }
            foreach (var b in city.Buildings)
            {
                if (buildings.ContainsKey(b.id)) continue;
                var def = sim.Db.Buildings[b.defIndex];
                var data = catalog != null ? catalog.Find(def.id) : null;
                if (data == null) continue;
                grid.FootprintCenter(b.x, b.y, b.cells, out float wx, out float wz);
                float y = world != null ? world.FootprintHeight(b.x, b.y, b.cells) : 0f;
                var view = Spawn(data, buildingRoot, new Vector3(wx, y, wz), b.rotation * 90f, data.upgradable ? era : data.era);
                view.buildingId = b.id;
                view.name = def.id + "_" + b.id;
                buildings[b.id] = view;
            }

            // ---- developed zoned lots ----
            scratch.Clear();
            foreach (var kv in lots)
            {
                int i = kv.Key;
                if (city.Zone[i] == 0 || city.Density[i] == 0 || city.BuildingAt[i] >= 0 || lotKey[i] != LotKey(city, i)) scratch.Add(i);
            }
            foreach (var i in scratch) { Destroy(lots[i].gameObject); lots.Remove(i); lotKey.Remove(i); }
            for (int i = 0; i < city.Zone.Length; i++)
            {
                if (city.Zone[i] == 0 || city.Density[i] == 0 || city.BuildingAt[i] >= 0 || lots.ContainsKey(i)) continue;
                char z = city.Zone[i] == (byte)ZoneType.Residential ? 'R' : city.Zone[i] == (byte)ZoneType.Commercial ? 'C' : 'I';
                var data = catalog != null ? catalog.ZoneLot(z, city.Density[i]) : null;
                if (data == null) continue;
                int x = i % grid.Width, cy = i / grid.Width;
                grid.CellCenter(x, cy, out float wx, out float wz);
                float y = world != null ? world.FootprintHeight(x, cy, 1) : 0f;
                int style = city.Style[i] > 0 ? city.Style[i] : era;
                var view = Spawn(data, lotRoot, new Vector3(wx, y, wz), LotFacing(city, x, cy) * 90f, style);
                view.cellIndex = i;
                lots[i] = view;
                lotKey[i] = LotKey(city, i);
            }

            RebuildTransport(city, era);
        }

        static int LotKey(CityState c, int i) => c.Zone[i] | c.Density[i] << 4 | c.Style[i] << 8;

        static int LotFacing(CityState city, int x, int y)
        {
            var g = city.Grid;
            if (g.InBounds(x, y + 1) && city.Transport[(y + 1) * g.Width + x] != 0) return 0;
            if (g.InBounds(x + 1, y) && city.Transport[y * g.Width + x + 1] != 0) return 1;
            if (g.InBounds(x, y - 1) && city.Transport[(y - 1) * g.Width + x] != 0) return 2;
            if (g.InBounds(x - 1, y) && city.Transport[y * g.Width + x - 1] != 0) return 3;
            return (int)(Rng.Hash2(x, y, 5) * 4);
        }

        BuildingView Spawn(BuildingData data, Transform parent, Vector3 pos, float yaw, int era)
        {
            var go = new GameObject(data.id);
            go.transform.SetParent(parent, false);
            go.transform.SetPositionAndRotation(pos, Quaternion.Euler(0, yaw, 0));
            int layer = LayerMask.NameToLayer("Buildings");
            if (layer >= 0) go.layer = layer;
            var col = go.AddComponent<BoxCollider>();
            float m = data.FootprintMeters;
            col.size = new Vector3(m * 0.95f, 6f, m * 0.95f);
            col.center = new Vector3(0, 3f, 0);
            var view = go.AddComponent<BuildingView>();
            view.Init(data, era);
            return view;
        }

        // ------------------------------------------------------------ transport meshes

        void RebuildTransport(CityState city, int era)
        {
            for (int type = 1; type <= 4; type++)
            {
                var verts = new List<Vector3>();
                var uvs = new List<Vector2>();
                var tris = new List<int>();
                Vector2 uv = AtlasLayout.UV(type == 1 ? (era == 1 ? "dirt" : era == 2 ? "laterite" : "asphalt") : type == 2 ? "gravel" : "concrete");
                Vector2 uvTop = AtlasLayout.UV(type == 2 ? "steel" : type == 3 ? "asphalt" : "concrete_dark");
                var g = city.Grid;
                float cs = g.CellSize;
                for (int i = 0; i < city.Transport.Length; i++)
                {
                    if (city.Transport[i] != type) continue;
                    int x = i % g.Width, y = i / g.Width;
                    float ground = world != null ? world.GroundHeight((x + 0.5f) * cs, (y + 0.5f) * cs) : 0f;
                    bool water = TerrainTypes.IsWater(city.Map.Terrain[i]);
                    float deck = type == 3 ? 6f : type == 4 ? 9f : water ? 1.2f : 0.08f;
                    float h = ground + deck;
                    float inset = type == 1 ? (era <= 2 ? 0.7f : 0.4f) : type == 2 ? 0.9f : 0.1f;
                    AddBox(verts, uvs, tris, new Vector3(x * cs + inset, h - (deck > 1 ? 0.6f : 0.05f), y * cs + inset), new Vector3((x + 1) * cs - inset, h, (y + 1) * cs - inset), uv, uvTop, type != 2);
                    if (type == 2)
                        for (int k = -1; k <= 1; k += 2)
                        {
                            // two steel rails along the dominant direction
                            bool ew = (g.InBounds(x - 1, y) && city.Transport[i - 1] == 2) || (g.InBounds(x + 1, y) && city.Transport[i + 1] == 2);
                            Vector3 a = ew ? new Vector3(x * cs, h, (y + 0.5f) * cs + k * 0.72f) : new Vector3((x + 0.5f) * cs + k * 0.72f, h, y * cs);
                            Vector3 b = ew ? new Vector3((x + 1) * cs, h + 0.15f, (y + 0.5f) * cs + k * 0.72f + 0.12f) : new Vector3((x + 0.5f) * cs + k * 0.72f + 0.12f, h + 0.15f, (y + 1) * cs);
                            AddBox(verts, uvs, tris, a, b, uvTop, uvTop, true);
                        }
                    if (deck > 1f)
                        AddBox(verts, uvs, tris, new Vector3((x + 0.42f) * cs, ground - 1f, (y + 0.42f) * cs), new Vector3((x + 0.58f) * cs, h - 0.6f, (y + 0.58f) * cs), AtlasLayout.UV("concrete"), AtlasLayout.UV("concrete"), true);
                }
                var mf = transportMeshes[type];
                if (mf == null)
                {
                    var go = new GameObject(type == 1 ? "Roads" : type == 2 ? "Railway (KTMB)" : type == 3 ? "Expressway" : "MRT Guideway");
                    go.transform.SetParent(transportRoot, false);
                    int roads = LayerMask.NameToLayer("Roads");
                    if (roads >= 0) go.layer = roads;
                    mf = go.AddComponent<MeshFilter>();
                    var mr = go.AddComponent<MeshRenderer>();
                    mr.sharedMaterial = transportMaterial;
                    mf.sharedMesh = new Mesh { name = go.name, indexFormat = IndexFormat.UInt32 };
                    transportMeshes[type] = mf;
                }
                var mesh = mf.sharedMesh;
                mesh.Clear();
                mesh.SetVertices(verts);
                mesh.SetUVs(0, uvs);
                mesh.SetTriangles(tris, 0);
                mesh.RecalculateNormals();
                mesh.RecalculateBounds();
            }
        }

        static void AddBox(List<Vector3> v, List<Vector2> uv, List<int> t, Vector3 min, Vector3 max, Vector2 uvSide, Vector2 uvTop, bool sides)
        {
            Vector3[] c =
            {
                new Vector3(min.x, max.y, min.z), new Vector3(min.x, max.y, max.z), new Vector3(max.x, max.y, max.z), new Vector3(max.x, max.y, min.z),
                new Vector3(min.x, min.y, min.z), new Vector3(min.x, min.y, max.z), new Vector3(max.x, min.y, max.z), new Vector3(max.x, min.y, min.z),
            };
            Quad(v, uv, t, c[0], c[1], c[2], c[3], uvTop);
            if (!sides) return;
            Quad(v, uv, t, c[4], c[0], c[3], c[7], uvSide);
            Quad(v, uv, t, c[7], c[3], c[2], c[6], uvSide);
            Quad(v, uv, t, c[6], c[2], c[1], c[5], uvSide);
            Quad(v, uv, t, c[5], c[1], c[0], c[4], uvSide);
        }

        static void Quad(List<Vector3> v, List<Vector2> uv, List<int> t, Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector2 u)
        {
            int n = v.Count;
            v.Add(a);
            v.Add(b);
            v.Add(c);
            v.Add(d);
            uv.Add(u);
            uv.Add(u);
            uv.Add(u);
            uv.Add(u);
            t.Add(n);
            t.Add(n + 1);
            t.Add(n + 2);
            t.Add(n);
            t.Add(n + 2);
            t.Add(n + 3);
        }
    }
}
