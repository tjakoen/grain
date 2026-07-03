# GRAIN — an interface an AI can operate

**GRAIN** is a **design system** with an **optional AI-interaction layer** on top. The
design system — the `b-*` atoms + *grade-as-signal* (grain texture encodes state) — is
usable on its own in any BATCH app, no AI required (grade also means draft/saved,
focus/editing). The AI layer adds the part where every surface is **addressable** and
**operable by both a human and an AI through one shared vocabulary**, with the AI's
presence shown as a visible signal: *grain = AI* (the Redaction grain grade), clean =
human. The dependency is one-directional — the AI layer uses the design system, never
the reverse (see [`../grain/README.md`](../README.md) §0).

> **On the name.** *Grain* earns it twice: it's the literal AI signal (the Redaction
> grain grade), and it's the *vibe* — warm paper, soft ink, that faxed/floury texture
> reads like **bread**. Wholesome, slow-risen (no-build, server-rendered), and the grain
> is the whole point. Fitting for a second brain.

It runs **on a substrate** — [BATCH](../../batch/docs/ARCHITECTURE.md) (no-build, server-rendered
hypermedia) is the reference one — but it is **substrate-agnostic**: `grain/` imports
nothing from `batch/`. It depends only on a small **port** (`OpChannel`, below), which
BATCH's SSE hub satisfies structurally. BATCH answers "how do I render and serve
components with no build step"; GRAIN answers "how does an AI drive that UI, visibly,
through one door" — and would answer it the same on a different substrate.

## Substrate contract — what GRAIN needs to run

GRAIN is portable if its host provides three things (BATCH provides all three; another
substrate could):

1. **A push channel** — the `OpChannel` port (`push(session, event, data)`): how render
   ops reach a client. BATCH = SSE; could be a WebSocket hub, etc. *(GRAIN imports the
   interface from its own `contract.ts`, never from the substrate.)*
2. **A renderer that understands GRAIN's binding vocabulary** — components use
   `data-field` / `data-bind-*` / `slot-tag` / `each` / `data`. BATCH's composition
   engine implements this; a different substrate must too. *(This is the one real
   remaining coupling — it lives in the markup conventions, not in code imports.)*
3. **A filesystem** to harvest `data-kind` / `data-accepts` for the manifest (any JS
   runtime; not BATCH-specific).

Everything else GRAIN needs (the write capability, the render-a-surface function) is
**injected** by the composition root, so GRAIN names no concrete dependency.

## The pieces

| Piece | What it is | Where |
|---|---|---|
| **Surfaces** | every mutable region has a stable semantic address (`data-surface`) | markup + `grain/ai/contract.ts` |
| **Action vocabulary** | one closed set of verbs (the SSOT: `ActionName`/`SurfaceKind` + `ACTIONS`) | `grain/ai/contract.ts` |
| **The one door** | human click *and* AI decision become the same `Intent` → `POST /intent` → single writer | `grain/ai/interaction-layer.ts` |
| **Render ops** | the writer's only output: `replace/append/remove/flash/type/spotlight`, addressed to surfaces, pushed over SSE | `grain/ai/contract.ts`, `batch/http/stream.ts` |
| **Manifest** | the AI's instruction manual per screen — harvested from components, can't drift | `grain/ai/manifest.ts`, `grain/ai/accepts.ts` |
| **Grade-as-signal** | grain = AI / in-transit, clean = human / committed — one inherited switch | `DESIGN-SYSTEM.md` §3, `AI-INTERFACE.md` §5 |
| **The "AI acts" protocol** | spotlight the surface, it enters AI-mode by kind (button → working, input → composed clean, text → grain), act, hand back — mediated, never force-killed | `AI-INTERFACE.md` §5c |
| **The takeover console** | when the AI takes over, the assistant retracts and a console narrates each step as an **action-badge** (the verb vocabulary made visible: `reads → types → revises → clicks → commits`) | `AI-INTERFACE.md` §5e, `components/atoms/action-badge` |

## How it stacks

```
Product (the assistant) — domain components + pages + wiring (+ optional theme override)
   └─ GRAIN   — the AI-operable design system + its DEFAULT theme, "Bread"
        │        (tokens, Redaction fonts, base/skin, grade mechanism, the AI layer)
        └─ BATCH — no-build hypermedia substrate (ARCHITECTURE.md)
```

