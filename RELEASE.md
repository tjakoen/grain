# Releasing the GRAIN monorepo

This repo is a bun workspace holding `packages/{grain,mill,proof,crumb}`. Internal deps resolve
via `workspace:*`; **external consumers install the published packages from the public npm
registry** (a single monorepo git-dep cannot expose the sub-packages by their own names — verified
2026-07-19).

Published as of 2026-07-30: `@tjakoen/grain` 0.1.12, `@tjakoen/mill` 0.2.0, `@tjakoen/proof` 0.1.2,
`@tjakoen/crumb` 0.1.4. All install anonymously.

## Registry: npmjs, not GitHub Packages (changed 2026-07-30)

These packages used to live on GitHub Packages, whose npm registry demands an auth token **even for
public packages** — every consumer had to mint a PAT before running anything. They are on npmjs now
and install with no credentials at all. Two rules keep it that way:

- **Never commit an `.npmrc` that maps the scope.** A scope mapping outranks both
  `publishConfig.registry` and `--registry`, so it silently retargets publishes and reads.
- **Never commit `_authToken=${GITHUB_TOKEN}`.** Unset, it resolves to an empty string and overrides
  the user's own valid token, so every install 401s on a cold cache — invisible locally, fatal on a
  new machine.

## How releases are published: CI, via trusted publishing

**Normal releases need no token and no local publish.** Bump a package's version, push to `main`,
and `.github/workflows/publish.yml` publishes it. Auth is npm **trusted publishing** (OIDC): npm
trusts that specific repo + workflow filename, so there is no long-lived credential to store,
rotate, or leak, and each published tarball carries a **provenance attestation** linking it to the
commit that built it.

That trust is configured **per package**, in the npmjs web UI — there is no CLI for it. For each of
`@tjakoen/{grain,mill,proof,crumb}`, go to `npmjs.com/package/@tjakoen/<name>/access` → *Trusted
publisher* and set:

| Field | Value |
|---|---|
| Publisher | GitHub Actions |
| Organization / user | `tjakoen` |
| Repository | `grain` |
| Workflow filename | `publish.yml` |
| Environment | *(leave blank)* |

**Renaming `publish.yml` breaks all four** until each config is updated to match. `@tjakoen/batch`
is configured the same way against its own repo.

Three things silently disable the OIDC exchange, so do not reintroduce them: `registry-url` on
`setup-node` (it writes an `_authToken=` line that expands to empty, which npm reads as "auth is
handled" and skips the exchange — [actions/setup-node#1551](https://github.com/actions/setup-node/issues/1551)),
`NODE_AUTH_TOKEN` in the job env, and an npm older than 11.5.1.

## Publishing by hand (fallback only)

If CI is unavailable, an npmjs **granular access token** with *Read and write* on `@tjakoen/*`
still works. npmjs requires 2FA to publish and this account's second factor is a **passkey**, so
there is no OTP to type and `--otp` cannot work: tick **Bypass 2FA** on the token.

```bash
export NPM_TOKEN=npm_xxx
npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"   # in ~/.npmrc, NOT committed
```

From the repo root, then. Pass `--@tjakoen:registry` **explicitly on every call** — if any ambient
`~/.npmrc` still maps the scope to GitHub Packages, the mapping wins and the publish targets the
wrong registry, failing with a misleading "cannot publish over 0.1.12" (because that version exists
*there*). Reads lie the same way: `npm view` reports the mapped registry's versions.

```bash
reg=--@tjakoen:registry=https://registry.npmjs.org
for p in grain mill proof crumb; do (cd packages/$p && npm publish "$reg" --access public); done
```

**Publish in dependency order** — grain → mill → proof/crumb (batch, in its own repo, is
independent; the CI loop already runs in this order). A just-published version can 404 on a CDN
edge for a few minutes; the authoritative check is an anonymous tarball download, not `npm view`:

```bash
url=$(npm view "$reg" @tjakoen/grain dist.tarball)
HOME=$(mktemp -d) curl -fsSL "$url" -o /dev/null && echo "downloads anonymously"
```

Verify a published tarball's `package.json` shows concrete versions (e.g. `@tjakoen/grain`:
`0.1.12`, not `workspace:*`). Bump versions before re-publishing the same version number.

CI does this automatically: `.github/workflows/publish.yml` publishes any package whose version is
new on every push to `main`, using the `NPM_TOKEN` repo secret.

## Consumer setup

Replace SHA-pinned git-deps with version ranges, and delete the repo's `.npmrc` entirely:

```jsonc
// before
"@tjakoen/grain": "github:tjakoen/grain#<sha>",
// after
"@tjakoen/grain": "^0.1.12",
"@tjakoen/mill":  "^0.2.0",
"@tjakoen/proof": "^0.1.2",
"@tjakoen/crumb": "^0.1.4",
```

`bun install`, then run each consumer's own gate. A plain "fresh clone" test proves nothing — the
shared bun cache masks a broken install. Test it properly:

```bash
rm -rf ~/.bun/install/cache/@tjakoen && HOME=$(mktemp -d) bun install && bun run check
```

Consumers carrying a committed lockfile must **regenerate** it: the old entries pin
`npm.pkg.github.com` tarball URLs, and a `--frozen-lockfile` CI job will keep resolving there.

## Standalone repos retired (Phase 5 — done 2026-07-19)

The old `github.com/tjakoen/mill` and `github.com/tjakoen/proof` standalone repos have been deleted;
`packages/mill` and `packages/proof` in this monorepo are the canonical home now, pre-merge history
included. `bread` no longer carries git submodules at all (that decision was broader than just
mill/proof), so there's no repin step here.
