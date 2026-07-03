# GRAIN — usage

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

GRAIN is the **AI-interaction design system**: a UI where every surface is addressable
and operable by both a human and an AI through one shared vocabulary, with the AI's
presence shown as a visible signal (*grain = AI*). It runs on a **substrate** (BATCH is
the reference one) but imports nothing from it.

- **The beliefs behind it:** [`../portfolio/PHILOSOPHY.md`](../portfolio/PHILOSOPHY.md)
- **Overview / why:** [`docs/GRAIN.md`](docs/GRAIN.md)
- **The full contract** (intent envelope, render ops, manifest, the AI-acts protocol,
  the two write paths): [`docs/AI-INTERFACE.md`](docs/AI-INTERFACE.md)
- **Built on top of GRAIN:** [`MILL`](../mill/PLAN.md), the Markdown→pages CMS (a layer above).
- **Roadmap / planned features:** [`PLAN.md`](PLAN.md)

This file is the practical reference: what a host must provide, the markup conventions,
and how to wire it.

---

## 0. Two layers — the AI interface is optional

GRAIN is **two things, one-directional**:

- **The design system** (always usable) — the `b-*` atoms, the **default theme**
  (`styles/variables.css` = tokens + `@font-face`, `styles/global.css` = base/skin,
  `fonts/` = the Redaction grades), and the **grade-as-signal** mechanism
  (`styles/grain.css`: the `--type-font` atom, `data-grade` / `.field` / `data-commit`
  rules, caret, settle). Grade is useful with **no AI at all**: draft vs. saved,
  focus/editing, in-transit vs. committed. It depends on nothing in `ai/`.
- **The AI-interaction layer** (opt-in) — `ai/*` (the door, contract, reasoner boundary,
  manifest, accepts), the dispatcher island `scripts/ai-dispatch.js`, and its styling
  `ai/ai.css` (the "AI is acting" spotlight). This layer *uses* the design system
  (sets `data-grade` by provenance); the design system never reaches back into it.

So you can adopt **just the design system** in a plain BATCH app: link GRAIN's three
stylesheets (`variables.css` → `global.css` → `grain.css`) + the `b-*` atoms, and skip
`ai/` entirely. It looks like GRAIN out of the box; override token slots (§4) to re-skin.
Add the AI layer later by wiring §5 and bundling `ai/ai.css`. (This repo's app uses both;
a no-AI consumer simply drops `grain/ai` from its style roots.)

---

## 1. The substrate contract — what a host must provide

GRAIN is portable to any host that supplies three things:

1. **An `OpChannel`** — `push(session, event, data)` (`ai/contract.ts`). How render ops
   reach a client. BATCH = SSE; a WebSocket hub would do. GRAIN imports the *interface*
   from its own contract, never the implementation. *(Future, additive: a durable
   sibling — a per-actor turn-status store — lets a reconnecting client reflect a
   still-running turn. It sits beside this port; the component conventions don't change.
   See `docs/AI-INTERFACE.md` §5d.)*
2. **A renderer that understands the binding vocabulary** below (§3). BATCH's
   composition engine implements it; another substrate must too.
3. **A filesystem** (`ai/accepts.ts` reads component files to harvest the manifest) —
   any JS runtime, not substrate-specific.

Everything else (the scoped write capability, "render a surface to HTML") is **injected**
by the composition root — GRAIN names no concrete dependency.

---

## 2. GRAIN's own conventions (read by the dispatcher + harvest)

Put these on your components/markup; GRAIN's island + door act on them:

| Attribute | On | Means |
|---|---|---|
| `data-surface="kind:id"` | any region | its **address** — what render ops target (built with `surface(kind, id)`) |
| `data-action="verb"` | a control | clicking it (or Enter in an input) becomes `POST /intent` with that verb |
| `data-target="surface"` | a control | the surface the action affects (defaults to the nearest `data-surface`) |
| `data-kind` + `data-accepts="v1 v2"` | a component root | harvested into the AI manifest (what verbs this kind accepts) |
| `data-grade="grain\|smooth\|accent"` · `.is-ai` | any ancestor | provenance: grain = AI, smooth = human (distributed via `--type-font`) |
| `data-commit="pending"` | any ancestor | in-transit / not-yet-committed → reads grain |

