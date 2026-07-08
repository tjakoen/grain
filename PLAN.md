# GRAIN — plan / roadmap

> **Status:** the **AI-interaction layer works today** — the closed action vocabulary
> (`grain/ai/contract.ts`), the one door (`grain/ai/interaction-layer.ts`), the harvested manifest
> (`/ai/manifest`), grade-as-signal, and the SSE dispatcher island. This file is GRAIN's **roadmap**:
> planned/deferred features, one line each. It is an *index*, **not** a second source of truth — the AI
> contract lives in [`docs/AI-INTERFACE.md`](docs/AI-INTERFACE.md), the build rules in
> [`../batch/docs/CONVENTIONS.md`](../batch/docs/CONVENTIONS.md), the beliefs in [`../tjakoen.github.io/PHILOSOPHY.md`](../tjakoen.github.io/PHILOSOPHY.md). When a
> feature is built, follow the CLAUDE.md alignment table (contract → reasoner → tests → docs).

## Planned

1. ~~**Unified interaction log (human + AI).**~~ **BUILT** (2026-07-08) — the **interaction timeline**
   (`docs/AI-INTERFACE.md` §5g). A `LogSink` port (`contract.ts`, like `OpChannel`) recorded in
   `handleIntent` for *every* crossing — request + response, `source`-tagged — so the door logs human
   and AI **identically**. The visible timeline is one impl (`ai/timeline-log.ts` `createStreamLogSink`)
   pushing a `log` render op to the `timeline` push surface; the `timeline` component color-codes each
   entry by provenance **through grade** (grain font = AI). Live on `/grain`. Unit + integration tested.
2. **Direct-write seam (`/kb/*`).** User-owned ground-truth writes that bypass the AI door
   (AI-INTERFACE §5b — a documented seam, not yet built).
3. **Reconnect & durability.** A durable op store + per-actor turn status, so a refresh mid-turn shows a
   coherent state (AI-INTERFACE §5d — deferred to the real-reasoner step).
4. **Retrieval / knowledge port.** A GRAIN seam (`KnowledgeSource` / `retrieve`) so the AI can query
   content smartly; the concrete model + embeddings are injected by the consumer (memory
   `ai-content-retrieval-layer`).
5. **Workflow / actions registry.** Named higher-level workflows composed from the atomic verbs, plus a
   discoverable "what the AI can do" list (memory `actions-workflow-registry-idea`).
