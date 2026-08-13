# Form grid

The layout the field family never had. A field is told to grow inside a column, which says nothing
about how several sit together, so every form so far laid itself out by hand. CSS only, so there is
no tag: put the class on whatever holds the controls, hand-authored or generated, and it asks nothing
of its own parent.

Columns are found rather than declared by default, flowing into as many tracks as fit down to a
minimum width a page can raise. A fixed count is an attribute, and it collapses to one column on a
narrow screen. Two rules make one mistake unmakeable: a message box takes the full width without
being asked, and fields align to the top so one carrying a hint cannot drag its neighbours down.

**One limit.** That collapse keys off the viewport rather than the container, so a fixed count inside
a narrow panel keeps its columns and the fields get cramped. The found columns have no such problem,
because their floor is a width rather than a count. Prefer them wherever the container can be much
narrower than the window.

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
