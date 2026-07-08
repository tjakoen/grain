# timeline

The **interaction timeline** — a read-only feed of every crossing of the one door, human **and** AI,
recorded identically at the single writer (AI-INTERFACE §5g). It is the unified log the whole stack
implies: because both a human click and an AI decision enter through the same `handleIntent`, the
door records them in one place, one format, source-tagged — so the history reads the same for either
operator (uniform auditability a pixel-click imitation can't give).

**Push-only, never a `SurfaceKind`.** The AI only ever *writes* to it — `log` render ops at the
`timeline` surface. Nothing acts on it, so like `console` it is addressed by its bare slug and is not
a verb target. Entries are produced by a `LogSink` (`grain/ai/timeline-log.ts` `createStreamLogSink`)
wired at the composition root; the door calls `logSink.record(...)` for each crossing.

**Provenance is shown by GRADE, not a hue** (the palette is hueless by design): an **AI** crossing
renders in the grain font behind a **dashed** terminal edge (grain = AI); a **human** crossing in the
smooth font behind a solid edge; a **system** rejection stays faint. A failed crossing (rejected
request, rolled-back write) reads struck-through. So the timeline itself demonstrates grade-as-signal.

**Parent context:** none required — it's self-contained. Give the feed a bounded height (the
component caps it at `18rem`) so a long run scrolls inside it; the dispatcher pins it to newest and
caps the DOM at 80 rows. CSS-only (no `.html`).

```html
<section class="timeline" aria-label="Interaction timeline">
  <div class="timeline__head">
    <span>Interaction timeline</span>
    <span class="timeline__hint">every crossing of the one door — human and AI, recorded identically</span>
  </div>
  <ol class="timeline__feed" data-surface="timeline"></ol>
</section>
```

Each `log` op appends one row (built by `timelineEntryHtml`):

```html
<li class="timeline__entry" data-provenance="ai" data-kind="response" data-seq="4">
  <span class="timeline__who">ai</span>
  <span class="timeline__mark">✓</span>
  <span class="timeline__verb">chat.send</span>
  <span class="timeline__detail">2 ops</span>
</li>
```
