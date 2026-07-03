# MILL — plan

> Status: **planned, not built (decision + design only, 2026-07-02).** MILL — **"Markdown In, Living
> Layouts"** — is the platform's **content rendering engine**: feed it Markdown + images and it
> renders pages out of components. It is its **own top-level project** (a sibling of `batch/`,
> `grain/`, `project/`, `portfolio/`) and is designed as a **reusable, open-source** tool. The
> **portfolio** is its first consumer. This file is the **canonical MILL plan**; `portfolio/PLAN.md`
> holds the *consumer* view and points here.

## What MILL is

A rendering engine that turns a folder of `.md` files (+ frontmatter + images) into rendered pages by
**mapping Markdown to components**. It does **not** invent its own renderer — it **emits component
tags** and lets the host framework compose them. In its default binding it emits **GRAIN** tags and
runs on the **BATCH** substrate (live render at request time; the static export just freezes the
output), so a site is *maintained by editing content, not HTML*.

MILL **enhances** a site's content; it does **not** build the site. A consumer's bespoke surfaces
stay its own work — the portfolio's hero AI, calendar, etc. are custom BATCH + GRAIN, not MILL.

## Where MILL sits (layering)

- **A new layer above GRAIN:** `batch → grain → MILL`. MILL **depends on GRAIN (components) and BATCH
  (substrate), never the reverse** — so it is an **extension of neither**, a layer above both. (It
  can't live inside `batch`, which must not import `grain`; it isn't part of `grain`, being a level
  up from design-system primitives.) See the layering diagram in `CLAUDE.md`.
- **Consumed, not depended-on-inward:** `project/` and `portfolio/` are independent consumers of the
  stack; the portfolio additionally uses MILL for its content.
- **Purity / extraction:** like `batch/export`, MILL is built reusable-shaped and kept framework-clean
  so it can move to its own repo once proven. It imports only GRAIN + BATCH public seams; nothing
  consumer-specific leaks in.

## Reusability scope (decision, 2026-07-02)

**MILL's core is framework-agnostic; its default adapter is BATCH+GRAIN.** Two seams (the same
port/adapter discipline that lets `grain` depend only on BATCH's `OpChannel`):

- **Rendering target — *what to emit*.** The core walks the Markdown AST and calls a **render adapter**
  (a node→output map); it does not hardcode GRAIN. The **GRAIN adapter** (emit `b-*` / theme tags) is
  the reference implementation. Another project could supply a React / Vue / plain-HTML adapter.
- **Hosting — *how it's served*.** The **BATCH adapter** mounts a content route (live render) and
  plugs into `batch/export` (freeze). A non-BATCH host would supply its own.

**Result: usable in any web project via a custom adapter; batteries-included for BATCH+GRAIN.** We
build **only the BATCH+GRAIN adapter now** (YAGNI / extraction rule) and keep the adapter seam clean
so more can be added when a real second consumer proves the need.

## The mapping model (how Markdown → components)

Two mappings, one seam, one escape hatch:

1. **Document → layout (from frontmatter).** `type` selects a **layout** (a GRAIN organism in the
   default adapter); frontmatter fields become its props. Consumer-owned registry, e.g.:
   `note` · `talk` · `role` · `student-work` · doc.
2. **Block → component (a node→tag map).** Each Markdown construct maps to a component tag, with a
   token-styled element as fallback:
   - paragraphs / headings → `b-text` (variants) · lists → `b-list` · frontmatter tags → `b-badge` / `action-badge`
   - links → `<a>` (internal `note:slug` / relative → `/notes/:slug`)
   - images → a figure / clipped-photo component · blockquote → a callout / margin-note · fenced code
     → a code block (mono) — these last three are **consumer-supplied** components the adapter points at.
3. **The seam:** MILL emits **tags**, not final HTML; **BATCH's `createRenderer` composes them** at
   request time — the same path `.html` pages use. There is no second render engine.
4. **Escape hatch (no-build bonus):** raw component tags (`<b-…>`) written inside a `.md` pass through
   untouched (BATCH already renders tags found in HTML). Markdown for prose, components for power — no
   MDX build step.

**Ownership — the "engine implemented by the consumer" model:** MILL ships the **engine + sensible
defaults**; the **consumer supplies the target specifics** — its `type → layout` registry and any
block-map overrides. MILL stays framework-generic; the portfolio decides how *its* content looks.

**Grade guardrail:** MILL output is **human-authored content → no grain** (clean ink, no
`data-commit`). Only the AI grains. Preserves the honest-signal decision (grain = AI).

## One content source, many consumers

The same `.md` files (a) render the human pages, (b) are chunked into `knowledge.json` for the AI's
RAG, and (c) publish rendered docs. For the portfolio, both the **notes/blog** *and* the **BATCH/GRAIN
docs** (`docs/*.md` → `/grain/docs`, `/batch/docs`) flow through MILL. Authoring = commit: edit a
`.md` → the GitHub Action reboots the app, crawls, deploys.

## Pieces to build

1. **Scaffold `mill/`** — the project folder + this plan; imports kept clean (GRAIN + BATCH public
   seams only).
2. **Core engine** (framework-agnostic) — frontmatter parse → Markdown AST walk → node→tag map →
   layout wrap, driven by a **render-adapter port**. Ship with tests (CONVENTIONS §6).
3. **BATCH+GRAIN adapter** — emit GRAIN tags; mount a live content route; plug into `batch/export`
   (projection, not re-render — memory: static-export-decision).
4. **Consumer wiring (in `portfolio/`)** — the `type → layout` registry + block overrides; render
   `/notes` (+ `/notes/:slug`), `/grain/docs`, `/batch/docs`; feed the RAG-corpus prep.
5. **Platform docs** — layer-count update in `CLAUDE.md` + `docs/ARCHITECTURE.md` (done 2026-07-02); this
   file stays the canonical MILL plan.

## Open questions

- **Markdown parser** — which library (or a tiny hand-rolled subset) stays no-build-friendly on Bun.
- **Render-adapter interface shape** — the exact port (node→tag, layout lookup) so non-GRAIN adapters fit.
- **Where layouts live** — MILL ships layout *primitives* vs. all layouts consumer-supplied. Lean:
  MILL ships primitives, the consumer supplies its set.
- **Slug / link resolution** — the internal `note:slug` scheme + collision rules.

## Relationship to the platform

- **`portfolio/PLAN.md`** is the *consumer* plan — it uses MILL for content and references this doc.
- **`static-export-decision`** holds: MILL renders live, export freezes — not a build-time re-render.
- Nothing built yet; this is decision + design only. See memory: `portfolio-cms-separate-project`.
