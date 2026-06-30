# Button

When the AI is acting through a button, it wears the **non-text grain**: a dashed
"terminal" edge + a blinking block caret, with the label in the Redaction grain family —
the same inherited grade state the text uses. It settles back to clean on commit.

## In-transit

### Working
```html
<button class="btn" data-commit="pending">Working…</button>
```

### Archiving (small)
```html
<button class="btn" data-size="sm" data-commit="pending">Archiving…</button>
```

### Full width
```html
<button class="btn" style="width:100%" data-commit="pending">Rescheduling your week…</button>
```
