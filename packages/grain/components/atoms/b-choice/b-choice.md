# Choice (from data)

The select sibling of the [Field](../b-field/b-field.md), for when the options are data too. Its
own template nests an `each` over the item's `options` array, so one tag renders every choice in
the form and every option inside each one:

```
<form><b-choice each="choices"></b-choice></form>
```

The item shape is label, name, surface and an `options` array of `{ value, label, selected }`.
Nesting is what earns this a component of its own: a select cannot be built from a flat field spec
without a second array, and the nested `each` handles it at the same depth as everything else.

```json
{ "surface": "field:contact-topic", "label": "About", "name": "topic",
  "options": [ { "value": "grain", "label": "GRAIN", "selected": null },
               { "value": "hiring", "label": "Hiring", "selected": "selected" } ] }
```

Like [Select](../b-select/b-select.md), it contributes no frame of its own: the `.field` label and
`.field__select` rules live in `b-input.css` and `b-select.css`, and the native dropdown arrow is
kept, so nothing here needs a color.

## What it renders

```html
<label class="field">
  <span class="field__label">About</span>
  <select class="field__select" data-surface="field:contact-topic" name="topic">
    <option value="grain">GRAIN</option>
    <option value="hiring" selected="selected">Hiring</option>
  </select>
</label>
```

## Writing to one, and why it is not the same as writing to a field

The address sits on the select, so a choice is addressable exactly like a text field. What it is not
is safe to write to carelessly. A select passes the same check a text input does, and assigning it a
string that is not one of its option values does not fail: it sets the value to the empty string, so
the control goes blank and nothing is logged. Anything writing to a choice has to send an option
value, never a label, and the caller is the one that has to know the difference. Measured against a
real page on 2026-08-13.
