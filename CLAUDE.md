# CLAUDE.md — mill

Onboarding for anyone (AI or human) working in `mill/`: MILL ("Markdown In, Living Layouts"), the
stack's content rendering engine (a content plugin for GRAIN). Read the plan first, it is the
source of truth. **Built so far (pieces 1–4, 2026-07-03/04):** the framework-agnostic core engine
(`core/`), the reference BATCH+GRAIN adapter (`adapters/grain/`), the live content route
(`serve.ts` — `createMillRoutes(deps)`, a transport-generic pathname handler), and the portfolio
wiring (`../tjakoen.github.io/content.ts`: `/notes`, `/grain/docs`, `/batch/docs`) — all tested. Next:
piece 4b (AI-facing outputs: meta/JSON-LD, `llms.txt`, `knowledge.json`, `data-surface`).

> This file follows `../tjakoen.github.io/standards/CLAUDE.starter.md`. Personal standards live in
> `../tjakoen.github.io/standards/`.

## What this is

MILL is a reusable, open-source Markdown-to-pages CMS: feed it Markdown + images and it renders GRAIN
pages. It is a layer ABOVE both batch and grain (`batch → grain → MILL`), an extension of neither.
Its core is framework-agnostic (a Markdown-to-components engine driven by a render adapter); the
batch + grain adapter is the default. It *enhances* the portfolio (manages its content) but does not
build it.

## Start here (reading order)

1. [`PLAN.md`](PLAN.md): the canonical MILL plan (design, seams, mapping model, build pieces). This
   is the source of truth; read it first.
2. [`../tjakoen.github.io/PHILOSOPHY.md`](../tjakoen.github.io/PHILOSOPHY.md): the *why* beneath the whole stack.
3. Whole-repo doc map: [`../DOCS.md`](../DOCS.md).

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
- **Layer docs are package-resolved, never path-reached.** `/grain/docs` + `/batch/docs` read their
  `.md` through `packageDocsSource` (`import.meta.resolve('@tjakoen/grain/docs/…')`) — never a
  `../grain/docs` relative path. Same code in the monorepo (workspaces) and after the split (git dep).
- **Build against the plan and keep it canonical.** `PLAN.md` tracks what's built vs. deferred.
