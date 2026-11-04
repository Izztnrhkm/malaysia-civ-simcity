using System;
using System.Collections.Generic;
using TamadunKota.Simulation;
using UnityEngine;

namespace TamadunKota.Data
{
    /// <summary>Footprint on the 1 unit = 1 metre grid.</summary>
    public enum Footprint
    {
        Small4x4 = 4,
        Medium8x8 = 8,
        Landmark16x16 = 16,
    }

    public enum BuildingKind
    {
        Civic,
        Residential,
        Commercial,
        Industrial,
    }

    [Serializable]
    public struct ResourceYield
    {
        public ResourceType resource;
        public float amountPerTick;
    }

    /// <summary>
    /// One placeable building type. Holds bilingual text (Bahasa Melayu / English), the
    /// Sejarahpedia summary, its footprint, economy values and one prefab per era: a lot
    /// that grows from a timber Kampung house (Era 1) to a brick Rumah Kedai (Era 2), a
    /// concrete apartment or factory (Era 3) and an eco-tower or smart hub (Era 4).
    /// Generated from Assets/Resources/GameData by "Tamadun & Kota/1. Build All ..." and
    /// editable afterwards.
    /// </summary>
    [CreateAssetMenu(fileName = "BuildingData", menuName = "Tamadun & Kota/Building Data", order = 0)]
    public class BuildingData : ScriptableObject
    {
        [Header("Identity")]
        public string id;
        public BuildingKind kind = BuildingKind.Civic;
        [Range(1, 4)] public int era = 1;
        public string category;
        [Tooltip("Zone density level for zoned lots (0 for civic buildings)")]
        [Range(0, 4)] public int zoneDensity;

        [Header("Bahasa Melayu")]
        public string nameMs;
        [TextArea(2, 6)] public string descriptionMs;
        public string sejarahpediaTitleMs;
        [TextArea(3, 10)] public string sejarahpediaMs;

        [Header("English")]
        public string nameEn;
        [TextArea(2, 6)] public string descriptionEn;
        public string sejarahpediaTitleEn;
        [TextArea(3, 10)] public string sejarahpediaEn;

        [Header("Grid & economy")]
        public Footprint footprint = Footprint.Small4x4;
        public float cost;
        public float upkeep;
        public int jobs;
        public List<ResourceYield> yields = new List<ResourceYield>();
        public List<ResourceYield> inputs = new List<ResourceYield>();
        [Tooltip("land, coast, water, river, tin, fertile, forest or rail")]
        public string placement = "land";
        public bool landmark;
        [Tooltip("Swaps its mesh when the city enters a new era")]
        public bool upgradable;

        [Header("Era meshes (prefabs with LODGroup: _LOD0 / _LOD1 / _LOD2)")]
        public GameObject Era1Mesh;
        public GameObject Era2Mesh;
        public GameObject Era3Mesh;
        public GameObject Era4Mesh;
        [Tooltip("Plain cube scaled to the footprint, used in Greybox mode and when an era mesh is missing")]
        public GameObject GreyboxPrefab;

        public int FootprintMeters => (int)footprint;

        /// <summary>The prefab for an era, falling back to the nearest earlier (then later) era.</summary>
        public GameObject PrefabForEra(int targetEra)
        {
            for (int e = Mathf.Clamp(targetEra, 1, 4); e >= 1; e--)
            {
                var p = RawEraMesh(e);
                if (p != null) return p;
            }
            for (int e = targetEra + 1; e <= 4; e++)
            {
                var p = RawEraMesh(e);
                if (p != null) return p;
            }
            return GreyboxPrefab;
        }

        public GameObject RawEraMesh(int e)
        {
            switch (e)
            {
                case 1: return Era1Mesh;
                case 2: return Era2Mesh;
                case 3: return Era3Mesh;
                default: return Era4Mesh;
            }
        }

        public void SetEraMesh(int e, GameObject prefab)
        {
            switch (e)
            {
                case 1: Era1Mesh = prefab; break;
                case 2: Era2Mesh = prefab; break;
                case 3: Era3Mesh = prefab; break;
                default: Era4Mesh = prefab; break;
            }
        }

        public string DisplayName(bool malay) => malay ? nameMs : nameEn;
    }
}
