# Note

The editorial content article — the layout MILL's default GRAIN adapter emits for a
rendered Markdown document (eyebrow meta → masthead → lede → tag badges → hairline rule →
prose). CSS-only: MILL composes the markup; nothing data-binds it. Human-authored content →
always clean ink (`data-grade="smooth"`; only the AI grains).

## Note article
```html
<article class="note" data-grade="smooth">
  <header class="note__head">
    <p class="eyebrow">2026-07-03 · ~13 min</p>
    <h1 class="masthead">Ten Times Zero Is Still Zero</h1>
    <p class="note__lede">How I actually work with AI, and why it holds up.</p>
    <div class="note__tags"><span class="badge" data-status="active">ai</span> <span class="badge" data-status="active">workflow</span></div>
    <hr class="rule">
  </header>
  <p>AI is a multiplier, not an addend…</p>
</article>
```
