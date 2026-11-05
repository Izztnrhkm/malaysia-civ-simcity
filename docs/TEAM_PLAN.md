# Team plan: Unity edition, next milestone

Three agents work on `unity-tamadun-kota/` at the same time. Claude (lead session) coordinates and
merges. Each agent works on its own branch and owns its own files, so no two agents edit the same file.

Goal of this milestone: the Unity edition plays like the web game (same rules, same panels), opens
cleanly in Unity 6000.3, and has CI that runs the rules-engine tests on every push.

## Lanes

| Lane | Agent | Branch | Owns (may edit) |
|---|---|---|---|
| A. Lead: Editor, scene, play-testing, performance, merges | Claude (lead session) | `lead/playtest-perf` | `Assets/Editor/**`, `Assets/Scripts/Core/**`, `Assets/Scripts/Data/**`, `Assets/Scenes`, `Assets/Prefabs`, `Assets/Materials`, `Assets/Settings`, `Assets/Tests/PlayMode/**` (new), `ProjectSettings/**`, `Packages/**`, `README.md`, `docs/GDD.md`, this file |
| B. HUD and UI parity | Claude (second session) | `claude/unity-hud-parity` | `Assets/Scripts/Systems/UIManager.cs`, new `Assets/Scripts/UI/**`, new `Assets/Resources/Localization/**`, `scripts/export-unity-data.ts` (repo root) |
| C. Rules-engine parity and CI | Codex | `codex/sim-parity` | `Assets/Scripts/Simulation/**`, `Assets/Tests/EditMode/**`, `ci/**`, `.github/workflows/unity-sim.yml` (new) |

Files not listed (the web game in `src/`, `Assets/Art/**`, `Systems/SaveLoadManager.cs`,
`Systems/AudioAtmosphereManager.cs`, `Systems/SteamworksManager.cs`) are frozen for this milestone.
Paths are relative to `unity-tamadun-kota/` unless marked "repo root".

### A. Lead (Claude, this session)

1. Open the project in Unity 6000.3.28f1 and play a full session: build, zone, roads, research, era
   change, save/load, crisis. Fix runtime errors and wiring in `Core/`, `Data/` and `Editor/`.
2. Add a PlayMode smoke test runnable headless (`-runTests -testPlatform PlayMode`): load
   `MainGame`, run 2,000 ticks at speed 3, assert no exceptions and a growing population.
3. Performance: a stress scene with 5,000 buildings; record frame time and draw calls with the
   Profiler and fix the top costs (GDD section 6 target: 60 FPS at 1080p).
4. Review and merge lanes B and C into `main`, rerun the setup menu, commit regenerated assets.

**Only the lead opens the Unity Editor or runs Unity in batch mode.** Unity locks the project folder,
so a second Unity process on the same checkout fails. Lanes B and C verify with `dotnet` (below) and
ask the lead for an in-Editor check.

### B. HUD and UI parity (second Claude session)

The web game has panels the Unity HUD lacks. Port them to uGUI built in code, in the existing style of
`UIManager.cs`. Split `UIManager.cs` into one class per panel under `Assets/Scripts/UI/` first, keeping
behaviour identical.

1. Main menu: New game with scenario select (`scenarios.json`), Continue, Load, Settings, Quit.
2. Notifications feed for events, era changes, milestones and crises (bottom-left, auto-fade).
3. Advisors panel (`advisors.json`, advisor messages already produced by the engine).
4. Economy panel: income and upkeep breakdown, tax rate, policies (`policies.json`).
5. Timeline / era panel (web: `src/ui/modals/Timeline.tsx`, `EraPanel.tsx`).
6. Sejarahpedia browser (`sejarahpedia.json`), opened from the inspector and from era changes.
7. Settings: language BM / EN, volume, art mode, edge scroll. Export the web game's strings
   (`src/i18n/strings.ts`, repo root) to `Assets/Resources/Localization/{ms,en}.json` by extending
   `scripts/export-unity-data.ts`.
8. Phase 2, after lane C merges: Diplomacy panel and milestone/victory screen, using the API that lane
   C publishes (see "Interfaces").

Reference for layout and behaviour: `src/ui/**` in the web game (read only).

### C. Rules-engine parity and CI (Codex)

The C# engine in `Assets/Scripts/Simulation` is a port of `src/core/**` (repo root). These web modules
have no C# counterpart yet: `src/core/sim/diplomacy.ts` and `src/core/sim/milestones.ts` (victory
included). `environment.ts`, `transport.ts` and `zoning.ts` are partly ported; check them against the
TypeScript and close the gaps.

1. Port diplomacy (partners, relations, trade deals) and milestones/victory to C#, with no Unity
   references (the assembly must stay engine-free) and no allocations per tick.
2. Add parity tests in `Assets/Tests/EditMode` comparing against values produced by the TypeScript
   engine (same approach as the existing map-fingerprint and RNG parity tests).
3. Include the new state in `SaveGame.cs`, with a version bump and loading of older saves.
4. Add `.github/workflows/unity-sim.yml` (repo root): on push and pull request, run
   `dotnet test unity-tamadun-kota/ci/SimulationTests` and
   `dotnet build unity-tamadun-kota/ci/UnityCompileCheck/Game.csproj` (after `fetch-deps.sh`).

## Interfaces between lanes

* Lane C exposes read-only views on `GameSimulation` for the UI, named `Diplomacy` and `Milestones`,
  and C# events `OnMilestoneReached` and `OnVictory`. Lane C writes the final signatures into the
  "Published API" section below when it opens its PR; lane B builds phase 2 against that.
