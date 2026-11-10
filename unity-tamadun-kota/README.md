# Tamadun & Kota: Unity 6 LTS edition

The Unity 6.3 LTS (Universal Render Pipeline) edition of Tamadun & Kota. This is the only
playable edition in the repository; it uses standalone JSON catalogs and Python asset tools.

* Design document: [`docs/GDD.md`](docs/GDD.md)
* Rules engine: pure C# in `Assets/Scripts/Simulation` (engine-free C#, checked with frozen regression fixtures and behavioral tests)

## Open it

1. Install **Unity 6.3 LTS** (6000.3.x) with Unity Hub. The project was authored for `6000.3.27f2`;
   any 6000.3 patch works, and Hub offers to switch if you have another one.
2. Clone with Git LFS (models and textures are LFS files):
   ```bash
   git lfs install
   ```
   ```bash
   git clone https://github.com/Izztnrhkm/malaysia-civ-simcity.git
   ```
3. Unity Hub > **Add** > **Add project from disk** > choose `malaysia-civ-simcity/unity-tamadun-kota`.
4. On first open Unity imports the packages and assets (a few minutes) and asks whether to build the
   scene. Click **Build now**, or later use the menu
   **Tamadun & Kota > 1. Build All ScriptableObjects, LOD Prefabs & Playable Scene**.
5. Open `Assets/Scenes/MainGame.unity` and press **Play**.

The setup menu is safe to run again. It:

* sets **Linear** colour space and creates a URP asset with the **SRP Batcher** on, assigned to
  Graphics and every Quality level;
* creates the shared atlas material (URP Lit, **GPU instancing** on) and ghost, water and greybox materials;
* turns every Blender FBX in `Assets/Art/Models` into a prefab with a **LODGroup** (`_LOD0`, `_LOD1`,
  `_LOD2`), falling back to greybox cubes when a model is missing;
* generates 55 `BuildingData` assets, 12 zone lot assets, `TechCivicTree.asset` (41 technologies,
  25 civics, 5 crises) and `BuildingCatalog.asset` from `Assets/Resources/GameData/*.json`;
* saves `Assets/Scenes/MainGame.unity` with sun, terrain, water, RTS camera, every manager wired, a
  NavMeshSurface, the HUD and the **Greybox / Full 3D Art** button, and adds it to Build Settings.

Unity creates `.meta` files for everything on first import; commit them so asset references stay stable.

## Controls

| Input | Action |
|---|---|
| WASD / arrows, screen edges, middle drag | pan |
| Q / E, right drag | rotate and tilt |
| Mouse wheel | zoom |
| Left click / drag | place building, draw road or rail, paint zones |
| Right click, Esc | cancel tool |
| Space, 1, 2, 3 | pause, speeds |
| G | Greybox / Full 3D Art |
| F5 / F9 | quick save / quick load |
| Home | reset camera |

## Project layout

| Path | Contents |
|---|---|
| `Assets/Scripts/Simulation` | rules engine (assembly `TamadunKota.Simulation`, no Unity references) |
| `Assets/Scripts/Core` | camera, grid placement, time, economy bridge, world and city views, traffic |
| `Assets/Scripts/Data` | `BuildingData`, `EraManager`, `TechCivicTreeSO`, `BuildingCatalog` |
| `Assets/Scripts/Systems` | save/load, HUD, audio atmosphere, Steamworks |
| `Assets/Editor` | `TamadunAutoSetupEditor` (setup menu, import rules, first-run prompt) |
| `Assets/Art` | Blender output: `Models/<Kind>/<id>.fbx` (3 LODs each), `Textures/MasterPaletteAtlas*.png` |
| `Assets/Resources` | `GameData/*.json` (catalog export) and `atlas_layout.json` |
| `Assets/Tests/EditMode` | NUnit tests (Unity Test Runner) |
| `scripts/blender_unity_pipeline.py` | headless Blender exporter |
| `ci/` | .NET test and compile-check projects (see below) |

## Regenerating data and art

The authoritative game and localization tables are checked into `Assets/Resources`. Validate them
from this project folder with `dotnet run --project ci/CatalogCheck -- .`. Edit the JSON directly;
there is no TypeScript export step. Scenery geometry is in `scripts/model_spec.json`.

