# Status list

A list where each row carries a leading status **mark**, a **title**, and trailing **meta** — a
live pass/fail checklist, a job queue, a deploy pipeline, a task run-down. `b-list` is a
prose-marker list; this is a three-slot structural row.

Composition note: an item is a `<li class="status-list__item">` inside a
`<ul class="status-list">`, with three children — `.status-list__mark` (a glyph, a `b-badge`, or
a `b-icon`), `.status-list__title`, and `.status-list__meta`. The **mark carries the signal**
(monochrome, currentColor) — the component bakes in no domain status colours.

The load-bearing idea: an **in-flight** row wears `data-commit="pending"` — a dashed leading edge
+ a blinking caret trailing the title — and settles on result. That's the grain control lifecycle
(the row a runner/AI is acting on), not a bespoke "running" state. A **not-yet-reached** row reads
faint via `data-state="waiting"`. Rows take `data-surface="…"` so an AI can address one row at a
time (a plain attribute hook — it adds no surface kind to `ai/contract.ts`).

## Settled rows
```html
<ul class="status-list">
  <li class="status-list__item" data-surface="row:login">
    <span class="status-list__mark">✓</span>
    <span class="status-list__title">login works</span>
    <span class="status-list__meta">2.1s · staging</span>
  </li>
  <li class="status-list__item" data-surface="row:checkout">
    <span class="status-list__mark">✕</span>
    <span class="status-list__title">checkout completes</span>
    <span class="status-list__meta">4.8s · staging</span>
  </li>
</ul>
```

## Waiting + in-flight
The first row hasn't been reached (faint); the second is being run right now
(`data-commit="pending"` → dashed edge + caret).
```html
<ul class="status-list">
  <li class="status-list__item" data-state="waiting">
    <span class="status-list__mark">○</span>
    <span class="status-list__title">search returns results</span>
    <span class="status-list__meta"></span>
  </li>
  <li class="status-list__item" data-commit="pending">
    <span class="status-list__mark">◐</span>
    <span class="status-list__title">profile loads</span>
    <span class="status-list__meta">staging</span>
  </li>
</ul>
```

## With a badge mark
The mark slot takes any small primitive — here a `b-badge` instead of a bare glyph.
```html
<ul class="status-list">
  <li class="status-list__item">
    <span class="status-list__mark"><span class="badge" data-status="active">ok</span></span>
    <span class="status-list__title">deploy · api</span>
    <span class="status-list__meta">1m 12s</span>
  </li>
</ul>
```
