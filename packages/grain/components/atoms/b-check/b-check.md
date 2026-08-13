# Check (from data)

The data-first sibling of the [Checkbox](../b-checkbox/b-checkbox.md) and the
[Radio](../b-radio/b-radio.md), and the fourth member of the family
[Field](../b-field/b-field.md), [Choice](../b-choice/b-choice.md) and [Memo](../b-memo/b-memo.md)
started. Use it when the boxes arrive as data rather than as markup. One atom covers both controls
where the authoring side needs two, because here the type is a binding, and a binding replaces where
a config property appends. Items carry label, name, type, value, checked, required, hint and error,
every key present and null where unset. A group of radios is simply every item sharing one name.

**This atom carries no address, and that is deliberate.** A checkbox's value is what the form submits
when it is ticked, not whether it is ticked, so the one verb the vocabulary has for a field would
land, report success, change what the form means and leave the control looking untouched. An address
would advertise an operation nothing can perform. The reason is kept as a conformance test, and the
full account is in the plan beside this component.

## What it renders

```html
<label class="field">
  <input type="checkbox" class="field__box" name="digest" value="yes" checked="checked">
  <span class="field__label">Send me the monthly digest</span>
</label>
```

The spec behind one item. Both message slots take null when there is nothing to say:

```json
{ "label": "Send me the monthly digest", "name": "digest", "type": "checkbox", "value": "yes",
  "checked": "checked", "required": null, "hint": null, "error": null }
```

## A radio group, from one array

```html
<div>
  <label class="field">
    <input type="radio" class="field__box" name="reply" value="email" checked="checked">
    <span class="field__label">Reply by email</span>
  </label>
  <label class="field">
    <input type="radio" class="field__box" name="reply" value="call">
    <span class="field__label">Reply by phone</span>
    <span class="field__hint">Only if you leave a number.</span>
  </label>
</div>
```

Every item carries the same name, which is what makes the group exclusive:

```json
{ "options": [
  { "label": "Reply by email", "name": "reply", "type": "radio", "value": "email",
    "checked": "checked", "required": null, "hint": null, "error": null },
  { "label": "Reply by phone", "name": "reply", "type": "radio", "value": "call",
    "checked": null, "required": null, "hint": "Only if you leave a number.", "error": null }
] }
```
