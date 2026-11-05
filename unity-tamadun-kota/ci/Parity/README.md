# Rules parity fixtures

From the repository root:

```bash
npm ci --prefix unity-tamadun-kota/ci/Parity --ignore-scripts
npm run generate --prefix unity-tamadun-kota/ci/Parity
npm run check --prefix unity-tamadun-kota/ci/Parity
dotnet test unity-tamadun-kota/ci/SimulationTests
```

`generate.mjs` executes the TypeScript modules in `src/core` through TypeScript's CommonJS
transpiler and writes `Assets/Tests/EditMode/WebParity.cs`. It reads the web source without
modifying it. NUnit consumes the same constants inside Unity and under .NET. `check` recomputes
the constants in memory and fails if they differ from the committed file.

Fixtures compare full tile layers for mixed-mode delivery/access, services, pollution, land
values, and seeded zone growth in each era. They also cover diplomacy commands, relation drift,
exchanges, settlement order, offer generation in every era, milestone boundaries and victory.
Handwritten tests cover command errors, legacy save migration, JSON round trips and one-time
events. The .NET test project additionally checks tick allocations, including offer generation.

The compile check downloads package sources with `ci/UnityCompileCheck/fetch-deps.sh`, then runs
`dotnet build ci/UnityCompileCheck/Game.csproj`. It does not start Unity. Unity 6000.3 play-testing
remains the lead lane's responsibility.
