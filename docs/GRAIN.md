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

## What GRAIN gives you (capabilities)

The capabilities, **tiered** — headliners first, then the useful-but-quieter ones. Nothing here is
buried: everything GRAIN does is either a hero or an explicitly-listed feature. **This list is the
single source** — the README and the `/grain` landing page are teasers of it, and if you add or drop
a capability, update this list (CLAUDE.md alignment table → `AUDIT.md` check 11 keeps them honest).

**Hero — the reasons GRAIN exists:**

- **One vocabulary, two operators.** Every surface is addressable and operable by *both* a human and
  an AI through one closed set of verbs, entering **one server-side door** (`POST /intent`) and
  returning as `RenderOp`s. A human click and an AI decision become the *same* `Intent` — there is no
  privileged AI→DOM back channel. (The pieces table below; `AI-INTERFACE.md`.)
- **Grade-as-signal — the AI's presence is visible.** Provenance is *typography*: grain texture = AI /
  in-transit, clean = human / committed. The honesty of the signal **is** the design system.
  (`DESIGN-SYSTEM.md` §3.)
- **Self-documenting — the live catalog.** Every component carries its own `.md` and **auto-appears in
  a live component catalog** (`/catalog`) — the design system browses itself, no hand-maintained
  index. (Harvested from the component tree; the catalog *mechanism* lives in BATCH, the content is
  GRAIN's — one source, many uses: `AI-INTERFACE.md` §4.)

**Also — useful features, deliberately listed (not headline, never hidden):**

- **The client-side door — the same contract with no backend.** The interaction layer can run
  *in the browser* (`ai/client-door.ts`): a loopback `OpChannel` hands `RenderOp`s straight to the
  dispatcher, so a **static host** runs the full vocabulary — same door, same ops, zero server. The
  page opts in (`<body data-ai-transport="client">`, typically stamped by the static export) and the
  boundary is hard: everything the client door loads is **client-safe by contract** — static-style
  modules only, no secrets/tokens, nothing that needs a server (ARCHITECTURE §19.2–19.3).
- **Theming — two orthogonal token axes.** `data-color-scheme` (light | dark | follow-the-OS) ×
  `data-theme` (the flavor — Sourdough default, Baguette, Brioche), both **pure token re-skins**
  driven by declarative controls (`scripts/theme.js`) with a render-blocking FOUC guard
  (`theme-boot.js`). Flavors are consumer-declared (`<html data-themes="…">`) — GRAIN hardcodes no
  theme names — and one `--color-accent` slot gives a flavor its single signature hue.
  (`DESIGN-SYSTEM.md` §2; the boot drift-guard validates the vocabulary server-side.)
- **The workspace shell — layout primitives for an app, not just a page.** `app-shell` (the
  five-region workspace grid), `side-rail` (+ collapsible groups), `sidebar-panel` (the assistant,
  with consumer-named modes), `console` (the AI's narration surface), `tab-bar`/`topbar` — CSS-only
  patterns that re-skin by token and carry view-transition names so the chrome persists across
  navigations.
- **The ⌘K palette + demo-box.** A command palette island (`scripts/cmdk.js`, fed by `/search.json`)
  and a reusable scripted-demo island (`scripts/demo-box.js`) for live, declarative walkthroughs.
- **The manifest — a drift-proof machine map.** A per-screen, machine-readable projection of what's
  addressable (`targets`) and invokable (`actions`) *right now*, **harvested** from components (never
  hand-typed) so it can't drift from the UI. This is how an AI "sees" a page. (`ai/manifest.ts`,
  `AI-INTERFACE.md` §4.)
- **Auditable by design.** Every interaction — human or AI — is one `source`-tagged `Intent` through
  one server-side door, so a complete human+AI **interaction log** is a server-side drop-in. GRAIN
  provides the chokepoint + provenance; **the consuming app owns the log sink** (see PROJECT-PLAN
  §10). Not built inside GRAIN by design — it's an affordance, not a feature GRAIN ships.
- **The design system works with no AI.** The `b-*` atoms + the grade mechanism are usable in any
  BATCH app with the `ai/` layer dropped entirely (grade also encodes draft/saved, focus/editing).
- **Re-skin by token override.** Change the whole look by overriding token slots (README §4), never
  by editing components.
- **Machine-readable by construction (SEO/AEO).** Semantic HTML + a self-describing surface tree —
  *AI-operable ≈ AI-answerable*.
- **Built on the modern web platform — native, not framework JS.** The platform got good enough:
  GRAIN leans on *shipped browser primitives* instead of reimplementing them in JavaScript. Page
  transitions are the native cross-document **View Transitions API** (`@view-transition { navigation:
  auto }` — one CSS declaration, no router); modals are **`<dialog>`** (⌘K, the interrupt confirm —
  free focus-trap, `::backdrop`, top-layer); disclosures are **`<details>`**; forms use **native
  constraint validation** (no JS validators); tabs/nav are **plain `<a>` + CSS**; and the styling
  leans on **`:has()`**, **`:focus-within`**, **`color-mix()`**, **`@starting-style`**, `text-wrap:
  balance/pretty`, and CSS `scroll-behavior` — all native. **The standing rule:** when a UI need has
  a platform primitive (**Popover API**, **anchor positioning**, **container queries**,
  scroll-driven animations), reach for it before writing JS. This is what makes "near-zero framework
  JS" (`bun run audit`) *real* rather than aspirational — the only client JS that remains is the
  load-bearing `/intent` dispatcher, not UI chrome. (ARCHITECTURE §11.3 + §0; CONVENTIONS §1.)

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

One consequence worth stating: GRAIN doesn't only render server-side. The client-door mode runs
the interaction layer **in the browser**, and the static export ships GRAIN pages as plain files —
in both, server-side memoization never reaches the user, so **client-side caching is a GRAIN
concern, not an afterthought**: cacheable module graph + style bundles (HTTP semantics, immutable
once exported), a per-screen manifest snapshot invalidated by applied ops rather than refetched,
and view preferences in `localStorage` (theme.js already does this). The plan is ROADMAP Track
B.6e; the header mechanism lives in the substrate, the manifest policy here.

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
   └─ GRAIN   — the AI-operable design system + its DEFAULT theme, "Sourdough"
        │        (tokens, Redaction fonts, base/skin, grade mechanism, the AI layer)
        └─ BATCH — no-build hypermedia substrate (ARCHITECTURE.md)
```

*Design system vs. theme:* GRAIN ships the **Sourdough** look as its **default
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
