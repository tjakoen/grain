---
audited: never
result: runbook only
---

# AUDIT: the alignment runbook

The committed procedure that checks this workspace still obeys the rules `CLAUDE.md` claims. It is the
**alignment** half of an audit: mechanical checks with a command and a pass bar, all run from the
repository root.

The **quality** half is
[`AUDIT-STANDARD.md`](https://portfolio.tjakoen.com/standards/audit-standard). A pass that runs only
this file is the most common way an audit lies. Nothing here restates `CLAUDE.md`, the package fronts or
the canonical standards; when a check and a canon disagree, the canon wins and the check gets fixed.

The gate commands below are the ones the container runs. `CLAUDE.md` explains why the container is the
canonical path on Windows; the scripts are the same either way.

Run every check, then either fix what it finds or flag it as deferred with a reason. Set `audited:` to
the date of the pass and leave the report beside the work.

## 1. The green gate

```sh
bun run check
bun run test
bun run lint 2>&1 | grep -E "^[^ ]+:[0-9]+:[0-9]+: error"
```

Pass: every package typechecks, every package reports `0 fail`, and the lint grep prints nothing.
Warnings are listed, not policed.

## 2. Every package carries the files the front door claims

```sh
for p in grain mill proof; do
  for f in CLAUDE.md PLAN.md; do [ -f "packages/$p/$f" ] || echo "missing: packages/$p/$f"; done
done
[ -f packages/crumb/PLAN.md ] || echo "missing: packages/crumb/PLAN.md"
[ -f packages/grain-mcp/README.md ] || echo "missing: packages/grain-mcp/README.md"
```

Pass: no `missing:` line.

## 3. Dependency direction runs one way

```sh
for p in grain mill proof; do
  case "$p" in
    grain) above="mill|proof|crumb" ;;
    mill)  above="proof|crumb" ;;
    proof) above="crumb" ;;
  esac
  git grep -nE "^(import|export).*@tjakoen/($above)" -- "packages/$p"
done
```

Pass: no output. Reaching across or upward is a port's job, never an import.

## 4. Every fixed export target resolves

```sh
bun -e 'for (const p of ["grain","mill","proof","crumb","grain-mcp"]) {
  const j = await Bun.file(`packages/${p}/package.json`).json();
  for (const [k,v] of Object.entries(j.exports ?? {})) {
    const t = typeof v === "string" ? v : (v.default ?? v.import ?? v.require);
    if (!t || t.includes("*")) continue;
    if (!(await Bun.file(`packages/${p}/${t}`).exists())) console.log(`${p} ${k} -> ${t}`);
  }
}'
```

Pass: no output. Wildcard subpaths are exercised by the package tests instead.

## 5. Tokens only, never raw colour in a component

```sh
git grep -nE "#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(" -- 'packages/grain/**/*.css' ':!packages/grain/styles/**'
```

Pass: no output. The palette-definition files under `packages/grain/styles/` are where literals live.

## 6. One vocabulary, one door

```sh
bun test packages/grain/ai/contract.test.ts
```

Pass: `0 fail`. This is the test behind the contract every surface and verb is read from.

## 7. No `.npmrc` is committed

```sh
find . -name .npmrc -not -path "./node_modules/*"
```

Pass: no output. Consumers take a version range from the public registry, with no token.

## 8. No secret material is tracked

```sh
git grep -nE "ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----" -- . ':!bun.lock'
```

Pass: no output. A hit is a blocker, not a finding.

## 9. `AGENTS.md` is the shared link, not a second copy

```sh
[ -L AGENTS.md ] && [ "$(readlink AGENTS.md)" = "CLAUDE.md" ] && echo ok
```

Pass: `ok`.

## 10. Every plan carries the PROOF frontmatter

```sh
for f in plans/*.md; do
  [ "$f" = "plans/README.md" ] && continue
  for k in id status track depends touches owner; do
    grep -q "^$k:" "$f" || echo "$f missing $k"
  done
done
```

Pass: no `missing` line.

## 11. The front door carries no em dash

`CLAUDE.md` points at VOICE for this. The check is scoped to the two files a cold reader opens first,
not to archived transcripts or pasted gate output.

```sh
git grep -nI $'\u2014' -- CLAUDE.md README.md
```

Pass: no output.

## 12. The README carries the badge the standard requires

```sh
grep -q "Made with Claude" README.md && echo badged
```

Pass: `badged`.

## 13. The history carries no AI attribution

```sh
git log -E --grep="^Co-Authored-By:" --oneline | wc -l
```

Pass: `0`.

## Findings template

```
✅ 1. gate                every package typechecks, 0 fail, lint 0 errors
⚠️ 3. dependency          packages/mill/a.ts:4, upward import, add a port
🚫 11. em dash            deferred, accepted: reason and who accepted it
```

Done means every line is ✅, or every ⚠️ is fixed, or every 🚫 names why it is deferred and who
accepted it. Then replace `audited: never` with the date.
