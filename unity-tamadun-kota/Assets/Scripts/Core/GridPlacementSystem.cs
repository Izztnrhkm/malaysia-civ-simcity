using System;
using System.Collections.Generic;
using TamadunKota.Data;
using TamadunKota.Simulation;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;

namespace TamadunKota.Core
{
    public enum PlacementMode { Inspect, Building, Transport, Zone, Bulldoze }

    /// <summary>
    /// Mouse-to-grid placement on the 1 unit = 1 metre grid (4 m cells by default).
    /// Physics.Raycast against the terrain picks a cell; buildings show a translucent ghost
    /// (green = valid, red = invalid, using the simulation's placement rules); roads and rails
    /// drag along an L-shaped path; zones and bulldozing drag a rectangle.
    /// Left click/drag applies, right click or Esc cancels.
    /// </summary>
    public class GridPlacementSystem : MonoBehaviour
    {
        public Camera cam;
        public CityView cityView;
        public WorldBuilder world;
        public BuildingCatalog catalog;
        [Tooltip("Layers the cursor ray hits (Ground = terrain)")]
        public LayerMask groundMask = ~0;
        public Material ghostMaterial;
        public Color validColor = new Color(0.3f, 0.95f, 0.45f, 0.45f);
        public Color invalidColor = new Color(0.95f, 0.3f, 0.25f, 0.45f);
        public int maxPreviewTiles = 512;

        public PlacementMode Mode { get; private set; } = PlacementMode.Inspect;
        public BuildingData SelectedBuilding { get; private set; }
        public string SelectedTransport { get; private set; } = "road";
        public ZoneType SelectedZone { get; private set; } = ZoneType.Residential;

        /// <summary>Cell under the cursor (valid while HasHover).</summary>
        public int HoverX { get; private set; }
        public int HoverY { get; private set; }
        public bool HasHover { get; private set; }
        public string LastMessage { get; private set; } = "";

        public event Action<BuildingData> Placed;
        public event Action<string> Message;
        public event Action<int, int> CellInspected;

        GameObject ghost;
        BuildingData ghostData;
        Material ghostOk, ghostBad;
        readonly List<GameObject> tilePool = new List<GameObject>();
        readonly List<(int x, int y)> cells = new List<(int x, int y)>(512);
        readonly List<PlacedBuilding> removed = new List<PlacedBuilding>();
        bool dragging;
        int dragX, dragY;
        Vector2 rightDownPos;

        GameSimulation Sim => GameRoot.Instance != null ? GameRoot.Instance.Sim : null;

        void Awake()
        {
            if (cam == null) cam = Camera.main;
            if (catalog == null && GameRoot.Instance != null) catalog = GameRoot.Instance.catalog;
            if (ghostMaterial == null && catalog != null) ghostMaterial = catalog.ghostMaterial;
            ghostOk = MakeGhostMaterial(validColor);
            ghostBad = MakeGhostMaterial(invalidColor);
            int ground = LayerMask.NameToLayer("Ground");
            if (ground >= 0 && groundMask.value == ~0) groundMask = 1 << ground;
        }

