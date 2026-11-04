using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using TamadunKota.Core;
using TamadunKota.Data;
using TamadunKota.Simulation;
using TamadunKota.Systems;
using Unity.AI.Navigation;
using UnityEditor;
using UnityEditor.Events;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace TamadunKota.EditorTools
{
    /// <summary>
    /// One-click project setup. Menu: Tamadun &amp; Kota / 1. Build All ScriptableObjects, LOD Prefabs &amp; Playable Scene
    ///
    ///  1. Project: Linear colour space, a URP asset with the SRP Batcher on, assigned to Graphics
    ///     and every Quality level.
    ///  2. Materials: the single shared atlas material (URP Lit, GPU instancing on) plus ghost,
    ///     water, greybox and skybox materials.
    ///  3. Prefabs: every Blender FBX (Assets/Art/Models) becomes a prefab with a LODGroup built
    ///     from its _LOD0 / _LOD1 / _LOD2 meshes and the atlas material. Missing models fall back
    ///     to greybox cubes sized to the footprint.
    ///  4. Data: one BuildingData asset per building and zoned lot (from Resources/GameData/*.json,
    ///     the export of the web game's catalog), the TechCivicTree asset and the BuildingCatalog.
    ///  5. Scene: Assets/Scenes/MainGame.unity with sun, terrain, water, RTS camera, game root,
    ///     every manager wired, a NavMeshSurface, the HUD and the "Greybox / Full 3D Art" button;
    ///     added to Build Settings.
    ///
    /// Safe to run again: assets are updated in place.
    /// </summary>
    public static class TamadunAutoSetupEditor
    {
        public const string MenuRoot = "Tamadun & Kota/";
        const string ScenePath = "Assets/Scenes/MainGame.unity";
        const string ModelsDir = "Assets/Art/Models";
        const string TexturesDir = "Assets/Art/Textures";
        const string PrefabsDir = "Assets/Prefabs";
        const string DataDir = "Assets/Data";
        const string SettingsDir = "Assets/Settings";
        const string MaterialsDir = "Assets/Materials";
        const string GameDataDir = "Assets/Resources/GameData";

        static readonly string[] Folders =
        {
            "Assets/Art", ModelsDir, TexturesDir, PrefabsDir, PrefabsDir + "/Buildings", PrefabsDir + "/Zones",
            PrefabsDir + "/Vehicles", PrefabsDir + "/Trees", PrefabsDir + "/Infrastructure", PrefabsDir + "/Variants",
            PrefabsDir + "/Greybox", DataDir, DataDir + "/Buildings", DataDir + "/ZoneLots", SettingsDir, MaterialsDir, "Assets/Scenes",
        };

        [MenuItem(MenuRoot + "1. Build All ScriptableObjects, LOD Prefabs & Playable Scene", priority = 1)]
        public static void BuildAll()
        {
            if (!Application.isBatchMode && EditorSceneManager.GetActiveScene().isDirty &&
                !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
                return;
            try
            {
                Step("Folders", 0.02f); EnsureFolders();
                Step("Project settings (Linear, URP, SRP Batcher)", 0.05f); var urp = ConfigureRenderPipeline();
                Step("Import settings", 0.1f); ReimportArt();
                Step("Materials", 0.2f); var mats = CreateMaterials();
                Step("LOD prefabs", 0.3f); var prefabs = BuildModelPrefabs(mats);
                Step("ScriptableObjects", 0.6f); var catalog = BuildData(prefabs, mats);
                Step("Scene", 0.8f); BuildScene(catalog, mats);
                AssetDatabase.SaveAssets();
                AssetDatabase.Refresh();
                string summary = $"Built {catalog.buildings.Count} buildings, {catalog.zoneLots.Count} zone lots, " +
                                 $"{prefabs.Count} LOD prefabs ({prefabs.Values.Count(p => p.fromModel)} from Blender models).\n" +
                                 $"Render pipeline: {(urp != null ? urp.name : "none")}, SRP Batcher on, Linear colour space.\n" +
                                 $"Scene saved to {ScenePath}. Press Play.";
                Debug.Log("[Tamadun & Kota] " + summary);
                if (!Application.isBatchMode) EditorUtility.DisplayDialog("Tamadun & Kota", summary, "OK");
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }
        }

        /// <summary>Batch-mode entry point: Unity -batchmode -quit -projectPath . -executeMethod TamadunKota.EditorTools.TamadunAutoSetupEditor.BuildAllBatch</summary>
        public static void BuildAllBatch() => BuildAll();

        [MenuItem(MenuRoot + "2. Open MainGame Scene", priority = 2)]
        public static void OpenScene()
        {
            if (!File.Exists(ScenePath))
            {
                EditorUtility.DisplayDialog("Tamadun & Kota", "Run '1. Build All ...' first.", "OK");
                return;
            }
            if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) EditorSceneManager.OpenScene(ScenePath);
        }

        [MenuItem(MenuRoot + "3. Re-run Blender Pipeline (needs blender on PATH)", priority = 20)]
        public static void RunBlender()
        {
            string project = Path.GetDirectoryName(Application.dataPath);
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "blender",
                Arguments = "--background --factory-startup --python scripts/blender_unity_pipeline.py",
                WorkingDirectory = project,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
            try
            {
                using (var p = System.Diagnostics.Process.Start(psi))
                {
                    EditorUtility.DisplayProgressBar("Tamadun & Kota", "Blender is exporting the 3-LOD models...", 0.5f);
                    string output = p.StandardOutput.ReadToEnd();
                    string errors = p.StandardError.ReadToEnd();
                    p.WaitForExit();
                    Debug.Log("[Blender] " + output);
                    if (p.ExitCode != 0) Debug.LogError("[Blender] exit " + p.ExitCode + "\n" + errors);
                }
            }
            catch (Exception e)
            {
                Debug.LogError("[Blender] could not start blender: " + e.Message + "\nRun it manually: blender --background --python scripts/blender_unity_pipeline.py");
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }
            AssetDatabase.Refresh();
        }

        static void Step(string what, float progress)
        {
            if (!Application.isBatchMode) EditorUtility.DisplayProgressBar("Tamadun & Kota setup", what, progress);
            Debug.Log("[Tamadun & Kota] " + what);
        }

        static void EnsureFolders()
        {
            foreach (var f in Folders)
            {
                if (AssetDatabase.IsValidFolder(f)) continue;
                string parent = Path.GetDirectoryName(f).Replace('\\', '/');
                AssetDatabase.CreateFolder(parent, Path.GetFileName(f));
            }
        }

        static T LoadOrCreate<T>(string path, Func<T> create) where T : UnityEngine.Object
        {
            var existing = AssetDatabase.LoadAssetAtPath<T>(path);
            if (existing != null) return existing;
            var created = create();
            AssetDatabase.CreateAsset(created, path);
            return created;
        }

        // ================================================================ 1. render pipeline

        public static UniversalRenderPipelineAsset ConfigureRenderPipeline()
        {
            PlayerSettings.colorSpace = ColorSpace.Linear;

            var urp = GraphicsSettings.defaultRenderPipeline as UniversalRenderPipelineAsset;
            if (urp == null)
            {
                urp = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(SettingsDir + "/TamadunURP.asset");
                if (urp == null)
                {
                    var renderer = LoadOrCreate(SettingsDir + "/TamadunURP_Renderer.asset", () => ScriptableObject.CreateInstance<UniversalRendererData>());
                    urp = UniversalRenderPipelineAsset.Create(renderer);
                    AssetDatabase.CreateAsset(urp, SettingsDir + "/TamadunURP.asset");
                }
            }
            urp.useSRPBatcher = true;
            urp.supportsHDR = true;
            urp.shadowDistance = 450f;
            urp.msaaSampleCount = 4;
            EditorUtility.SetDirty(urp);

            GraphicsSettings.defaultRenderPipeline = urp;
            int current = QualitySettings.GetQualityLevel();
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = urp;
            }
            QualitySettings.SetQualityLevel(current, false);
            AssetDatabase.SaveAssets();
            return urp;
        }

        // ================================================================ 2. import settings

        static void ReimportArt()
        {
            foreach (var guid in AssetDatabase.FindAssets("t:Model", new[] { ModelsDir }))
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                if (AssetImporter.GetAtPath(path) is ModelImporter mi && TamadunArtImportRules.ApplyModelRules(mi)) mi.SaveAndReimport();
            }
            foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { TexturesDir }))
            {
                string path = AssetDatabase.GUIDToAssetPath(guid);
                if (AssetImporter.GetAtPath(path) is TextureImporter ti && TamadunArtImportRules.ApplyTextureRules(ti)) ti.SaveAndReimport();
            }
        }

        // ================================================================ 3. materials

        public class Materials
        {
            public Material atlas, ghost, water, greybox, skybox;
            public bool atlasTextured;
        }

        static Shader FindShader(params string[] names)
        {
            foreach (var n in names)
            {
                var s = Shader.Find(n);
                if (s != null) return s;
            }
            return null;
        }

        static Materials CreateMaterials()
        {
            var lit = FindShader("Universal Render Pipeline/Lit", "Standard");
            var unlit = FindShader("Universal Render Pipeline/Unlit", "Unlit/Color");
            var m = new Materials();

            m.atlas = LoadOrCreate(MaterialsDir + "/MasterPaletteAtlas.mat", () => new Material(lit));
            m.atlas.shader = lit;
            var baseMap = AssetDatabase.LoadAssetAtPath<Texture2D>(TexturesDir + "/MasterPaletteAtlas.png");
            var msMap = AssetDatabase.LoadAssetAtPath<Texture2D>(TexturesDir + "/MasterPaletteAtlas_MetallicSmoothness.png");
            var emMap = AssetDatabase.LoadAssetAtPath<Texture2D>(TexturesDir + "/MasterPaletteAtlas_Emission.png");
            m.atlasTextured = baseMap != null;
            SetTex(m.atlas, "_BaseMap", baseMap);
            SetTex(m.atlas, "_MainTex", baseMap);
            SetColor(m.atlas, "_BaseColor", Color.white);
            if (msMap != null)
            {
                SetTex(m.atlas, "_MetallicGlossMap", msMap);
                SetFloat(m.atlas, "_Metallic", 1f);
                SetFloat(m.atlas, "_Smoothness", 1f);
                SetFloat(m.atlas, "_SmoothnessTextureChannel", 0f);
                m.atlas.EnableKeyword("_METALLICSPECGLOSSMAP");
            }
            else
            {
                SetFloat(m.atlas, "_Smoothness", 0.25f);
            }
            if (emMap != null)
            {
                SetTex(m.atlas, "_EmissionMap", emMap);
                SetColor(m.atlas, "_EmissionColor", new Color(0.55f, 0.55f, 0.55f));
                m.atlas.EnableKeyword("_EMISSION");
                m.atlas.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            }
            m.atlas.enableInstancing = true;
            EditorUtility.SetDirty(m.atlas);

            m.ghost = LoadOrCreate(MaterialsDir + "/Ghost.mat", () => new Material(unlit));
            MakeTransparent(m.ghost, new Color(0.3f, 0.95f, 0.45f, 0.45f));
            m.water = LoadOrCreate(MaterialsDir + "/Water.mat", () => new Material(lit));
            MakeTransparent(m.water, new Color(0.13f, 0.38f, 0.5f, 0.82f));
            SetFloat(m.water, "_Smoothness", 0.92f);
            SetFloat(m.water, "_Metallic", 0.1f);
            m.greybox = LoadOrCreate(MaterialsDir + "/Greybox.mat", () => new Material(lit));
            m.greybox.shader = lit;
            SetColor(m.greybox, "_BaseColor", new Color(0.78f, 0.77f, 0.73f));
            SetFloat(m.greybox, "_Smoothness", 0.1f);
            m.greybox.enableInstancing = true;
            EditorUtility.SetDirty(m.greybox);

            var sky = FindShader("Skybox/Procedural");
            if (sky != null)
            {
                m.skybox = LoadOrCreate(MaterialsDir + "/TropicalSky.mat", () => new Material(sky));
                SetColor(m.skybox, "_SkyTint", new Color(0.45f, 0.62f, 0.85f));
                SetColor(m.skybox, "_GroundColor", new Color(0.33f, 0.38f, 0.33f));
                SetFloat(m.skybox, "_AtmosphereThickness", 1.15f);
                SetFloat(m.skybox, "_Exposure", 1.25f);
                EditorUtility.SetDirty(m.skybox);
            }
            AssetDatabase.SaveAssets();
            return m;
        }

        static void SetTex(Material m, string prop, Texture t) { if (t != null && m.HasProperty(prop)) m.SetTexture(prop, t); }
        static void SetColor(Material m, string prop, Color c) { if (m.HasProperty(prop)) m.SetColor(prop, c); }
        static void SetFloat(Material m, string prop, float v) { if (m.HasProperty(prop)) m.SetFloat(prop, v); }

        /// <summary>URP Lit/Unlit transparent surface set from script (what the material inspector does).</summary>
        static void MakeTransparent(Material m, Color c)
        {
            SetColor(m, "_BaseColor", c);
            SetColor(m, "_Color", c);
            SetFloat(m, "_Surface", 1f);
            SetFloat(m, "_Blend", 0f);
            SetFloat(m, "_SrcBlend", (float)BlendMode.SrcAlpha);
            SetFloat(m, "_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
            SetFloat(m, "_SrcBlendAlpha", (float)BlendMode.One);
            SetFloat(m, "_DstBlendAlpha", (float)BlendMode.OneMinusSrcAlpha);
            SetFloat(m, "_ZWrite", 0f);
            m.SetOverrideTag("RenderType", "Transparent");
            m.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            m.renderQueue = (int)RenderQueue.Transparent;
            m.enableInstancing = true;
            EditorUtility.SetDirty(m);
        }

        // ================================================================ 4. LOD prefabs

        public class ModelPrefab
        {
            public string id;
            public GameObject prefab;
            public bool fromModel;
            public string kind;
            public int footprintMeters;
        }

        [Serializable] class ManifestEntry { public string file; public string kind; public int era; public int size; }

        /// <summary>Reads models_manifest.json (written by Blender) without a JSON dictionary type: Unity's JsonUtility cannot read dictionaries.</summary>
        static Dictionary<string, ManifestEntry> ReadManifest()
        {
            var result = new Dictionary<string, ManifestEntry>();
            string path = ModelsDir + "/models_manifest.json";
            if (File.Exists(path))
            {
                // simple scan: every "<id>": { "file": "...", "kind": "...", "era": n, "size": n, ... }
                string text = File.ReadAllText(path);
                int models = text.IndexOf("\"models\"", StringComparison.Ordinal);
                int i = models >= 0 ? text.IndexOf('{', models) + 1 : -1;
                while (i > 0 && i < text.Length)
                {
                    int q0 = text.IndexOf('"', i);
                    if (q0 < 0) break;
                    int q1 = text.IndexOf('"', q0 + 1);
                    int b0 = text.IndexOf('{', q1);
                    int b1 = text.IndexOf('}', b0);
                    if (q1 < 0 || b0 < 0 || b1 < 0) break;
                    string id = text.Substring(q0 + 1, q1 - q0 - 1);
                    string body = text.Substring(b0, b1 - b0 + 1);
                    var entry = JsonUtility.FromJson<ManifestEntry>(body);
                    if (entry != null && !string.IsNullOrEmpty(entry.file)) result[id] = entry;
                    i = b1 + 1;
                }
            }
            // also pick up FBX files that are not in the manifest (hand-made replacements)
            foreach (var guid in AssetDatabase.FindAssets("t:Model", new[] { ModelsDir }))
            {
                string p = AssetDatabase.GUIDToAssetPath(guid);
                string id = Path.GetFileNameWithoutExtension(p);
                if (!result.ContainsKey(id))
                    result[id] = new ManifestEntry { file = p, kind = GuessKind(id), size = 1 };
            }
            return result;
        }

        static string GuessKind(string id) =>
            id.StartsWith("vehicle_") ? "vehicle" : id.StartsWith("tree_") ? "tree" : id.StartsWith("infra_") ? "infra" :
            id.StartsWith("zone_") ? "zone" : "building";

        static string PrefabFolder(string kind) =>
            kind == "vehicle" ? "/Vehicles" : kind == "tree" ? "/Trees" : kind == "infra" ? "/Infrastructure" : kind == "zone" ? "/Zones" : "/Buildings";

        static Dictionary<string, ModelPrefab> BuildModelPrefabs(Materials mats)
        {
            var result = new Dictionary<string, ModelPrefab>();
            var manifest = ReadManifest();
            int n = 0;
            foreach (var kv in manifest)
            {
                n++;
                if (!Application.isBatchMode && n % 8 == 0)
                    EditorUtility.DisplayProgressBar("Tamadun & Kota setup", "LOD prefab " + kv.Key, 0.3f + 0.3f * n / manifest.Count);
                var model = AssetDatabase.LoadAssetAtPath<GameObject>(kv.Value.file);
                if (model == null) continue;
                string kind = string.IsNullOrEmpty(kv.Value.kind) ? GuessKind(kv.Key) : kv.Value.kind;
                var prefab = MakeLodPrefab(kv.Key, model, kind, mats.atlas, 1f, PrefabsDir + PrefabFolder(kind) + "/" + kv.Key + ".prefab");
                if (prefab == null) continue;
                int size = Mathf.Max(1, kv.Value.size);
                result[kv.Key] = new ModelPrefab
                {
                    id = kv.Key, prefab = prefab, fromModel = true, kind = kind,
                    footprintMeters = kind == "zone" ? 4 : size == 3 ? 16 : size * 4,
                };
            }
            return result;
        }

        /// <summary>Instantiate the FBX, collect _LOD0/_LOD1/_LOD2 renderers into a LODGroup on the root, assign the atlas and save as a prefab.</summary>
        static GameObject MakeLodPrefab(string id, GameObject model, string kind, Material atlas, float scale, string path)
        {
            var inst = (GameObject)UnityEngine.Object.Instantiate(model);
            try
            {
                inst.name = id;
                inst.transform.position = Vector3.zero;
                inst.transform.rotation = Quaternion.identity;
                inst.transform.localScale = Vector3.one * scale;
                var levels = new List<Renderer>[3] { new List<Renderer>(), new List<Renderer>(), new List<Renderer>() };
                foreach (var r in inst.GetComponentsInChildren<Renderer>(true))
                {
                    r.sharedMaterial = atlas;
                    r.shadowCastingMode = ShadowCastingMode.On;
                    r.receiveShadows = true;
                    int lod = r.name.EndsWith("_LOD2") ? 2 : r.name.EndsWith("_LOD1") ? 1 : 0;
                    levels[lod].Add(r);
                }
                if (levels[0].Count == 0) return null;
                if (levels[2].Count > 0) foreach (var r in levels[2]) r.shadowCastingMode = ShadowCastingMode.On;

                // remove any LODGroup the importer made on a child, keep one on the root
                foreach (var g in inst.GetComponentsInChildren<LODGroup>(true))
                    if (g.gameObject != inst) UnityEngine.Object.DestroyImmediate(g);
                var group = inst.GetComponent<LODGroup>();
                if (group == null) group = inst.AddComponent<LODGroup>();

                // screen-relative heights: big landmarks keep detail longer, vehicles drop it sooner
                float[] h = kind == "vehicle" ? new[] { 0.12f, 0.04f, 0.008f }
                    : kind == "tree" ? new[] { 0.2f, 0.06f, 0.01f }
                    : kind == "infra" ? new[] { 0.15f, 0.05f, 0.005f }
                    : new[] { 0.3f, 0.1f, 0.01f };
                var lods = new List<LOD>();
                for (int i = 0; i < 3; i++)
                    if (levels[i].Count > 0) lods.Add(new LOD(h[lods.Count], levels[i].ToArray()));
                group.SetLODs(lods.ToArray());
                group.fadeMode = LODFadeMode.None;
                group.RecalculateBounds();
                var prefab = PrefabUtility.SaveAsPrefabAsset(inst, path);
                return prefab;
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(inst);
            }
        }

        /// <summary>A model reused at another footprint (for example a 4 m shophouse row as an 8 m market in era 2).</summary>
        static GameObject ScaledVariant(string buildingId, int era, ModelPrefab source, int footprintMeters, Material atlas)
        {
            float k = footprintMeters / (float)Mathf.Max(1, source.footprintMeters);
            if (Mathf.Approximately(k, 1f)) return source.prefab;
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(ReadManifestPath(source.id));
            if (model == null) return source.prefab;
            return MakeLodPrefab(buildingId + "_e" + era, model, source.kind, atlas, k, PrefabsDir + "/Variants/" + buildingId + "_e" + era + ".prefab") ?? source.prefab;
        }

        static string ReadManifestPath(string id)
        {
            var guids = AssetDatabase.FindAssets(id + " t:Model", new[] { ModelsDir });
            foreach (var g in guids)
            {
                var p = AssetDatabase.GUIDToAssetPath(g);
                if (Path.GetFileNameWithoutExtension(p) == id) return p;
            }
            return null;
        }

        static readonly Dictionary<string, GameObject> greyboxCache = new Dictionary<string, GameObject>();

        /// <summary>Greybox cube prefab: footprint-sized, base on the ground, shared greybox material.</summary>
        static GameObject Greybox(int footprintMeters, float height, Material mat)
        {
            string key = footprintMeters + "m_" + Mathf.RoundToInt(height) + "h";
            if (greyboxCache.TryGetValue(key, out var cached) && cached != null) return cached;
            string path = PrefabsDir + "/Greybox/Greybox_" + key + ".prefab";
            var root = new GameObject("Greybox_" + key);
            try
            {
                var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
                UnityEngine.Object.DestroyImmediate(cube.GetComponent<Collider>());
                cube.name = "Block";
                cube.transform.SetParent(root.transform, false);
                float m = footprintMeters * 0.9f;
                cube.transform.localScale = new Vector3(m, height, m);
                cube.transform.localPosition = new Vector3(0, height * 0.5f, 0);
                cube.GetComponent<Renderer>().sharedMaterial = mat;
                var prefab = PrefabUtility.SaveAsPrefabAsset(root, path);
                greyboxCache[key] = prefab;
                return prefab;
            }
            finally
            {
                UnityEngine.Object.DestroyImmediate(root);
            }
        }

        // ================================================================ 5. ScriptableObjects

        static T ReadTable<T>(string name) where T : new()
        {
            string path = GameDataDir + "/" + name + ".json";
            if (!File.Exists(path))
            {
                Debug.LogError("Missing " + path + ": run `npm run unity:data` in the repository root");
                return new T();
            }
            return JsonUtility.FromJson<T>(File.ReadAllText(path));
        }

        static Footprint ToFootprint(int meters) => meters >= 16 ? Footprint.Landmark16x16 : meters >= 8 ? Footprint.Medium8x8 : Footprint.Small4x4;

        static List<ResourceYield> Yields(KeyValue[] kvs)
        {
            var list = new List<ResourceYield>();
            if (kvs == null) return list;
            foreach (var kv in kvs)
            {
                try { list.Add(new ResourceYield { resource = ResourceInfo.FromGood(kv.key), amountPerTick = (float)kv.value }); }
                catch (ArgumentException) { Debug.LogWarning("Unknown good " + kv.key); }
            }
            return list;
        }

        static BuildingCatalog BuildData(Dictionary<string, ModelPrefab> prefabs, Materials mats)
        {
            greyboxCache.Clear();
            var buildings = ReadTable<BuildingTable>("buildings").items;
            var zones = ReadTable<ZoneTable>("zones").items;
            var research = ReadTable<ResearchTable>("research").items;
            var crises = ReadTable<CrisisTable>("crises").items;
            var entries = ReadTable<EntryTable>("sejarahpedia").items;
            var entryById = new Dictionary<string, EntryRecord>();
            foreach (var e in entries) entryById[e.id] = e;

            var catalog = LoadOrCreate(DataDir + "/BuildingCatalog.asset", ScriptableObject.CreateInstance<BuildingCatalog>);
            catalog.buildings.Clear();
            catalog.zoneLots.Clear();

            foreach (var b in buildings)
            {
                var d = LoadOrCreate(DataDir + "/Buildings/" + b.id + ".asset", ScriptableObject.CreateInstance<BuildingData>);
                d.id = b.id;
                d.kind = BuildingKind.Civic;
                d.era = Mathf.Clamp(b.era, 1, 4);
                d.category = b.category;
                d.zoneDensity = 0;
                d.nameMs = b.nameMs;
                d.nameEn = b.nameEn;
                d.descriptionMs = b.descMs;
                d.descriptionEn = b.descEn;
                d.sejarahpediaTitleMs = b.entryTitleMs;
                d.sejarahpediaTitleEn = b.entryTitleEn;
                d.sejarahpediaMs = b.entrySummaryMs;
                d.sejarahpediaEn = b.entrySummaryEn;
                if (b.entryId != null && entryById.TryGetValue(b.entryId, out var entry))
                {
                    if (string.IsNullOrEmpty(d.sejarahpediaMs)) d.sejarahpediaMs = entry.summaryMs;
                    if (string.IsNullOrEmpty(d.sejarahpediaEn)) d.sejarahpediaEn = entry.summaryEn;
                }
                d.footprint = ToFootprint(b.footprintMeters);
                d.cost = (float)b.cost;
                d.upkeep = (float)b.upkeep;
                d.jobs = b.jobs;
                d.yields = Yields(b.produces);
                d.inputs = Yields(b.consumes);
                d.placement = b.placement;
                d.landmark = b.landmark;
                string[] eraIds = b.eraModelIds != null && b.eraModelIds.Length == 4 ? b.eraModelIds : new[] { b.modelId, b.modelId, b.modelId, b.modelId };
                d.upgradable = eraIds.Distinct().Count() > 1;
                float height = b.landmark ? 24f : b.category == "production" ? 6f : 8f;
                d.GreyboxPrefab = Greybox(d.FootprintMeters, height, mats.greybox);
                for (int e = 1; e <= 4; e++)
                {
                    GameObject p = null;
                    if (eraIds[e - 1] != null && prefabs.TryGetValue(eraIds[e - 1], out var mp))
                        p = mp.footprintMeters == d.FootprintMeters ? mp.prefab : ScaledVariant(b.id, e, mp, d.FootprintMeters, mats.atlas);
                    d.SetEraMesh(e, p);
                }
                EditorUtility.SetDirty(d);
                catalog.buildings.Add(d);
            }

            foreach (var z in zones)
            {
                var d = LoadOrCreate(DataDir + "/ZoneLots/" + z.id + ".asset", ScriptableObject.CreateInstance<BuildingData>);
                d.id = z.id;
                d.kind = z.zone == "R" ? BuildingKind.Residential : z.zone == "C" ? BuildingKind.Commercial : BuildingKind.Industrial;
                d.era = 1;
                d.category = "zone";
                d.zoneDensity = z.density;
                d.nameMs = z.nameMs;
                d.nameEn = z.nameEn;
                d.descriptionMs = z.eraNamesMs != null ? string.Join(" / ", z.eraNamesMs) : "";
                d.descriptionEn = z.eraNamesEn != null ? string.Join(" / ", z.eraNamesEn) : "";
                d.footprint = Footprint.Small4x4;
                d.jobs = z.capacity;
                d.upgradable = true;
                d.GreyboxPrefab = Greybox(4, 3f + 2.5f * z.density, mats.greybox);
                for (int e = 1; e <= 4; e++)
                {
                    string mid = z.eraModelIds != null && z.eraModelIds.Length >= e ? z.eraModelIds[e - 1] : null;
                    d.SetEraMesh(e, mid != null && prefabs.TryGetValue(mid, out var mp) ? mp.prefab : null);
                }
                EditorUtility.SetDirty(d);
                catalog.zoneLots.Add(d);
            }

            var tree = LoadOrCreate(DataDir + "/TechCivicTree.asset", ScriptableObject.CreateInstance<TechCivicTreeSO>);
            tree.Populate(research, crises);
            EditorUtility.SetDirty(tree);

            catalog.atlasMaterial = mats.atlas;
            catalog.ghostMaterial = mats.ghost;
            catalog.vehiclePrefabs = prefabs.Values.Where(p => p.kind == "vehicle").OrderBy(p => p.id).Select(p => p.prefab).ToList();
            catalog.treePrefabs = prefabs.Values.Where(p => p.kind == "tree").OrderBy(p => p.id).Select(p => p.prefab).ToList();
            EditorUtility.SetDirty(catalog);
            AssetDatabase.SaveAssets();
            Debug.Log($"[Tamadun & Kota] TechCivicTree: {tree.technologies.Count} technologies, {tree.civics.Count} civics, {tree.crises.Count} crises");
            return catalog;
        }

        // ================================================================ 6. scene


        static void BuildScene(BuildingCatalog catalog, Materials mats)
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            int ground = LayerMask.NameToLayer("Ground"), waterLayer = LayerMask.NameToLayer("Water"), uiLayer = LayerMask.NameToLayer("UI");

            // lighting: tropical sun, trilight ambient, procedural sky
            var sunGo = new GameObject("Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.95f, 0.86f);
            sun.intensity = 1.35f;
            sun.shadows = LightShadows.Soft;
            sunGo.transform.rotation = Quaternion.Euler(52f, -35f, 0f);
            RenderSettings.sun = sun;
            if (mats.skybox != null) RenderSettings.skybox = mats.skybox;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.72f, 0.86f);
            RenderSettings.ambientEquatorColor = new Color(0.52f, 0.57f, 0.52f);
            RenderSettings.ambientGroundColor = new Color(0.3f, 0.28f, 0.24f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.72f, 0.8f, 0.86f);
            RenderSettings.fogStartDistance = 600f;
            RenderSettings.fogEndDistance = 1800f;

            // game root
            var rootGo = new GameObject("GameRoot");
            var gameRoot = rootGo.AddComponent<GameRoot>();
            gameRoot.catalog = catalog;

            // world: terrain + water
            var worldGo = new GameObject("World");
            var world = worldGo.AddComponent<WorldBuilder>();
            var terrainData = LoadOrCreate(SettingsDir + "/MainGameTerrain.asset", () => new TerrainData());
            terrainData.heightmapResolution = 513;
            terrainData.size = new Vector3(512f, WorldBuilder.HeightRange, 512f);
            EditorUtility.SetDirty(terrainData);
            var terrainGo = Terrain.CreateTerrainGameObject(terrainData);
            terrainGo.name = "Terrain";
            terrainGo.transform.SetParent(worldGo.transform, false);
            terrainGo.transform.position = new Vector3(0, -WorldBuilder.BaseDepth, 0);
            if (ground >= 0) terrainGo.layer = ground;
            var terrain = terrainGo.GetComponent<Terrain>();
            var terrainShader = FindShader("Universal Render Pipeline/Terrain/Lit");
            if (terrainShader != null)
            {
                var tm = LoadOrCreate(MaterialsDir + "/TerrainLit.mat", () => new Material(terrainShader));
                terrain.materialTemplate = tm;
            }
            terrain.treeDistance = 900f;
            terrain.treeBillboardDistance = 260f;
            terrain.basemapDistance = 1000f;
            terrain.heightmapPixelError = 4f;
            world.terrain = terrain;
            var waterGo = GameObject.CreatePrimitive(PrimitiveType.Plane);
            waterGo.name = "Straits of Melaka (Water)";
            UnityEngine.Object.DestroyImmediate(waterGo.GetComponent<Collider>());
            waterGo.transform.SetParent(worldGo.transform, false);
            waterGo.transform.position = new Vector3(256f, 0f, 256f);
            waterGo.transform.localScale = new Vector3(170f, 1f, 170f);
            if (waterLayer >= 0) waterGo.layer = waterLayer;
            waterGo.GetComponent<Renderer>().sharedMaterial = mats.water;
            waterGo.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;
            world.water = waterGo.transform;
            world.waterMaterial = mats.water;
            world.treePrefabs = catalog.treePrefabs.Where(p => p != null).ToArray();

            // camera rig
            var rigGo = new GameObject("Camera Rig (RTS)");
            rigGo.transform.position = new Vector3(256f, 0f, 256f);
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            camGo.transform.SetParent(rigGo.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.nearClipPlane = 0.5f;
            cam.farClipPlane = 3000f;
            cam.fieldOfView = 45f;
            camGo.AddComponent<AudioListener>();
            var camData = camGo.AddComponent<UniversalAdditionalCameraData>();
            camData.renderPostProcessing = true;
            camData.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            var rts = rigGo.AddComponent<RTSCameraController>();
            rts.cam = cam;
            rts.SetBounds(512f, 512f);
            TryAddCinemachine(camGo, rigGo);

            // city view + placement
            var cityGo = new GameObject("City");
            var cityView = cityGo.AddComponent<CityView>();
            cityView.world = world;
            cityView.catalog = catalog;
            cityView.transportMaterial = mats.atlas;
            var placement = cityGo.AddComponent<GridPlacementSystem>();
            placement.cam = cam;
            placement.cityView = cityView;
            placement.world = world;
            placement.catalog = catalog;
            placement.ghostMaterial = mats.ghost;
            if (ground >= 0) placement.groundMask = 1 << ground;

            // simulation managers
            var systemsGo = new GameObject("Systems");
            var time = systemsGo.AddComponent<TimeManager>();
            var economy = systemsGo.AddComponent<EconomyManager>();
            economy.time = time;
            var era = systemsGo.AddComponent<EraManager>();
            era.cityView = cityView;
            var save = systemsGo.AddComponent<SaveLoadManager>();
            systemsGo.AddComponent<SteamworksManager>();
            var audio = systemsGo.AddComponent<AudioAtmosphereManager>();
            audio.listenerCamera = cam;
            var artToggle = systemsGo.AddComponent<ArtModeToggle>();

            // traffic + NavMesh
            var trafficGo = new GameObject("Citizens & Traffic");
            var surface = trafficGo.AddComponent<NavMeshSurface>();
            surface.collectObjects = CollectObjects.All;
            surface.useGeometry = NavMeshCollectGeometry.PhysicsColliders;
            surface.layerMask = ground >= 0 ? 1 << ground : ~0;
            var traffic = trafficGo.AddComponent<CitizenTrafficNavMesh>();
            traffic.world = world;
            traffic.catalog = catalog;
            traffic.navSurface = surface;

            // HUD: canvas + the Greybox / Full 3D Art toggle (the rest is built by UIManager at runtime)
            var canvasGo = new GameObject("HUD Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            if (uiLayer >= 0) canvasGo.layer = uiLayer;
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 0.5f;
            var button = CreateArtToggleButton(canvasGo.transform, artToggle);
            var ui = canvasGo.AddComponent<UIManager>();
            ui.canvas = canvas;
            ui.artToggleButton = button;
            ui.placement = placement;
            ui.time = time;
            ui.economy = economy;
            ui.eraManager = era;
            ui.saveLoad = save;
            ui.catalog = catalog;

            var esGo = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
            esGo.transform.SetAsLastSibling();

            EditorSceneManager.MarkSceneDirty(scene);
            EditorSceneManager.SaveScene(scene, ScenePath);
            var scenes = EditorBuildSettings.scenes.Where(s => s.path != ScenePath).ToList();
            scenes.Insert(0, new EditorBuildSettingsScene(ScenePath, true));
            EditorBuildSettings.scenes = scenes.ToArray();
            Selection.activeGameObject = rigGo;
        }

        static Button CreateArtToggleButton(Transform canvas, ArtModeToggle target)
        {
            var go = new GameObject("Greybox / Full 3D Art", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
            go.transform.SetParent(canvas, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = new Vector2(1, 1);
            rt.pivot = new Vector2(1, 1);
            rt.sizeDelta = new Vector2(220, 40);
            rt.anchoredPosition = new Vector2(-12, -72);
            go.GetComponent<Image>().color = new Color(0.16f, 0.22f, 0.19f, 1f);
            var le = go.GetComponent<LayoutElement>();
            le.preferredWidth = 220;
            le.minWidth = 220;
            le.preferredHeight = 40;
            var labelGo = new GameObject("Label", typeof(RectTransform), typeof(Text));
            labelGo.transform.SetParent(go.transform, false);
            var lrt = (RectTransform)labelGo.transform;
            lrt.anchorMin = Vector2.zero;
            lrt.anchorMax = Vector2.one;
            lrt.offsetMin = lrt.offsetMax = Vector2.zero;
            var text = labelGo.GetComponent<Text>();
            text.text = "Greybox / Full 3D Art";
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = 16;
            text.alignment = TextAnchor.MiddleCenter;
            text.color = new Color(0.95f, 0.93f, 0.86f);
            text.raycastTarget = false;
            var button = go.GetComponent<Button>();
            UnityEventTools.AddPersistentListener(button.onClick, target.Toggle);
            return button;
        }

        /// <summary>
        /// Adds a CinemachineBrain to the camera and a disabled CinemachineCamera "Cinematic Camera"
        /// (for era-transition fly-overs) if Cinemachine 3 is installed. Done by reflection so the
        /// project compiles even if the package is removed. The RTS controller drives the camera
        /// directly while no CinemachineCamera is live.
        /// </summary>
        static void TryAddCinemachine(GameObject cameraGo, GameObject rig)
        {
            var brainType = Type.GetType("Unity.Cinemachine.CinemachineBrain, Unity.Cinemachine");
            var vcamType = Type.GetType("Unity.Cinemachine.CinemachineCamera, Unity.Cinemachine");
            if (brainType == null || vcamType == null) return;
            cameraGo.AddComponent(brainType);
            var vcamGo = new GameObject("Cinematic Camera (Cinemachine)");
            vcamGo.transform.position = new Vector3(256f, 160f, -40f);
            vcamGo.transform.rotation = Quaternion.Euler(35f, 0f, 0f);
            vcamGo.AddComponent(vcamType);
            vcamGo.SetActive(false);
        }
    }

    /// <summary>Import rules for the Blender output, applied on first import and by the setup menu.</summary>
    public class TamadunArtImportRules : AssetPostprocessor
    {
        void OnPreprocessModel()
        {
            if (assetPath.StartsWith("Assets/Art/Models/", StringComparison.Ordinal) && assetImporter is ModelImporter mi)
                ApplyModelRules(mi);
        }

        void OnPreprocessTexture()
        {
            if (assetPath.StartsWith("Assets/Art/Textures/", StringComparison.Ordinal) && assetImporter is TextureImporter ti)
                ApplyTextureRules(ti);
        }

        /// <summary>1 unit = 1 metre, Y up, no imported materials (the atlas is assigned by the prefab step). Returns true if anything changed.</summary>
        public static bool ApplyModelRules(ModelImporter mi)
        {
            bool changed = false;
            void Set<T>(T current, T wanted, Action<T> apply)
            {
                if (EqualityComparer<T>.Default.Equals(current, wanted)) return;
                apply(wanted);
                changed = true;
            }
            Set(mi.globalScale, 1f, v => mi.globalScale = v);
            Set(mi.useFileScale, true, v => mi.useFileScale = v);
            Set(mi.bakeAxisConversion, true, v => mi.bakeAxisConversion = v);
            Set(mi.materialImportMode, ModelImporterMaterialImportMode.None, v => mi.materialImportMode = v);
            Set(mi.importNormals, ModelImporterNormals.Import, v => mi.importNormals = v);
            Set(mi.importAnimation, false, v => mi.importAnimation = v);
            Set(mi.animationType, ModelImporterAnimationType.None, v => mi.animationType = v);
            Set(mi.importCameras, false, v => mi.importCameras = v);
            Set(mi.importLights, false, v => mi.importLights = v);
            Set(mi.isReadable, false, v => mi.isReadable = v);
            Set(mi.addCollider, false, v => mi.addCollider = v);
            Set(mi.meshCompression, ModelImporterMeshCompression.Off, v => mi.meshCompression = v);
            return changed;
        }

        /// <summary>The atlas must stay pixel-exact: no mipmaps (cells would bleed), clamp, uncompressed.</summary>
        public static bool ApplyTextureRules(TextureImporter ti)
        {
            bool linear = ti.assetPath.Contains("MetallicSmoothness");
            bool changed = false;
            if (ti.textureType != TextureImporterType.Default) { ti.textureType = TextureImporterType.Default; changed = true; }
            if (ti.mipmapEnabled) { ti.mipmapEnabled = false; changed = true; }
            if (ti.wrapMode != TextureWrapMode.Clamp) { ti.wrapMode = TextureWrapMode.Clamp; changed = true; }
            if (ti.filterMode != FilterMode.Bilinear) { ti.filterMode = FilterMode.Bilinear; changed = true; }
            if (ti.sRGBTexture == linear) { ti.sRGBTexture = !linear; changed = true; }
            if (ti.textureCompression != TextureImporterCompression.Uncompressed) { ti.textureCompression = TextureImporterCompression.Uncompressed; changed = true; }
            if (ti.alphaSource != TextureImporterAlphaSource.FromInput) { ti.alphaSource = TextureImporterAlphaSource.FromInput; changed = true; }
            if (ti.alphaIsTransparency) { ti.alphaIsTransparency = false; changed = true; }
            return changed;
        }
    }

    /// <summary>
    /// On the first editor load of a fresh clone: make sure the colour space is Linear and offer
    /// to run the setup menu when the playable scene does not exist yet.
    /// </summary>
    [InitializeOnLoad]
    static class TamadunFirstRun
    {
        static TamadunFirstRun()
        {
            EditorApplication.delayCall += () =>
            {
                if (Application.isBatchMode) return;
                if (PlayerSettings.colorSpace != ColorSpace.Linear) PlayerSettings.colorSpace = ColorSpace.Linear;
                if (File.Exists("Assets/Scenes/MainGame.unity")) return;
                string key = "TamadunKota.FirstRunPrompt." + Application.dataPath.GetHashCode();
                if (SessionState.GetBool(key, false)) return;
                SessionState.SetBool(key, true);
                if (EditorUtility.DisplayDialog("Tamadun & Kota",
                        "This clone has no playable scene yet.\n\nBuild the ScriptableObjects, LOD prefabs, URP settings and Assets/Scenes/MainGame.unity now?\n" +
                        "(Menu: Tamadun & Kota > 1. Build All ScriptableObjects, LOD Prefabs & Playable Scene)",
                        "Build now", "Later"))
                    TamadunAutoSetupEditor.BuildAll();
            };
        }
    }
}
