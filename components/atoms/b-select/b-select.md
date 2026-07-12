# Select

A labelled `<select>` in the `.field` idiom — the dropdown sibling of the text input.
It reuses the shared `.field`/`.field__label` frame from b-input (parent-context note:
b-select contributes only `.field__select`, and must be composed inside a `.field` label
exactly like b-input, or it has no frame/spacing/AI treatment). The native dropdown arrow
is kept — no custom caret, so nothing here needs a hardcoded color.

## States

### Default
```html
<label class="field">
  <span class="field__label">Environment</span>
  <select class="field__select" name="env">
    <option>staging</option><option>prod</option>
  </select>
</label>
```

### Focus
```html
<label class="field">
  <span class="field__label">Environment</span>
  <select class="field__select" name="env" data-force="focus">
    <option>staging</option><option>prod</option>
  </select>
</label>
```

## Variants

### Default (stacked)
```html
<label class="field">
  <span class="field__label">Priority</span>
  <select class="field__select" name="priority">
    <option>Low</option><option>Medium</option><option>High</option>
  </select>
</label>
```

### Inline
Inline works for free — it's declared on `.field[data-variant="inline"]` by b-input.css,
and b-select reuses the same `.field` frame, so no separate CSS is needed here.
```html
<label class="field" data-variant="inline">
  <span class="field__label">Priority</span>
  <select class="field__select" name="priority">
    <option>Low</option><option>Medium</option><option>High</option>
  </select>
</label>
```

## Sizes

### Small
```html
<label class="field" data-size="sm">
  <span class="field__label">Priority</span>
  <select class="field__select" name="priority">
    <option>Low</option><option>Medium</option><option>High</option>
  </select>
</label>
```

### Large
```html
<label class="field" data-size="lg">
  <span class="field__label">Priority</span>
  <select class="field__select" name="priority">
    <option>Low</option><option>Medium</option><option>High</option>
  </select>
</label>
```
