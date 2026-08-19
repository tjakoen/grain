# Readiness

A verdict over its evidence: whether a set of boundary conditions holds, one line saying why,
and what is still in the way. The generic shape behind "ready to deploy", "ready to release",
"ready to hand off" — a run that has finished checking and now has to tell someone.

It is a **readout, not an ask.** It reports and stops. A closed-set question with options and an
escape hatch belongs on CRUMB's decision ask; two surfaces putting the same question to the same
person is a failure mode rather than thoroughness.

Composition note: no parent context is required — it fills its container and carries no width of
its own, so it sits inside a `card` or bare in a panel. The evidence rows are a **`status-list`**,
not markup this component invents: the marks, the in-flight lifecycle and the per-row
`data-surface` hook already live there. Counts alongside the verdict are `stat` tiles, laid out by
the parent.

State is an attribute (`data-state`), and reads as ink level and edge weight, never hue.

## Ready
```html
<div class="readiness" data-state="ready">
  <span class="readiness__verdict">Ready to hand off</span>
  <span class="readiness__why">Gates green, plan synced, nothing in flight.</span>
  <ul class="status-list">
    <li class="status-list__item">
      <span class="status-list__mark">✓</span>
      <span class="status-list__title">gates green</span>
      <span class="status-list__meta">check · test</span>
    </li>
    <li class="status-list__item">
      <span class="status-list__mark">✓</span>
      <span class="status-list__title">plan synced</span>
      <span class="status-list__meta">PLAN.md</span>
    </li>
  </ul>
</div>
```

## Blocked
The one state meant to stop you, so it takes a solid-ink edge. What blocks goes in the rows; the
verdict says only that something does.
```html
<div class="readiness" data-state="blocked">
  <span class="readiness__verdict">Not yet</span>
  <span class="readiness__why">Two conditions still hold it open.</span>
  <ul class="status-list">
    <li class="status-list__item">
      <span class="status-list__mark">✕</span>
      <span class="status-list__title">tests failing</span>
      <span class="status-list__meta">3 of 663</span>
    </li>
    <li class="status-list__item" data-state="waiting">
      <span class="status-list__mark">·</span>
      <span class="status-list__title">plan not synced</span>
      <span class="status-list__meta">PLAN.md</span>
    </li>
  </ul>
</div>
```

## Waiting
Nothing has been checked yet, so the verdict recedes rather than claiming a result.
```html
<div class="readiness" data-state="waiting">
  <span class="readiness__verdict">Not checked</span>
  <span class="readiness__why">No gate has run this session.</span>
</div>
```

## With counts
Tiles are laid out by the parent, never by a wrapper inside the component.
```html
<div class="readiness" data-state="blocked">
  <span class="readiness__verdict">Not yet</span>
  <span class="readiness__why">Work is uncommitted.</span>
  <div style="display:flex;gap:var(--space-3)">
    <div class="stat" data-tone="bad"><span class="stat__value">12</span><span class="stat__label">uncommitted</span></div>
    <div class="stat" data-tone="muted"><span class="stat__value">1</span><span class="stat__label">unpushed</span></div>
  </div>
</div>
```

## In transit (the detector is still deciding)
The shared in-flight idiom, not a bespoke loading state. The verdict sits at display scale
precisely so that an AI-composed line reads as grain rather than claiming to be checked fact.
```html
<div class="readiness" data-commit="pending">
  <span class="readiness__verdict" data-grade="grain">Checking…</span>
  <span class="readiness__why">Reading the gate log.</span>
</div>
```
