# 🌾 GRAIN — the design-system family

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![No build step](https://img.shields.io/badge/build_step-none-2ea44f)](#)
[![Bun workspace](https://img.shields.io/badge/monorepo-bun_workspace-2ea44f)](#)

This is the monorepo for the GRAIN family: one Bun workspace holding four layers that build on each
other, from the design system up to the tools built on it. Each layer is its own package, so an app
can adopt just the design system or the whole stack. Nothing here has a build step, everything runs
on Bun straight from TypeScript.

## The packages

| Package | What it is | Docs |
|---|---|---|
| [`@tjakoen/grain`](packages/grain) | The AI-interaction design system and its default theme. Every surface is operable by a human or an AI through one shared vocabulary, with the AI's presence shown as a visible signal (grain = AI). | [grain/docs](https://tjakoen.github.io/grain/docs) |
| [`@tjakoen/mill`](packages/mill) | Markdown In, Living Layouts. A Markdown to GRAIN-pages CMS: feed it markdown and images, it renders GRAIN pages. | [mill/docs](https://tjakoen.github.io/mill/docs) |
| [`@tjakoen/proof`](packages/proof) | The AI plan board. Plans are markdown files and the board is a live projection of them. The files are the source of truth, the board never writes back. | [proof/docs](https://tjakoen.github.io/proof/docs) |
| [`@tjakoen/crumb`](packages/crumb) | The guided-tour, demo-mode, and AI-review layer. Tours are markdown, rendered as a guided projection. Published and live — it's the guided-tour frame running on tjakoen.github.io, see its [PLAN](packages/crumb/PLAN.md). | [crumb/docs](https://tjakoen.github.io/crumb/docs) · [live](https://tjakoen.github.io/crumb/) |

The dependency direction runs one way. A substrate (BATCH is the reference one) sits below grain,
mill builds on grain, proof builds on mill, and crumb builds on grain and mill. grain itself imports
nothing from the substrate except one port.

## Using a layer in your own app

Inside this repo the packages resolve as workspaces (`workspace:*`). A separate app installs the
published versions from GitHub Packages:

```json
{
  "dependencies": {
    "@tjakoen/grain": "^0.1.0",
    "@tjakoen/mill": "^0.1.0",
    "@tjakoen/proof": "^0.1.0"
  }
}
```

with an `.npmrc` that points the scope at GitHub Packages (the auth token lives in your environment,
never in the repo):

```
@tjakoen:registry=https://npm.pkg.github.com
```

The full write-up, including why a single monorepo git dependency cannot expose the sub-packages by
name, is in [how to consume a layer](https://github.com/tjakoen/tjakoen.github.io/blob/main/docs/batch/CONSUME-AS-GIT-DEPS.md).

## Develop

```bash
bun install     # one root install, one lockfile
bun run check   # tsc across every package
bun run test    # bun test across every package
```

Each package also carries its own `check` and `test` scripts.

## Layout

```
packages/
  grain/   the AI-interaction design system + default theme
  mill/    the Markdown to GRAIN-pages CMS
  proof/   the AI plan board
  crumb/   the guided-tour / AI-review layer
```

Each package has its own `CLAUDE.md` and `PLAN.md` with its rules and design. Start there when you
work in a layer.

---
🤖 **Built with Claude, on the same door you'd use.** I called the shots, Claude typed them, and the
AI never got a private channel to the DOM, it went through the same door as a human, every time. **I
don't prompt and pray, I prompt and prove.**
[How I actually work with AI, receipts and all →](https://tjakoen.github.io/notes/ten-times-zero)