        Material MakeGhostMaterial(Color c)
        {
            var m = ghostMaterial != null ? new Material(ghostMaterial) : new Material(Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Sprites/Default"));
            m.color = c;
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            return m;
        }

        // ------------------------------------------------------------ tool selection

        public void SelectBuilding(BuildingData data)
        {
            Cancel();
            if (data == null) return;
            Mode = PlacementMode.Building;
            SelectedBuilding = data;
        }

        public void SelectTransport(string key)
        {
            Cancel();
            Mode = PlacementMode.Transport;
            SelectedTransport = key;
        }

        public void SelectZone(ZoneType zone)
        {
            Cancel();
            Mode = PlacementMode.Zone;
            SelectedZone = zone;
        }

        public void SelectBulldoze()
        {
            Cancel();
            Mode = PlacementMode.Bulldoze;
        }

        public void Cancel()
        {
            Mode = PlacementMode.Inspect;
            SelectedBuilding = null;
            dragging = false;
            ClearGhost();
            HideTiles(0);
        }

        // ------------------------------------------------------------ input loop

        void Update()
        {
            var sim = Sim;
            var mouse = Mouse.current;
            var kb = Keyboard.current;
            if (sim == null || mouse == null || cam == null) return;
            if (kb != null && kb.escapeKey.wasPressedThisFrame) Cancel();
            if (mouse.rightButton.wasPressedThisFrame) rightDownPos = mouse.position.ReadValue();
            if (mouse.rightButton.wasReleasedThisFrame && (mouse.position.ReadValue() - rightDownPos).sqrMagnitude < 25 && Mode != PlacementMode.Inspect) Cancel();

            bool overUI = EventSystem.current != null && EventSystem.current.IsPointerOverGameObject();
            int cx = 0, cy = 0;
            HasHover = !overUI && Pick(mouse.position.ReadValue(), out cx, out cy);
            if (!HasHover)
            {
                if (!dragging) { ClearGhost(); HideTiles(0); }
                return;
            }
            HoverX = cx;
            HoverY = cy;

            switch (Mode)
            {
                case PlacementMode.Inspect:
                    if (mouse.leftButton.wasPressedThisFrame) CellInspected?.Invoke(cx, cy);
                    break;
                case PlacementMode.Building:
                    UpdateBuilding(sim, cx, cy, mouse.leftButton.wasPressedThisFrame);
                    break;
                default:
                    UpdateDrag(sim, cx, cy, mouse.leftButton.wasPressedThisFrame, mouse.leftButton.wasReleasedThisFrame);
                    break;
            }
        }

        /// <summary>Mouse position to grid cell with Physics.Raycast against the terrain.</summary>
        public bool Pick(Vector2 screen, out int x, out int y)
        {
            x = y = 0;
            var sim = Sim;
            if (sim == null) return false;
            Ray ray = cam.ScreenPointToRay(screen);
            if (!Physics.Raycast(ray, out RaycastHit hit, 5000f, groundMask)) return false;
            // over the sea the terrain is below the water: use where the ray crosses sea level
            Vector3 p = hit.point;
            if (p.y < 0 && ray.direction.y < -1e-4f)
            {
                float t = -ray.origin.y / ray.direction.y;
                p = ray.origin + ray.direction * t;
            }
            sim.City.Grid.WorldToCell(p.x, p.z, out x, out y);
            return sim.City.Grid.InBounds(x, y);
        }

        void UpdateBuilding(GameSimulation sim, int cx, int cy, bool click)
        {
            var data = SelectedBuilding;
            int defIndex = sim.Db.BuildingIndex(data.id);
            if (defIndex < 0) return;
            var grid = sim.City.Grid;
            int n = grid.FootprintCells(data.FootprintMeters);
            grid.FootprintOrigin(cx, cy, n, out int ox, out int oy);
            var result = sim.CheckBuilding(defIndex, ox, oy, out double cost);
            bool ok = result == PlacementResult.Ok;
            ShowGhost(data, sim, ox, oy, n, ok);
            cells.Clear();
            for (int dy = 0; dy < n; dy++) for (int dx = 0; dx < n; dx++) cells.Add((ox + dx, oy + dy));
            ShowTiles(sim, cells, ok);
            SetMessage(ok ? Cost(cost) : Reason(result));
            if (!click) return;
            if (!ok)
            {
                Message?.Invoke(Reason(result));
                return;
            }
            var b = sim.PlaceBuilding(defIndex, ox, oy, out result);
            if (b != null)
            {
                Placed?.Invoke(data);
                if (cityView != null) cityView.ForceSync();
            }
        }

        void UpdateDrag(GameSimulation sim, int cx, int cy, bool down, bool up)
        {
            if (down)
            {
                dragging = true;
                dragX = cx;
                dragY = cy;
            }
            int ax = dragging ? dragX : cx, ay = dragging ? dragY : cy;
            if (Mode == PlacementMode.Transport) GridPaths.LinePath(ax, ay, cx, cy, cells);
            else GridPaths.Rect(ax, ay, cx, cy, cells);

            bool ok = true;
            double cost = 0;
            if (Mode == PlacementMode.Transport)
            {
                var def = sim.TransportByKey(SelectedTransport);
                ok = def != null && sim.Tech.IsTransportUnlocked(SelectedTransport, sim.CurrentEra);
                if (ok) cost = sim.City.PathCost(def, cells, sim.Effects.ConstructionMult);
            }
            else if (Mode == PlacementMode.Zone) cost = sim.City.ZoneCostFor(cells, SelectedZone, sim.Effects.ConstructionMult);
            ok &= cost <= sim.Stock[ResourceType.Treasury];
            ShowTiles(sim, cells, ok);
            SetMessage(Mode == PlacementMode.Bulldoze ? "" : Cost(cost));

            if (!(up && dragging)) return;
            dragging = false;
            HideTiles(0);
            bool done;
            switch (Mode)
            {
                case PlacementMode.Transport: done = sim.BuildTransport(SelectedTransport, cells, out _); break;
                case PlacementMode.Zone: done = sim.Zone(cells, SelectedZone, out _); break;
                default: sim.Bulldoze(cells, removed); done = true; break;
            }
            if (!done) Message?.Invoke(GameRoot.Instance.T("Tidak boleh dibina di sini atau wang tidak cukup", "Cannot build here or not enough money"));
            else if (cityView != null) cityView.ForceSync();
        }

        // ------------------------------------------------------------ previews

        void ShowGhost(BuildingData data, GameSimulation sim, int ox, int oy, int n, bool ok)
        {
            if (ghostData != data)
            {
                ClearGhost();
                ghostData = data;
                var prefab = data.PrefabForEra(sim.CurrentEra);
                if (prefab != null) ghost = Instantiate(prefab);
                else
                {
                    ghost = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    ghost.transform.localScale = new Vector3(data.FootprintMeters * 0.9f, 4f, data.FootprintMeters * 0.9f);
                }
                ghost.name = "Ghost";
                int layer = LayerMask.NameToLayer("Ghost");
                foreach (var t in ghost.GetComponentsInChildren<Transform>(true)) if (layer >= 0) t.gameObject.layer = layer;
                foreach (var c in ghost.GetComponentsInChildren<Collider>(true)) Destroy(c);
            }
            var mat = ok ? ghostOk : ghostBad;
            foreach (var r in ghost.GetComponentsInChildren<Renderer>(true))
            {
                var mats = r.sharedMaterials;
                for (int i = 0; i < mats.Length; i++) mats[i] = mat;
                r.sharedMaterials = mats;
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            sim.City.Grid.FootprintCenter(ox, oy, n, out float wx, out float wz);
            float y = world != null ? world.FootprintHeight(ox, oy, n) : 0f;
            int rot = sim.City.FacingFor(data.placement, ox, oy, n);
            ghost.transform.SetPositionAndRotation(new Vector3(wx, y + 0.05f, wz), Quaternion.Euler(0, rot * 90f, 0));
        }

        void ClearGhost()
        {
            if (ghost != null) Destroy(ghost);
            ghost = null;
            ghostData = null;
        }

        void ShowTiles(GameSimulation sim, List<(int x, int y)> list, bool ok)
        {
            var grid = sim.City.Grid;
            int count = Mathf.Min(list.Count, maxPreviewTiles);
            while (tilePool.Count < count)
            {
                var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
                var col = q.GetComponent<Collider>();
                if (col != null) Destroy(col);
                q.name = "PreviewTile";
                q.transform.SetParent(transform, false);
                q.transform.rotation = Quaternion.Euler(90, 0, 0);
                q.transform.localScale = new Vector3(grid.CellSize * 0.94f, grid.CellSize * 0.94f, 1);
                q.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                tilePool.Add(q);
            }
            var mat = ok ? ghostOk : ghostBad;
            for (int k = 0; k < count; k++)
            {
                var (x, y) = list[k];
                var q = tilePool[k];
                q.SetActive(grid.InBounds(x, y));
                if (!q.activeSelf) continue;
                grid.CellCenter(x, y, out float wx, out float wz);
                float h = world != null ? world.GroundHeight(wx, wz) : 0f;
                q.transform.position = new Vector3(wx, h + 0.15f, wz);
                q.GetComponent<Renderer>().sharedMaterial = mat;
            }
            HideTiles(count);
        }

        void HideTiles(int from)
        {
            for (int k = from; k < tilePool.Count; k++) if (tilePool[k].activeSelf) tilePool[k].SetActive(false);
        }

        void SetMessage(string m) => LastMessage = m;

        string Cost(double cost) => GameRoot.Instance.T("Kos: ", "Cost: ") + cost.ToString("N0");

        public static string Reason(PlacementResult r)
        {
            var g = GameRoot.Instance;
            switch (r)
            {
                case PlacementResult.OutOfBounds: return g.T("Di luar peta", "Outside the map");
                case PlacementResult.Occupied: return g.T("Tapak sudah digunakan", "The site is occupied");
                case PlacementResult.Terrain: return g.T("Rupa bumi tidak sesuai", "Unsuitable terrain");
                case PlacementResult.Locked: return g.T("Belum dibuka: selidik teknologi atau sivik", "Locked: research the technology or civic first");
                case PlacementResult.Unique: return g.T("Mercu tanda hanya boleh dibina sekali", "A landmark can only be built once");
                case PlacementResult.Money: return g.T("Wang tidak cukup", "Not enough money");
                case PlacementResult.NeedCoast: return g.T("Mesti di pantai", "Must be on the coast");
                case PlacementResult.NeedWater: return g.T("Mesti di tepi air", "Must be beside water");
                case PlacementResult.NeedRiver: return g.T("Mesti di tebing sungai", "Must be on a riverbank");
                case PlacementResult.NeedTin: return g.T("Perlu tanah kaya bijih timah", "Needs tin-rich ground");
                case PlacementResult.NeedFertile: return g.T("Perlu tanah subur", "Needs fertile soil");
                case PlacementResult.NeedForest: return g.T("Mesti di tepi hutan", "Must be next to rainforest");
                case PlacementResult.NeedRail: return g.T("Mesti bersebelahan landasan kereta api", "Must touch a railway");
                default: return "";
            }
        }
    }
}
