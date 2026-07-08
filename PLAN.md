# PROOF — plan

> Status: **pieces 1, 2, 4 built + the mount seam (`createProofRoutes`); piece 3 (live SSE) pending.** PROOF — the dough rising before the bake,
> and the proof of progress — is the stack's **AI plan board**: a standardized way to write an AI's
> development plans as markdown files (`plans/`), and a kanban-style board that *renders* them.
> It is its **own top-level project** (a sibling of `mill/`, above `batch/` + `grain/`, a consumer
> of `mill/`) and is designed as a **reusable, open-source** tool (Apache-2.0, per the per-repo
> licensing decision). This file is the **canonical PROOF plan**; the cross-layer sequencing is
> Track E in [`../ROADMAP.md`](../ROADMAP.md). A companion blog note is drafted at
> [`../tjakoen.github.io/notes/where-were-we.md`](../tjakoen.github.io/notes/where-were-we.md).

> **Direction update (2026-07-08): PROOF is a mountable layer, not a server.** The standalone
> server built in piece 2 will be **extracted into PANTRY** (the dev-docs cockpit app —
> [`../pantry/PLAN.md`](../pantry/PLAN.md)). PROOF keeps `core/` + `loader.ts` + `board.ts` and
> gains **`createProofRoutes(deps)`** (a transport-generic pathname handler, mirroring MILL's
> `createMillRoutes`); `serve.ts`/`cli.ts`/asset wiring move to PANTRY. Don't extract until pieces
> 3–4 settle the layer surface. The design law below is unchanged.

## Positioning

PROOF is **plan legibility for AI-driven development**: the AI's intent as a visible surface, the
same way GRAIN makes the AI's *hands* visible (grade-as-signal). It extends the stack's thesis from
provenance-of-output to **provenance-of-intent** — you can watch not just what the AI did, but what
it *thinks it's doing and where it is*.

Honest pitch split (state it everywhere): **~70% human observability, ~30% AI efficiency.** The AI
never sees the board; its gain comes only from the file structure (cheaper session start, ground
truth for parallel sessions, forced decomposition). The board is for the human. Don't overclaim.

## The one design law

**Files are the SSOT. The board is a projection. The AI maintains files, never the board.**

- Plans are markdown with minimal frontmatter. The AI edits them with its native tools — zero new
  workflow, zero plugin, zero API.
- `tasks.json` (the machine index) is **derived by the parser, never hand-maintained**. A
  hand-edited JSON beside the markdown is dual bookkeeping and is banned by design.
- Delete PROOF and the plans stay readable markdown. The tool is a viewport, never a store.
  (Same law as the static-export decision: projection, never fork.)

## The schema (deliberately minimal — ≤6 fields)

```yaml
---
id: 001-interaction-timeline   # = filename stem
status: doing                  # todo | doing | done | blocked
track: A                       # optional, free grouping label
depends: []                    # ids this plan waits on
touches: [grain/ai/contract.ts] # optional; code areas — scopes graphify queries + board links
owner: ai                      # ai | human
---
```

Body = the plan prose + a task checklist (`- [ ]`). Big tasks may become child plan files. The
schema stays small **on purpose**: a heavy schema makes the AI do bookkeeping instead of work,
which kills the efficiency the whole thing claims.

## What PROOF gives you (capabilities)

**Hero — the reasons PROOF exists:**

- **The AI's plans as a live board.** `bunx proof serve` boots its own tiny BATCH+GRAIN server,
  reads `./plans/`, renders a kanban board; a file watcher pushes changes as `RenderOp`s over SSE
  (the existing `OpChannel` port). Works in **any** project — Python, Rust, whatever — because the
  tool ships its own substrate.
