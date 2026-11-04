# Unity compile check (without the Unity Editor)

Builds every script in `Assets/Scripts` and `Assets/Editor` with the .NET SDK so compile errors are
caught in CI or on machines without Unity.

```bash
./fetch-deps.sh
```

```bash
dotnet build Game.csproj
```

```bash
dotnet build SteamCheck.csproj
```

## What is real and what is a stand-in

| Dependency | Used for the check | In the Unity project |
|---|---|---|
| UnityEngine | nuget.org `UnityEngine.Modules` 2021.3.33 (official reference assemblies) | Unity 6.3 |
| UnityEditor | nuget.org `Unity3D.SDK` 2021.1.14.1 | Unity 6.3 |
| uGUI | nuget.org `Unity3D.UnityEngine.UI` 2018.3.5.1 | com.unity.ugui 2.0.0 |
| Input System | **source** of com.unity.inputsystem 1.14.2 from the Unity registry, except `Plugins/UI` (needs uGUI 2.0), replaced by `Stubs/InputSystemUIStub.cs` | 1.14.2 |
| AI Navigation | **source** of com.unity.ai.navigation 1.1.7 (2.0.9 needs Unity 6 engine internals; the `NavMeshSurface` API used here is the same) | 2.0.9 |
| URP | `Stubs/URPStubs.cs`: the six members the setup script touches, with URP 17 signatures | 17.3 |
| Steamworks.NET | nuget.org `Steamworks.NET` 2024.8.0 (SteamCheck only) | git package, optional |

APIs that are new or changed in Unity 6 are therefore not fully covered. The project still has to be
opened in Unity 6.3 to be certain.
