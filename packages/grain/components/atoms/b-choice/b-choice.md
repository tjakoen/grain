# Choice (from data)

The select sibling of the [Field](../b-field/b-field.md), for when the options are data too. Its own
template nests an each over the item's options array, so one tag renders every choice in the form and
every option inside each one. That nesting is what earns it a component of its own: a select cannot
be built from a flat field spec without a second array.

The item shape is label, name, surface, hint, error and an options array of value, label and
selected. Like [Select](../b-select/b-select.md) it contributes no frame of its own, and the native
dropdown arrow is kept, so nothing here needs a color.

**One caller rule.** A select accepts a write that a text input would, and anything that is not one
of its option values does not fail: it sets the value to an empty string, so the control goes blank
and nothing is logged. Send option values, never labels. Measured against a real page on 2026-08-13.

## What it renders

One item of the spec, and the markup it becomes:

```json
{ "surface": "field:contact-topic", "label": "About", "name": "topic",
  "hint": null, "error": null,
  "options": [ { "value": "grain", "label": "GRAIN", "selected": null },
               { "value": "hiring", "label": "Hiring", "selected": "selected" } ] }
```

```html
<label class="field">
  <span class="field__label">About</span>
  <select class="field__select" data-surface="field:contact-topic" name="topic">
    <option value="grain">GRAIN</option>
    <option value="hiring" selected="selected">Hiring</option>
  </select>
</label>
```
