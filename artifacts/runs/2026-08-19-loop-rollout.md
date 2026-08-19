---
title: GRAIN gets a config, a plan board and a ledger, and one failing check goes green
date: 2026-08-19
status: complete
lane: gated
branch: main
skills: [conformance, loop-standard, voice]
scope: [CLAUDE.md, pantry.config.json, plans/, artifacts/runs/]
touched: [CLAUDE.md, pantry.config.json, plans/README.md, artifacts/runs/README.md, artifacts/runs/2026-08-19-loop-rollout.md]
plans: []
gates:
  - "bun run check | pass, exit 0, all five packages exited 0"
  - "bun test | pass, exit 0, 691 pass, 0 fail, 1963 expect() calls across 69 files"
  - "bun run lint | pass, exit 0, warnings only"
diffstat: 1 file modified, 4 files added. No source touched.
unpushed: "0 | nothing committed here."
doctor: 21 checks, 1 FAILING and 3 due at the start; 21 checks, 0 failing, 3 due at the close.
verifiedBy: nobody yet. This is the author's own account.
---

This repo had a failing doctor check: plans/ present: missing. It is the only repo in the estate
that was actually red rather than merely unwired, and the machine-level session-start hook had been
printing that row at the top of every session here. It is now green, because the directory exists and
carries the board contract.

Added alongside it: pantry.config.json and artifacts/runs/.

## Gate output, verbatim

```
$ bun run --filter '*' check
@tjakoen/grain check: Exited with code 0
@tjakoen/grain-mcp check: Exited with code 0
@tjakoen/mill check: Exited with code 0
@tjakoen/crumb check: Exited with code 0
@tjakoen/proof check: Exited with code 0
CHECK_EXIT=0

 691 pass
 0 fail
 1963 expect() calls
Ran 691 tests across 69 files. [2.80s]
TEST_EXIT=0

LINT_EXIT=0   (warnings only: an unused import, no-array-sort, two shadowed names)
```

## One flag carried by name

graphify freshness: the graph was built from 4b616000 and 17 files have changed since. Running
graphify update . is one command, and it was left because it rewrites graphify-out/ in a repo
other sessions are working in and was outside this envelope.

## What was not done

Nothing committed, nothing pushed. No source touched. The graph was not refreshed, named above.

## What needs human eyes

The graph is 17 files stale and refreshing it rewrites graphify-out/ while other sessions may be
reading it. One command, but it is a shared-tree change and this run did not have the room to make
it. Worth doing before the next substantive session here, not after.

Same envelope question as BATCH: plans/ was created one step past the file list this run was
handed, because the config it wrote declares that directory and because the doctor was failing on its
absence. Visible here rather than buried.