*Design system vs. theme:* GRAIN ships the **Bread** look as its **default
theme** — it's GRAIN's identity (the warm-paper, Redaction-grain, bread vibe). A product
on GRAIN uses it directly and only **overrides token slots** (in its own sheet, linked
after GRAIN's) if it wants a different vibe. New design work generally lands **in GRAIN**
(it's reusable); only the obviously app-specific bits (a one-off page layout) stay in the project.

The detailed contract is **[AI-INTERFACE.md](./AI-INTERFACE.md)** (envelopes, manifest,
the two write paths, the AI-acts protocol); the visual identity and grade mechanics are
**[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)**.

## Two layout archetypes — editorial & workspace

GRAIN ships two ways to lay out a page; both read the same tokens and the same grade
mechanism, so the AI layer works identically in either.

- **Editorial** — the single-column `.container` (reading, marketing, docs). The portfolio
  and content pages use it.
- **Workspace** — the **`app-shell`**: a full-viewport grid of five regions (left **rail**,
  **topbar** with **tabs**, **main**, right **aside** = the assistant, bottom **console**),
  the "work-y" VS Code-style archetype. Because the render engine can't project children into
  a component, the shell and its parts (`side-rail`, `tab-bar`, `nav-item`, `tab`) are
  **layout class-contracts** (a `.css` + a `.md` example, no `.html` tag) that a page applies
  to plain elements — not data-bound tags. The product wraps them once in a domain organism,
  **`app-frame`** (`project/components/organisms/app-frame`), that carries the rail, tabs,
  assistant, and console as the shared chrome on every page; `/dashboard` and `/loop` compose it.

**The AI lives in the shell.** The right **aside** holds the assistant conversation
(`chat.send` → your bubble + the AI's streamed reply, `chat-message`); when the AI *takes
over* (a spotlight op raises `data-acting` on `.app-shell`), the chat retracts and the bottom
**console** rises to narrate the run as `action-badge`s (`AI-INTERFACE.md` §5e). The console
is styled in the **grain serif** (not a monospace terminal) — the AI's narration is its
*speech*, so it wears the same grain voice as everything else the AI authors, not a
developer-console aesthetic. `grain/scripts/shell.js` manages the rail collapse/drawer and the
chat⇄console swap; it knows nothing about the AI door.

## Repo layout (monorepo, separated now)

The three concerns are already separate top-level directories — no Bun workspaces,
plain relative imports, one `package.json` + `tsconfig` at the root. They're polished
in place and will each become **their own repo** (GRAIN a package on BATCH) once the
product proves them; the boundary is kept clean so that split is a copy, not a rewrite.

```
batch/     substrate — render, http (incl. stream.ts SSE), assets, catalog, platform.
           Imports nothing from grain/project. Ships its own render-test fixtures.
grain/     the design system — ai/ (contract, interaction-layer, reasoner boundary,
           manifest, accepts), components/atoms/b-*, scripts/ (ai-dispatch, cmdk),
           styles/ (variables = tokens, global = base/skin, grain = grade mechanism),
           fonts/ (the Redaction grades). Ships its DEFAULT THEME — GRAIN looks like
           GRAIN on its own. A consumer overrides token slots to re-skin.
project/   the app — domain/data/services/routes/view, DOMAIN components (item/loop/…),
           pages, vendor, server.ts (the composition root — the one place batch + grain
           + project meet). Uses GRAIN's look; would add an override sheet only to diverge.
```

A key consequence the split forced (and a real reusability test): BATCH's
`render`/`catalog`/`style-bundle` and GRAIN's `accepts` accept **multiple component
roots**, so components compose across `grain/components` + `project/components`.

The detailed contract is **[AI-INTERFACE.md](./AI-INTERFACE.md)**; the visual identity
and grade mechanics are **[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)**; the hands-on usage
reference (substrate contract, binding vocabulary, token slots, wiring) lives in the
package itself, **[`../grain/README.md`](../README.md)**. When extracting:
BATCH → its own repo; GRAIN → a repo on a substrate (BATCH the reference); product → on GRAIN.
