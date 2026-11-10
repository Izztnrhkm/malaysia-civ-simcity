# Standalone Unity checks

From the repository root:

```sh
dotnet run --project unity-tamadun-kota/ci/CatalogCheck -- unity-tamadun-kota
dotnet test unity-tamadun-kota/ci/SimulationTests
bash unity-tamadun-kota/ci/UnityCompileCheck/fetch-deps.sh
dotnet build unity-tamadun-kota/ci/UnityCompileCheck/Game.csproj
dotnet build unity-tamadun-kota/ci/UnityCompileCheck/SteamCheck.csproj
```

No Node tooling or browser source is required. CatalogCheck validates authoritative JSON,
cross-references, thirteen pairings, geographic terrain and required shipped character assets.

`Assets/Tests/EditMode/RulesRegression.cs` contains frozen results from the reference engine before
the Unity-only migration. Its original generated values were checked against that engine before
the source was removed. Keep the constants unchanged for legacy behavior. A deliberate rule
change needs reviewed expectations and a focused C# behavioral test; do not regenerate expected
values directly from the implementation being tested.

Simulation tests additionally cover state/leader stacking, save versions one through three,
geographic map stability, and tick allocations. Full character appearance, animation deformation,
scene import and frame-time checks belong to the lead in Unity 6000.3.
