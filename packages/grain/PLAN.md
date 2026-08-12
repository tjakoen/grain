# GRAIN — plan / roadmap

> **Status:** the **AI-interaction layer works today** — the closed action vocabulary
> (`grain/ai/contract.ts`), the one door (`grain/ai/interaction-layer.ts`), the harvested manifest
> (`/ai/manifest`), grade-as-signal, and the SSE dispatcher island. This file is GRAIN's **roadmap**:
> planned/deferred features, one line each. It is an *index*, **not** a second source of truth — the AI
> contract lives in [AI-INTERFACE](https://tjakoen.github.io/grain/docs/ai-interface), the build rules in
> [CONVENTIONS](https://tjakoen.github.io/batch/docs/conventions), the beliefs in [`PHILOSOPHY.md`](https://github.com/tjakoen/tjakoen.github.io/blob/main/docs/PHILOSOPHY.md). When a
> feature is built, follow the CLAUDE.md alignment table (contract → reasoner → tests → docs).

## Planned

1. ~~**Unified interaction log (human + AI).**~~ **BUILT** (2026-07-08) — the **interaction timeline**
   (<https://tjakoen.github.io/grain/docs/ai-interface> §5g). A `LogSink` port (`contract.ts`, like `OpChannel`) recorded in
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

## Components

Component work does not belong in the numbered list above, which tracks the AI-interaction layer.

1. ~~**Gallery.**~~ **BUILT** (2026-08-12) — `molecules/gallery`, a captioned image grid: the
   companion to `card-grid` for pictures rather than facts, tuned by `--gallery-min` and
   `--gallery-ratio`, wired to `scripts/lightbox.js` by one group per gallery. Written because the
   portfolio's event pages could only carry a hero strip, which hides anything past the fifth tile.
2. ~~**Media card.**~~ **BUILT** (2026-08-12) — `molecules/media-card`, a `card` that leads with a
   picture: one image, a title, an optional description, an optional row of buttons, cropped to
   `--media-ratio`. It reuses `card`'s vocabulary rather than a second one, and both optional rows
   collapse to nothing when absent.

   Both consumers are satisfied. The plain photo that links somewhere is the default stacked
   layout. The video poster that links out is `data-layout="overlay"`, which carries the centred
   play badge and lays the title along the bottom on a scrim, and it keeps the one hard rule that
   made the original worth copying: **it embeds nothing.** No iframe, no platform script, no JS at
   all, so the no-JS case is the only case. `tjakoen.github.io/view/components/molecules/event-video`
   retires into it and `content.ts` `renderVideoCard` composes the molecule instead of owning it.

   **The open question is answered: one component, layout is an attribute.** The two shapes share
   every rule they have apart from where the text sits, so two molecules would fork the box, the
   crop, the hover, the badge and the pending edge to move one block of text. A beside-the-picture
   layout is deliberately not shipped, because nothing asks for it yet and it is one more attribute
   value when something does.

   Two new global tokens came with it, `--scrim` and `--on-scrim` in `styles/variables.css`. They
   are the one pair that does **not** invert in the dark block, on purpose: a scrim darkens
   somebody else's photograph so a label survives on top of it, and a photograph does not invert
   with the palette.
