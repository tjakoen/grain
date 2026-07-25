# GRAIN-MCP — an MCP server over a grain app's static export

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](../../LICENSE)
[![Status](https://img.shields.io/badge/status-workspace--only-lightgrey)](#workspace-only)

A zero-dependency, hand-rolled [MCP](https://modelcontextprotocol.io) stdio server that exposes a
grain app's affordances to any MCP client — Claude Code, Claude Desktop, or anything else that speaks
MCP over stdio. It reads a grain app's **static export directory** (plain HTML on disk), harvests the
door manifest with grain's own pure `domManifest` (`@tjakoen/grain/ai/manifest-dom.ts`), and serves
four read-only inspection + validation tools. No browser, no live driving, no npm dependencies beyond
the `@tjakoen/grain` workspace package.

## Why static, not live

A grain page already exposes its own affordances to an in-browser AI (the manifest, the action
registry, move validation — see `@tjakoen/grain`'s AI-INTERFACE). This package answers the SAME
questions from OUTSIDE the browser, over an already-built export, for a coding agent that wants to
know "what's on this page" and "would this move be legal" without spinning up a browser or a live
server. It never drives anything — there's no live app behind a static export to drive.

## The four tools

| tool | input | what it answers |
| --- | --- | --- |
| `grain_pages` | *(none)* | every route in the export, with each page's `<title>` |
| `grain_manifest` | `{ route }` | the harvested manifest for one route — targets, verbs, `data-read` state |
| `grain_actions` | *(none)* | the whole verb vocabulary (`ACTIONS`), MCP-annotation-shaped |
| `grain_validate_move` | `{ route, move }` | would this `{action, target, payload?}` be legal there right now |

All four are declared `{ readOnlyHint: true }` — none of them can mutate anything.

## Usage

```bash
bun run <your grain app's export script>   # produces ./dist (or wherever your build writes it)
bunx grain-mcp ./dist
```

Wire it into Claude Code:

```bash
claude mcp add grain-mcp -- bunx grain-mcp /absolute/path/to/your/export/dist
```

The process reads the export ONCE at startup — a personal export is small and there's no live-reload
story here; restart it after a re-export, same as any MCP stdio server a client spawns fresh.

## Design stance

- **Zero dependency.** No HTML-parsing library, no JSON-RPC library. `harvest.ts` hand-rolls a tiny
  HTML tokenizer (Bun's runtime, not an npm package); `jsonrpc.ts` hand-rolls JSON-RPC 2.0 + the MCP
  message shapes.
- **Read-only, by construction.** There's no write path in this package at all — the four tools only
  ever inspect a harvested manifest and the pure contract; none can act on the export.
- **Comment-safe harvesting.** The real export (`tjakoen.github.io/dist/mail/index.html`) documents
  its data-binding contract in HTML comments that literally contain an unresolved placeholder
  (`data-surface="item:mail-<id>"`). Comments are stripped before tag scanning ever starts, so that
  prose is never mistaken for a live attribute — see the module comment in `harvest.ts` for the full
  story (including why a bare `data-bind-*` check would have been the WRONG signal: real, shipped mail
  rows carry `data-bind-*` too).

## Workspace-only

This package is not published — no `publishConfig`, no place in a release workflow. It lives in this
monorepo as `@tjakoen/grain-mcp` and is consumed via the bun workspace only, for now.

## Tests

```bash
bun test
```

Colocated `*.test.ts` files cover the JSON-RPC wire core, the HTML harvester (against a real snippet
from the live export), the tool layer, the in-process MCP dispatcher (a full handshake), and one
end-to-end smoke test that spawns `bun cli.ts` as a real child process against a checked-in fixture
export (`fixtures/export/`).
