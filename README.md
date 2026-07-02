# MILL

**Markdown In, Living Layouts** — a Markdown → GRAIN-pages CMS. Feed it a folder of `.md` +
frontmatter + images; it renders them as real GRAIN pages by mapping Markdown nodes to components.

> **Status: planned — design only.** This directory currently holds just the plan; nothing is built.

## Where it sits

The **fourth concern**, a layer *above* GRAIN:

```
batch → grain → MILL → (consumed by project, portfolio)
```

MILL depends on **GRAIN** (components) and **BATCH** (substrate), never the reverse — so it's an
extension of neither, a new layer over both. It's **reusable and open-source by design**: its core
is framework-agnostic (a Markdown→components engine driven by a render-adapter port), shipping a
first-class **BATCH+GRAIN adapter** as the default. That MILL exists at all is part of the pitch —
BATCH + GRAIN proving they compose into a real, reusable tool.

MILL **renders live** on the BATCH app at request time; `batch/export` then freezes the output —
never a build-time re-render (keeps [export-as-projection](../ARCHITECTURE.md) intact).

## Read next

- **[mill/PLAN.md](PLAN.md)** — the canonical plan (design, seams, mapping model, build pieces).
- **[../PHILOSOPHY.md](../PHILOSOPHY.md)** — why content is Markdown and pages are a projection of it.
- **[../CLAUDE.md](../CLAUDE.md)** — how MILL fits the four concerns.