- **Injectable discipline, not injectable suggestion.** `bunx proof init` scaffolds three things:
  the `plans/` dir + schema, a CLAUDE.md contract section, and a **hook set** (SessionStart injects
  the plan index into context; Stop + pre-commit check "source changed but no `doing` plan
  touched"). Enforcement ladder: design-out > hooks > lint > human glance — instructions alone
  decay; hooks don't run on the AI's goodwill.

**Also — useful features, deliberately listed:**

- **`proof check` lint** (CI-able, deterministic): schema validity, legal statuses, staleness
  (`doing` with no repo activity for N days), inconsistency (`done` with unticked checklist).
  Board renders the flags — rot is visible, not silent.
- **Card detail via MILL.** The board owns only the board layout + the frontmatter index; clicking
  a card renders the full plan body through MILL. PROOF is MILL's first library consumer — proves
  the "own reusable project" claim.
- **Git as the timeline.** Cards show last-modified from git log; a plan file's history is the
  record of the AI's decisions.
- **`CodeGraph` port (optional, never a dependency).** A small interface for code-graph enrichment;
  **graphify is the first adapter**. Present: `touches` scopes `graphify query` at session start,
  cards show blast radius, `proof check` cross-checks `done` plans against graph deltas. Absent:
  features degrade, cards still render. Never couple to graphify's JSON schema directly — the
  adapter isolates it.
- **Handoff for free.** Session start reads the plan index instead of a handoff prompt; state is
  already durable in files.

## Pieces (build order)

1. **Core: schema + parser + derived index.** ✅ (2026-07-08) — `proof/core/` (`types.ts`,
   `schema.ts` = `parsePlan`, `index.ts` = `buildIndex` + `validateBoard`). Framework-agnostic and
   PURE (no fs/git/clock — the loader + git-age live in the serve piece); **reuses
   `mill/core/frontmatter.ts`** (`parseFrontmatter`) by relative import (git dep on split). Invalid
   status/owner fall back to a default AND report an error (never silently dropped). 16 unit tests.
2. **Board: `proof serve`.** ✅ (2026-07-08) — `proof/loader.ts` (fs + best-effort git age),
   `proof/board.ts` (pure renderer, emits FINAL GRAIN-class HTML not `<b-…>` tags — MILL's rule),
   `proof/board.css` (kanban layout, tokens-only, theme-aware for free), `proof/serve.ts`
   (self-contained Bun server; assets resolve relative to the module so `bunx proof` runs from any
   cwd; reads the consumer's `plans/`), `proof/cli.ts` (`proof serve [dir] [--port N]`). Card detail
   renders the plan body through MILL (body-only layout). `/plans.json` = the derived index. Read-only.
   Example plans in `proof/example/` (board demo + test fixtures). 28 unit tests; screenshots verified.
   **Mount seam (2026-07-08): `proof/routes.ts` = `createProofRoutes(deps)`** — a transport-generic
   pathname handler `(pathname) => Response|null`, prefix-configurable (mirrors MILL's
   `createMillRoutes`), chrome injected. `serve.ts` is now a thin standalone wrapper over it; PANTRY
   mounts it at `/plans`. This is the pivot in code: PROOF is a mountable layer, not a server.
3. **Live: watch + push.** File watcher → ops over SSE via the `OpChannel` port. (Respect the
   ready-handshake lesson — see memory `sse-ready-handshake-and-op-drop`.) *(pending — piece 3.)*
4. **Inject: `proof init` + `proof check`.** ✅ (2026-07-08) — `proof/check.ts` (`runCheck` +
   `formatReport`: parse errors, dangling depends, done-with-open-tasks, stale `doing`, duplicate
   ids; exits nonzero for CI) and `proof/init.ts` (`runInit`: non-invasive scaffold — `plans/` +
   README contract + session-start/pre-commit hook scripts; prints the one manual wiring step,
   never edits a host's files). `proof <serve|check|init>`. `init`→`check` roundtrip verified clean
   (README.md is excluded from plans at the loader). This piece is what makes it portable.
5. **Dogfood: migrate this repo.** ROADMAP tracks become `plans/*.md` files; ROADMAP.md shrinks to
   the frame + milestone + a pointer. **Owner gate before migrating** — ROADMAP is load-bearing
   and parallel sessions read it.
6. **Phase 2 (not now):** the mindmap (join plan nodes + memory `[[links]]` + `CodeGraph` — all
   three graphs exist already, this is a render); multi-project board (`proof serve` over many
   dirs); human interaction on the board through the client-side `/intent` door (symmetry thesis —
   v1 is read-only on purpose).

## Non-goals

- **Not a task manager for humans.** v1 board is read-only; humans edit the same files the AI does.
- **Not a store.** No DB, no board state outside the files + git.
- **Not a parallel plan system.** In any repo that adopts it, existing plan prose migrates in or
  PROOF stays out — two plan systems is the drift this exists to kill.
- **No graphify dependency.** Port + adapter only.

## Efficiency guardrails (the "does the AI still work well" contract)

- AI's total new duty = editing one frontmatter line + keeping its plan body current. Both happen
  in a file it's already editing (the plan IS the working doc).
- Plan index injection at session start stays small (id + status + one-liner each).
- Schema never grows past the fields above without a fight.
- If a session shows the AI spending tokens on plan bookkeeping instead of work, that's a design
  failure of PROOF, not an operator error (mistake = design signal).

## Related work this unlocks (tracked elsewhere)

- **Standards web-render route** (`/standards/*` through MILL) — portfolio work, closes the owed
  item from the standards-SSOT consolidation. Standards stay in the portfolio (public); consumers
  reference by URL or git dep — reference, not fork, not a separate repo.
- **Portfolio showcase page** for PROOF (a `/proof` trailhead) once built — teaser, docs stay the
  single source.
