# Releasing the GRAIN monorepo

This repo is a bun workspace holding `packages/{grain,mill,proof,crumb}`. Internal deps resolve
via `workspace:*`; **external consumers install the published packages from GitHub Packages** (a
single monorepo git-dep cannot expose the sub-packages by their own names — verified 2026-07-19).

`@tjakoen/crumb` is published too (`0.1.1`, alongside grain/mill/proof).

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
for p in grain mill proof crumb; do (cd packages/$p && bun publish); done
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
"@tjakoen/crumb": "^0.1.0",
```

`bun install`, then run each consumer's own gate (pantry: boots + cockpit; portfolio: full gate —
tsc, bun test, export N/N, verify:export, playwright, visual baselines).

## Standalone repos retired (Phase 5 — done 2026-07-19)

The old `github.com/tjakoen/mill` and `github.com/tjakoen/proof` standalone repos have been deleted;
`packages/mill` and `packages/proof` in this monorepo are the canonical home now, pre-merge history
included. `bread` no longer carries git submodules at all (that decision was broader than just
mill/proof), so there's no repin step here.
