# CRUMB — plan

> Status: **PLANNING ONLY (2026-07-19). Nothing built.** CRUMB — the breadcrumb trail, the guided
> path, the proof-you-can-follow — is the GRAIN stack's **guided-tour / demo-mode / AI-review
> layer**. It is PROOF's twin: where PROOF renders *plans-as-markdown* as a board that never writes,
> CRUMB renders **tours-as-markdown** as a guided projection that never writes. It is its own
> top-level package (in the grain monorepo: `packages/crumb`, a sibling of `mill`/`proof`, a
> consumer of `grain` + `mill`), Apache-2.0, mountable. This file is the canonical CRUMB plan.
>
> **Sequencing (owner, 2026-07-19): migration-first.** CRUMB is built natively inside the
> grain-monorepo (`packages/crumb`, `workspace:*` deps) *after* the grain→monorepo cutover, so it
> never lives a SHA-pinned life. See `grain-monorepo-migration-plan.md`; this doc is effort **B**.

## Positioning

PROOF made the AI's **intent** legible (plans as a board). GRAIN made the AI's **hands** legible
(grade-as-signal, the traveling lamp). CRUMB makes the AI's **work reviewable** — a guided path
through what changed, with a way to mark each step verified. It extends the stack's thesis from
*provenance-of-intent* to **provenance-of-review**: you don't just see what the AI did, you're
walked through it and you sign off, step by step.

