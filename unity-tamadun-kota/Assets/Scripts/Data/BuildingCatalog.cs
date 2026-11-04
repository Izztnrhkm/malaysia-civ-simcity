using System.Collections.Generic;
using UnityEngine;

namespace TamadunKota.Data
{
    /// <summary>Every BuildingData asset, plus shared art references, in one place for runtime lookups.</summary>
    [CreateAssetMenu(fileName = "BuildingCatalog", menuName = "Tamadun & Kota/Building Catalog", order = 2)]
    public class BuildingCatalog : ScriptableObject
    {
        public List<BuildingData> buildings = new List<BuildingData>();
        [Tooltip("Zoned lots: R/C/I x density 1..4")]
        public List<BuildingData> zoneLots = new List<BuildingData>();
        public Material atlasMaterial;
        public Material ghostMaterial;
        [Tooltip("Vehicles keyed by model id (vehicle_car, vehicle_steam_loco, ...)")]
        public List<GameObject> vehiclePrefabs = new List<GameObject>();
        public List<GameObject> treePrefabs = new List<GameObject>();

        Dictionary<string, BuildingData> byId;

        public BuildingData Find(string id)
        {
            if (byId == null || byId.Count != buildings.Count + zoneLots.Count)
            {
                byId = new Dictionary<string, BuildingData>();
                foreach (var b in buildings) if (b != null && !string.IsNullOrEmpty(b.id)) byId[b.id] = b;
                foreach (var b in zoneLots) if (b != null && !string.IsNullOrEmpty(b.id)) byId[b.id] = b;
            }
            return id != null && byId.TryGetValue(id, out var d) ? d : null;
        }

        public BuildingData ZoneLot(char zone, int density) => Find("zone_" + zone + "_" + Mathf.Clamp(density, 1, 4));

        public GameObject Vehicle(string modelId)
        {
            foreach (var v in vehiclePrefabs) if (v != null && v.name == modelId) return v;
            return null;
        }
    }
}
