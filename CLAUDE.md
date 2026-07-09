# CLAUDE.md — grain

Onboarding + operating rules for any AI (or human) working in **`grain/`**, the AI-interaction
design system. Read this first, then the docs it points to. Keep it accurate — if you change how
grain works, update this file.

> Personal standards (voice, badges, AI-use posture) live at the published index
> <https://tjakoen.github.io/standards> (the `@tjakoen/standards` package) — referenced, never
> forked. This file is seeded from its `CLAUDE.starter.md`.

## What this is

GRAIN is a UI where **every surface is addressable and operable by both a human and an AI through
one shared vocabulary**, with the AI's presence shown as a visible signal (*grain = AI*). It's
**two layers, one direction**: the **design system** (the `b-*` atoms, the *Sourdough* default theme,
the grade-as-signal mechanism) — usable with no AI at all — and the **optional AI-interaction layer**
(`ai/*`, the dispatcher, the spotlight). It runs on a substrate (BATCH is the reference) but imports
**nothing** from it except the `OpChannel` port. `README.md` is the practical wiring reference.

## Start here (reading order)

1. [`../tjakoen.github.io/PHILOSOPHY.md`](../tjakoen.github.io/PHILOSOPHY.md) — the *why* beneath the whole stack.
2. [CONVENTIONS](https://tjakoen.github.io/batch/docs/conventions) — the **build standard** (layering,
   components, tokens, the action vocabulary, the 3-tier testing bar). The rulebook.
3. [GRAIN](https://tjakoen.github.io/grain/docs/grain) — the design system + AI layer overview.
4. [AI-INTERFACE](https://tjakoen.github.io/grain/docs/ai-interface) — the **contract**: one door →
   `RenderOp`s, the manifest, grade = commit state, and the **control lifecycle** (§5).
5. [DESIGN-SYSTEM](https://tjakoen.github.io/grain/docs/design-system) — the look + grade-as-signal.

The GRAIN docs are canonically homed in the portfolio repo (`tjakoen.github.io/docs/grain/`), rendered
via MILL. The SSOT for what's operable is **`ai/contract.ts`** (`SurfaceKind`, `ActionName`, `ACTIONS`,
`RenderOp`). The published docs home for the whole stack is <https://tjakoen.github.io>.

**What's next for grain lives in [`../ROADMAP.md`](../ROADMAP.md) — Track A** (finish the modality,
then wire the live model at M★). Read it before starting substantive grain work; it's the canonical
cross-layer execution plan and this file stays canonical for grain's rules.

## Non-negotiables

- **Layering.** grain imports **nothing** from `batch/` except the `OpChannel` port (`ai/contract.ts`).
  **Nothing product- or page-specific belongs in grain** — test: *"would another product on GRAIN
  want this?"* No → it lives in `project/` or `tjakoen.github.io/`, not here.
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
6. **The reply channel must be LIVE before an intent is raised — SSE has no replay.** An `Intent`
   posted before the `/stream` subscriber is registered *server-side* silently drops its first
   `RenderOp`s. When the dropped op is the `spotlight`-on, the page never enters "acting"
   (`isActing()` stays false) → the AI **looks stuck and can't be interrupted** (clicks/Escape never
   raise the stop prompt), yet nothing errors. The native EventSource `open` is **not** sufficient —
   it fires on response headers, which can precede `start()` registering the subscriber. Fix: the
   stream emits a `ready` handshake **from inside `start()`** and the dispatcher gates every submit
   on it (`grain/scripts/ai-dispatch.js`, `batch/http/stream.ts`). Symptom→cause: *a demo that does
   nothing for a beat, or can't be stopped* = dropped early ops, not reasoner logic.
7. **An AI run must be LEGIBLE and must always RELEASE.** Every run narrates its steps somewhere the
   user can see (the app-shell console on `/loop`; a `.surface-term` terminal on `/grain`, both the
   `console` push-surface) so a multi-second run never reads as frozen — silence looks like "stuck".
   And every path (natural completion *and* graceful stop) must end by releasing the spotlight
   (`spot("screen", false)`); **test the natural-completion release**, not just the stop path — the
   gap that let #6 ship was an e2e that asserted outcomes but never that the veil drops on its own.
8. **The "AI is acting" treatment must hold for every surface KIND — designed out (2026-07-04) by
   the TRAVELING LAMP.** The original spotlight restyled the *target* (`.ai-spotlit` = paper lift +
   offset outline): every surface shape needed bespoke lit CSS, inputs broke first (label left in the
   dim, doubled focus ring — patched with `.field:has(...)`), and **nothing ever traveled** — class
   swap = teleport, so the `--ai-focus-move` "glide" token was a visual no-op and the AI's focus
   switch read as an instant snap. The root fix inverted the model: the spotlight is now **one
   fixed-position lamp** (`.ai-lamp`) whose rect glides between surfaces, carrying the dim as its
   own cutout shadow; the lit element is never restyled (a rect is a rect — kind-agnostic by
   construction; a control's frame is its whole `.field`, a rule in the primitive, not CSS).
   `.ai-spotlit` remains as the semantic marker only. Meta-lesson kept: if a treatment needs a new
   rule per surface kind, the treatment is at the wrong altitude — attach it to the *geometry*, not
   the element. (Also: a shell pane that owns the page scroll must opt into `scroll-behavior:
   smooth` — `scrollIntoView` uses the nearest scrollable ancestor, and `html`'s opt-in doesn't
   cascade into `overflow:auto` panes; that regression made the AI's focus jumps instant.)

9. **A design token must be MECHANICALLY CONSUMED — and a knob that changes nothing is a
   disconnected knob, not a wrong value.** How the lamp snap survived three tuning rounds
   (2026-07-04): `--ai-focus-move` ("how slowly the spotlight glides") existed, was documented, and
   was wired into a `transition` — but the transition animated properties that never actually
   changed visibly (`outline-color` on a class swap), so no duration or easing could ever produce a
   glide. Human and AI both kept adjusting the value. The rule this bought: **before tuning a token,
   verify the mechanism consumes it — measure the behavior (rAF-sample it, don't eyeball it); if
   turning the knob produces no measurable change, the mechanism is broken and the tuning session is
   over.** Corollary for authors: never ship a token whose promise ("glide", "settle", "travel") the
   mechanism can't render — that's documented behavior with no implementation, the worst drift,
   invisible to `tsc` and tests unless a conformance assertion covers the *motion itself*.
   Verdict on the whole episode: a **design-system defect** (the treatment lived on the element
   instead of the geometry — see lesson 8), *not* an architecture defect — the door, the ops, and
   the dispatcher orchestration were all correct throughout; nothing in `contract.ts` changed to fix it.

## Definition of done

Code + the right test tier(s) (unit / conformance e2e) + `tsc` and `bun test` green + docs synced
(the `.md` next to the component, and the concept docs above — now homed in
`tjakoen.github.io/docs/grain/`) + a memory if a decision was made.

## Working notes

- Commit/push only when asked; branch off `main` if you must. No AI attribution trailers on
  commits (the "built with Claude" receipt is the README badge + footer, not commit metadata).
- Voice for any prose in the owner's name: <https://tjakoen.github.io/standards/voice> (no backticks in prose).
- README badges/footer: <https://tjakoen.github.io/standards/readme-standard>.
