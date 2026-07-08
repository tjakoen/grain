# ⚙️ MILL

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)
[![Status](https://img.shields.io/badge/status-live-brightgreen)](PLAN.md)

**Markdown In, Living Layouts** — a Markdown → GRAIN-pages CMS. Feed it a folder of `.md` +
frontmatter + images; it renders them as real GRAIN pages by mapping Markdown nodes to components.

> **Status: in progress — the core is live.** Pieces 1–4 are built and tested: the
> framework-agnostic core engine (`core/`), the BATCH+GRAIN adapter (`adapters/grain/`), the live
> content route (`serve.ts`), and the portfolio wiring (`/notes`, `/grain/docs`, `/batch/docs`).
> What remains (AI-facing outputs, mermaid→SVG, RSS) is tracked in [PLAN.md](PLAN.md).

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
never a build-time re-render (keeps [export-as-projection](../batch/docs/ARCHITECTURE.md) intact).

## Read next

- **[mill/PLAN.md](PLAN.md)** — the canonical plan (design, seams, mapping model, build pieces).
- **[../tjakoen.github.io/PHILOSOPHY.md](../tjakoen.github.io/PHILOSOPHY.md)** — why content is Markdown and pages are a projection of it.
- **[../CLAUDE.md](../CLAUDE.md)** — how MILL fits the four concerns.

---

🤖 **Built with Claude, fed on markdown and nothing fancier.** I wrote the plan, Claude wrote the
parser, and the whole engine still runs with no build step. **I don't prompt and pray, I prompt
and prove.**
[How I actually work with AI, receipts and all →](https://tjakoen.github.io/notes/ten-times-zero)
