# Meter

A proportional horizontal bar split into segments — a health bar (passed / failed / pending
share of a run), a storage bar, a progress bar, a poll result. Each segment's width is a single
custom property (`--seg`) so it's bindable server-side with **zero JS**. Monochrome: segments
differ by texture and ink-level — solid ink, hatched, faint — never by hue.

Segments read left-to-right and should sum to 100% (any remainder shows the faint track). Give
the meter an `aria-label`; for a single-value progress meter add `aria-valuenow`/`min`/`max`.

## Health bar (three tones)
`ok` is solid ink, `bad` is a dense hatch, an untoned/`pending` segment is faint. Order and
widths are author-set.
```html
<div class="meter" role="meter" aria-label="Run health">
  <span class="meter__seg" data-tone="ok" style="--seg: 70%"></span>
  <span class="meter__seg" data-tone="bad" style="--seg: 20%"></span>
  <span class="meter__seg" data-tone="pending" style="--seg: 10%"></span>
</div>
```

## Progress (one segment)
```html
<div class="meter" role="meter" aria-label="Upload" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100">
  <span class="meter__seg" data-tone="ok" style="--seg: 60%"></span>
</div>
```

## Indeterminate (running, totals unknown)
`data-state="busy"` sweeps a faint stripe across the track (static faint fill under
`prefers-reduced-motion`).
```html
<div class="meter" data-state="busy" role="meter" aria-label="Running…">
  <span class="meter__seg"></span>
</div>
```

## In transit (AI updating the meter)
```html
<div class="meter" data-commit="pending" role="meter" aria-label="Run health">
  <span class="meter__seg" data-tone="ok" style="--seg: 55%"></span>
  <span class="meter__seg" data-tone="pending" style="--seg: 45%"></span>
</div>
```
