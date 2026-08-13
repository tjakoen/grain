# Radio

One button from a set where exactly one answer is right. As a component: b-radio with label, name,
value, checked, required, hint, error and size, and the tag may self-close. It carries no stylesheet
of its own: the frame is the [Input](../b-input/b-input.md) and the control is the
[Checkbox](../b-checkbox/b-checkbox.md), so the row, the sizes, the focus ring and the AI treatment
all arrive already agreeing with the rest of the family.

Radios are a group, and the group is made by the name. Every button meant to be mutually exclusive
with another carries the same name; the question they answer is a heading the page writes above them,
because the field frame labels a control and a group of controls is a different thing. When the
options arrive as data rather than as markup, reach for [Check](../b-check/b-check.md) instead and
let one tag render the whole group.

This is a separate file from the checkbox for a measured reason rather than for symmetry. The obvious
design is one atom with a type property, and it does not work: the renderer appends a property's
attribute next to the literal one already in the template instead of replacing it, so a tag asking
for a radio arrives at the browser declaring both types and the browser honors the first. The result
is a checkbox that was asked to be a radio and says nothing about it. Two templates that each state
their own type are the only shape that cannot get this wrong.

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
