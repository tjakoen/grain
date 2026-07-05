# MILL — plan

> Status: **pieces 1–4 built (core 2026-07-03; live route + portfolio wiring 2026-07-04); piece
> 4b (AI-facing outputs) is next.** MILL — **"Markdown In, Living Layouts"** — is the platform's
> **content rendering engine**: feed it Markdown + images and it renders pages out of components.
> It is its **own top-level project** (a sibling of `batch/`, `grain/`, `project/`, `tjakoen.github.io/`)
> and is designed as a **reusable, open-source** tool. The **portfolio** is its first consumer
> (`/notes`, `/grain/docs`, `/batch/docs` render live through MILL). This file is the **canonical
> MILL plan**; `tjakoen.github.io/PLAN.md` holds the *consumer* view and points here. The cross-layer
> sequencing (MILL is Track C) lives in [`../ROADMAP.md`](../ROADMAP.md).

## Positioning (decision, 2026-07-03)

MILL is **a content plugin for GRAIN** — the stack's content layer, published — **not a
standalone CMS play.** Competing with Eleventy/Astro/Hugo on their turf (taxonomies, image
pipelines, ecosystems) is a **non-goal**; "CMS" overpromises and is retired from the pitch in
favor of "content rendering engine." What MILL is *for*, in order: (1) prove the layers compose
(`batch → grain → MILL`, ports at every seam); (2) let the portfolio be maintained by editing
Markdown; (3) the one lane no incumbent occupies — **content that is AI-answerable and
AI-operable by construction** (see "AI-facing outputs" below). It stays small on purpose; the
"framework-agnostic core" is an architecture discipline (the adapter port), not a marketing
claim — we don't lead with agnosticism that only one adapter ever tests.

## What MILL is

A rendering engine that turns a folder of `.md` files (+ frontmatter + images) into rendered pages by
**mapping Markdown to components**. It does **not** invent its own renderer — it **emits component
tags** and lets the host framework compose them. In its default binding it emits **GRAIN** tags and
runs on the **BATCH** substrate (live render at request time; the static export just freezes the
output), so a site is *maintained by editing content, not HTML*.

MILL **enhances** a site's content; it does **not** build the site. A consumer's bespoke surfaces
stay its own work — the portfolio's hero AI, calendar, etc. are custom BATCH + GRAIN, not MILL.

## What MILL gives you (capabilities)

The capabilities, **tiered** — headliners first, then the useful-but-quieter ones. Pieces 1–4 (the
framework-agnostic core, the reference adapter, the live content route, the portfolio wiring) are
built; piece 4b (the AI-facing outputs) is not yet. Nothing here is buried. **This list is the single source**
(any README/landing teaser projects from it); add or drop a capability → update this list (the
`../CLAUDE.md` alignment table Track C row → `AUDIT.md` check 11).

**Hero — the reasons MILL exists:**

- **Markdown in → GRAIN pages out.** Feed it a folder of `.md` + images and it renders pages by
  **mapping Markdown to components** (not inventing a renderer) — a site is *maintained by editing
  content, not HTML*. (§"The mapping model".) *(built — live at `/notes` + the layer docs.)*
- **AI-answerable by construction.** The same source that renders a human page also emits semantic
  HTML + per-page meta, schema.org JSON-LD, `llms.txt`, `knowledge.json` (RAG chunks), and
  `data-surface` addresses on content — so *AI-operable ≈ AI-answerable* falls out of authoring, not
  a separate pipeline. (§"AI-facing outputs".) *(piece 4b.)*

**Also — useful features, deliberately listed:**

- **The escape hatch (no MDX build).** Raw `<b-…>` component tags written inside a `.md` pass through
  untouched for BATCH to compose — Markdown for prose, components for power, no build step.
- **Grade guardrail.** MILL output is human-authored → **clean ink** (`data-grade="smooth"`, never
  grain), machine-enforced (`core/grade.ts`). Only the AI grains — preserves the honest signal. *(built.)*
