using System;
using System.Collections.Generic;
using UnityEngine;

namespace TamadunKota.Core
{
    /// <summary>
    /// Where each PBR material sits in MasterPaletteAtlas.png. Written by
    /// scripts/blender_unity_pipeline.py to Resources/atlas_layout.json so procedural meshes
    /// (roads, rails) can sample the same atlas and share the single SRP-Batcher material.
    /// </summary>
    [Serializable]
    public class AtlasLayoutData
    {
        public int grid = 16;
        public int size = 512;
        public string[] materials = Array.Empty<string>();
    }

    public static class AtlasLayout
    {
        static Dictionary<string, int> index;
        static int grid = 16;

        static void Ensure()
        {
            if (index != null) return;
            index = new Dictionary<string, int>();
            var asset = Resources.Load<TextAsset>("atlas_layout");
            if (asset == null) return;
            var data = JsonUtility.FromJson<AtlasLayoutData>(asset.text);
            grid = Mathf.Max(1, data.grid);
            for (int i = 0; i < data.materials.Length; i++) index[data.materials[i]] = i;
        }

        /// <summary>UV at the centre of a material's cell (row 0 at the top of the image).</summary>
        public static Vector2 UV(string material)
        {
            Ensure();
            if (!index.TryGetValue(material, out int i)) return new Vector2(0.5f / grid, 1 - 0.5f / grid);
            int cx = i % grid, cy = i / grid;
            return new Vector2((cx + 0.5f) / grid, 1f - (cy + 0.5f) / grid);
        }

        public static bool Loaded { get { Ensure(); return index.Count > 0; } }
    }
}
