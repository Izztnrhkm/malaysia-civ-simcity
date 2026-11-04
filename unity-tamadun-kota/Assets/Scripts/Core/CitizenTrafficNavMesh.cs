using System.Collections.Generic;
using TamadunKota.Data;
using TamadunKota.Simulation;
using Unity.AI.Navigation;
using UnityEngine;
using UnityEngine.AI;

namespace TamadunKota.Core
{
    /// <summary>
    /// Living traffic. Villagers are NavMeshAgents walking between homes (residential lots)
    /// and workplaces (commercial/industrial lots, jobs buildings, ports) on a NavMesh baked
    /// from the terrain by a NavMeshSurface. Carts/cars/buses follow the road graph (A* over
    /// road cells, driving on the left), trains follow the railway with wagons in tow, ships
    /// sail from the open Straits to the harbours. Agents are pooled; pools scale with the city.
    /// </summary>
    public class CitizenTrafficNavMesh : MonoBehaviour
    {
        public WorldBuilder world;
        public BuildingCatalog catalog;
        public NavMeshSurface navSurface;
        [Tooltip("Optional prefab for villagers (a capsule is used otherwise)")]
        public GameObject villagerPrefab;

        [Header("Budgets")]
        [Range(0, 200)] public int maxVillagers = 60;
        [Range(0, 200)] public int maxVehicles = 60;
        [Range(0, 12)] public int maxTrains = 4;
        [Range(0, 12)] public int maxShips = 6;
        public float rebuildNavMeshEvery = 20f;

        class Mover
        {
            public Transform t;
            public Transform[] followers;
            public readonly List<int> path = new List<int>(256);
            public readonly List<Vector3> trail = new List<Vector3>(16);
            public int index;
            public float along;
            public float speed;
            public float lift;
            public bool ship, rail;
        }

        class Villager
        {
            public NavMeshAgent agent;
            public Vector3 home, work;
            public bool toWork;
        }

        readonly List<Villager> villagers = new List<Villager>();
        readonly List<Mover> vehicles = new List<Mover>();
        readonly List<Mover> trains = new List<Mover>();
        readonly List<Mover> ships = new List<Mover>();
        readonly List<int> homes = new List<int>(512);
        readonly List<int> works = new List<int>(512);
        readonly List<int> roadCells = new List<int>(2048);
        readonly List<int> railCells = new List<int>(512);
        RoadGraph graph;
        GameSimulation sim;
        int seenVersion = -1;
        float nextNavBuild;
        bool navDirty = true;
        AsyncOperation navOp;
        Rng rng = new Rng(4242);
        Transform root;

        static readonly string[][] EraCars =
        {
            new string[0],
            new[] { "vehicle_bullock_cart" },
            new[] { "vehicle_bullock_cart", "vehicle_vintage_car" },
            new[] { "vehicle_car", "vehicle_car_white", "vehicle_bus" },
            new[] { "vehicle_car", "vehicle_car_white", "vehicle_bus" },
        };
        static readonly string[][] EraShips =
        {
            new string[0],
            new[] { "vehicle_jong", "vehicle_junk", "vehicle_perahu" },
            new[] { "vehicle_steamship", "vehicle_junk" },
            new[] { "vehicle_container_ship", "vehicle_steamship" },
            new[] { "vehicle_container_ship" },
        };

        void Awake()
        {
            root = new GameObject("Traffic").transform;
            root.SetParent(transform, false);
            if (catalog == null && GameRoot.Instance != null) catalog = GameRoot.Instance.catalog;
        }

        void Update()
        {
            if (GameRoot.Instance == null) return;
            if (sim != GameRoot.Instance.Sim)
            {
                sim = GameRoot.Instance.Sim;
                graph = new RoadGraph(sim.City.Grid.Width, sim.City.Grid.Height);
                ClearAll();
                seenVersion = -1;
            }
            if (sim == null) return;
            if (sim.City.Version != seenVersion && Time.frameCount % 15 == 0)
            {
                seenVersion = sim.City.Version;
                Survey();
                navDirty = true;
                Respawn();
            }
            if (navSurface != null && navDirty && Time.unscaledTime >= nextNavBuild && (navOp == null || navOp.isDone))
            {
                nextNavBuild = Time.unscaledTime + rebuildNavMeshEvery;
                navDirty = false;
                if (navSurface.navMeshData == null) navSurface.BuildNavMesh();
                else navOp = navSurface.UpdateNavMesh(navSurface.navMeshData);
            }
            float dt = Time.deltaTime;
            foreach (var v in villagers) StepVillager(v);
            foreach (var m in vehicles) StepMover(m, dt, false);
            foreach (var m in trains) StepMover(m, dt, false);
            foreach (var m in ships) StepMover(m, dt, true);
        }

