# CLAUDE.md — proof

Onboarding + operating rules for any AI (or human) working in **`proof/`**, the AI plan board.
Read this first, then the docs it points to. Keep it accurate: if you change how PROOF works,
update this file in the same change.

> Personal standards (voice, badges, AI-use posture) live at the published index
> <https://tjakoen.github.io/standards> (the `@tjakoen/standards` package) — referenced, never
> forked. This file is seeded from its `CLAUDE.starter.md`.

## What this is

PROOF turns plans-as-markdown into a kanban projection: each `plans/*.md` file (frontmatter +
prose + a task checklist) is one plan, and the board *renders* them — never the other way around.
It is a **mountable layer** (`createProofRoutes` in `routes.ts`) above MILL
(`batch → grain → mill → proof`), plus a CLI (`proof check` lints a plans folder, `proof init`
scaffolds one, `proof serve` runs a standalone board).

## Start here (reading order)

1. [`PLAN.md`](PLAN.md) — the canonical plan (design, the schema, build pieces). Source of truth.
2. [`example/`](example/) — a working plans folder (the schema in practice).
3. The layer docs it builds on: <https://tjakoen.github.io/grain/docs> · <https://tjakoen.github.io/batch/docs>.

## Commands

```bash
bun run check      # tsc --noEmit (must stay green)
bun test           # unit + integration
bun cli.ts check   # lint a plans/ folder (what consumers run as `bunx proof check`)
```

## Non-negotiables

- **The files are the source of truth; the board NEVER writes.** No endpoint, tool, or "fix"
  may mutate a plan file from the board side. Status changes happen in the plan's own frontmatter.
- **The frontmatter schema is a contract** (`id` = filename stem; `status` ∈ todo/doing/done/blocked;
  `depends`, `touches`, `owner`). `check.ts` enforces it; change the schema only with the loader,
  the checker, the tests, and `PLAN.md` in the same change.
- **A layer above, never sideways.** PROOF consumes mill/grain/batch via `@tjakoen/*` package
  specifiers (sha-pinned git deps) — never relative sibling paths, never the reverse direction.
- **Tests are part of the work.** `tsc` + `bun test` green before "done".

## Definition of done

Code + colocated tests + `tsc` and `bun test` green + `PLAN.md` synced (tick what landed) + a
memory if a decision was made.
