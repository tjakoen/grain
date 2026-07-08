# 🫧 PROOF — the AI plan board

[![Made with Claude](https://img.shields.io/badge/Made_with-Claude-D97757?logo=anthropic&logoColor=white)](https://tjakoen.github.io/notes/ten-times-zero)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)
[![Status](https://img.shields.io/badge/status-in_progress-blue)](PLAN.md)

**Plans as markdown, in. A kanban board, out.** PROOF is a standardized way to write an AI's
development plans as `.md` files (`plans/*.md`) and a board that *renders* them, never the other
way around. It's its own top-level project, built on GRAIN and BATCH, and a consumer of MILL (the
board's card detail is MILL's first real library user).

The honest pitch, stated everywhere it matters: **roughly 70% human observability, 30% AI
efficiency.** The AI never looks at the board. Its gain is the file structure itself, a cheaper
session start, one ground truth parallel sessions can share, plans forced into small pieces before
they turn into a mess. The board is for the human watching.

## The one design law

**Files are the source of truth. The board is a projection. The AI maintains files, never the
board.**

- A plan is markdown with a deliberately small frontmatter, `id`, `status`, `track`, `depends`,
  `touches`, `owner`, six fields, on purpose. A heavier schema turns the AI into a bookkeeper
  instead of a builder.
- The derived index is built by the parser, never hand-maintained. A hand-edited index sitting
  next to the markdown is dual bookkeeping, exactly the drift this exists to kill.
- Delete PROOF and the plans are still just readable markdown. The tool is a viewport. It is never
  a store.

## What's built

- **The core** (`core/`): a framework-agnostic parser and derived index. An invalid status or
  owner falls back to a default *and* reports the error, never a silent drop.
- **The board** (`board.ts`, `board.css`, `loader.ts`): a kanban renderer, tokens-only, so it's
  theme-aware for free. Card detail renders the full plan body through MILL.
- **The live board** (`live.ts`, `board-live.js`): a file watcher debounces a change and
  broadcasts a `replace` render op over SSE, so every open tab updates on its own. It's read-only
  by design, v1 never posts an intent back.
- **`proof check`**: a deterministic lint, schema validity, dangling `depends`, a `done` plan with
  unticked tasks, a `doing` plan gone stale with no activity. Exits nonzero, so it's CI-able.
- **`proof init`**: scaffolds `plans/` plus a contract section for the host's own CLAUDE.md,
  non-invasive, it never edits a host's existing files.

Not yet built: migrating this monorepo's own roadmap onto PROOF, and phase 2 (a mindmap view, a
multi-project board, human edits through the client-side door). The full build order and honest
status live in [`PLAN.md`](PLAN.md).

## How it mounts

PROOF is a **mountable layer**, not a server of its own. `routes.ts` exports
`createProofRoutes(deps)`, a transport-generic pathname handler that mirrors MILL's
`createMillRoutes`:

```ts
import { createProofRoutes } from "@tjakoen/proof/routes.ts";

const proofRoutes = createProofRoutes({ plansDir: "./plans", channel /* an OpChannel */ });
// mount proofRoutes(pathname) inside your own request handler; the prefix is configurable
```

[PANTRY](../pantry/) mounts it at `/plans`, alongside the framework docs and the component
catalog. Building your own app instead of running PANTRY? Import `createProofRoutes` the same way
PANTRY does.

Prefer zero code? `bunx proof serve` boots its own self-contained BATCH+GRAIN server and reads
`./plans/` from the current directory. Either path, the plans stay in your repo. PROOF only ever
reads them.

## Non-goals

Not a task manager for humans, v1's board is read-only, humans edit the same files the AI does.
Not a store, no database, no board state outside the files and git. Not a second plan system, a
repo that already has plan prose migrates it in, it doesn't run PROOF alongside something else.

---

🤖 **Built with Claude, and the board never once wrote to itself.** I decided what "done" has to
mean, Claude typed the parser that enforces it. **I don't prompt and pray, I prompt and prove.**
[How I actually work with AI, receipts and all →](https://tjakoen.github.io/notes/ten-times-zero)