        // ------------------------------------------------------------ survey the city

        void Survey()
        {
            var c = sim.City;
            homes.Clear();
            works.Clear();
            roadCells.Clear();
            railCells.Clear();
            for (int i = 0; i < c.Zone.Length; i++)
            {
                if (c.Density[i] > 0)
                {
                    if (c.Zone[i] == (byte)ZoneType.Residential) homes.Add(i);
                    else if (c.Zone[i] != 0) works.Add(i);
                }
                if (c.Transport[i] == (byte)TransportType.Road || c.Transport[i] == (byte)TransportType.Highway) roadCells.Add(i);
                else if (c.Transport[i] == (byte)TransportType.Rail) railCells.Add(i);
            }
            foreach (var b in c.Buildings)
                if (sim.Db.Buildings[b.defIndex].jobs > 0) works.Add(b.y * c.Grid.Width + b.x);
        }

        void Respawn()
        {
            int era = sim.CurrentEra;
            int wantVillagers = Mathf.Min(maxVillagers, homes.Count / 2);
            int wantVehicles = Mathf.Min(maxVehicles, roadCells.Count / 5);
            int wantTrains = railCells.Count >= 6 ? Mathf.Min(maxTrains, 1 + railCells.Count / 40) : 0;
            int wantShips = Mathf.Min(maxShips, 2 + HarbourCount() * 2);
            while (villagers.Count < wantVillagers && SpawnVillager()) { }
            while (vehicles.Count > wantVehicles) RemoveAt(vehicles, vehicles.Count - 1);
            while (vehicles.Count < wantVehicles && SpawnVehicle(era)) { }
            while (trains.Count > wantTrains) RemoveAt(trains, trains.Count - 1);
            while (trains.Count < wantTrains && SpawnTrain(era)) { }
            while (ships.Count < wantShips && SpawnShip(era)) { }
        }

        int HarbourCount()
        {
            int n = 0;
            foreach (var b in sim.City.Buildings) if (sim.Db.Buildings[b.defIndex].exportHub) n++;
            return n;
        }

        void ClearAll()
        {
            foreach (var v in villagers) if (v.agent != null) Destroy(v.agent.gameObject);
            villagers.Clear();
            foreach (var list in new[] { vehicles, trains, ships })
            {
                for (int i = list.Count - 1; i >= 0; i--) RemoveAt(list, i);
            }
        }

        void RemoveAt(List<Mover> list, int i)
        {
            var m = list[i];
            if (m.t != null) Destroy(m.t.gameObject);
            if (m.followers != null) foreach (var f in m.followers) if (f != null) Destroy(f.gameObject);
            list.RemoveAt(i);
        }

        Vector3 CellPos(int i, float lift = 0)
        {
            var g = sim.City.Grid;
            g.CellCenter(i % g.Width, i / g.Width, out float x, out float z);
            float y = world != null ? world.GroundHeight(x, z) : 0;
            return new Vector3(x, y + lift, z);
        }

        Transform MakeVisual(string modelId, PrimitiveType fallback, Vector3 scale)
        {
            GameObject prefab = catalog != null ? catalog.Vehicle(modelId) : null;
            GameObject go;
            if (prefab != null) go = Instantiate(prefab);
            else
            {
                go = GameObject.CreatePrimitive(fallback);
                go.transform.localScale = scale;
                var col = go.GetComponent<Collider>();
                if (col != null) Destroy(col);
            }
            go.name = modelId;
            go.transform.SetParent(root, true);
            int layer = LayerMask.NameToLayer("Agents");
            if (layer >= 0) go.layer = layer;
            return go.transform;
        }

        // ------------------------------------------------------------ villagers (NavMesh)

