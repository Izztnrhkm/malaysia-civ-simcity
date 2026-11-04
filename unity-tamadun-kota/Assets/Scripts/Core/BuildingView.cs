using TamadunKota.Data;
using UnityEngine;

namespace TamadunKota.Core
{
    /// <summary>
    /// The visual of one placed building or developed lot. Holds an art child (prefab with a
    /// LODGroup: _LOD0 / _LOD1 / _LOD2 on the shared atlas material) and a greybox child.
    /// On an era change the meshes are swapped in place inside the existing MeshFilters and
    /// LODGroup when the new era prefab has the same LOD structure, otherwise the art child is
    /// re-instantiated.
    /// </summary>
    public class BuildingView : MonoBehaviour
    {
        public BuildingData data;
        public int buildingId = -1;
        public int cellIndex = -1;
        public int era = 1;
        public GameObject art;
        public GameObject greybox;

        public void Init(BuildingData d, int forEra)
        {
            data = d;
            era = Mathf.Clamp(forEra, 1, 4);
            BuildArt(d.PrefabForEra(era));
            BuildGreybox();
            ApplyArtMode(ArtMode.Greybox);
        }

        void OnEnable() => ArtMode.Changed += ApplyArtMode;
        void OnDisable() => ArtMode.Changed -= ApplyArtMode;

        void BuildArt(GameObject prefab)
        {
            if (art != null) Destroy(art);
            art = null;
            if (prefab == null || prefab == data.GreyboxPrefab) return;
            art = Instantiate(prefab, transform);
            art.name = "Art";
            art.transform.localPosition = Vector3.zero;
            art.transform.localRotation = Quaternion.identity;
        }

        void BuildGreybox()
        {
            if (greybox != null) return;
            if (data.GreyboxPrefab != null)
            {
                greybox = Instantiate(data.GreyboxPrefab, transform);
            }
            else
            {
                greybox = GameObject.CreatePrimitive(PrimitiveType.Cube);
                var col = greybox.GetComponent<Collider>();
                if (col != null) Destroy(col);
                greybox.transform.SetParent(transform, false);
                float m = data.FootprintMeters * 0.9f;
                float h = data.landmark ? 24f : 3f + 2.5f * Mathf.Max(1, data.zoneDensity);
                greybox.transform.localScale = new Vector3(m, h, m);
                greybox.transform.localPosition = new Vector3(0, h * 0.5f, 0);
            }
            greybox.name = "Greybox";
        }

        public void ApplyArtMode(bool greyboxMode)
        {
            bool hasArt = art != null;
            if (art != null) art.SetActive(!greyboxMode);
            if (greybox != null) greybox.SetActive(greyboxMode || !hasArt);
        }

        /// <summary>Swap to the mesh set of another era (called by EraManager.OnEraAdvanced).</summary>
        public void SetEra(int newEra)
        {
            newEra = Mathf.Clamp(newEra, 1, 4);
            if (newEra == era || data == null) return;
            var prefab = data.PrefabForEra(newEra);
            var oldPrefab = data.PrefabForEra(era);
            era = newEra;
            if (prefab == oldPrefab) return;
            if (!SwapMeshesInPlace(prefab)) BuildArt(prefab);
            ApplyArtMode(ArtMode.Greybox);
        }

        /// <summary>Copy each LOD's meshes from the prefab into this instance's MeshFilters.</summary>
        bool SwapMeshesInPlace(GameObject prefab)
        {
            if (art == null || prefab == null) return false;
            var mine = art.GetComponent<LODGroup>();
            var theirs = prefab.GetComponent<LODGroup>();
            if (mine == null || theirs == null) return false;
            var a = mine.GetLODs();
            var b = theirs.GetLODs();
            if (a.Length != b.Length) return false;
            for (int i = 0; i < a.Length; i++)
                if (a[i].renderers == null || b[i].renderers == null || a[i].renderers.Length != b[i].renderers.Length) return false;
            for (int i = 0; i < a.Length; i++)
                for (int k = 0; k < a[i].renderers.Length; k++)
                {
                    var src = b[i].renderers[k] != null ? b[i].renderers[k].GetComponent<MeshFilter>() : null;
                    var dst = a[i].renderers[k] != null ? a[i].renderers[k].GetComponent<MeshFilter>() : null;
                    if (src == null || dst == null) return false;
                    dst.sharedMesh = src.sharedMesh;
                    a[i].renderers[k].transform.localPosition = b[i].renderers[k].transform.localPosition;
                    a[i].renderers[k].transform.localRotation = b[i].renderers[k].transform.localRotation;
                    a[i].renderers[k].transform.localScale = b[i].renderers[k].transform.localScale;
                }
            // era variants may be scaled (a 4 m shophouse model reused for an 8 m market)
            art.transform.localScale = prefab.transform.localScale;
            mine.RecalculateBounds();
            return true;
        }
    }
}
