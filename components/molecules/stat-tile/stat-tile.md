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
`data-tone` shifts ink-level, not hue. `bad` draws the eye with a solid-ink border; `muted` is a
secondary/context count that recedes to faint; `ok` and the default read identically on purpose
(a healthy count needs no shouting).
```html
<div class="stat" data-tone="ok"><span class="stat__value">14</span><span class="stat__label">passed</span></div>
<div class="stat" data-tone="bad"><span class="stat__value">2</span><span class="stat__label">failed</span></div>
<div class="stat" data-tone="muted"><span class="stat__value">3</span><span class="stat__label">skipped</span></div>
```

## In transit (AI writing the number)
```html
<div class="stat" data-commit="pending">
  <span class="stat__value" data-grade="grain">…</span>
  <span class="stat__label">passed</span>
</div>
```