        bool SpawnVillager()
        {
            if (homes.Count == 0 || works.Count == 0) return false;
            Vector3 home = CellPos(homes[rng.Int(0, homes.Count - 1)]);
            Vector3 work = CellPos(works[rng.Int(0, works.Count - 1)]);
            if (!NavMesh.SamplePosition(home, out NavMeshHit hit, 6f, NavMesh.AllAreas)) return false;
            Transform t = villagerPrefab != null ? Instantiate(villagerPrefab).transform : MakeVisual("villager", PrimitiveType.Capsule, new Vector3(0.6f, 0.9f, 0.6f));
            t.SetParent(root, true);
            t.position = hit.position;
            var agent = t.gameObject.AddComponent<NavMeshAgent>();
            agent.speed = 1.4f + (float)rng.Next() * 0.6f;
            agent.radius = 0.35f;
            agent.height = 1.8f;
            agent.angularSpeed = 360f;
            agent.acceleration = 6f;
            agent.obstacleAvoidanceType = ObstacleAvoidanceType.LowQualityObstacleAvoidance;
            var v = new Villager { agent = agent, home = home, work = work, toWork = true };
            if (agent.isOnNavMesh) agent.SetDestination(work);
            villagers.Add(v);
            return true;
        }

        void StepVillager(Villager v)
        {
            var a = v.agent;
            if (a == null || !a.isOnNavMesh || a.pathPending) return;
            if (a.remainingDistance <= a.stoppingDistance + 0.5f)
            {
                v.toWork = !v.toWork;
                a.SetDestination(v.toWork ? v.work : v.home);
            }
        }

        // ------------------------------------------------------------ road vehicles and trains (road graph)

        bool SpawnVehicle(int era)
        {
            if (roadCells.Count < 2) return false;
            var cars = EraCars[era];
            var m = new Mover { speed = era == 1 ? 3f : 9f + (float)rng.Next() * 4f, lift = 0.1f };
            string model = cars[rng.Int(0, cars.Length - 1)];
            m.t = MakeVisual(model, PrimitiveType.Cube, new Vector3(1.8f, 1.4f, 4f));
            if (!NewRoute(m, roadCells, IsRoad)) { Destroy(m.t.gameObject); return false; }
            vehicles.Add(m);
            return true;
        }

        bool SpawnTrain(int era)
        {
            if (railCells.Count < 2) return false;
            var m = new Mover { speed = era <= 2 ? 10f : 18f, lift = 0.2f, rail = true };
            m.t = MakeVisual(era <= 2 ? "vehicle_steam_loco" : "vehicle_diesel_loco", PrimitiveType.Cube, new Vector3(2.6f, 3f, 9f));
            m.followers = new Transform[3];
            for (int k = 0; k < 3; k++) m.followers[k] = MakeVisual("vehicle_rail_wagon", PrimitiveType.Cube, new Vector3(2.6f, 2.6f, 8f));
            if (!NewRoute(m, railCells, IsRail)) { RemoveAt(new List<Mover> { m }, 0); return false; }
            trains.Add(m);
            return true;
        }

        bool IsRoad(int i) => sim.City.Transport[i] == (byte)TransportType.Road || sim.City.Transport[i] == (byte)TransportType.Highway;
        bool IsRail(int i) => sim.City.Transport[i] == (byte)TransportType.Rail;
        bool IsSea(int i) => TerrainTypes.IsSea(sim.Map.Terrain[i]);

        bool NewRoute(Mover m, List<int> cells, System.Func<int, bool> walkable)
        {
            for (int attempt = 0; attempt < 6; attempt++)
            {
                int a = m.path.Count > 0 ? m.path[m.path.Count - 1] : cells[rng.Int(0, cells.Count - 1)];
                int b = cells[rng.Int(0, cells.Count - 1)];
                if (a == b) continue;
                if (graph.FindPath(a, b, walkable, m.path, 6000) && m.path.Count >= 2)
                {
                    m.index = 0;
                    m.along = 0;
                    return true;
                }
            }
            return false;
        }

