# Radio

One button from a set where exactly one answer is right. As a component:
`<b-radio label="Reply by email" name="reply" value="email" checked />`, and the tag may self-close.
It carries no stylesheet: the frame is the [Input](../b-input/b-input.md) and the control is the
[Checkbox](../b-checkbox/b-checkbox.md), so the row, the sizes, the ring and the AI treatment cannot
drift from it.

Radios are a group, and the group is made by the name. Every button meant to be mutually exclusive
with another carries the same one, and the question they answer is a heading the page writes above
them. When the options arrive as data, reach for [Check](../b-check/b-check.md) and let one tag
render the whole group.

## States

### A group
```html
<div>
  <label class="field">
    <input type="radio" class="field__box" name="reply" value="email" checked>
    <span class="field__label">Reply by email</span>
  </label>
  <label class="field">
    <input type="radio" class="field__box" name="reply" value="call">
    <span class="field__label">Reply by phone</span>
  </label>
  <label class="field">
    <input type="radio" class="field__box" name="reply" value="none">
    <span class="field__label">No reply needed</span>
  </label>
</div>
```

### With a hint
```html
<label class="field">
  <input type="radio" class="field__box" name="pace" value="soon" checked>
  <span class="field__label">Within the week</span>
  <span class="field__hint">A best effort, not a promise.</span>
</label>
```

### Focus
```html
<label class="field">
  <input type="radio" class="field__box" name="focus-demo" value="one" data-force="focus">
  <span class="field__label">The keyboard ring lands on the control</span>
</label>
```

### AI is acting
```html
<label class="field" data-commit="pending">
  <input type="radio" class="field__box" name="ai-demo" value="one">
  <span class="field__label">Dashed while the AI works nearby</span>
</label>
```
