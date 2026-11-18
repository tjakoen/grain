# Stat tile

A KPI tile — one big number, a small label, an optional sub-line. The standard dashboard
primitive (a stats strip, a run summary, a cockpit home). Monochrome: tone is ink-level +
border weight, never hue.

Composition note: tiles are laid out by their parent, not by a wrapper component — drop them
in a plain flex or grid row (`display: flex; gap: var(--space-3)`, or a
`grid-template-columns: repeat(auto-fit, minmax(…, 1fr))`). Keep the `.stat` itself layout-free
so it fits any strip.

The value sits at display scale so, when an AI writes it, the grain texture reads — put
`data-grade="grain"` on the `.stat__value` while the AI is composing it; a tile whose number is
mid-update wears `data-commit="pending"` (the shared in-transit idiom), not a bespoke "loading"
state.

## Default
```html
<div class="stat">
  <span class="stat__value">128</span>
  <span class="stat__label">total</span>
</div>
```

## With a sub-line
```html
<div class="stat">
  <span class="stat__value">128</span>
  <span class="stat__label">total</span>
  <span class="stat__sub">across 4 environments</span>
</div>
```

## Tones
`data-tone` shifts ink-level, not hue. `warn` marks a count worth a look that is not yet wrong
(items waiting, checks due) by setting the value in semibold while the border stays calm; `bad`
draws the eye with a solid-ink border; `muted` is a
secondary/context count that recedes to faint; `ok` and the default read identically on purpose
(a healthy count needs no shouting).
```html
<div class="stat" data-tone="ok"><span class="stat__value">14</span><span class="stat__label">passed</span></div>
<div class="stat" data-tone="warn"><span class="stat__value">4</span><span class="stat__label">due</span></div>
<div class="stat" data-tone="bad"><span class="stat__value">2</span><span class="stat__label">failed</span></div>
<div class="stat" data-tone="muted"><span class="stat__value">3</span><span class="stat__label">skipped</span></div>
```

## A long text value
When the value is a word rather than a number (a plan id, a name), `data-fit="truncate"` keeps it
on one line and ends it in an ellipsis, so the tile stays the height of its neighbours. Put the
full text in a `title` so it can still be read.
```html
<div class="stat">
  <span class="stat__value" data-fit="truncate" title="pantry-session-control">pantry-session-control</span>
  <span class="stat__label">busiest plan</span>
</div>
```

## As a link
A tile can be the link itself when it filters a view or opens the detail behind the number. Use a
real `<a>`, and mark the selected filter with `aria-current="page"`, which adds an ink bar under
the tile. The label should say where the link goes, as it does here.
```html
<a class="stat" href="?view=doing" aria-current="page"><span class="stat__value">4</span><span class="stat__label">doing</span></a>
<a class="stat" href="?view=blocked"><span class="stat__value">1</span><span class="stat__label">blocked</span></a>
```

## In transit (AI writing the number)
```html
<div class="stat" data-commit="pending">
  <span class="stat__value" data-grade="grain">…</span>
  <span class="stat__label">passed</span>
</div>
```