The verbs themselves live in the closed registry (`ai/contract.ts`: `ActionName` /
`SurfaceKind` / `ACTIONS`) — the single source of truth.

**State invariant (what keeps it from getting fidgety).** UI state is **declarative
attributes** components wear — the dispatcher acts on attributes, never component names,
so any component participates with no bespoke JS. Transient state (`data-commit="pending"`
/ `ai-spotlit`) follows one rule: **every optimistic "pending" is cleared by a
server-sent terminal op** — a `committed` op, a `flash` (rollback), a `remove`, or a
`type {done}`. Backstops cover the rest: a held control is also released when the AI
turn ends (`spotlight active:false`), re-triggering the same surface clears the old
holder first, and a 20s timeout releases a stuck spotlight. Net: the server is the
source of truth; the DOM is derived, and never strands a "working" state.

---

## 3. The binding vocabulary GRAIN's components are authored in

These are the host-renderer conventions (BATCH defines them in `../batch/render/render.ts`).
A substrate must interpret them to render GRAIN's `b-*` atoms. This is the one coupling
that lives in markup rather than code.

| Form | Means |
|---|---|
| `data-field="path"` | set this element's **text** from a data path (HTML-escaped); `"."` = the scope itself |
| `data-bind-<attr>="path"` | set **attribute** `<attr>` from a data path; empty → omit; URL attrs are scheme-guarded |
| `<slot-tag prop-as="default" prop-attr-X="prop" prop-text="prop">` | the **polymorphic** element: become `as`; set attrs/text from config props |
| `each="path"` | **repeat** the component once per array item (item = the scope) |
| `data="path"` | **scope** a child component to a sub-slice |
| `<b-button>` … (hyphenated tag) | a **component** — expanded server-side; may self-close |

Example (GRAIN's text atom):
```html
<slot-tag prop-as="span" prop-attr-class="class" data-field=".">Example text</slot-tag>
```

---

## 4. The token slots (GRAIN's default theme — override to re-skin)

GRAIN ships a **default theme** in `styles/variables.css` (the *Bread* look:
monochrome paper/ink + self-hosted Redaction grades). The mechanism (`styles/grain.css`)
and atoms read these token *slots*, so a consumer re-skins by **overriding the slots** in
its own sheet (linked after GRAIN's) — no component changes:

- **fonts:** `--type-font` (the inherited switch), `--font-grain`, `--font-smooth`, `--font-accent`
- **ink/paper:** `--ink`, `--paper`, `--color-fg`, `--color-muted`, `--line-soft`
- **scale:** `--space-1..8`, `--text-sm`, `--border`, `--radius-sm`, `--radius-md`
- **AI spotlight:** `--ai-veil` (the "AI is acting" backdrop — three on-theme picks:
  `color-mix(in srgb, var(--ink) 22%, transparent)` dim · `color-mix(in srgb, var(--paper) 70%, transparent)` wash ·
  `transparent` lift) and `--ai-focus-move` (how slowly the spotlight glides between
  surfaces). Both set once in the theme so every page behaves identically.

---

## 5. Wiring it (composition root)

```ts
import { createInteractionLayer } from "grain/ai/interaction-layer.ts";
import { createAccepts } from "grain/ai/accepts.ts";

const layer = createInteractionLayer({
  reasoner,                       // your Model-backed reasoner (or the stub)
  stream,                         // an OpChannel (e.g. BATCH's createStream())
  archiveItem,                    // app-scoped write capabilities the reasoner may use…
  renderSurface,                  // …and "render this surface to committed HTML"
});
// mount: POST /intent → layer.handleIntent ; GET /stream → the channel ;
//        GET /ai/manifest → buildManifest(screen, targets) ;
// include the island: <script src="/scripts/ai-dispatch.js" defer></script>
// link GRAIN's stylesheets in <head>: variables.css → global.css → grain.css, then your
//   component bundle; include grain/ai/ai.css (bundled or linked) for the AI spotlight.
```

> **Rough edge (honest):** the action *vocabulary values* and the reasoner's *tools*
> (`archiveItem` …) are currently entangled with GRAIN rather than fully app-injected.
> Pushing the vocabulary down to the consumer is a known next step (see
> `docs/AI-INTERFACE.md` §1b note). Until then, edit `ai/contract.ts` to add verbs.