- **Framework-agnostic core.** The engine talks to a render-adapter port (a total node→handler map);
  it imports nothing from GRAIN/BATCH. The BATCH+GRAIN adapter is the default, proven swappable by a
  fake-adapter test. *(built.)*
- **The ContentSource port — content from anywhere, docs from packages.** Collections read through a
  small `list()/read()` port: `dirSource` (a folder of `.md`) covers a consumer's own content, and
  `packageDocsSource` resolves a docs folder **out of an installed package** (`import.meta.resolve`)
  so layer docs are rendered from the dependency itself — never copied, never a `../sibling` path,
  same code before and after the repo split. Slugs are traversal-safe by construction. *(built —
  `serve.ts`; plus `listMillRoutes`, the enumerated route list a consumer feeds to its sitemap /
  static-export allowlist so content pages are always discoverable.)*
- **mermaid → SVG figures** — server-side diagram conversion (FIGURES.md). **Deferred** (heavy dep);
  until then figures ship as pre-rendered SVG.

## Where MILL sits (layering)

- **A new layer above GRAIN:** `batch → grain → MILL`. MILL **depends on GRAIN (components) and BATCH
  (substrate), never the reverse** — so it is an **extension of neither**, a layer above both. (It
  can't live inside `batch`, which must not import `grain`; it isn't part of `grain`, being a level
  up from design-system primitives.) See the layering diagram in `CLAUDE.md`.
- **Consumed, not depended-on-inward:** `project/` and `tjakoen.github.io/` are independent consumers of the
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

## AI-facing outputs (first-class; added 2026-07-03)

The piece that makes MILL serve the stack's thesis rather than sit beside it: **"AI-operable ≈
AI-answerable."** The same source that renders a human page also emits, by construction:

- **Semantic HTML + per-page meta** — frontmatter → `<title>`/description/OG tags; headings and
  landmarks stay real HTML (SEO/AEO floor, and what GUI agents and answer engines actually parse).
- **schema.org JSON-LD** — frontmatter `type` → Article/TechArticle etc.; emitted with the page.
- **`llms.txt`** — generated from the content tree, alongside `sitemap.xml` (same page list).
- **`knowledge.json`** — the RAG corpus chunks (feeds the assistant's retrieval port — memory:
  `ai-content-retrieval-layer`).
- **`data-surface` addresses on rendered content** — rendered notes/regions get stable surface
  addresses so the assistant can *operate* them (spotlight, navigate, summarize-this) through the
  one vocabulary, even though the content itself stays clean-grade (human-authored) and outside
  the write path.

These are adapter outputs, not core concerns: the core maps nodes; the BATCH+GRAIN adapter emits
the AI-facing artifacts. Scope guard: emit + wire, no ranking/embedding logic in MILL itself (the
retrieval port and models live with the consumer).

## Prerequisites and deferred dependencies (honest list, 2026-07-03)

- **`batch/export` now exists** (ROADMAP Track B.1, Tier 1 shipped 2026-07-04) — the hosting
  adapter's freeze path can build on it (`bun run export` → `dist/`). Live render works without it too.
- ✅ **GRAIN content components** a markdown renderer needs out of the box are built: **code block
  (mono), figure/clipped-photo, callout/blockquote** (with piece 2), and **table, note (the default
  article layout), content-index (the collection listing)** (with piece 3).
- **mermaid→SVG** (FIGURES.md requires server-side conversion; the converter is a heavy
  dependency) — explicitly **deferred**, not implied. Until then, figures ship as pre-rendered
  SVG per the FIGURES.md scaffold.

## Pieces to build

1. ✅ **Scaffold `mill/`** (done 2026-07-03) — module layout: `core/` (the framework-agnostic
   engine) + `adapters/grain/` (the reference adapter) + `index.ts`. Imports kept clean — the
   engine imports **nothing** from GRAIN or BATCH; the coupling is a name/CSS-class contract
   (strings), the cleanest seam. (Runtime coupling — `createRenderer` to compose escape-hatch
   `<b-…>` tags, and serving — arrives with piece 3.)
