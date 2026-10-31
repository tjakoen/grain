---
title: Make framework verification and model execution truthful
date: 2026-11-01
status: complete
lane: gated
branch: codex/framework-reliability
skills: [loop-standard, graph]
scope: [packages/proof, packages/grain/ai/model.ts, packages/grain/ai/model-reasoner.ts]
scopeGrowth: none
touched: [packages/proof, packages/grain/ai/model.ts, packages/grain/ai/model.test.ts, packages/grain/ai/model-reasoner.ts, packages/grain/ai/model-reasoner.test.ts, plans/framework-reliability.md]
dirty: ["All changed files | Deliberately uncommitted under parent instruction"]
plans: [framework-reliability]
gates: ["bun run check | passed", "bun run test | 706 passed, zero failed", "bun run lint | exit zero with existing warnings", "git diff --check | passed"]
diffstat: See body
unpushed: No commits created by this run
doctor: Parent run owns maintenance and doctor reconciliation
verifiedBy: root session | independent review of final model, watcher, Git-root and canonical-path changes; source scope verification passed
---

PROOF fails closed when Git comparison evidence cannot be collected. Its watcher serializes rebuilds,
reports startup, asynchronous watch and refresh failures, suppresses late broadcasts and drains active
work during shutdown. Generic model execution rejects unsupported actions, limits advertised model
capabilities, checks cancellation before effects and navigation, and validates model property types.

## Gate evidence

```text
$ bun run --filter '*' check
@tjakoen/grain check: Exited with code 0
@tjakoen/grain-mcp check: Exited with code 0
@tjakoen/mill check: Exited with code 0
@tjakoen/crumb check: Exited with code 0
@tjakoen/proof check: Exited with code 0
@tjakoen/grain test: (pass) modified clicks pass through untouched (the lightbox courtesy) [0.02ms]
@tjakoen/grain test: (pass) the fit pass measures the WORST case: expandable cards open [0.02ms]
@tjakoen/grain test: (pass) the fit pass has a floor, so a runaway slide cannot loop forever [0.01ms]
@tjakoen/grain test: (pass) the fit pass re-runs on resize and on fonts loading, not once at boot [0.03ms]
@tjakoen/grain test: (pass) buildManifest: targets are passed through unchanged
@tjakoen/grain test: (pass) parseModelMove: no JSON / malformed JSON → informative failure [0.04ms]
@tjakoen/grain test: (pass) validateMove: a legal act move passes, payload kept [0.12ms]
@tjakoen/grain test: (pass) validateMove: a reply-only move (action null) with text passes [0.01ms]
@tjakoen/grain test: (pass) item.archive failure rolls back: ok:false + a flash op [0.05ms]
@tjakoen/grain test: (pass) navigate: an unsafe/missing href fails the REQUEST (not the dispatcher) — ok:false, a flash, no navigate op [0.07ms]
@tjakoen/grain test: (pass) failed write rolls back: a flash op, no committed replace [1.20ms]
@tjakoen/grain test: (pass) model.complete throwing → graceful failure, not a crash [0.12ms]
@tjakoen/grain test: (pass) a failed crossing is marked so the component can strike it through [0.02ms]
@tjakoen/grain test: (pass) the header is sticky and opaque — a transparent one lets rows show through as they pass [0.10ms]
@tjakoen/grain test:  371 pass
@tjakoen/grain test:  0 fail
@tjakoen/grain test:  1243 expect() calls
@tjakoen/grain test: Ran 371 tests across 38 files. [644.00ms]
@tjakoen/grain test: Exited with code 0
@tjakoen/mill test: (pass) a line opening a tag is raw HTML passthrough (escape hatch) [0.01ms]
@tjakoen/mill test: (pass) slugifyHeading > backticks and underscores already stripped by callers pass through cleanly
@tjakoen/mill test: (pass) a failed render is not cached, so a capable machine can still render it later [0.40ms]
@tjakoen/grain-mcp test:  55 pass
@tjakoen/grain-mcp test:  0 fail
@tjakoen/grain-mcp test:  132 expect() calls
@tjakoen/grain-mcp test: Ran 55 tests across 5 files. [126.00ms]
@tjakoen/grain-mcp test: Exited with code 0
@tjakoen/mill test: (pass) escape hatch: a raw component tag passes through for BATCH to compose [0.04ms]
@tjakoen/mill test:  135 pass
@tjakoen/mill test:  0 fail
@tjakoen/mill test:  300 expect() calls
@tjakoen/mill test: Ran 135 tests across 10 files. [1.59s]
@tjakoen/mill test: Exited with code 0
@tjakoen/crumb test: (pass) duplicate ids fail [0.07ms]
@tjakoen/crumb test: (pass) an empty folder is reported, not silently passed as clean
@tjakoen/crumb test: (pass) a dev step carrying review and status passes [0.08ms]
@tjakoen/crumb test: (pass) a dev step with NO review and NO status fails the lint [0.05ms]
@tjakoen/crumb test: (pass) a prompt card whose template uses every ask passes [0.33ms]
@tjakoen/crumb test: (pass) an ask the template never uses fails — the answer would be thrown away [0.07ms]
@tjakoen/crumb test: (pass) a clean staged tour — safe value, non-empty say — passes [0.03ms]
@tjakoen/crumb test: (pass) a failed crossing marks the whole surface a known-issue [0.02ms]
@tjakoen/crumb test:  61 pass
@tjakoen/crumb test:  0 fail
@tjakoen/crumb test:  136 expect() calls
@tjakoen/crumb test: Ran 61 tests across 6 files. [22.00ms]
@tjakoen/crumb test: Exited with code 0
@tjakoen/proof test: (pass) a change inside the plan's touches passes [18.41ms]
@tjakoen/proof test: (pass) a tick added by the diff, with nothing under touches, fails the gate [12.73ms]
@tjakoen/proof test: (pass) a plan moved to done in the diff, with nothing under touches, warns but does not fail [12.96ms]
@tjakoen/proof test: (pass) outside a git repo it fails loudly instead of passing on no evidence [0.78ms]
@tjakoen/proof test: (pass) a failed changedFiles command fails verification rather than supplying an empty diff [13.42ms]
@tjakoen/proof test: (pass) a failed untrackedFiles command fails verification rather than supplying an empty diff [12.64ms]
@tjakoen/proof test: (pass) a failed addedLines command fails verification rather than supplying an empty diff [12.62ms]
@tjakoen/proof test: (pass) a failed rebuild is reported and the watcher can recover [203.62ms]
@tjakoen/proof test: (pass) a doing plan with no touches is reported rather than silently passed [0.01ms]
@tjakoen/proof test: (pass) only an unbacked tick can fail the gate; the rest are warnings [0.06ms]
@tjakoen/proof test:  84 pass
@tjakoen/proof test:  0 fail
@tjakoen/proof test:  192 expect() calls
@tjakoen/proof test: Ran 84 tests across 10 files. [808.00ms]
@tjakoen/proof test: Exited with code 0
```

