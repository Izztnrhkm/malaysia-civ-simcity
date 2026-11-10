using System;

namespace TamadunKota.Simulation
{
    [Serializable]
    public sealed class StateRecord
    {
        public string id, leaderId, mapId, nameMs, nameEn, descMs, descEn, abilityMs, abilityEn;
        public EffectRecord effects = new EffectRecord();
    }

    [Serializable]
    public sealed class LeaderRecord
    {
        public string id, name, titleMs, titleEn, bioMs, bioEn, abilityMs, abilityEn, modelResource, portraitResource;
        public bool interpretive;
        public SourceRecord[] sources = Array.Empty<SourceRecord>();
        public EffectRecord effects = new EffectRecord();
    }

    [Serializable] public sealed class StateTable { public StateRecord[] items = Array.Empty<StateRecord>(); }
    [Serializable] public sealed class LeaderTable { public LeaderRecord[] items = Array.Empty<LeaderRecord>(); }

    /// <summary>New-game choices. The simulation takes a copy so callers cannot change a running city's identity.</summary>
    [Serializable]
    public sealed class GameSetup
    {
        public string stateId = "melaka", leaderId = "tun_perak", mapId = "melaka_region", scenarioId = "melaka_1400";
        public int seed = 42;

        public GameSetup Copy() => new GameSetup { stateId = stateId, leaderId = leaderId, mapId = mapId, scenarioId = scenarioId, seed = seed };

        public void Validate(GameDatabase db)
        {
            var state = db.StateById(stateId);
            if (state == null || db.LeaderById(leaderId) == null || state.leaderId != leaderId || state.mapId != mapId)
                throw new ArgumentException("The state, leader and regional map must belong to the same pairing.");
            bool found = false;
            foreach (var scenario in db.Scenarios) if (scenario.id == scenarioId) { found = true; break; }
            if (!found) throw new ArgumentException("Unknown starting scenario.");
        }
    }

    /// <summary>Portable exact map layers. Base64 strings have the same JSON representation in Unity and .NET.</summary>
    [Serializable]
    public sealed class MapSnapshot
    {
        public int width, height, seed, mouthX, mouthY;
        public string terrain, elevation, fertility, tin;

        public static MapSnapshot Capture(MapData map) => new MapSnapshot
        {
            width = map.Width, height = map.Height, seed = map.Seed,
            mouthX = map.MouthX, mouthY = map.MouthY,
            terrain = Convert.ToBase64String(map.Terrain), elevation = Convert.ToBase64String(map.Elevation),
            fertility = Convert.ToBase64String(map.Fertility), tin = Convert.ToBase64String(map.Tin),
        };

        public MapData CreateMap()
        {
            if (width < 8 || height < 8 || width > 512 || height > 512) throw new FormatException("Invalid map dimensions.");
            int count = width * height;
            byte[] Decode(string value)
            {
                if (value == null || value.Length > (count + 2) / 3 * 4) throw new FormatException("Invalid map layer length.");
                var bytes = Convert.FromBase64String(value);
                if (bytes.Length != count) throw new FormatException("Map layer dimensions do not match.");
                return bytes;
            }
            var terrainBytes = Decode(terrain);
            foreach (byte t in terrainBytes) if (t > (byte)TerrainType.Mountain) throw new FormatException("Unknown terrain type.");
            var elevationBytes = Decode(elevation); var fertilityBytes = Decode(fertility); var tinBytes = Decode(tin);
            var map = new MapData(width, height, seed);
            map.MouthX = Math.Max(0, Math.Min(width - 1, mouthX));
            map.MouthY = Math.Max(0, Math.Min(height - 1, mouthY));
            Array.Copy(terrainBytes, map.Terrain, count); Array.Copy(elevationBytes, map.Elevation, count);
            Array.Copy(fertilityBytes, map.Fertility, count); Array.Copy(tinBytes, map.Tin, count);
            return map;
        }
    }

    /// <summary>Offline geographic bake. A seed varies resource richness without moving rivers or shorelines.</summary>
    [Serializable]
    public sealed class MapDefinition
    {
        public string id, stateId, regionMs, regionEn, revision, terrain, elevation, fertility, tin, attribution, previewResource;
        public int width, height;
        public double south, west, north, east;
        public string[] sources = Array.Empty<string>();

        public MapData CreateMap(int seed)
        {
            var map = new MapSnapshot { width = width, height = height, seed = seed, terrain = terrain,
                elevation = elevation, fertility = fertility, tin = tin }.CreateMap();
            for (int i = 0; i < map.Terrain.Length; i++)
            {
                if (!TerrainTypes.IsLand(map.Terrain[i])) continue;
                int variation = (int)(Rng.Hash2(i % width, i / width, seed) * 17) - 8;
                map.Fertility[i] = (byte)Math.Max(0, Math.Min(255, map.Fertility[i] + variation));
                map.Tin[i] = (byte)Math.Max(0, Math.Min(255, map.Tin[i] + variation));
            }
            int best = int.MaxValue;
            for (int y = 1; y < height - 2; y++) for (int x = 1; x < width - 2; x++)
            {
                if (!map.IsCoastal(x, y)) continue;
                int distance = (x - width / 2) * (x - width / 2) + (y - height / 2) * (y - height / 2);
                if (distance < best) { best = distance; map.MouthX = x; map.MouthY = y; }
            }
            return map;
        }
    }
}
