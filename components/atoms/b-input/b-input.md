# Input

A labelled text field. Compose several inside a `<form>` to build any form.
As a component: `<b-input name="email" label="Email" required />` — `required` is a
bare boolean, and the tag may self-close.

## States

### Default
```html
<label class="field">
  <span class="field__label">Name</span>
  <input class="field__input" name="name" placeholder="Jane">
</label>
```

### Focus
```html
<label class="field">
  <span class="field__label">Name</span>
  <input class="field__input" name="name" value="Jane" data-force="focus">
</label>
```

## Variants

### Default (stacked)
```html
<label class="field">
  <span class="field__label">Name</span>
  <input class="field__input" name="name">
</label>
```

### Inline
```html
<label class="field" data-variant="inline">
  <span class="field__label">Name</span>
  <input class="field__input" name="name">
</label>
```

## Sizes

### Small
```html
<label class="field" data-size="sm">
  <span class="field__label">Name</span>
  <input class="field__input" name="name">
</label>
```

### Large
```html
<label class="field" data-size="lg">
  <span class="field__label">Name</span>
  <input class="field__input" name="name">
</label>
```
