# Code editor

The interactive tier above [code-block](../../atoms/code-block/code-block.md): a framed edit
surface with a toolbar, a **mount slot** a real editor is injected into, a validation status
strip, a diagnostics list, and a version-history drawer. CSS-only like every grain component —
it bundles **no** editor. The consumer lazy-loads its own (Monaco, CodeMirror, a plain
`<textarea>`) into `.code-editor__mount` and toggles the `data-state` / `data-history` /
`data-dirty` attributes; grain owns the chrome and the monochrome grammar, the app owns the
engine. Shares code-block's mono/surface tokens so code in a blog and code in the editor read as
one system. Give the panel a height (grid/flex parent) — the mount owns the scroll.

## Frame

### Empty (pre-engine fallback)
The mount holds a plain code-block until the engine mounts, so the panel never looks broken.
```html
<div class="code-editor" style="height:20rem">
  <div class="code-editor__bar">
    <span class="code-editor__title">tests/checkout.spec.ts</span>
    <span class="code-editor__dirty">• unsaved</span>
    <span class="code-editor__actions">
      <button class="btn" data-size="sm" data-variant="soft">Validate</button>
      <button class="btn" data-size="sm">Save</button>
    </span>
  </div>
  <div class="code-editor__mount">
    <pre class="code-block"><code>import { test, expect } from '@playwright/test';</code></pre>
  </div>
  <div class="code-editor__status">Ready</div>
</div>
```

### Dirty
Flip `data-dirty="true"` to reveal the unsaved marker.
```html
<div class="code-editor" data-dirty="true" style="height:12rem">
  <div class="code-editor__bar">
    <span class="code-editor__title">tests/checkout.spec.ts</span>
    <span class="code-editor__dirty">• unsaved</span>
    <span class="code-editor__actions">
      <button class="btn" data-size="sm">Save</button>
    </span>
  </div>
  <div class="code-editor__mount"><pre class="code-block"><code>// edited…</code></pre></div>
  <div class="code-editor__status">Ready</div>
</div>
```

## Validation

The status strip reads `data-state` on the root. Monochrome: the glyph + word carry the signal,
`invalid` adds weight and a heavier frame — never colour.

### Validating
```html
<div class="code-editor" data-state="validating" style="height:8rem">
  <div class="code-editor__bar"><span class="code-editor__title">spec.ts</span></div>
  <div class="code-editor__mount"></div>
  <div class="code-editor__status">Validating…</div>
</div>
```

### Valid
```html
<div class="code-editor" data-state="valid" style="height:8rem">
  <div class="code-editor__bar"><span class="code-editor__title">spec.ts</span></div>
  <div class="code-editor__mount"></div>
  <div class="code-editor__status">Compiles — 0 problems</div>
</div>
```

### Invalid (with diagnostics)
The diagnostics list shows when `data-state="invalid"` and the list is non-empty. Each row is a
`__diag-loc` (line:col — the app wires it to jump the caret) plus the message.
```html
<div class="code-editor" data-state="invalid" style="height:12rem">
  <div class="code-editor__bar"><span class="code-editor__title">spec.ts</span></div>
  <div class="code-editor__mount"></div>
  <div class="code-editor__status">1 problem</div>
  <div class="code-editor__diagnostics">
    <div class="code-editor__diag" data-clickable>
      <span class="code-editor__diag-loc">12:4</span>
      <span>Cannot find name 'expcet'. Did you mean 'expect'?</span>
    </div>
  </div>
</div>
```

### Saved
```html
<div class="code-editor" data-state="saved" style="height:8rem">
  <div class="code-editor__bar"><span class="code-editor__title">spec.ts</span></div>
  <div class="code-editor__mount"></div>
  <div class="code-editor__status">Saved as version 4</div>
</div>
```

## History

Toggle `data-history="open"` to slide the version drawer in. Rows are newest-first; the live one
carries `data-current`. Restore writes a new version — history is never mutated.
```html
<div class="code-editor" data-history="open" style="height:16rem">
  <div class="code-editor__bar">
    <span class="code-editor__title">spec.ts</span>
    <span class="code-editor__actions"><button class="btn" data-size="sm" data-variant="soft">History</button></span>
  </div>
  <div class="code-editor__mount"></div>
  <div class="code-editor__status">Ready</div>
  <aside class="code-editor__history">
    <div class="code-editor__history-head">History</div>
    <div class="code-editor__version" data-current>
      <div class="code-editor__version-msg">tighten the checkout assertion</div>
      <div class="code-editor__version-meta"><span>maria</span><span>2m ago</span></div>
    </div>
    <div class="code-editor__version">
      <div class="code-editor__version-msg">initial spec</div>
      <div class="code-editor__version-meta"><span>maria</span><span>yesterday</span></div>
    </div>
  </aside>
</div>
```
