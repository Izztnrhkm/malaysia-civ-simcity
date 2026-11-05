# Agent instructions

Several agents work in this repository at once. Read [`docs/TEAM_PLAN.md`](docs/TEAM_PLAN.md) first:
it says which lane you own, your branch, and the only files you may edit.

* Codex: you own **lane C, rules-engine parity and CI**, on branch `codex/sim-parity`.
* Work in your own git worktree, never in the lead's checkout:
  `git worktree add ../tamadun-codex -b codex/sim-parity main`
* Do not open Unity or run Unity in batch mode; the lead does that. Verify with `dotnet test` and
  `dotnet build` as listed in the plan.
* Do not edit files outside your lane. If you need a change elsewhere, write it under "Requests" in
  `docs/TEAM_PLAN.md` on your branch and say so in your PR.
* Never push to `main` or force-push. Open a pull request from your branch for the lead to merge.

## Project facts

* `src/` (repo root): the web game (React, TypeScript, Three.js). `npm run check` runs typecheck,
  lint and tests.
* `unity-tamadun-kota/`: the Unity 6000.3 (URP) edition. `Assets/Scripts/Simulation` is a pure C#
  port of `src/core/**` with no `UnityEngine` references; keep it that way.
* Models and textures under `unity-tamadun-kota/Assets/Art` are Git LFS files; run `git lfs pull`
  in a fresh worktree before anything reads them.
* Write in plain, factual English in code comments, commits and docs.
