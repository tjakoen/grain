# Form grid

The layout the field family never had. A field is told to grow inside a column, which is a rule about
how one control behaves and says nothing about how several sit together, so until now every form laid
itself out by hand and no two of them agreed. This is one class that wraps them and settles it.

It is CSS only, so there is no tag to write. Put the class on the element that holds the controls,
whether those are hand-authored inputs or a generated set rendered through
[Field](../../atoms/b-field/b-field.md), [Choice](../../atoms/b-choice/b-choice.md),
[Memo](../../atoms/b-memo/b-memo.md) and [Check](../../atoms/b-check/b-check.md). It asks nothing of
its own parent.

By default the columns are found rather than declared: fields flow into as many tracks as fit, down
to a minimum width a page can raise for unusually long labels. A fixed count is available as an
attribute, for a form whose shape is a design decision rather than a consequence of the width it
happens to have, and a fixed count collapses to one column on a narrow screen, because two columns of
form fields on a phone is not a smaller version of that design but a different and worse one.

Two rules are there to make a specific mistake unmakeable. A message box spans the full width without
being asked, because a paragraph in a half-width column is the layout error this grid exists to
prevent, and the rule keys off the control being present so it holds for a hand-authored box and a
generated one alike. Anything else can span the full width by asking. Fields also align to the top
rather than stretching, so one field carrying a hint cannot drag every neighbouring control's border
down to match it.

## Found columns (the default)

```html
<div class="form-grid">
  <label class="field">
    <span class="field__label">Name</span>
    <input class="field__input" name="name" placeholder="Jane">
  </label>
  <label class="field">
    <span class="field__label">Email</span>
    <input class="field__input" type="email" name="email" placeholder="jane@example.com" required>
  </label>
  <label class="field">
    <span class="field__label">Company</span>
    <input class="field__input" name="company">
    <span class="field__hint">Optional.</span>
  </label>
  <label class="field">
    <span class="field__label">Message</span>
    <textarea class="field__textarea" name="message" rows="3"></textarea>
  </label>
</div>
```

## Two columns, and a full-width row

```html
<div class="form-grid" data-columns="2">
  <label class="field">
    <span class="field__label">First name</span>
    <input class="field__input" name="first">
  </label>
  <label class="field">
    <span class="field__label">Last name</span>
    <input class="field__input" name="last">
  </label>
  <label class="field" data-span="full">
    <span class="field__label">Where should the reply go</span>
    <input class="field__input" type="email" name="reply" required>
    <span class="field__hint">Spanning the whole row because it was asked to.</span>
  </label>
  <label class="field">
    <input type="checkbox" class="field__box" name="terms" value="yes" required>
    <span class="field__label">I agree to be contacted</span>
  </label>
</div>
```
