# Releasing the GRAIN monorepo

This repo is a bun workspace holding `packages/{grain,mill,proof,crumb}`. Internal deps resolve
via `workspace:*`; **external consumers install the published packages from GitHub Packages** (a
single monorepo git-dep cannot expose the sub-packages by their own names — verified 2026-07-19).

`@tjakoen/crumb` is `private` (scaffold) and is **not** published until its build lands.

## One-time auth (publisher)

Publishing to GitHub Packages needs a token with the **`write:packages`** scope (the default
`gh` CLI token does not have it). Either:

```bash
gh auth refresh -s write:packages          # adds the scope to your gh token (browser flow)
# …or create a classic PAT with write:packages and export it:
export GITHUB_TOKEN=ghp_xxx
```

Point the `@tjakoen` scope's auth at GitHub Packages (in `~/.npmrc`, NOT committed):

```
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Registry routing itself is already set per-package via `publishConfig.registry`, so no
`@tjakoen:registry` line is required to publish.

## Publish

From the repo root, publish each public package (bun substitutes `workspace:*` → the concrete
version at publish time):

```bash
for p in grain mill proof; do (cd packages/$p && bun publish); done
```

Verify a published tarball's `package.json` shows concrete versions (e.g. `@tjakoen/grain`:
`0.1.0`, not `workspace:*`). Bump versions before re-publishing the same version number.

## Consumer setup (pantry, portfolio, bread) — Phase 4 cutover

Each consumer repo needs an `.npmrc` routing the scope + auth:

```
@tjakoen:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then replace the old SHA-pinned git-deps with version ranges:

```jsonc
// before
"@tjakoen/grain": "github:tjakoen/grain#<sha>",
"@tjakoen/mill":  "github:tjakoen/mill#<sha>",
"@tjakoen/proof": "github:tjakoen/proof#<sha>",
// after
"@tjakoen/grain": "^0.1.0",
"@tjakoen/mill":  "^0.1.0",
"@tjakoen/proof": "^0.1.0",
```

`bun install`, then run each consumer's own gate (pantry: boots + cockpit; portfolio: full gate —
tsc, bun test, export N/N, verify:export, playwright, visual baselines).

## Retire the standalone repos (Phase 5 — after consumers verify on the published packages)

Archive `github.com/tjakoen/mill` and `github.com/tjakoen/proof` (README pointer to this monorepo;
**do not delete** — they hold the pre-merge history). Update `bread`'s `.gitmodules` (drop the mill
+ proof submodules; grain is now the monorepo) and its lockless-umbrella note.
