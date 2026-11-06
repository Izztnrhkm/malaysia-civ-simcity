using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;

namespace TamadunKota.Core
{
    /// <summary>
    /// Samples frame time (and, in the Editor, batches, SetPass calls and triangles) for a fixed
    /// time after a warm-up, then logs a report and writes it to Logs/perf_&lt;label&gt;.txt in the
    /// project folder. Add it at runtime; it destroys itself when done.
    /// </summary>
    public class PerfProbe : MonoBehaviour
    {
        public string label = "probe";
        public string context = "";
        public float warmupSeconds = 3f;
        public float sampleSeconds = 10f;

        /// <summary>Raised with the report text when sampling ends.</summary>
        public event Action<string> Finished;
        public string Report { get; private set; }
        public float AverageMs { get; private set; }
        public float P95Ms { get; private set; }

        readonly List<float> frameMs = new List<float>(4096);
        double batches, setPass, triangles;
        readonly FrameTiming[] timing = new FrameTiming[1];
        double cpuMain, gpu;
        int timedFrames;
        float elapsed;
        int savedVSync, savedTargetFps;

        void OnEnable()
        {
            // Measure uncapped: VSync would round every frame up to a multiple of the refresh interval.
            savedVSync = QualitySettings.vSyncCount;
            savedTargetFps = Application.targetFrameRate;
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = -1;
        }

        void OnDisable()
        {
            QualitySettings.vSyncCount = savedVSync;
            Application.targetFrameRate = savedTargetFps;
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            elapsed += dt;
            if (elapsed < warmupSeconds) return;
            frameMs.Add(dt * 1000f);
            FrameTimingManager.CaptureFrameTimings();
            if (FrameTimingManager.GetLatestTimings(1, timing) > 0)
            {
#if UNITY_2022_1_OR_NEWER
                cpuMain += timing[0].cpuMainThreadFrameTime;
#else
                cpuMain += timing[0].cpuFrameTime; // older reference assemblies (CI compile check)
#endif
                gpu += timing[0].gpuFrameTime;
                timedFrames++;
            }
#if UNITY_EDITOR
            batches += UnityEditor.UnityStats.batches;
            setPass += UnityEditor.UnityStats.setPassCalls;
            triangles += UnityEditor.UnityStats.triangles;
#endif
            if (elapsed >= warmupSeconds + sampleSeconds) Finish();
        }

        void Finish()
        {
            int n = frameMs.Count;
            var sorted = new List<float>(frameMs);
            sorted.Sort();
            float sum = 0;
            foreach (var f in frameMs) sum += f;
            AverageMs = sum / Mathf.Max(1, n);
            P95Ms = n > 0 ? sorted[Mathf.Min(n - 1, (int)(n * 0.95f))] : 0;
            float p99 = n > 0 ? sorted[Mathf.Min(n - 1, (int)(n * 0.99f))] : 0;
            float median = n > 0 ? sorted[n / 2] : 0;
            float max = n > 0 ? sorted[n - 1] : 0;

            var sb = new StringBuilder();
            sb.AppendLine($"Tamadun & Kota performance probe: {label}");
            sb.AppendLine($"Date: {DateTime.Now:yyyy-MM-dd HH:mm}");
            if (!string.IsNullOrEmpty(context)) sb.AppendLine(context);
            sb.AppendLine($"GPU: {SystemInfo.graphicsDeviceName} ({SystemInfo.graphicsDeviceType}), CPU: {SystemInfo.processorType}");
            sb.AppendLine($"Screen: {Screen.width}x{Screen.height}, quality: {QualitySettings.names[QualitySettings.GetQualityLevel()]}, editor: {Application.isEditor}, batch mode: {Application.isBatchMode}");
            sb.AppendLine($"Renderers active: {CountActiveRenderers()}");
            sb.AppendLine($"Frames: {n} over {sampleSeconds:0.#} s after {warmupSeconds:0.#} s warm-up");
            sb.AppendLine($"Frame time ms: avg {AverageMs:0.00}, median {median:0.00}, p95 {P95Ms:0.00}, p99 {p99:0.00}, max {max:0.00}");
            sb.AppendLine($"FPS: avg {1000f / Mathf.Max(0.001f, AverageMs):0.0}, p95-frame {1000f / Mathf.Max(0.001f, P95Ms):0.0} (VSync off while sampling)");
            if (timedFrames > 0)
                sb.AppendLine($"FrameTimingManager avg: CPU main thread {cpuMain / timedFrames:0.00} ms, GPU {gpu / timedFrames:0.00} ms ({timedFrames} frames)");
            else
                sb.AppendLine("FrameTimingManager: no data (enable Player Settings > Frame Timing Stats)");
#if UNITY_EDITOR
            if (n > 0) sb.AppendLine($"Per frame (Editor stats): batches {batches / n:0}, SetPass calls {setPass / n:0}, triangles {triangles / n:0}");
#endif
            Report = sb.ToString();
            Debug.Log(Report);
            try
            {
                string dir = Path.Combine(Path.GetDirectoryName(Application.dataPath) ?? ".", "Logs");
                Directory.CreateDirectory(dir);
                File.WriteAllText(Path.Combine(dir, "perf_" + label + ".txt"), Report);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[PerfProbe] could not write the report: " + e.Message);
            }
            Finished?.Invoke(Report);
            enabled = false;
            Destroy(this);
        }

        static int CountActiveRenderers()
        {
            int count = 0;
            foreach (var r in FindObjectsByType<Renderer>(FindObjectsSortMode.None))
                if (r.enabled && r.gameObject.activeInHierarchy) count++;
            return count;
        }
    }
}