From this project folder with Blender installed:

```bash
blender --background --factory-startup --python scripts/blender_unity_pipeline.py
```

writes 131 scenery FBX models (including: oil refinery, oil platform,
vertical farm, AI and cyber hub, eco tower), the three atlas textures, `atlas_layout.json` and
`Assets/Art/Models/models_manifest.json`.

![Blender export check: LOD0 in front, LOD2 stand-ins behind (refinery, oil platform, vertical farm, cyber hub, eco tower, mosque, Moorish station, shophouse, steam locomotive)](docs/images/blender_lod_preview.png) The same is available in Unity as
**Tamadun & Kota > 3. Re-run Blender Pipeline** when `blender` is on your PATH. Run the setup menu
again afterwards.

## Steamworks (optional)

`SteamworksManager` compiles its Steam code only when the Steamworks.NET package is installed and
`DISABLESTEAMWORKS` is not defined, so the project builds without it (achievements are then kept in
PlayerPrefs). To enable Steam:

1. Package Manager > **+** > **Add package from git URL** >
   `https://github.com/rlabrecque/Steamworks.NET.git?path=/com.rlabrecque.steamworks.net`
   (append `#<version>` from the [releases page](https://github.com/rlabrecque/Steamworks.NET/releases)
   to pin a version). The runtime assembly defines `STEAMWORKS_NET` automatically when it is present.
2. Edit `steam_appid.txt` in this folder (created by the package; it is git-ignored) and set your App
   ID, and set the same ID on the `SteamworksManager` component (480 is Valve's test app).
3. Create the achievements `ACH_ERA_2_TIN_RUSH`, `ACH_ERA_3_MERDEKA`, `ACH_ERA_4_SMART_METROPOLIS`
   and `ACH_SURVIVE_BAH_BESAR` in the Steamworks partner site and enable Steam Cloud for the files
   `slot0.json` to `slot3.json`.

Installation steps follow the [Steamworks.NET documentation](https://steamworks.github.io/installation/).

## Tests and verification

| Check | Command (from `unity-tamadun-kota/`) | What it proves |
|---|---|---|
| Rules engine tests | `dotnet test ci/SimulationTests` | NUnit regression and behavioral tests: maps, RNG, music, placement, economy, state/leader bonuses, saves and tick allocations |
| Unity compile check | `ci/UnityCompileCheck/fetch-deps.sh` then `dotnet build ci/UnityCompileCheck/Game.csproj` | all Runtime and Editor scripts compile against real Unity reference assemblies and the real Input System and AI Navigation sources |
| Steam branch | `dotnet build ci/UnityCompileCheck/SteamCheck.csproj` | the `STEAMWORKS_NET` code compiles against the official Steamworks.NET build |
| In Unity | Window > General > Test Runner > EditMode > Run All | the same NUnit tests inside the Editor |

The compile check is strong evidence but not a substitute for opening the project in Unity 6: it uses
Unity 2021.3 engine reference assemblies (the newest on nuget.org), AI Navigation 1.1.7 (same public
API as 2.0.9), a 2018.3 uGUI reference, and small stubs for the six URP members the editor script uses.
See [`ci/UnityCompileCheck/README.md`](ci/UnityCompileCheck/README.md).

## States, leaders and geographic maps

New games select one of thirteen fixed state–leader pairings. Both permanent passives, the leader
biography and an animated 3D preview are shown before starting. The same profile can be reopened
from the game HUD. Select **Reduced motion** in Settings to stop character animation.

Each state ships an offline geographic city-region map. Coastline and elevation do not change
with the resource seed. See [geographic sources and rebuilds](docs/GEOGRAPHY.md) and
[character sources and exports](docs/LEADER_ART.md).

New saves use format version three, including the selected identity and complete terrain layers.
Existing version-one/version-two saves remain compatible as neutral legacy cities. Their map
still uses the original seeded generator. Run the catalog validator and .NET checks before asking
the lead for a Unity 6000.3 import, PlayMode and 1080p performance check.
