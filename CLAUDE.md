# CLAUDE.md: GRAIN monorepo

> Read this first, then the docs it points to. Keep it accurate: if you change how the workspace
> works (a package, a command, a rule), update this file in the same change. This repo wires into
> Tjakoen's personal standards, published at `https://tjakoen.github.io/standards`. **Reference
> them, don't fork them.**

## What this is

The Bun-workspace monorepo for the **GRAIN family**: four layers that build on each other, each its
own package, no build step, everything runs on Bun straight from TypeScript. An app can adopt just
the design system or the whole stack.

| Package | What it is |
|---|---|
| [`@tjakoen/grain`](packages/grain) | The AI-interaction design system + default theme. Every surface is operable by a human or an AI through one shared vocabulary, with the AI's presence shown as a visible signal (grain = AI). |
| [`@tjakoen/mill`](packages/mill) | Markdown In, Living Layouts. A Markdown to GRAIN-pages CMS. |
| [`@tjakoen/proof`](packages/proof) | The AI plan board. Plans are markdown; the board is a live projection that never writes back. |
| [`@tjakoen/crumb`](packages/crumb) | The guided-tour, demo-mode, and AI-review layer. Published and live on tjakoen.github.io. |

**Dependency direction runs one way:** a substrate (BATCH is the reference) sits below grain, mill
builds on grain, proof builds on mill, crumb builds on grain and mill. grain imports nothing from
the substrate except one port. Never reach across or upward; add a port instead.

**Each package carries its own `CLAUDE.md` and `PLAN.md`** with that layer's rules, non-negotiables,
and hard-won lessons. Working inside a layer? Read its file first. This root file is the workspace
front door.

## How I work here (non-negotiables)

The full rulebook is [`AI-DEVELOPMENT.md`](https://tjakoen.github.io/standards/ai-development) plus
[`SESSION-LOOP.md`](https://tjakoen.github.io/standards/session-loop) (session mechanics, memory,
handoff, model economy). The short version:

- **I build with AI, out loud, on purpose.** Co-authored with Claude as a practice, not a git
  trailer. No `Co-Authored-By` lines. The receipt is the README badge and the flagship note.
- **AI multiplies, it doesn't add.** The AI types; I engineer. If I can't explain it, I didn't
  build it.
- **One vocabulary, one door.** Surfaces and verbs live in the contract; reference the registry,
  never magic strings. No privileged AI-to-DOM back channel.
- **Tokens only:** no hardcoded colors; components read semantic tokens. Re-skin by overriding
  tokens, never editing components.
- **Definition of done = code + the right test tier + docs synced + `tsc` and `bun test` green +
  a memory if a decision was made.** All of them.
- **Hand off when a task finishes** (SESSION-LOOP §5).

## Commands

```bash
bun install     # one root install, one lockfile
bun run check   # tsc across every package (must stay green)
bun run test    # bun test across every package
```

Each package also carries its own `check` and `test` scripts; run them when working in one layer.

## Voice (for any prose in my name)

Follow [VOICE.md](https://tjakoen.github.io/standards/voice): honest, concrete,
opinionated-with-the-why; no backticks in prose; no em-dashes; money stays vague. Any published
docs or design copy also follow [FIGURES.md](https://tjakoen.github.io/standards/figures) for
diagrams and charts.

## README presentation

Follow [README-STANDARD.md](https://tjakoen.github.io/standards/readme-standard). The README already
carries the curated badge row led by the `Made with Claude` badge and the text footer; keep it that
way.

## Commit convention

No AI attribution trailers on commits (`Co-Authored-By: Claude` etc.). The receipt is the README
badge and footer and the flagship note, not commit metadata.

## Docs / structure

`packages/{grain,mill,proof,crumb}`, each with its own `CLAUDE.md` + `PLAN.md`. Consuming a layer in
another app: see the README (GitHub Packages + `.npmrc` scope) and
[how to consume a layer](https://github.com/tjakoen/tjakoen.github.io/blob/main/docs/batch/CONSUME-AS-GIT-DEPS.md).
