# MILL — plan

> Status: **pieces 1–4 built (core 2026-07-03; live route + portfolio wiring 2026-07-04); piece
> 4b (AI-facing outputs) is next.** MILL — **"Markdown In, Living Layouts"** — is the platform's
> **content rendering engine**: feed it Markdown + images and it renders pages out of components.
> It is its **own top-level project** (a sibling of `batch/`, `grain/`, `project/`, `tjakoen.github.io/`)
> and is designed as a **reusable, open-source** tool. The **portfolio** is its first consumer
> (`/notes`, `/grain/docs`, `/batch/docs` render live through MILL). This file is the **canonical
> MILL plan**; `tjakoen.github.io/PLAN.md` holds the *consumer* view and points here. The cross-layer
> sequencing (MILL is Track C) lives in [ROADMAP.md](https://github.com/tjakoen/bread/blob/main/ROADMAP.md).

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
- **mermaid → SVG figures.** A fenced mermaid block renders to inline SVG server-side, with its
  colors written as GRAIN token references so one cached diagram re-colors across both theme axes
  without being rendered again. The heavy renderer sits behind a port and is dynamically imported,
  so MILL stays dependency-free for anyone who wants no diagrams. *(built — see the diagrams
  section below, including why it shipped with no visible effect on the portfolio.)*

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
- ✅ **mermaid→SVG** (2026-08-16) — built behind the `DiagramRenderer` port, with `mermaid` and
  `playwright` as root devDependencies rather than package dependencies. A consumer that wants
  diagrams installs both and builds the renderer; everyone else is unaffected.

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
     [`SPLIT-PLAN.md`](https://github.com/tjakoen/bread/blob/main/docs/history/SPLIT-PLAN.md) § "Layer docs travel inside the package".
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
- Pieces 1–4 are built and live; the mermaid→SVG converter landed 2026-08-16; piece 4b
  (AI-facing outputs) remains. See memory: `portfolio-cms-separate-project`.

---

# Diagrams: mermaid to SVG, styled with theme tokens

> Status: **built in MILL (2026-08-16), and made publishable (2026-08-19, 0.4.0).** The
> renderer, the pre-pass, the disk cache and the route wiring are done and tested. A rendered
> diagram now carries the accessible name FIGURES requires, read from the fence; see
> *The accessible name* below, which is the one part of this that changes what an author types.
> What is deliberately NOT done: the portfolio wiring, the warm tool, the committed cache
> directory, and the migration of the hand-authored figures. Read the section on why before
> picking any of those up.

## What changed about the reason for building this

The original plan (folded in from the portfolio's `MERMAID.md`, 2026-07-06) opened on a
concrete complaint: roughly 22 mermaid diagrams across 9 files were showing raw source on the
live site, and FIGURES.md called the converter MILL's critical path.

**That is no longer true, and the record should say so.** By the time this was built, every
mermaid fence in served content had been hand-converted to inline SVG. A sweep of the
portfolio's served collections (`content/notes`, `content/events`, and the six `docs/<layer>`
folders) found zero mermaid fences. The only survivor in the whole repo is
`docs/AUDIT-AI-LOOP-2026-08-13.md`, which sits at the docs root outside every collection and
is therefore never rendered.

So this capability shipped with **no visible effect on the portfolio**, and that was understood
before it was written rather than discovered afterwards. The justification it was built on
instead: a documentation engine that generates diagrams from an extracted dependency graph
cannot hand-author them, so the fence has to render. Anyone reviewing this later should judge
it against that reason, not against a site that had already solved its own problem.

## Architecture

Parsing needed no change: fences already produce `{type:"code", lang:"mermaid", value}`.
MILL's block handlers are synchronous and mermaid is asynchronous, so an **async pre-pass**
resolves diagrams before the synchronous render, and a `code` block override injects them.

```
request → source.read(slug)
        → prepareDiagrams(raw, renderer)               // async: parse, find fences, await SVG
        → renderGrainDocument(raw, withDiagrams(...))  // sync: the code handler reads the map
        → chrome → compose → Response
```

The double parse (pre-pass plus render) is accepted: the parser is a tiny hand-rolled subset
and content files are small.

### Files

- **`diagrams/prepare.ts`** — zero dependencies. Owns the `DiagramRenderer` port
  (`(lang, source) => Promise<string | null>`, never throws), `prepareDiagrams` (find the
  fences, render each once, return a lookup) and `withDiagrams` (compose the `code` override).
- **`diagrams/cache.ts`** — zero dependencies. `cachedRenderer(dir, inner, versionTag)`: a
  disk cache meant to be committed, keyed by `sha1(lang \0 source \0 versionTag)`.
- **`diagrams/mermaid-playwright.ts`** — the only file that touches playwright or mermaid, and
  it imports both dynamically. Lazy singleton browser; a missing browser logs once and disables
  itself for the process.
- **`serve.ts`** — `MillServeDeps.diagrams`, shared across collections. Absent by default, so a
  consumer that wants no diagrams pays nothing.

### Decisions this piece resolved

- **The lookup key is qualified by language, not source alone.** The original sketch keyed the
  map on source text. Two blocks in different languages that happen to share text would then
  collide, and a `ts` block could render as a diagram. `diagramKey(lang, source)` costs nothing
  and removes the case.
- **`withDiagrams` composes over a consumer's own `code` override rather than replacing it.**
  A fence with no prepared SVG delegates to the consumer's handler if it has one, and to the
  exported `grainCodeBlock` otherwise. `grainCodeBlock` is exported from the GRAIN adapter for
  exactly this: re-implementing the fallback would be two escaping rules free to drift apart.
- **Failures are never cached.** A diagram that failed because a machine had no browser must
  not be poisoned for the machine that could have rendered it.
- **Theme styling is sentinel substitution.** Mermaid bakes literal colors into its output and
  offers no hook for emitting a CSS variable, so it is initialized with a palette of unique
  meaningless hex values that are replaced with `var(--color-…)` references afterwards. An
  inline SVG inherits custom properties from the document, so **one cached SVG re-colors across
  every scheme and flavor with no re-render.** That is what makes committing the cache sound.
- **`arrowheadColor` must be set explicitly, and this is the trap worth remembering.** Mermaid
  derives it by *inverting* the background. A near-black background sentinel therefore produced
  near-white arrowheads that no sentinel could match, and arrows disappeared on light paper.
  Any mermaid variable left unset is derived from another and lands outside the palette, so the
  rule is to set every variable that matters explicitly.
- **The leftover-color warning carries an ignore list.** Real mermaid output always contains a
  few literals that cannot be seen: a KaTeX fill only reachable by diagrams using math, a
  drop-shadow at six percent opacity, and rules for the `neo` look we never select. Warning on
  those would fire on every diagram and train the reader to ignore it, so they are listed as
  inert with the reason. The warning now fires only on a color the sentinel map has not learned.
- **Mermaid runs at `securityLevel: "strict"`.** The SVG is spliced into pages unescaped, which
  is what makes it a figure rather than a listing, so its own sanitizer stays on.
- **Mermaid's scoped `<style>` stays inside the generated SVG.** FIGURES.md forbids `<style>`
  in hand-authored SVG so it survives GitHub's sanitizer; MILL-generated SVG is injected into
  our own HTML and never sanitized. The two rules do not conflict.
- **GRAIN grew `figure[data-variant="diagram"]`** — fits the column, lets a wide flowchart
  scroll rather than shrink. Still no figcaption, though half the reason given here in August
  has since expired: a fence *does* now carry a label. The half that stands is the one that
  mattered, which is that the italic prose line under a figure is the visible caption
  convention on this site, and `label` is an accessible name rather than visible text. See
  *The accessible name* below for why the two are not the same thing.

### Verified

`bun run check` and `bun test` green across every package. Unit tests cover the pre-pass, the
override composition, the cache (hit, miss, key variance, uncached failure, unwritable
directory) and the sentinel substitution. Integration tests drive the route with a fake
renderer in three states: rendered, failed, and not wired. Two tests drive a real browser and
skip where playwright is absent, since a machine without one is a supported case that reads the
committed cache. Visual check: one diagram rendered once, then displayed under light Sourdough,
dark Sourdough and dark Baguette from the same bytes, with arrowheads legible in each.

## The accessible name (2026-08-19, 0.4.0)

The renderer shipped in August could not legally put a diagram on the published site, and the
reason had nothing to do with the picture. FIGURES is blunt about what a figure owes:
`role="img"` plus an `aria-label` that narrates the whole flow in words, node by node,
including the loop and the exit, because **the label is the accessible figure**. Mermaid emits
`role="graphics-document"` and an `aria-roledescription` of `"flowchart-v2"`, which names the
drawing's genre and says nothing about what the drawing says, and it emits no `aria-label` at
all. So every generated diagram would have been strictly less accessible, and less AI-legible,
than every hand-authored figure on the same site. FIGURES treats those two as one coin.

The owner's call on 2026-08-19 was that this is fixed here, upstream, and that FIGURES is not
amended to accommodate it.

### The mechanism

The label is authored in the fence's info string, next to the diagram it describes:

~~~
```mermaid label="BATCH serves the request, GRAIN dresses it, MILL renders the Markdown"
flowchart LR
...
```
~~~

This needed a parser change, and it uncovered a latent bug on the way in. `FENCE` was anchored
with `$` immediately after the language, so **any** tail made the line stop being a fence
entirely and the diagram body leaked out as prose. That was true for every language, not just
mermaid. The pattern now captures the tail as `MillNode.meta` (optional, so a plain fence
produces exactly the node it always did), and the language group is unchanged. Backticks and
tildes are excluded from both parts, which is CommonMark's own rule for an info string and is
what keeps `~~~word~~~` from reading as a fence.

### Decisions this piece resolved

- **The label is called `label`, not `caption`.** A caption is visible text; this is an
  accessible name, and nothing about it appears on the page. Naming it `caption` would have
  promised a `figcaption` that is deliberately not emitted. Because `caption` is the obvious
  thing to type anyway, an unknown fence key is reported by name in the warning rather than
  ignored, so the near miss is as loud as the omission.
- **The label stays OUT of the `DiagramRenderer` port**, which remains
  `(lang, source) => Promise<string | null>`. Three reasons, worst first. It is not an input to
  drawing: it describes the picture and does not change a pixel of it. Renderers are written by
  consumers, so putting it in the signature would break every existing one and then oblige each
  author to re-implement the same aria wrapping, which is the kind of duplicated rule that
  drifts apart; MILL owns the `<figure>` wrapper, so MILL owns the name. And the cache keys on
  what crosses the port, so a label in the signature would send an unchanged picture back
  through chromium every time someone fixed a typo.
- **`CACHE_VERSION` did NOT move, and that is a design property rather than an oversight.**
  The name is applied when the figure is wrapped, downstream of the cache, so the bytes on disk
  are the same bytes as before. A cached SVG cannot be stale against a label it never contained.
  Every committed entry stays valid, which is the whole point of committing them, and bumping
  would have re-rendered every diagram in the estate to produce byte-identical output. The
  wrapper reads the label from the node on every render, so editing the sentence takes effect
  immediately with no browser and no cache invalidation.
- **The lookup map still keys on `(lang, source)` and still holds the unlabelled SVG.** Two
  fences holding the same diagram therefore share one render while keeping their own separate
  sentences, which is the correct behaviour and came free.

### The unlabelled fence is refused, and why that over the alternatives

An unlabelled diagram is the exact defect this work exists to prevent, so it must not be the
easy default. It is **refused: it renders as an ordinary code block**, down the same path a
failed render already takes, plus a console warning that names the attribute to add and quotes
the diagram's first line so the author can find it. The pre-pass checks before it renders, so
an unnamed diagram never costs a browser launch either.

The two rejected options, and the reason each lost:

- **Render it anyway with a warning.** This is the silent default the work exists to remove. A
  warning scrolls past in a dev server, the page looks finished, and it ships. Rejected.
- **Throw, and fail the build.** MILL is a live server, not a batch compiler. An author halfway
  through writing a fence has to be able to load the page they are editing, and a 500 there is
  hostile. It would also break this subsystem's one standing promise, that a diagram which will
  not render must never take the page down with it. Rejected.

Refusing wins because the failure is **visible on the page itself**, not only in a log. Raw
mermaid source sitting where a picture should be is the pre-MILL symptom FIGURES complains
about, and nobody ships that by accident.

### The honest limit

MILL enforces that a label exists and is not blank. It cannot enforce that the label is any
good. A one-word label passes the check and fails the standard, and no lint can tell the
difference; that judgment stays with the reader, the same way `bun run lint:voice` deliberately
covers only the mechanical half of VOICE. The warning text at least states the bar (in words,
node by node, including any loop and any exit) so the author is aimed at the right shape.

### Verified

`bun run check` clean and `bun test` green at 135 passing, up from 107. New coverage: the info
string in the parser (including the leaked-body regression and the strikethrough case), the
label parser, the root-element rewrite (role replaced, `aria-roledescription` and
`aria-labelledby` dropped because either would out-rank or muddy the name, `aria-describedby`
kept because a description sits alongside a name, attribute escaping, first-`<svg>`-only,
non-SVG passthrough), and the refusal in four directions: not sent to the renderer, served as a
visible code block, warns naming the attribute, and never reaches a page even when the map
holds an SVG for it. Proved end to end against real mermaid in real chromium: the served root
element came back `role="img"` with the author's sentence, `graphics-document` and
`aria-roledescription` gone, `id`/`viewBox`/`class`/`style` untouched, and the name read back
out of the live DOM rather than out of the string that produced it. Rendered light and dark
from one cached SVG, so the sentinel substitution is undisturbed.

## Not built, and why

- **Portfolio wiring, the warm tool, the committed cache directory.** All three exist to serve
  diagrams that are in the content. There are none. Wiring `content.ts` now would add a
  renderer that never fires and a cache directory that stays empty. Do this when a served page
  gains a mermaid fence, or when a consumer that generates diagrams arrives.
- **The FIGURES.md scaffold rewrite and the hand-authored figure migration.** Still worth
  doing and unrelated to this: 7 SVG roots across 3 notes (`ten-times-zero.md` four times,
  `the-browser-grew-up.md` twice, `feels-like-an-app.md` once) still declare the fixed e-ink
  palette, so they ignore dark mode and every flavor. That is a portfolio content task with no
  MILL code in it, tracked separately.
- **A consumer needs its own dependencies.** `@tjakoen/mill` stays dependency-free; `mermaid`
  and `playwright` are root devDependencies here, for tests. A consumer building the renderer
  installs both itself.
- **The visible caption is still prose, not a `figcaption`.** `label` is the accessible name
  and renders nowhere. The italic line under a figure stays the way a reader is told what they
  are looking at. Emitting both from one field would make the same sentence do two jobs badly.
