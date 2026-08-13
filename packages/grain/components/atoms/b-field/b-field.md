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
itself. Each item may also carry a `surface`, which lands as `data-surface="field:…"` **on the input
itself** and makes the generated field addressable by the AI through `field.set` with nothing to
register by hand. The address sits on the control rather than on the label around it for a concrete
reason: `field.set` resolves the address and then writes `el.value`, and a label has no value, so an
address one level up is an address the write is dropped at, silently. The first real form built from
this atom found exactly that.

The spec is JSON, and every item carries every key. A key left out logs an unknown-binding warning
in dev; a key set to `null` renders nothing and stays quiet. `required` is the one that surprises
people: bind it as the string `"required"`, because an empty bound value drops the attribute.

Two more keys arrive with the frame's message slots, `hint` and `error`. Both are per-item data
rather than form-wide, because what to say about one field is the least form-wide thing there is, and
both collapse to nothing when null, which is what makes it safe for a generator to emit them on every
item without deciding anything. A required item also needs no marker in the spec: the frame reads the
attribute and marks the label itself.

```json
{ "surface": "field:contact-name", "label": "Name", "name": "name",
  "type": "text", "placeholder": "Jane", "value": null, "required": "required",
  "hint": null, "error": null }
```

There is no CSS here. The frame, the sizes, the inline variant and the AI treatment all come from
`b-input.css`, which is the point: two components, one control, no drift.

## What it renders

```html
<label class="field">
  <span class="field__label">Name</span>
  <input class="field__input" data-surface="field:contact-name" name="name" type="text"
         placeholder="Jane" required="required">
</label>
```

## Inline (form-wide config)

```html
<label class="field" data-variant="inline">
  <span class="field__label">Email</span>
  <input class="field__input" data-surface="field:contact-email" name="email" type="email"
         placeholder="jane@example.com">
</label>
```
