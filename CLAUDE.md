# CLAUDE.md — grain

Onboarding + operating rules for any AI (or human) working in **`grain/`**, the AI-interaction
design system. Read this first, then the docs it points to. Keep it accurate — if you change how
grain works, update this file.

> Personal standards (voice, badges, AI-use posture) live in `../portfolio/standards/`
> (`VOICE.md`, `README-STANDARD.md`) and this file is seeded from `CLAUDE.starter.md`.

## What this is

GRAIN is a UI where **every surface is addressable and operable by both a human and an AI through
one shared vocabulary**, with the AI's presence shown as a visible signal (*grain = AI*). It's
**two layers, one direction**: the **design system** (the `b-*` atoms, the *Bread* default theme,
the grade-as-signal mechanism) — usable with no AI at all — and the **optional AI-interaction layer**
(`ai/*`, the dispatcher, the spotlight). It runs on a substrate (BATCH is the reference) but imports
**nothing** from it except the `OpChannel` port. `README.md` is the practical wiring reference.

## Start here (reading order)

1. [`../portfolio/PHILOSOPHY.md`](../portfolio/PHILOSOPHY.md) — the *why* beneath the whole stack.
2. [`../batch/docs/CONVENTIONS.md`](../batch/docs/CONVENTIONS.md) — the **build standard** (layering,
   components, tokens, the action vocabulary, the 3-tier testing bar). The rulebook.
3. [`docs/GRAIN.md`](docs/GRAIN.md) — the design system + AI layer overview.
4. [`docs/AI-INTERFACE.md`](docs/AI-INTERFACE.md) — the **contract**: one door → `RenderOp`s, the
   manifest, grade = commit state, and the **control lifecycle** (§5).
5. [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) — the look + grade-as-signal.

The SSOT for what's operable is **`ai/contract.ts`** (`SurfaceKind`, `ActionName`, `ACTIONS`,
`RenderOp`). The doc map for the whole monorepo is [`../DOCS.md`](../DOCS.md).

## Non-negotiables

- **Layering.** grain imports **nothing** from `batch/` except the `OpChannel` port (`ai/contract.ts`).
  **Nothing product- or page-specific belongs in grain** — test: *"would another product on GRAIN
  want this?"* No → it lives in `project/` or `portfolio/`, not here.
- **Tokens only.** No hardcoded colors, ever; components read semantic `var(--token)`s. Re-skin by
  overriding token slots (README §4), never by editing components.
- **One root class per component**, variants as **attributes** (`.btn[data-variant="soft"]`), not
  extra classes. The component owns its styling.
- **Component files:** `<name>.html`/`.css`/`.md` (+ `.ai.md` if it needs its own AI panel).
  **CSS-only layout/pattern components skip `.html`** (`app-shell`, `tab-bar`, `chat-log`, and
  data-driven atoms `b-badge`/`b-list`) — and **must state any parent-context requirement in their
  `.md`** (see lesson 3).
- **One vocabulary.** Verbs/surfaces live in `ai/contract.ts`; reference the registry in TS, never
  magic strings (HTML/browser-JS literals are the drift-guarded exception).
- **AI-mode is the shared idiom, never bespoke.** A component reads "AI / in-transit" off
  `[data-commit="pending"]` (live) and `[data-grade="grain"]` (ancestor). Express it per component,
  but key off those two.
- **Tests are part of the work.** Unit (`*.test.ts`, colocated) + the GRAIN **conformance** e2e
  (asserts usage contracts, not just that a page renders). `tsc` + `bun test` green before "done".

## Hard-won lessons — do NOT repeat these (each was an architecture smell, not a typo)

These are the mistakes that kept recurring. They share one root: **reaching for a bespoke mechanism
instead of the vocabulary GRAIN already ships, and contracts that fail *silently*.**

1. **USE the mechanism; don't reinvent it.** A client demo re-implemented the dispatcher's spotlight
   and pending lifecycle instead of reusing them → divergent, wrong. Before writing "AI is acting"
   behavior, check `scripts/ai-dispatch.js` and `ai/ai.css` — reuse, don't parallel.
2. **The control lifecycle (one rule).** A control the AI operates enters `data-commit="pending"`
   (dashed "terminal" edge + blinking caret) the moment it's used and **holds it until that action's
   *output* commits**, then releases to the human state. It is the whole working span, **not a flash
   and not a bespoke "running" state** (`AI-INTERFACE.md` §5, `pendingTriggers`). Nested work nests.
3. **Grade & component contracts must not fail silently** (all fixed — keep them fixed):
   `data-grade` applies the grain font to **any** element (`[data-grade]{font-family:var(--type-font)}`
   in `styles/grain.css`), not just type primitives; `chat-message` only aligns inside a **`chat-log`**
   (flex column); the click pulse (`.is-click`) is **self-sufficient**. If a component needs parent
   context or a sibling class to work, that's a trap — design it out or document it in the `.md`.
4. **Grade doctrine.** AI-authored text **stays grain** (provenance persists — never resolves to
   clean); only a **human's** optimistic value settles to clean once committed. Grade texture only
   reads at **≥ `--text-2xl`** — don't demonstrate it in small body text.
5. **If you keep getting something wrong, the contract is unclear.** Fix the contract (design the
   mistake out) or add a **conformance test** that catches misuse — don't just patch the instance.
   An AI tripping on the system is a measurement of the system, not just the AI.

## Definition of done

Code + the right test tier(s) (unit / conformance e2e) + `tsc` and `bun test` green + docs synced
(the `.md` next to the component, and the concept docs above) + a memory if a decision was made.

## Working notes

- Commit/push only when asked; branch off `main` if you must. End commit messages with the
  `Co-Authored-By: Claude` trailer (the receipt behind "built with Claude").
- Voice for any prose in the owner's name: `../portfolio/standards/VOICE.md` (no backticks in prose).
- README badges/footer: `../portfolio/standards/README-STANDARD.md`.
