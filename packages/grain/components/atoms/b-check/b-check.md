# Check (from data)

The data-first sibling of the [Checkbox](../b-checkbox/b-checkbox.md) and the
[Radio](../b-radio/b-radio.md), and the fourth member of the family
[Field](../b-field/b-field.md), [Choice](../b-choice/b-choice.md) and [Memo](../b-memo/b-memo.md)
started. Use it when the boxes arrive as data rather than as markup. One atom covers both controls
where the authoring side needs two, because here the type is a binding, and a binding replaces where
a config property appends. Items carry label, name, type, value, checked, required, surface, hint and
error, every key present and null where unset. A group of radios is simply every item sharing one
name.

**The address is a check address, never a field one.** This atom shipped without an address at all,
because a checkbox's value is what the form submits when it is ticked rather than whether it is
ticked, and the only verb the vocabulary had for a field wrote that value: it would have landed,
reported success, changed what the form means and left the control looking untouched. The verb that
can tick a box exists now, so the surface reads `check:digest` and the kind it names accepts that
verb and no other. Give an item a `field:` address and the tick box goes back to advertising the
write that lies, so the prefix is not a formatting detail.

## What it renders

```html
<label class="field">
  <input type="checkbox" class="field__box" name="digest" value="yes" checked="checked"
         data-surface="check:digest">
  <span class="field__label">Send me the monthly digest</span>
</label>
```

The spec behind one item. Both message slots take null when there is nothing to say:

```json
{ "label": "Send me the monthly digest", "name": "digest", "type": "checkbox", "value": "yes",
  "checked": "checked", "required": null, "surface": "check:digest", "hint": null, "error": null }
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
    "checked": "checked", "required": null, "surface": "check:reply-email", "hint": null, "error": null },
  { "label": "Reply by phone", "name": "reply", "type": "radio", "value": "call",
    "checked": null, "required": null, "surface": "check:reply-call", "hint": "Only if you leave a number.", "error": null }
] }
```

A radio takes its own address per item rather than one for the group, because a verb operates a
control and a group is not one. What the verb will not do is clear a radio: a group with nothing
selected is a state no click can reach, so the request is refused rather than granted, and the way
to move a group is to tick the option you want.