* Lane B must not change `Simulation/**`. If the UI needs data the engine does not expose, add a note
  under "Requests" below (on your branch) and tell the lead.
* Lane C must not change `Core/**` or `Systems/**`. If an API change breaks a caller there, say so in
  the PR and the lead fixes the caller during the merge.

### Published API (lane C fills this in)

Namespace: `TamadunKota.Simulation`. The following members are on `GameSimulation`:

```csharp
public DiplomacyState Diplomacy { get; }
public MilestoneState Milestones { get; }
public event Action<string> OnMilestoneReached; // milestone id
public event Action OnVictory;

public CommandResult SendEnvoy(string partnerId);
public CommandResult ProposeDeal(string partnerId, string good, double quantity, double duration);
public CommandResult CancelDeal(int dealId);
public CommandResult ToggleExchange(string partnerId);
public CommandResult AcceptOffer(int offerId);
public CommandResult DeclineOffer(int offerId);
```

`CommandResult` exposes `bool Ok`, `string Reason` (`err.*` key, null on success), and
`double Cost` (envoy fee). Good ids are the web ids, for example `rempah`, `ikan`, `elektronik`.
Invalid non-finite quantities and durations return `err.invalid`.

`DiplomacyState` exposes these read-only views and prices:

```csharp
public IReadOnlyList<PartnerView> Partners { get; }
public IReadOnlyList<TradeDeal> Deals { get; }
public IReadOnlyList<DiplomaticOffer> Offers { get; }
public PartnerView FindPartner(string id); // null if unknown
public double DealPrice(string partnerId, string good);
public double EnvoyPrice { get; }
public double ExchangePrice { get; }
```

Filter `Partners` by `Active` for the current era and historical-event gate. Each `PartnerView`
has `Id`, `NameMs/NameEn`, `DescriptionMs/DescriptionEn`, `Color`, `Relation`, `EnvoyCooldown`,
`Exchange`, `KnowledgePerTick` and `IReadOnlyList<PartnerGood> Buys`. `PartnerGood` exposes
`Good` and `PriceMultiplier`. Inactive partners keep their saved relations and exchange flag.
The legacy `GameSimulation.Relations` dictionary remains the source used by events and crises.

`TradeDeal` exposes `Id`, `Partner`, `Good`, `Quantity`, `Price`, `Remaining`, `Delivered`,
`Missed`. `DiplomaticOffer` exposes `Id`, `Partner`, `Kind` (`OfferKind.Deal/Investment/Exchange`),
`Good`, `Quantity`, `Price`, `Duration`, `Money`, `Expires`. Deals settle before spot exports;
`Economy.Budget.deals` is included in `Budget.Income` and `Budget.Net`.

`MilestoneState.All` is an `IReadOnlyList<MilestoneView>` in web order:
`economic_hegemon`, `smart_nation`, `heritage_metropolis`. Each view has `Id`, `NameMs/NameEn`,
`DescriptionMs/DescriptionEn`, `Reached` and `IReadOnlyList<MilestoneRequirement> Requirements`.
Requirements expose `LabelMs/LabelEn`, `Met`, `Numeric`, `Current`, `Target`; display rounded
values only when `Numeric` is true. `MilestoneState.Victory` is the separate era-four victory
flag; `HeritageLots` is the preserved lot count. `Milestones.Refresh()` updates requirement
values for a panel opened between ticks without granting achievements.

`Step()` posts existing `NoticePosted` notices and emits achievement events once, after advancing
the calendar and before `Ticked`. Loading restores awards without replaying events; the UI must
read `Reached` and `Victory` when binding a loaded game. Play can continue after victory.
The new rules reuse tick buffers, including partner offer generation and milestone checks.

Save format version is now 2. It includes diplomacy partners/cooldowns/exchanges, deals, offers,
next diplomatic id, milestones, victory and RNG state. Version-one saves still load. Rice uses
the existing `ResourceType.Food` index; `ResourceType.Fish` is appended at index 14 so rice cannot
fulfil a fish contract. Old saves keep their combined food at index 1 and start with zero fish.
`City.Coverage`, `Pollution`, `LandValue`, `WaterDistance` and `City.Network` provide the new
environment and multimodal transport layers. These derived layers are rebuilt on load.

Fixture regeneration and CI commands are documented in `unity-tamadun-kota/ci/Parity/README.md`.

### Requests

* ~~Lane A: update `Core/EconomyManager.cs` to report headline food as
  `Stock[ResourceType.Food] + Stock[ResourceType.Fish]`.~~ Done in the merge of lane C. No other
  goods loop in `Core/`, `Systems/`, `Data/` or `Editor/` stops at `ResourceType.Digital`.
  Lane B: use `ResourceInfo.GoodIds` or `ResourceInfo.IsGood` for goods lists so fish is included.
* ~~Lane A: run the in-Editor check on Unity 6000.3 after merging.~~ Done: the PlayMode smoke test
  passes on the merged code.

## Checks every lane runs before asking for a merge

From `unity-tamadun-kota/`:

```bash
dotnet test ci/SimulationTests
```

```bash
dotnet build ci/UnityCompileCheck/Game.csproj
```

(run `ci/UnityCompileCheck/fetch-deps.sh` once first). From the repo root, if `src/` or `scripts/`
changed:

```bash
npm run check
```

## Merge order

1. Lane C (engine and CI): no dependencies.
2. Lane B phase 1 (panels): rebased on `main` after C.
3. Lane B phase 2 (diplomacy and milestone UI).
4. Lane A work lands on `main` continuously; the lead reruns the setup menu after each merge and
   commits any regenerated assets.

Commits end with the agent's own co-author line. Nobody force-pushes `main`.
