# ⚙️ MILL

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![npm](https://img.shields.io/npm/v/@tjakoen/mill?logo=npm&logoColor=white)](https://www.npmjs.com/package/@tjakoen/mill)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)
[![Status](https://img.shields.io/badge/status-live-brightgreen)](PLAN.md)

**Markdown In, Living Layouts**: a Markdown → GRAIN-pages CMS. Feed it a folder of `.md` +
frontmatter + images; it renders them as real GRAIN pages by mapping Markdown nodes to components.

> **Status: in progress, the core is live.** Pieces 1–4 are built and tested: the
> framework-agnostic core engine (`core/`), the BATCH+GRAIN adapter (`adapters/grain/`), the live
> content route (`serve.ts`), the portfolio wiring (`/notes`, `/grain/docs`, `/batch/docs`), and
> diagrams (`diagrams/`, mermaid to theme-tokened SVG).
> What remains (AI-facing outputs, RSS) is tracked in [PLAN.md](PLAN.md).

## Diagrams (optional)

A fenced mermaid block can render to inline SVG, with its colors written as GRAIN token references
so one diagram follows both theme axes without being rendered again. The renderer is optional and
sits behind a port, so MILL itself stays free of heavy dependencies: install them only if you want
diagrams.

**Every diagram needs a label, and this is enforced.** A picture with no accessible name is
decorative: a screen reader skips it, and so does anything else reading the page as text. So the
fence carries one, and it should narrate the flow in words rather than name it.

~~~
```mermaid label="BATCH serves the request, GRAIN dresses it, MILL renders the Markdown"
flowchart LR
  A[BATCH] --> B[GRAIN]
  B --> C[MILL]
```
~~~

That becomes `role="img"` with the sentence as the `aria-label` on the rendered SVG. A fence
without a label is **refused**: it renders as an ordinary code block, with a warning naming the
attribute to add. The raw source then sits visibly on the page, which is the point. An unnamed
figure that looks finished is the failure this prevents.

```bash
bun add -d playwright mermaid
```

```ts
import { createMillRoutes } from "@tjakoen/mill/serve.ts";
import { cachedRenderer } from "@tjakoen/mill/diagrams/cache.ts";
import { createMermaidRenderer, MERMAID_VERSION_TAG } from "@tjakoen/mill/diagrams/mermaid-playwright.ts";

const millRoutes = createMillRoutes({
  collections: [/* … */],
  diagrams: cachedRenderer("diagram-cache", createMermaidRenderer(), MERMAID_VERSION_TAG),
});
```

Commit the cache directory. A rendered diagram is keyed by its own source, so CI, the deploy and
the static export read the committed SVG and never need a browser; only a new diagram launches
one. The label is applied downstream of the cache and is not part of its key, so rewording one
takes effect at once without re-rendering anything. Nothing here can break a page: a missing
browser or an invalid diagram falls back to the ordinary code block.

## Quickstart

```bash
bun add @tjakoen/mill @tjakoen/grain
```

```ts
import { createMillRoutes } from "@tjakoen/mill/serve.ts";

const millRoutes = createMillRoutes({ /* content sources, render adapter */ });
// mount millRoutes(pathname) inside your own request handler; null = not mine, fall through
```

## Where it sits

The **fourth concern**, a layer *above* GRAIN:

```
batch → grain → MILL → (consumed by project, portfolio)
```

MILL depends on **GRAIN** (components) and **BATCH** (substrate), never the reverse, so it's an
extension of neither, a new layer over both. It's **reusable and open-source by design**: its core
is framework-agnostic (a Markdown→components engine driven by a render-adapter port), shipping a
first-class **BATCH+GRAIN adapter** as the default. That MILL exists at all is part of the pitch:
BATCH + GRAIN proving they compose into a real, reusable tool.

MILL **renders live** on the BATCH app at request time; `batch/export` then freezes the output:
never a build-time re-render (keeps [export-as-projection](https://tjakoen.github.io/batch/docs/architecture) intact).

## Read next

- **[Docs](https://tjakoen.github.io/mill/docs)**: the full write-up.
- **[mill/PLAN.md](PLAN.md)**: the canonical plan (design, seams, mapping model, build pieces).
- **[PHILOSOPHY.md](https://github.com/tjakoen/tjakoen.github.io/blob/main/docs/PHILOSOPHY.md)**: why content is Markdown and pages are a projection of it.
- **[../../CLAUDE.md](../../CLAUDE.md)**: how MILL fits the four concerns.

---

🤖 **Built with Claude, fed on markdown and nothing fancier.** I wrote the plan, Claude wrote the
parser, and the whole engine still runs with no build step. **I don't prompt and pray, I prompt
and prove.**
[How I actually work with AI, receipts and all →](https://tjakoen.github.io/notes/ten-times-zero)
