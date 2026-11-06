using System.Collections.Generic;
using TamadunKota.Simulation;

namespace TamadunKota.Core
{
    /// <summary>
    /// Fills the map with a dense late-era city for performance testing (GDD section 6: 5,000+
    /// buildings at 60 FPS). Roads run along every fourth row with connecting columns, placed
    /// buildings line the roads, and every remaining land cell becomes a developed zoned lot at the
    /// era's maximum density. Zones and densities are written straight into CityState, so this is
    /// a rendering and simulation load test, not a playable city.
    /// </summary>
    public static class StressCity
    {
        public struct Result
        {
            public int buildings, lots, roadCells;
            public int Total => buildings + lots;
            public override string ToString() => $"{Total} buildings ({buildings} placed, {lots} zoned lots), {roadCells} road cells";
        }

        public static Result Build(GameSimulation sim, int target = 5000, int era = 4)
        {
            var result = new Result();
            while (sim.CurrentEra < era && sim.AdvanceEra(force: true)) { }
            sim.Stock[ResourceType.Treasury] = 1e12;

            var city = sim.City;
            var grid = city.Grid;
            int w = grid.Width, h = grid.Height;
            var map = sim.Map;
            bool Land(int x, int y)
            {
                int i = y * w + x;
                byte t = map.Terrain[i];
                return !TerrainTypes.IsWater(t) && t != (byte)TerrainType.Mountain;
            }

            // Roads: every fourth row, plus every sixteenth column, in runs over land.
            var run = new List<(int x, int y)>();
            void Flush()
            {
                if (run.Count >= 2 && sim.BuildTransport("road", run, out _)) result.roadCells += run.Count;
                run.Clear();
            }
            for (int y = 1; y < h; y += 4)
            {
                for (int x = 0; x < w; x++) { if (Land(x, y) && city.BuildingAt[y * w + x] < 0) run.Add((x, y)); else Flush(); }
                Flush();
            }
            for (int x = 8; x < w; x += 16)
            {
                for (int y = 0; y < h; y++)
                {
                    int i = y * w + x;
                    if (Land(x, y) && city.BuildingAt[i] < 0 && city.Transport[i] == 0) run.Add((x, y)); else Flush();
                }
                Flush();
            }

            // Placed buildings: one-cell, non-landmark buildings unlocked in this era, round-robin,
            // on every sixth cell of the rows next to the roads (about a tenth of the target).
            var defs = new List<int>();
            for (int d = 0; d < sim.Db.Buildings.Length; d++)
            {
                var def = sim.Db.Buildings[d];
                if (!def.landmark && grid.FootprintCells(def.footprintMeters) == 1 && sim.IsUnlocked(d)) defs.Add(d);
            }
            int wantPlaced = target / 10, next = 0;
            for (int y = 0; y < h && result.buildings < wantPlaced && defs.Count > 0; y += 4)
                for (int x = 3; x < w && result.buildings < wantPlaced; x += 6)
                    for (int tries = 0; tries < defs.Count; tries++)
                    {
                        int d = defs[next++ % defs.Count];
                        if (sim.CheckBuilding(d, x, y, out _) != PlacementResult.Ok) continue;
                        if (sim.PlaceBuilding(d, x, y, out _) != null) result.buildings++;
                        break;
                    }

            // Zoned lots on all other free land, at the era's top density, until the target is met.
            byte density = (byte)System.Math.Max(1, sim.EraDef.maxDensity);
            for (int y = 0; y < h && result.Total < target; y++)
                for (int x = 0; x < w && result.Total < target; x++)
                {
                    int i = y * w + x;
                    if (!Land(x, y) || city.BuildingAt[i] >= 0 || city.Transport[i] != 0) continue;
                    int band = (x / 12 + y / 12) % 3;
                    city.Zone[i] = (byte)(band == 0 ? ZoneType.Residential : band == 1 ? ZoneType.Commercial : ZoneType.Industrial);
                    city.Density[i] = density;
                    city.Style[i] = (byte)sim.CurrentEra;
                    result.lots++;
                }
            city.RecomputeAccess();
            city.Version++;
            return result;
        }

        /// <summary>
        /// Builds the stress city in the running game, frames it from a high overview, runs the clock
        /// at top speed and attaches a PerfProbe (report in the Console and Logs/perf_&lt;label&gt;.txt).
        /// </summary>
        public static PerfProbe StartProbe(string label, int target = 5000, float sampleSeconds = 10f)
        {
            var root = GameRoot.Instance;
            if (root == null || root.Sim == null) return null;
            var result = Build(root.Sim, target);
            var cam = UnityEngine.Object.FindAnyObjectByType<RTSCameraController>();
            if (cam != null)
            {
                var g = root.Sim.City.Grid;
                g.CellCenter(g.Width / 2, g.Height / 2, out float cx, out float cz);
                cam.pitch = 50f;
                cam.distance = UnityEngine.Mathf.Min(cam.maxDistance, 260f);
                cam.FocusOn(new UnityEngine.Vector3(cx, 0, cz), instant: true);
            }
            var time = UnityEngine.Object.FindAnyObjectByType<TimeManager>();
            if (time != null) time.SetSpeed(3);
            var probe = root.gameObject.AddComponent<PerfProbe>();
            probe.label = label;
            probe.sampleSeconds = sampleSeconds;
            probe.context = "City: " + result + ", era " + root.Sim.CurrentEra + ", art: " + (ArtMode.Greybox ? "greybox" : "full 3D") + ", camera overview at 260 m, speed 3";
            UnityEngine.Debug.Log("[Tamadun & Kota] Stress city built: " + result + ". Sampling " + sampleSeconds + " s after a 3 s warm-up...");
            return probe;
        }
    }

    /// <summary>
    /// Command-line performance run for player builds: TamadunKota.exe -tamadunStress [-screen-width
    /// 1920 -screen-height 1080]. Waits for the scene to settle, runs StressCity.StartProbe, writes
    /// Logs/perf_stress5000_player.txt next to the data folder and quits.
    /// </summary>
    public class StressCommandLine : UnityEngine.MonoBehaviour
    {
        [UnityEngine.RuntimeInitializeOnLoadMethod(UnityEngine.RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Init()
        {
            if (System.Array.IndexOf(System.Environment.GetCommandLineArgs(), "-tamadunStress") < 0) return;
            var go = new UnityEngine.GameObject("Stress Command Line");
            DontDestroyOnLoad(go);
            go.AddComponent<StressCommandLine>();
        }

        System.Collections.IEnumerator Start()
        {
            yield return new UnityEngine.WaitForSecondsRealtime(3f);
            var probe = StressCity.StartProbe("stress5000_player");
            if (probe == null) { UnityEngine.Application.Quit(2); yield break; }
            probe.Finished += _ => UnityEngine.Application.Quit(0);
        }
    }
}
