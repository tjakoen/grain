# 🌾 GRAIN: the design-system family

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-000?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![No build step](https://img.shields.io/badge/build_step-none-2ea44f)](#)
[![Bun workspace](https://img.shields.io/badge/monorepo-bun_workspace-2ea44f)](#)

This is the monorepo for the GRAIN family: one Bun workspace holding five packages. Four of them are
published layers that build on each other, from the design system up to the tools built on it. The
fifth is a workspace-only MCP server that reads what those layers export. Each layer is its own
package, so an app can adopt just the design system or the whole stack. Nothing here has a build
step, everything runs on Bun straight from TypeScript.

## The packages

| Package | What it is | Docs |
|---|---|---|
| [`@tjakoen/grain`](packages/grain) | The AI-interaction design system and its default theme. Every surface is operable by a human or an AI through one shared vocabulary, with the AI's presence shown as a visible signal (grain = AI). | [grain/docs](https://tjakoen.github.io/grain/docs) |
| [`@tjakoen/mill`](packages/mill) | Markdown In, Living Layouts. A Markdown to GRAIN-pages CMS: feed it markdown and images, it renders GRAIN pages. | [mill/docs](https://tjakoen.github.io/mill/docs) |
| [`@tjakoen/proof`](packages/proof) | The AI plan board. Plans are markdown files and the board is a live projection of them. The files are the source of truth, the board never writes back. | [proof/docs](https://tjakoen.github.io/proof/docs) |
| [`@tjakoen/crumb`](packages/crumb) | The guided-tour, demo-mode, and AI-review layer. Tours are markdown, rendered as a guided projection. Published and live: it's the guided-tour frame running on tjakoen.github.io, see its [PLAN](packages/crumb/PLAN.md). | [crumb/docs](https://tjakoen.github.io/crumb/docs) · [live](https://tjakoen.github.io/crumb/) |
| [`@tjakoen/grain-mcp`](packages/grain-mcp) | A hand-rolled MCP stdio server over a grain app's static export. It reads the built HTML and answers what is on a page and whether a move would be legal, without a browser. **Workspace-only, not published**: run it from a checkout. | [README](packages/grain-mcp/README.md) |

The dependency direction runs one way. A substrate (BATCH is the reference one) sits below grain,
mill builds on grain, proof builds on mill, and crumb builds on grain and mill. grain itself imports
nothing from the substrate except one port.

## Using a layer in your own app

Inside this repo the packages resolve as workspaces (`workspace:*`). A separate app installs the four
published layers from the public npm registry (grain-mcp is workspace-only and is not on npm):

```json
{
  "dependencies": {
    "@tjakoen/grain": "^0.1.23",
    "@tjakoen/mill": "^0.3.0",
    "@tjakoen/proof": "^0.1.4",
    "@tjakoen/crumb": "^0.1.10"
  }
}
```

Those are the versions npm serves today, 2026-08-19. Take them as a floor, not a snapshot to keep
copying: `bun update` moves them forward.

That is the whole setup. **No `.npmrc`, no token**: the `@tjakoen` scope resolves from npmjs by
default, so `bun install` works on a fresh machine with nothing configured. (These packages lived on
GitHub Packages until 2026-07-30, which required every consumer to mint a `read:packages` PAT before
installing anything; that is no longer the case. Never commit an `.npmrc` that maps the scope: a
mapping overrides the default and drags the token requirement back.)

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
  grain/      the AI-interaction design system + default theme
  mill/       the Markdown to GRAIN-pages CMS
  proof/      the AI plan board
  crumb/      the guided-tour / AI-review layer
  grain-mcp/  the MCP stdio server over a static export (workspace-only)
```

grain, mill and proof each carry their own `CLAUDE.md` and `PLAN.md` with that layer's rules and
design, and crumb carries a `PLAN.md`. Start there when you work in a layer. grain-mcp is small
enough that its README is the whole story.

---
🤖 **Built with Claude, on the same door you'd use.** I called the shots, Claude typed them, and the
AI never got a private channel to the DOM, it went through the same door as a human, every time. **I
don't prompt and pray, I prompt and prove.**
[How I actually work with AI, receipts and all →](https://tjakoen.github.io/notes/ten-times-zero)
