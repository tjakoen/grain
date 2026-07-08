---
id: 002-board-server
status: doing
track: A
depends: [001-core-parser]
touches: [proof/serve.ts, proof/board.ts, proof/loader.ts]
owner: ai
---

# The board server

`proof serve` boots its own tiny BATCH+GRAIN server, reads a plans folder, and renders a kanban
board. Read-only: the board is a window over the files, never a store. Card detail renders the
plan body through MILL.

- [x] the filesystem loader (git age, best-effort)
- [x] the pure board renderer (GRAIN classes, tokens only)
- [x] the server + the CLI
- [ ] a screenshot in the gallery
