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
2. **Media card** (owner, 2026-08-12, next up). One image, a title, an optional description, an
   optional row of CTA buttons. A `card` that leads with a picture, so it covers the two shapes the
   portfolio currently hand-rolls.

   **Build it as `molecules/media-card`**, beside `card` and `gallery`, and reuse `card`'s vocabulary
   rather than inventing a second one: hairline box, no fill, `data-pad` for padding, the whole tile
   navigable when it is an `<a>`. Description and CTA row are both optional and both collapse to
   nothing when absent, the way `feed-card` hides its empty rows.

   **The two consumers to satisfy, and the second one is the real test:**
   - a photo that links somewhere (the plain case);
   - a **video poster** that links out to the platform the video lives on. That one exists today as
     `tjakoen.github.io/view/components/molecules/event-video` and is rendered by `content.ts`
     `renderVideoCard` off a flat `video:` frontmatter string. It carries a centred play badge over
     a scrim, a label along the bottom, and one hard rule worth keeping: **it embeds nothing.** No
     iframe, no platform script, no JS at all, so the no-JS case is the only case. If the media card
     can wear that badge as a variant, `event-video` retires into it and the portfolio stops owning
     design work it should not own.

   **Open question to settle while building:** whether image-above-text and image-beside-text is one
   component with a variant attribute or two components. Decide it against the two consumers above,
   not in the abstract.

   **Trap, already paid for once:** `styles/vars-defined.test.ts` fails on any new `var(--knob)` a
   stylesheet reads. A per-use knob has to be registered in its `EXTERNALLY_SET` map with a pointer
   to the doc line that documents it (see `--gallery-min`).