The first workspace run failed because Playwright's required headless shell was absent. Installing
the workspace version fixed that prerequisite. The recursive native watcher fixture also exposed a
macOS startup-event race; its real filesystem regression uses the nonrecursive adapter over a flat
fixture. Default recursive production watch coverage remains a platform limitation.

A cancellation assertion originally counted the committed caret-settlement operation as a token;
the final assertion prohibits pending token operations and navigation while permitting settlement.

## Diffstat

```text
 packages/grain/ai/model-reasoner.test.ts |  56 ++++++++++++
 packages/grain/ai/model-reasoner.ts      |  21 ++++-
 packages/grain/ai/model.test.ts          |   8 ++
 packages/grain/ai/model.ts               |  16 ++++
 packages/proof/README.md                 |   8 +-
 packages/proof/live.test.ts              | 148 ++++++++++++++++++++++++-------
 packages/proof/live.ts                   |  82 ++++++++++-------
 packages/proof/serve.ts                  |   6 +-
 packages/proof/verify.test.ts            |  30 ++++++-
 packages/proof/verify.ts                 |  78 +++++++++-------
 10 files changed, 349 insertions(+), 104 deletions(-)
```

## What was not done

No push, deployment, publish or commit. No badge or course-platform edits. No cancellation rollback
is promised for a write that has already begun. No new generic handlers are invented for application
verbs. Parent owns canonical portfolio documentation and browser evidence.

## What needs human eyes

Final independent review of asynchronous watcher error reporting and the model capability projection.
The parent run must reconcile canonical documentation and the final framework coverage limits.

## Follow-up: nested plan directory Git evidence

The parent scope check exposed that Git commands ran from the plans directory. Untracked evidence
was limited to that subtree, and added-line pathspecs interpreted repository paths from the wrong
directory. All evidence commands now run from the resolved repository root. The plan directory and
root are canonicalized before relative-path comparison, including macOS temporary directory aliases.

A real Git fixture failed before the fix, then proved root-level untracked coverage, correctly
prefixed untracked plans, tracked plan added lines, and rejection of unsupported completion ticks.
No interface or canonical documentation contract changed.

```text
$ bun run --filter '*' check
@tjakoen/grain check: Exited with code 0
@tjakoen/grain-mcp check: Exited with code 0
@tjakoen/mill check: Exited with code 0
@tjakoen/crumb check: Exited with code 0
@tjakoen/proof check: Exited with code 0

 85 pass
 0 fail
 199 expect() calls
Ran 85 tests across 10 files. [1022.00ms]
```

The unchanged workspace suites were not repeated for this follow-up. The PROOF package has 85
passing tests. Root independently reviewed the follow-up and reran source scope verification successfully; only the excluded badges plan retained its pre-existing scope warning.

## Local landing, November 1

The owner subsequently requested clean main branches. The verified changes and their evidence are
being recorded in a local commit and brought onto main by fast-forward. Earlier statements about
uncommitted work describe the implementation phase. No push, package release, or deployment is part
of this landing.
