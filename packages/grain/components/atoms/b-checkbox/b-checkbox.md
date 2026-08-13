# Checkbox

A tick box in the field frame: something a form submits, rather than something the user switches.
As a component: `<b-checkbox label="I agree" name="terms" value="yes" required />`, and the tag may
self-close. Its twin is the [Radio](../b-radio/b-radio.md) and its data-first sibling is
[Check](../b-check/b-check.md). Reach for the [Switch](../b-switch/b-switch.md) instead when the
thing being set takes effect the moment it moves, like delivered or held.

This atom owns the stylesheet the other two reuse, the division the
[Textarea](../b-textarea/b-textarea.md) already makes for the Memo. It adds one class for the control
and one rule for the row, because a tick box has no inside: the label sits beside it and reads at
full ink, as the sentence being agreed to. The native control is kept as the platform draws it, and
the tap target is the whole row rather than the box.

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
