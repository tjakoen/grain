# Input

A labelled text field. Compose several inside a `<form>` to build any form, or lay them out with the
[Form grid](../../molecules/form-grid/form-grid.md).
As a component: `<b-input name="email" label="Email" required />` — `required` is a
bare boolean, and the tag may self-close.

This atom owns the frame the whole field family shares, which is three more things than the input
itself. Two message slots sit under the control, a quiet hint and an error, and both collapse when
empty so a template can carry them unconditionally. An error is not a red one: status here is weight
against the hint's fade, not hue, and the token it reaches for is hueless by default so a theme that
does own a hue can supply one without this component ever naming a color.

The third is the required marker, and nothing has to add it. The frame reads the required attribute
the control already needs for the browser to enforce anything, and marks the label from that. So the
marker cannot drift from the constraint, no author can forget it, and every atom in the family gets it
at once. It is decorative: a screen reader announces the control as required with or without it.

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

### Required, with a hint
```html
<label class="field">
  <span class="field__label">Email</span>
  <input class="field__input" type="email" name="email" placeholder="jane@example.com" required>
  <span class="field__hint">Only used to reply to you.</span>
</label>
```

### With an error
```html
<label class="field">
  <span class="field__label">Email</span>
  <input class="field__input" type="email" name="email" value="jane@" required>
  <span class="field__error">That address is missing everything after the at sign.</span>
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
