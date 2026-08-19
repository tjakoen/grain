# CLAUDE.md — mill

Onboarding for anyone (AI or human) working in `mill/`: MILL ("Markdown In, Living Layouts"), the
stack's content rendering engine (a content plugin for GRAIN). Read the plan first, it is the
source of truth. **Built so far (pieces 1–4, 2026-07-03/04):** the framework-agnostic core engine
(`core/`), the reference BATCH+GRAIN adapter (`adapters/grain/`), the live content route
(`serve.ts` — `createMillRoutes(deps)`, a transport-generic pathname handler), and the portfolio
wiring (`../tjakoen.github.io/content.ts`: `/notes`, `/grain/docs`, `/batch/docs`) — all tested.
**Also built (2026-08-16):** `diagrams/` — mermaid fences render to theme-tokened inline SVG behind
the `DiagramRenderer` port, with a committable disk cache. **Extended 2026-08-19 (0.4.0):** a fence
carries `label="…"`, which becomes `role="img"` plus that sentence as the `aria-label`, and an
unlabelled fence is refused down to a code block. Next:
piece 4b (AI-facing outputs: meta/JSON-LD, `llms.txt`, `knowledge.json`, `data-surface`).

> This file follows the `CLAUDE.starter.md` template from the published standards index
> <https://tjakoen.github.io/standards> (homed in the portfolio at `tjakoen.github.io/standards/`) — referenced, never forked.

## What this is

MILL is a reusable, open-source Markdown-to-pages CMS: feed it Markdown + images and it renders GRAIN
pages. It is a layer ABOVE both batch and grain (`batch → grain → MILL`), an extension of neither.
Its core is framework-agnostic (a Markdown-to-components engine driven by a render adapter); the
batch + grain adapter is the default. It *enhances* the portfolio (manages its content) but does not
build it.

## Start here (reading order)

1. [`PLAN.md`](PLAN.md): the canonical MILL plan (design, seams, mapping model, build pieces). This
   is the source of truth; read it first.
2. [`PHILOSOPHY.md`](https://github.com/tjakoen/tjakoen.github.io/blob/main/docs/PHILOSOPHY.md): the *why* beneath the whole stack.
3. Whole-repo doc map: [`DOCS.md`](https://github.com/tjakoen/bread/blob/main/DOCS.md).

## Non-negotiables

- **A layer above, not inside.** MILL depends on grain (components) + batch (substrate), never the
  reverse.
- **Framework-agnostic core.** The engine (`core/`) talks to a render-adapter port (a total
  node→handler map + layout lookup); it imports **nothing** from grain/batch. The BATCH+GRAIN
  adapter (`adapters/grain/`) is one implementation, not baked in — proven by a fake-adapter test.
- **Emit final HTML with grain CSS classes, not data-bound `<b-…>` tags.** BATCH's `createRenderer`
  replaces a registered component tag's children with its own template, so a `<b-text>prose</b-text>`
  would lose the prose. Bare `<p>/<h*>/<li>` are already grain-styled; the escape hatch (raw `<b-…>`
  in the `.md`) still passes through for BATCH to compose.
- **Grade guardrail.** MILL output is human-authored → clean ink (`data-grade="smooth"`, never grain,
  never `data-commit`). `renderGrainDocument` enforces it (`core/grade.ts`). Only the AI grains.
- **Content sources are package-resolved, never path-reached.** MILL reads a collection's `.md`
  through `dirSource`/`packageDocsSource` (`import.meta.resolve('@pkg/…')`) — never a `../sibling`
  relative path. Same code whether mill resolves as a `workspace:*` package inside the grain
  monorepo or as the published `@tjakoen/mill` in a consumer. Note: the
  layer docs behind `/grain/docs` + `/batch/docs` were folded into the portfolio in the 2026-07-09
  option-b docs home, so the portfolio's `content.ts` now points those two collections at its own
  `docs/<layer>/` via `dirSource` — MILL's resolution mechanism is unchanged, only the source dir.
- **Heavy dependencies stay behind a port and a dynamic import.** `@tjakoen/mill` has no runtime
  dependency beyond grain. The mermaid renderer needs `playwright` and `mermaid`, so it lives alone
  in `diagrams/mermaid-playwright.ts`, imports both dynamically, and is never re-exported from
  `index.ts`. A consumer that wants diagrams installs them and builds the renderer itself; a
  consumer that does not pays nothing and never launches a browser.
- **A diagram that will not render is never an error.** Every path — no browser, invalid source,
  unwritable cache, no label — degrades to the ordinary code block. A renderer must not throw.
- **A generated figure carries an accessible name or it does not render.** FIGURES requires
  `role="img"` plus an `aria-label` narrating the flow, so the fence supplies one via `label="…"`.
  The name is applied when the figure is wrapped, downstream of both the port and the cache: it is
  not a renderer argument and not part of `CACHE_VERSION`. See `diagrams/label.ts`.
- **Build against the plan and keep it canonical.** `PLAN.md` tracks what's built vs. deferred.