**The flagship is the AI Review tour** (owner: "the big feature is a feedback mechanism for AI
dev"). Because the AI already acts through the visible door emitting `RenderOp`s to addressable
surfaces, the review tour **writes itself from the audit trail** — it is a projection of grain's
`timeline-log.ts` (`LogEntry`s). This is the "prompt and prove" surface: prompt the AI, then walk
the proof.

Honest pitch split (state it everywhere, PROOF-style): **~80% human review/onboarding, ~20% AI
efficiency.** The AI's only gain is the `crumb init` contract that makes it drop a review tour at
the end of a UI-touching task — the tour itself is for the human. Two audiences, one mechanism:
**demo mode** (onboarding/marketing walkthrough) and **dev mode** (post-change AI review) are the
same component with `data-mode` flipped.

## The one design law

**Tours are markdown data. CRUMB is a projection. The tour never writes to the app.**

- Tours are markdown with minimal frontmatter (below). The AI authors them with native tools — zero
  new workflow, zero plugin, zero API. (Same law as PROOF's plans, MILL's pages, the static export:
  projection, never fork.)
- A tour **targets** existing surfaces by their `data-surface="kind:id"` address and **routes**
  between them with the existing `navigate` RenderOp. It highlights, it explains, it collects a
  verified/flagged mark — it never mutates app state.
- Delete CRUMB and the tours stay readable markdown; the app is untouched. The tour is a viewport.

## Reuse, don't rebuild (GRAIN lessons 1 & 8 — this is most of the design)

CRUMB is deliberately **thin**: nearly every mechanism already ships in grain. Building any of these
fresh would be the exact smell lessons 1 & 8 warn against.

| CRUMB need | Existing GRAIN mechanism (reuse) |
|---|---|
| Highlight a step's target | The **traveling lamp** (`grain/scripts/ai-spotlight.js` `createSpotlight()`) — one fixed lamp whose rect glides between surfaces. Kind-agnostic by construction. |
| Address a step target | `data-surface="kind:id"` (the manifest also **validates** targets — a tour pointing at a dead surface is a catchable error, not a silent no-op). |
| Popover + a11y | Native `<dialog>` (the cmdk / lightbox pattern already in the fleet) — focus trap, Escape, backdrop for free. |
| Step routing | The `navigate` RenderOp + View Transitions (real navigation, not an SPA fake). |
| "Mark verified" gesture | The `choices` op + `data-payload-text` primitive (AI asks / human picks) — already built for desk choices. |
| Status vocabulary | grade/`data-commit` for *render* state; a **new** verification vocab for *review* state (see net-new). |
| Enabled-by-default | `crumb init` appends a CLAUDE.md non-negotiable (grain's native enforcement idiom) telling the AI to drop `tours/review/<session>.md` after any UI-touching task. |

## Frame = a routed app-shell variant, NOT an iframe

The "window-in-window" demo frame (top bar + combined nav/content sidebar + bordered viewport) is a
**routed `app-shell` variant**, never an iframe. An iframe would spawn a second `OpChannel`
subscriber and break grain's single-door audit model (and lesson 6's live-reply-channel invariant).
Step navigation is real navigation via the `navigate` op + View Transitions. One sidebar component,
`data-mode="demo|dev"` (non-negotiable: variants as attributes, not a `DemoSidebar`/`DevSidebar`
split). Config carries `demoContent` / `devContent`; the toggle is a pure `data-mode` flip on the
same step.

## Net-new work (the small surface that is genuinely CRUMB's)

Flagged so the "reuse" table above stays honest — these four don't exist yet:

1. **Lamp passthrough mode (the ONE change that lands in `grain`, not crumb).** Today the lamp's
   backdrop is a click-catcher: any click → `onInterrupt` (`ai-spotlight.js:14-16`). A tour needs
   the opposite for its lit target — the user must be able to **click the highlighted surface to
   verify it**. Add a passthrough/non-interrupting mode: the backdrop lets pointer events through to
   the lit rect (cut a hole at the lamp's geometry, or gate `onInterrupt` off for the target).
   Attach it to the **geometry**, not per-surface (lesson 8). This is the only grain primitive gap.
2. **Verification-status vocabulary** (`new | changed | needs-verification | verified | known-issue`)
   — a CRUMB concept. **Do not overload grade** (grade = provenance/commit; conflating them is a
   lesson-3 silent-contract trap). Lives in `packages/crumb/core`.
3. **crumb-sidebar organism + frame top-bar cluster** — new composites (built from existing atoms).
4. **`from-timeline.ts`** — the `LogEntry[]` → tour-steps projection. **Highest leverage:** it is
   what makes the flagship AI-review tour write itself from the audit trail.

## The schema (minimal — mirror PROOF's ≤6 fields)

```yaml
---
id: review-2026-07-19-nav-drawer   # = filename stem
mode: dev                          # dev (AI review) | demo (onboarding)
title: "Nav drawer z-layering fix"
route: /                           # entry route the tour opens on
steps: []                          # ordered; each step below
---
```

Each step (body or frontmatter list — settle in core):

```yaml
- surface: nav:drawer              # data-surface address the lamp lights
  say: "The drawer now sits above the dock…"   # popover prose (demoContent)
  review: "Changed: z-index + safe-area pad."  # devContent (dev mode only)
  status: changed                  # the verification vocab
  verify: "Open the drawer on mobile; the dock shouldn't clip it."
```

Body = the tour's prose intro + optional per-step long-form (rendered through MILL — CRUMB is MILL's
second library consumer, same as PROOF's card detail). Schema stays small on purpose: a heavy schema
makes the AI do bookkeeping instead of work.

## Structure (mirror PROOF exactly)

```
packages/crumb/
  core/            types.ts (Tour/Step/VerificationStatus/schema), index.ts, parser
  routes.ts        createCrumbRoutes(deps) — transport-generic, chrome injected (the mount seam)
  live.ts          file-watch → RenderOp over the existing OpChannel/SSE port
  from-timeline.ts LogEntry[] → Step[] projection (the flagship's engine)
  crumb-live.js    client: drives the lamp (passthrough mode) + <dialog> popover + verify marks
  check.ts         lint: schema validity, dead-surface targets (via manifest), stale review tours
  init.ts          scaffold tours/ + CLAUDE.md non-negotiable + (optional) hook set
  cli.ts           serve | check | init
  serve.ts         standalone helper ONLY — imports batch → devDependency (per Phase 0 doctrine)
  example/         a demo-mode tour + a dev-mode review tour
  PLAN.md CLAUDE.md README.md AGENTS.md LICENSE NOTICE
```

**Dependency doctrine (inherited from the migration's Phase 0 findings):** the CRUMB *library*
(`core`/`routes.ts`/`live.ts`/`from-timeline.ts`) is **batch-free** — it takes an injected `chrome`
like PROOF's `routes.ts`. Only `serve.ts` (the optional standalone boot) names batch, so **batch is
a `devDependency`**, never a runtime dep. Internal deps (`grain`, `mill`) are `workspace:*`.

## Phased build (effort B — starts AFTER the migration lands packages/crumb)

- **B0 — grain lamp passthrough** (the one upstream change). Land in `packages/grain` with a
  conformance test that asserts a click on the lit target does NOT fire interrupt in passthrough
  mode (lesson 9: test the *motion/behavior*, not just presence). Ships independent of the rest.
- **B1 — core.** `types.ts` + schema + markdown parser + `check.ts` (dead-surface lint via manifest).
  Gate: `tsc` + `bun test`. Pure data, no DOM.
- **B2 — routes + client (demo mode first).** `createCrumbRoutes` + `crumb-live.js` driving the lamp
  (passthrough) and the `<dialog>` popover through a hand-authored `example/` demo tour. Gate: a
  playwright walk of the example tour (step → lamp lands on the surface → next → route change).
- **B3 — the crumb-sidebar organism + frame** (routed app-shell variant, `data-mode`). Gate:
  conformance e2e for the demo|dev flip on one step.
- **B4 — the flagship: `from-timeline.ts` + dev mode.** Project `LogEntry[]` → review steps; wire
  the verify/flag marks (`choices` + `data-payload-text`). Gate: a recorded timeline → generated
  review tour → walk it → marks collected.
- **B5 — `init` + the contract.** `crumb init` scaffolds `tours/` + the CLAUDE.md non-negotiable
  ("drop `tours/review/<session>.md` after any UI-touching task") + optional hooks. Gate: init on a
  throwaway dir produces a valid tour dir the AI picks up.
- **B6 — docs + a published note.** CLAUDE/README/AGENTS; fold into ROADMAP as a new track; a
  companion note in `tjakoen.github.io/notes/` (PROOF-style "where were we").

## Relationship to the migration

CRUMB does not start until the migration's **Phase 3** is green (the family installs + typechecks as
a workspace). It slots in at migration **Phase 1's** "scaffold empty `packages/crumb/`" and grows
there. The one exception is **B0 (lamp passthrough)** — a pure grain change that can land anytime,
even pre-migration, since it's just a new mode on an existing primitive.

## Open questions to settle in core (B1), not now

- Steps in frontmatter list vs. markdown body headings (PROOF puts the checklist in the body — lean
  that way for authoring ergonomics).
- Whether `verify` marks persist anywhere (they must NOT write to the app; a review tour writing its
  own "verified" back into its markdown is the one allowed self-write — decide in B4).
- Demo-mode content authoring: same file with `demoContent`/`devContent` per step vs. two files.
