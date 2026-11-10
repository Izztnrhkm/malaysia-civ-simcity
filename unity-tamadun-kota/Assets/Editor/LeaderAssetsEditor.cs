using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace TamadunKota.Editor
{
    /// <summary>Imports the standalone leader FBX assets and builds their Resources prefabs.</summary>
    public sealed class LeaderAssetsEditor : AssetPostprocessor
    {
        const string ArtRoot = "Assets/Art/Leaders/";
        const string ResourceRoot = "Assets/Resources/Leaders/";
        static readonly string[] MaterialNames = { "Skin", "Cloth", "Metal", "Hair" };
        static bool queued;

        bool IsLeaderModel => assetPath.StartsWith(ArtRoot, StringComparison.Ordinal) &&
                              assetPath.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase);

        void OnPreprocessModel()
        {
            if (!IsLeaderModel) return;
            var importer = (ModelImporter)assetImporter;
            importer.animationType = ModelImporterAnimationType.Legacy;
            importer.importAnimation = true;
            importer.importCameras = false;
            importer.importLights = false;
            importer.isReadable = false;
            importer.optimizeGameObjects = false;
            importer.globalScale = 1;
            importer.materialImportMode = ModelImporterMaterialImportMode.None;
        }

        void OnPreprocessAnimation()
        {
            if (!IsLeaderModel) return;
            var importer = (ModelImporter)assetImporter;
            var defaults = importer.defaultClipAnimations;
            string take = defaults.Length > 0 ? defaults[0].takeName : "Scene";
            importer.clipAnimations = new[]
            {
                new ModelImporterClipAnimation
                {
                    name = "Idle", takeName = take, firstFrame = 0, lastFrame = 119,
                    loopTime = true, loopPose = true, wrapMode = WrapMode.Loop
                },
                new ModelImporterClipAnimation
                {
                    name = "Greeting", takeName = take, firstFrame = 120, lastFrame = 179,
                    loopTime = false, loopPose = false, wrapMode = WrapMode.Once
                }
            };
        }

        void OnPostprocessModel(GameObject model)
        {
            if (!IsLeaderModel) return;
            AssignMaterials(model, Path.GetFileNameWithoutExtension(assetPath));
        }

        static void AssignMaterials(GameObject model, string id)
        {
            var materials = new Material[MaterialNames.Length];
            for (int i = 0; i < materials.Length; i++)
                materials[i] = AssetDatabase.LoadAssetAtPath<Material>(ArtRoot + id + "/Materials/" + id + "_" + MaterialNames[i] + ".mat");
            foreach (var renderer in model.GetComponentsInChildren<Renderer>(true))
                renderer.sharedMaterials = materials;
        }

        [InitializeOnLoadMethod]
        static void Initialize() => Schedule();

        static void OnPostprocessAllAssets(string[] imported, string[] deleted, string[] moved, string[] movedFrom)
        {
            if (imported.Any(p => p.StartsWith(ArtRoot, StringComparison.Ordinal) && p.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase)))
                Schedule();
        }

        static void Schedule()
        {
            if (queued) return;
            queued = true;
            EditorApplication.delayCall += RebuildWhenReady;
        }

        static void RebuildWhenReady()
        {
            if (EditorApplication.isCompiling || EditorApplication.isUpdating)
            {
                EditorApplication.delayCall += RebuildWhenReady;
                return;
            }
            queued = false;
            RebuildLeaderPrefabs();
        }

        [MenuItem("Tamadun & Kota/6. Rebuild Leader Prefabs")]
        public static void RebuildLeaderPrefabs()
        {
            if (!Directory.Exists(ArtRoot)) return;
            Directory.CreateDirectory(ResourceRoot);
            int built = 0;
            foreach (string path in Directory.GetFiles(ArtRoot, "*.fbx", SearchOption.AllDirectories))
            {
                string normalized = path.Replace('\\', '/');
                string id = Path.GetFileNameWithoutExtension(path);
                var model = AssetDatabase.LoadAssetAtPath<GameObject>(normalized);
                if (model == null) continue;
                var instance = UnityEngine.Object.Instantiate(model);
                try
                {
                    instance.name = id;
                    // Blender source characters face -Y. The FBX coordinate
                    // conversion imports them facing +Z; previews face -Z.
                    instance.transform.localRotation = Quaternion.Euler(0, 180, 0);
                    AssignMaterials(instance, id);
                    var animation = instance.GetComponent<Animation>();
                    if (animation == null) animation = instance.AddComponent<Animation>();
                    var clips = AssetDatabase.LoadAllAssetsAtPath(normalized).OfType<AnimationClip>();
                    foreach (var clip in clips)
                    {
                        if (clip.name.StartsWith("__preview__", StringComparison.Ordinal)) continue;
                        string name = clip.name.EndsWith("Greeting", StringComparison.Ordinal) ? "Greeting" :
                                      clip.name.EndsWith("Idle", StringComparison.Ordinal) ? "Idle" : null;
                        if (name == null) continue;
                        animation.AddClip(clip, name);
                        if (name == "Idle") animation.clip = clip;
                    }
                    animation.playAutomatically = true;
                    animation.wrapMode = WrapMode.Loop;
                    var group = instance.GetComponent<LODGroup>();
                    if (group == null) group = instance.AddComponent<LODGroup>();
                    var renderers = instance.GetComponentsInChildren<Renderer>(true);
                    group.SetLODs(new[]
                    {
                        new LOD(0.55f, renderers.Where(r => r.name.EndsWith("_LOD0", StringComparison.Ordinal)).ToArray()),
                        new LOD(0.22f, renderers.Where(r => r.name.EndsWith("_LOD1", StringComparison.Ordinal)).ToArray()),
                        new LOD(0.035f, renderers.Where(r => r.name.EndsWith("_LOD2", StringComparison.Ordinal)).ToArray())
                    });
                    group.RecalculateBounds();
                    PrefabUtility.SaveAsPrefabAsset(instance, ResourceRoot + id + ".prefab");
                    built++;
                }
                finally { UnityEngine.Object.DestroyImmediate(instance); }
            }
            if (built > 0) Debug.Log("Built " + built + " leader preview prefabs (Idle/Greeting, three LODs).");
        }
    }
}
