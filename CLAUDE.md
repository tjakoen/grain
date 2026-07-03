# CLAUDE.md — mill

Onboarding for anyone (AI or human) working in `mill/`: MILL ("Markdown In, Living Layouts"), a
planned standalone CMS. Nothing is built yet; only the plan exists. Read the plan first, it is the
source of truth.

> This file follows `../portfolio/standards/CLAUDE.starter.md`. Personal standards live in
> `../portfolio/standards/`.

## What this is

MILL is a reusable, open-source Markdown-to-pages CMS: feed it Markdown + images and it renders GRAIN
pages. It is a layer ABOVE both batch and grain (`batch → grain → MILL`), an extension of neither.
Its core is framework-agnostic (a Markdown-to-components engine driven by a render adapter); the
batch + grain adapter is the default. It *enhances* the portfolio (manages its content) but does not
build it.

## Start here (reading order)

1. [`PLAN.md`](PLAN.md): the canonical MILL plan (design, seams, mapping model, build pieces). This
   is the source of truth; read it first.
2. [`../portfolio/PHILOSOPHY.md`](../portfolio/PHILOSOPHY.md): the *why* beneath the whole stack.
3. Whole-repo doc map: [`../DOCS.md`](../DOCS.md).

## Non-negotiables

- **A layer above, not inside.** MILL depends on grain (components) + batch (substrate), never the
  reverse.
- **Framework-agnostic core.** The engine talks to a render-adapter port; the batch + grain adapter
  is one implementation, not baked in.
- **Nothing built yet.** Only `PLAN.md` exists. Build against the plan and keep it canonical.
