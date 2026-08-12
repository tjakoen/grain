# Field (from data)

The data-first sibling of the [Input](../b-input/b-input.md). Same control, same frame, different
author. Reach for `b-input` when you know the field while you are typing the page; reach for
`b-field` when the fields arrive as data and you want one tag to render all of them:

```
<form><b-field each="fields" size="sm"></b-field></form>
```

Two rules make it work, and both are the renderer's, not this atom's. **Config props are form-wide**:
a literal `size` or `variant` on the tag reaches every item of the `each`, so presentation is set
once. **Data is per item**: label, name, type, placeholder, value and required come from the item
itself. Each item may also carry a `surface`, which lands as `data-surface="field:…"` and makes the
generated field addressable by the AI through `field.set` with nothing to register by hand.

The spec is JSON, and every item carries every key. A key left out logs an unknown-binding warning
in dev; a key set to `null` renders nothing and stays quiet. `required` is the one that surprises
people: bind it as the string `"required"`, because an empty bound value drops the attribute.

```json
{ "surface": "field:contact-name", "label": "Name", "name": "name",
  "type": "text", "placeholder": "Jane", "value": null, "required": "required" }
```

There is no CSS here. The frame, the sizes, the inline variant and the AI treatment all come from
`b-input.css`, which is the point: two components, one control, no drift.

## What it renders

```html
<label class="field" data-surface="field:contact-name">
  <span class="field__label">Name</span>
  <input class="field__input" name="name" type="text" placeholder="Jane" required="required">
</label>
```

## Inline (form-wide config)

```html
<label class="field" data-variant="inline" data-surface="field:contact-email">
  <span class="field__label">Email</span>
  <input class="field__input" name="email" type="email" placeholder="jane@example.com">
</label>
```
