#!/usr/bin/env bash
# Downloads the sources of the Unity packages the game scripts use, from Unity's public package
# registry, so `dotnet build` can compile the Runtime and Editor scripts against the real APIs.
# Usage: ci/UnityCompileCheck/fetch-deps.sh   (from unity-tamadun-kota/)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cache="$here/../.cache/packages"
mkdir -p "$cache"
fetch() {
  local name="$1" version="$2"
  local dir="$cache/$name"
  if [ -f "$dir/package.json" ] && grep -q "\"version\": \"$version\"" "$dir/package.json"; then return; fi
  rm -rf "$dir" && mkdir -p "$dir"
  curl -sSfL "https://download.packages.unity.com/$name/-/$name-$version.tgz" | tar -xz -C "$dir" --strip-components=1
  echo "fetched $name@$version"
}
fetch com.unity.inputsystem 1.14.2
fetch com.unity.ai.navigation 1.1.7   # same NavMeshSurface API as 2.0.9, which needs Unity 6 engine internals

# The only uGUI reference assembly on nuget.org is 2018.3, which predates the UI Toolkit pointer
# hook (Unity 2021.1). Hide that one override from the compile check; it is untouched in Unity.
f="$cache/com.unity.inputsystem/InputSystem/Plugins/UI/InputSystemUIInputModule.cs"
perl -0pi -e 's/#if UNITY_2021_1_OR_NEWER\n(\s+public override int ConvertUIToolkitPointerId)/#if UNITY_2021_1_OR_NEWER \&\& !OLD_UGUI_REFERENCE\n$1/' "$f"