2. ✅ **Core engine** (framework-agnostic, done 2026-07-03) — `frontmatter.ts` → `markdown.ts`
   (blocks + inline AST) → the render-adapter port (`types.ts`) → layout wrap (`engine.ts`),
   with the grade guardrail (`grade.ts`) machine-checked. Ships the **BATCH+GRAIN adapter** as a
   plain module (no route). Colocated tests, tsc + bun test green. Decisions this piece resolved:
   - **Markdown parser → tiny hand-rolled subset, zero runtime deps** (respects batch's
     "zero third-party runtime deps" bar; `catalog.ts` already hand-rolls a line parser). It is a
     documented SUBSET, not CommonMark: headings, paragraphs, ordered/unordered lists, fenced code,
     blockquotes, standalone images, thematic breaks, and a raw-HTML/component **passthrough** (the
     escape hatch). Inline: `**strong**`, `*em*`, `` `code` ``, `[link]`, `![img]` — **emphasis is
     asterisk-only** (underscore dropped so `snake_case` in technical prose never becomes `<em>`).
   - **Render-adapter port shape → a total node→handler map + layout lookup.** Every AST node type
     has a handler (a missing type is a compile error in *every* adapter — drift protection);
     handlers get a `RenderContext` to recurse (`renderInline`/`renderBlocks`) — the mdast→hast
     pattern. Proven non-GRAIN-agnostic by an engine test driving a bracket-notation fake adapter.
   - **GRAIN adapter emits FINAL semantic HTML with grain CSS classes, NOT data-bound component
     tags.** Reason: BATCH's `createRenderer` *replaces* a registered component tag's children with
     its own template, so `<b-text>literal prose</b-text>` would discard the prose. Bare
     `<p>/<h*>/<a>/<li>` are already styled by grain's `global.css`+`grain.css`; the three content
     components ship their own CSS. Authors keep the escape hatch: raw `<b-…>` in the `.md` passes
     through untouched and BATCH composes *those* (they are genuinely data-bound).
   - **Grade guardrail enforced:** output is clean/human (`data-grade="smooth"` asserted on the
     article root; never grain, never `data-commit`). `renderGrainDocument` runs `assertHumanGrade`.
   - **GRAIN content-component prereqs built** in `grain/components/**`: `atoms/code-block` (+ inline
     code; added the `--font-mono` token), `molecules/figure` (+ `clipped` variant),
     `molecules/callout`. CSS-only (composed by MILL, no data-binding), auto-appear in `/catalog`.
