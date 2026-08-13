# Checkbox

A tick box in the field frame: something the form submits, rather than something the user switches.
As a component: b-checkbox with label, name, value, checked, required, hint, error and size, and the
tag may self-close. Its twin is the [Radio](../b-radio/b-radio.md) and its data-first sibling is
[Check](../b-check/b-check.md).

Reach for the [Switch](../b-switch/b-switch.md) instead when the thing being set is a state that
takes effect the moment it moves, like delivered or held. A switch is a control you flip; this is a
box you tick and then submit with the rest of the form.

This atom owns the stylesheet the other two reuse, the same division the
[Textarea](../b-textarea/b-textarea.md) makes for the Memo. What it adds to the frame is one class
for the control and one rule for the row. A field is a column, because a text field shows its value
inside itself and the label above is a caption. A tick box has no inside, so the label sits beside it
and reads as the sentence being agreed to, at full ink rather than muted. That row layout keys off
the control being present rather than off a modifier class, so composing the markup correctly is
enough to get it: there is no variant to remember and none to forget.

The native control is kept as the platform draws it. It already distinguishes a square tick from a
round dot, it is accessible without help, and drawing a replacement would need a hardcoded color to
fill, which the tokens-only rule does not allow. The whole styling budget here is an accent, a size
and the focus ring.

The tap target is the entire row rather than the box, because the label wraps the input. That is why
the box is allowed to stay small and why the row carries the minimum height instead: a box and a line
of text come to about half the touch floor on their own, and a checkbox nobody can hit on a phone is
the one control whose failure is invisible on a desktop.

## States

### Default
```html
<label class="field">
  <input type="checkbox" class="field__box" name="terms" value="yes">
  <span class="field__label">I have read how this site handles what you send</span>
</label>
```

### Checked
```html
<label class="field">
  <input type="checkbox" class="field__box" name="digest" value="yes" checked>
  <span class="field__label">Send me the monthly digest</span>
</label>
```

### Required, with a hint
```html
<label class="field">
  <input type="checkbox" class="field__box" name="terms" value="yes" required>
  <span class="field__label">I agree to be contacted about this enquiry</span>
  <span class="field__hint">Nothing is stored: the form opens your own mail client.</span>
</label>
```

### With an error
```html
<label class="field">
  <input type="checkbox" class="field__box" name="terms" value="yes" required>
  <span class="field__label">I agree to be contacted about this enquiry</span>
  <span class="field__error">Tick this before sending.</span>
</label>
```

### Focus
```html
<label class="field">
  <input type="checkbox" class="field__box" name="terms" value="yes" data-force="focus">
  <span class="field__label">I agree to be contacted about this enquiry</span>
</label>
```

### AI is acting
```html
<label class="field" data-commit="pending">
  <input type="checkbox" class="field__box" name="terms" value="yes">
  <span class="field__label">A box the AI is working near, dashed like the rest of the family</span>
</label>
```

## Sizes

### Small
```html
<label class="field" data-size="sm">
  <input type="checkbox" class="field__box" name="sm" value="yes" checked>
  <span class="field__label">Small</span>
</label>
```

### Large
```html
<label class="field" data-size="lg">
  <input type="checkbox" class="field__box" name="lg" value="yes" checked>
  <span class="field__label">Large</span>
</label>
```
