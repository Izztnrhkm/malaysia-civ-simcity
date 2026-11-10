using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using TamadunKota.Simulation;

internal static class Program
{
    static readonly JsonSerializerOptions Json = new JsonSerializerOptions { IncludeFields = true };
    static string root;
    static int checks;
    static void Require(bool condition, string message) { checks++; if (!condition) throw new InvalidDataException(message); }
    static T Load<T>(string name) => JsonSerializer.Deserialize<T>(File.ReadAllText(Path.Combine(root, "Assets/Resources/GameData", name + ".json")), Json);
    static void Text(params string[] values) { foreach (var s in values) Require(!string.IsNullOrWhiteSpace(s), "Missing bilingual catalog text."); }
    static bool Resource(string path, params string[] extensions) => extensions.Any(e => File.Exists(Path.Combine(root, "Assets/Resources", path + e)));

    static int Main(string[] args)
    {
        try
        {
            root = Path.GetFullPath(args.Length > 0 ? args[0] : Path.Combine(AppContext.BaseDirectory, "../../../../.."));
            var db = new GameDatabase
            {
                Buildings = Load<BuildingTable>("buildings").items, Zones = Load<ZoneTable>("zones").items,
                Research = Load<ResearchTable>("research").items, Policies = Load<PolicyTable>("policies").items,
                Eras = Load<EraTable>("eras").items, Goods = Load<GoodTable>("goods").items,
                Transports = Load<TransportTable>("transports").items, Events = Load<EventTable>("events").items,
                Crises = Load<CrisisTable>("crises").items, Advisors = Load<AdvisorTable>("advisors").items,
                Partners = Load<PartnerTable>("partners").items, Scenarios = Load<ScenarioTable>("scenarios").items,
                Milestones = Load<MilestoneTable>("milestones").items, Entries = Load<EntryTable>("sejarahpedia").items,
                States = Load<StateTable>("states").items, Leaders = Load<LeaderTable>("leaders").items,
            }.Index();
            Require(db.States.Length == 13 && db.Leaders.Length == 13, "Exactly thirteen state/leader pairings are required.");
            var ids = new HashSet<string>(); var leaderIds = new HashSet<string>();
            foreach (var b in db.Buildings)
            {
                Require(ids.Add(b.id), "Duplicate building " + b.id); Text(b.nameMs, b.nameEn, b.descMs, b.descEn);
                Require(double.IsFinite(b.cost) && b.cost >= 0 && double.IsFinite(b.upkeep), "Invalid building economics: " + b.id);
                Require(string.IsNullOrEmpty(b.unlockedBy) || db.ResearchIndex(b.unlockedBy) >= 0, "Unknown building unlock: " + b.id);
            }
            foreach (var r in db.Research)
            {
                Text(r.nameMs, r.nameEn);
                foreach (var prerequisite in r.prereqs) Require(db.ResearchIndex(prerequisite) >= 0, "Unknown research prerequisite " + prerequisite);
                foreach (var building in r.unlockBuildings) Require(db.BuildingIndex(building) >= 0, "Unknown unlocked building " + building);
            }
            ids.Clear();
            foreach (var state in db.States)
            {
                Require(ids.Add(state.id), "Duplicate state " + state.id);
                var leader = db.LeaderById(state.leaderId);
                Require(leader != null && leaderIds.Add(leader.id), "Missing or shared leader for " + state.id);
                Text(state.nameMs, state.nameEn, state.abilityMs, state.abilityEn, leader.bioMs, leader.bioEn, leader.abilityMs, leader.abilityEn);
                Require(leader.sources.Length > 0 && leader.sources.All(s => Uri.TryCreate(s.url, UriKind.Absolute, out var uri) && uri.Scheme == "https"), "Missing historical sources: " + leader.id);
                Require(Resource(leader.modelResource, ".prefab", ".fbx"), "Missing leader model " + leader.modelResource);
                Require(Resource(leader.portraitResource, ".png"), "Missing leader portrait " + leader.portraitResource);
                string source = Path.Combine(root, "Assets/Art/Leaders", leader.id + ".blend");
                if (!File.Exists(source)) source = Directory.GetFiles(Path.Combine(root, "Assets/Art/Leaders"), leader.id + ".blend", SearchOption.AllDirectories).FirstOrDefault();
                Require(source != null && File.Exists(source) && new FileInfo(source).Length > 1024, "Missing editable Blender source: " + leader.id);
                var map = JsonSerializer.Deserialize<MapDefinition>(File.ReadAllText(Path.Combine(root, "Assets/Resources/Maps", state.mapId + ".json")), Json);
                Require(map.id == state.mapId && map.stateId == state.id && map.width == 256 && map.height == 256, "Wrong regional map for " + state.id);
                Require(map.north > map.south && map.east > map.west && map.sources.Length > 0, "Missing geography provenance: " + state.id);
                Require(!string.IsNullOrWhiteSpace(map.revision) && !string.IsNullOrWhiteSpace(map.attribution), "Missing geographic version or attribution: " + state.id);
                Require(Resource(map.previewResource, ".png"), "Missing map preview: " + state.id);
                var first = map.CreateMap(42); var second = map.CreateMap(99);
                Require(first.Terrain.SequenceEqual(second.Terrain) && first.Elevation.SequenceEqual(second.Elevation), "A seed changed the geographic terrain: " + state.id);
                Require(first.Terrain.Count(t => TerrainTypes.IsLand(t) && t != (byte)TerrainType.Mountain) > 4096, "Too little buildable land: " + state.id);
                var setup = new GameSetup { stateId = state.id, leaderId = state.leaderId, mapId = state.mapId };
                var sim = new GameSimulation(db, setup, first);
                int harbour = db.BuildingIndex("pelabuhan"); bool found = false;
                for (int y = 0; y < first.Height - 2 && !found; y++) for (int x = 0; x < first.Width - 2; x++)
                    if (sim.CheckBuilding(harbour, x, y, out _) == PlacementResult.Ok) { found = true; break; }
                Require(found, "No legal starting harbour: " + state.id);
            }
            using var spec = JsonDocument.Parse(File.ReadAllText(Path.Combine(root, "scripts/model_spec.json")));
            Require(spec.RootElement.GetProperty("models").GetArrayLength() > 100, "Scenery specification is incomplete.");
            Console.WriteLine($"Validated {checks} catalog, geography and shipped-asset checks without Node.");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