3. ✅ **Live content route** (done 2026-07-04) — `mill/serve.ts`: `createMillRoutes(deps)` returns a
   transport-generic pathname handler (`(pathname) → Response | null`), mounted in a few delimited
   lines at the composition root. Per request: read `.md` → `renderGrainDocument` (grade-guarded) →
   consumer chrome (full page) → injected `compose` (BATCH's `renderPage`) so chrome component tags
   AND escape-hatch `<b-…>` tags compose at request time — live render; `bun run export` freezes this
   output as-is (projection, not re-render — memory: static-export-decision). Content sources are a
   port (`ContentSource`): `dirSource` (a folder) + `packageDocsSource` (a docs folder inside an
   installed package, via `import.meta.resolve`). Decisions this piece resolved:
   - **Core subset extended for real content:** GitHub-style pipe **tables** (new `table` node —
     total-map drift protection made every adapter update a compile error, as designed) and
     frontmatter **folded/literal block scalars** (`key: >` / `key: |` — the shape every real note's
     `summary:` uses). GRAIN grew the matching CSS-only content components: `molecules/table`
     (+ `.table-scroll`), `organisms/note` (the default layout's `.note/.note__head/.note__lede/
     .note__tags` — reusable, so it lives in GRAIN, not the portfolio), `molecules/content-index`
     (the index listing).
   - **Monorepo workspaces wired** (root `package.json` `workspaces`) so `@tjakoen/grain` /
     `@tjakoen/batch` resolve from `node_modules` in the monorepo era too — the package-resolution
     decision below runs the SAME code both eras.
4. ✅ **Consumer wiring (in `tjakoen.github.io/`)** (done 2026-07-04) — `tjakoen.github.io/content.ts`: three
   collections (`/notes` from `tjakoen.github.io/notes/*.md`; `/grain/docs` + `/batch/docs` from the
   installed layer packages), the BREAD-shell chrome (`<portfolio-frame />`, composed at request
   time), and per-collection `resolveLink` overrides (sibling `x.md` → `/notes/x`; docs cross-links
   `../../grain/docs/X.md` → `/grain/docs/x`). Integration-tested against the REAL content (every
   note + both docs collections render clean-grade). The `type → layout` registry stays empty for
   now — the default editorial-note layout fits all current content; RAG-corpus prep = piece 4b.
   - **Layer-docs source = package-resolved, never a hardcoded sibling path or a copy.** The
     `/grain/docs` + `/batch/docs` collections read their `.md` from the *installed layer package*
     via `import.meta.resolve('@tjakoen/grain/docs')` / `@tjakoen/batch/docs` (both layers now ship a
     `./docs/*` `exports` entry). In the monorepo this resolves to the sibling `grain/docs/` /
     `batch/docs/` folder; post-split it resolves into the git-dep — **same code, both eras, always
     synced to `#main` via `bun update`, zero copied files.** Do **not** wire these against a literal
     `../grain/docs` relative path — that would break on the split and reintroduce the copy problem.
     Portfolio-owned content (`/notes`) still reads from the portfolio repo's own content dir. See
     [`../SPLIT-PLAN.md`](../SPLIT-PLAN.md) § "Layer docs travel inside the package".
4b. **AI-facing outputs** (see section above) — meta/OG + JSON-LD emission, `llms.txt`,
   `knowledge.json`, `data-surface` addresses on rendered content. Ships with the adapter, after
   the minimal proof-of-value (pieces 1–4) renders `/notes` live.
5. **Platform docs** — layer-count update in `CLAUDE.md` + `docs/ARCHITECTURE.md` (done 2026-07-02); this
   file stays the canonical MILL plan.

## Open questions

- ✅ **Markdown parser** (resolved 2026-07-03) — tiny hand-rolled subset, zero runtime deps
  (`mill/core/markdown.ts`). See piece 2 for the supported subset + the asterisk-only-emphasis call.
- ✅ **Render-adapter interface shape** (resolved 2026-07-03) — total node→handler map + layout
  lookup, handlers recurse via a `RenderContext` (`mill/core/types.ts`). See piece 2.
- ✅ **Where layouts live** (resolved 2026-07-03) — MILL ships a **default** layout (editorial
  note masthead); the consumer supplies its `type → layout` registry via `GrainAdapterOptions`
  (the "engine implemented by the consumer" model). MILL stays framework-generic.
- ✅ **Slug / link resolution** (resolved 2026-07-04) — default stays `note:slug` → `/notes/slug`;
  the consumer overrides per collection via `GrainAdapterOptions.resolveLink`
  (`tjakoen.github.io/content.ts`: sibling-`.md` and cross-layer docs rewrites). Slug = filename minus
  `.md`, lowercased (`GRAIN.md` → `grain`); a case-colliding pair is last-one-wins (documented in
  `dirSource`). Links to `.md` files with no rendered page pass through untouched — the export's
  dead-link warning keeps those honest.

## Relationship to the platform

- **`tjakoen.github.io/PLAN.md`** is the *consumer* plan — it uses MILL for content and references this doc.
- **`static-export-decision`** holds: MILL renders live, export freezes — not a build-time re-render.
- Pieces 1–4 are built and live; piece 4b (AI-facing outputs) and the mermaid→SVG converter remain.
  See memory: `portfolio-cms-separate-project`.
