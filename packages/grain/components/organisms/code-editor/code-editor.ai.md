# Code editor

When the AI is writing into the editor, the whole panel wears the **non-text grain**: a dashed
"terminal" edge (the same signal code-block uses when the AI authors a block). It settles back to
a solid frame on commit — the moment the human owns the buffer again. Inherited grade works too:
any `[data-grade="grain"]` ancestor puts the panel in-transit without touching the root.

## In-transit

### AI writing a spec
```html
<div class="code-editor" data-commit="pending" style="height:12rem">
  <div class="code-editor__bar">
    <span class="code-editor__title">tests/checkout.spec.ts</span>
    <span class="code-editor__dirty">• writing…</span>
  </div>
  <div class="code-editor__mount"><pre class="code-block"><code>await page.goto('/checkout');</code></pre></div>
  <div class="code-editor__status">Drafting…</div>
</div>
```

### Inherited grade
```html
<div data-grade="grain">
  <div class="code-editor" style="height:8rem">
    <div class="code-editor__bar"><span class="code-editor__title">spec.ts</span></div>
    <div class="code-editor__mount"></div>
    <div class="code-editor__status">Ready</div>
  </div>
</div>
```