        void StepMover(Mover m, float dt, bool ship)
        {
            if (m.t == null || m.path.Count < 2) return;
            m.along += m.speed * dt / sim.City.Grid.CellSize;
            while (m.along >= 1f)
            {
                m.along -= 1f;
                m.index++;
                if (m.index >= m.path.Count - 1)
                {
                    if (ship) { m.path.Reverse(); m.index = 0; }
                    else if (!NewRoute(m, m.rail ? railCells : roadCells, m.rail ? (System.Func<int, bool>)IsRail : IsRoad)) { m.index = 0; m.path.Reverse(); }
                    break;
                }
            }
            int i0 = m.path[Mathf.Min(m.index, m.path.Count - 1)];
            int i1 = m.path[Mathf.Min(m.index + 1, m.path.Count - 1)];
            Vector3 a = ship ? SeaPos(i0) : CellPos(i0, m.lift + DeckLift(i0));
            Vector3 b = ship ? SeaPos(i1) : CellPos(i1, m.lift + DeckLift(i1));
            Vector3 dir = b - a;
            Vector3 pos = Vector3.Lerp(a, b, m.along);
            if (!ship && !m.rail && dir.sqrMagnitude > 1e-4f)
            {
                // drive on the left: offset to the left of the travel direction
                Vector3 left = Vector3.Cross(dir.normalized, Vector3.up);
                pos += left * 0.9f;
            }
            m.t.position = pos;
            if (dir.sqrMagnitude > 1e-4f) m.t.rotation = Quaternion.Slerp(m.t.rotation, Quaternion.LookRotation(new Vector3(dir.x, 0, dir.z)), 10f * dt);
            if (m.followers != null)
            {
                if (m.trail.Count == 0 || (m.trail[m.trail.Count - 1] - pos).sqrMagnitude > 4f)
                {
                    m.trail.Add(pos);
                    if (m.trail.Count > 16) m.trail.RemoveAt(0);
                }
                for (int k = 0; k < m.followers.Length; k++)
                {
                    int idx = m.trail.Count - 1 - (k + 1) * 4;
                    if (idx < 0 || m.followers[k] == null) continue;
                    var f = m.followers[k];
                    Vector3 target = m.trail[idx];
                    Vector3 look = (idx + 1 < m.trail.Count ? m.trail[idx + 1] : pos) - target;
                    f.position = Vector3.Lerp(f.position, target, 8f * dt);
                    if (look.sqrMagnitude > 1e-4f) f.rotation = Quaternion.LookRotation(new Vector3(look.x, 0, look.z));
                }
            }
        }

        float DeckLift(int i) => sim.City.Transport[i] == (byte)TransportType.Highway ? 6f : sim.City.Transport[i] == (byte)TransportType.Mrt ? 9f : 0f;

        // ------------------------------------------------------------ ships

        Vector3 SeaPos(int i)
        {
            var g = sim.City.Grid;
            g.CellCenter(i % g.Width, i / g.Width, out float x, out float z);
            return new Vector3(x, 0.05f + Mathf.Sin(Time.time * 0.8f + i) * 0.08f, z);
        }

        bool SpawnShip(int era)
        {
            var c = sim.City;
            var g = c.Grid;
            // destination: sea next to a harbour, or the river mouth before any harbour exists
            int goal = -1;
            foreach (var b in c.Buildings)
            {
                if (!sim.Db.Buildings[b.defIndex].exportHub) continue;
                for (int dy = -3; dy <= b.cells + 3 && goal < 0; dy++)
                    for (int dx = -3; dx <= b.cells + 3 && goal < 0; dx++)
                        if (g.InBounds(b.x + dx, b.y + dy) && IsSea((b.y + dy) * g.Width + b.x + dx)) goal = (b.y + dy) * g.Width + b.x + dx;
                if (goal >= 0 && rng.Chance(0.5)) break;
            }
            if (goal < 0) goal = sim.Map.MouthY * g.Width + Mathf.Max(0, sim.Map.MouthX - 2);
            int startRow = rng.Int(2, g.Height - 3);
            int start = startRow * g.Width;
            if (!IsSea(start) || !IsSea(goal)) return false;
            var names = EraShips[era];
            var m = new Mover { speed = 4f + (float)rng.Next() * 3f, ship = true };
            if (!graph.FindPath(start, goal, IsSea, m.path, 20000)) return false;
            m.t = MakeVisual(names[rng.Int(0, names.Length - 1)], PrimitiveType.Cube, new Vector3(4f, 3f, 14f));
            m.index = rng.Int(0, Mathf.Max(0, m.path.Count - 2));
            ships.Add(m);
            return true;
        }
    }
}
