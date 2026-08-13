# Field (from data)

The data-first sibling of the [Input](../b-input/b-input.md). Same control, same frame, different
author: reach for the Input when you know the field while typing the page, and for this when the
fields arrive as data and one tag should render all of them.

Two rules make it work and both are the renderer's. Config properties are form-wide, so a literal
size or variant on the tag reaches every item. Data is per item: label, name, type, placeholder,
value, required, hint and error. Every item carries every key, null where unset, because a key left
out warns in development and an explicit null stays quiet. An item may also carry a surface, which
lands on the input itself and makes the generated field addressable, and it sits on the control
rather than the label around it because a label has nothing to write into.

There is no CSS here. The frame, the sizes, the inline variant and the AI treatment all come from
b-input.css, which is the point: two components, one control, no drift.

## What it renders

One item of the spec, and the markup it becomes:

```json
{ "surface": "field:contact-name", "label": "Name", "name": "name",
  "type": "text", "placeholder": "Jane", "value": null, "required": "required",
  "hint": null, "error": null }
```

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
