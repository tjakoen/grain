# Check (from data)

The data-first sibling of the [Checkbox](../b-checkbox/b-checkbox.md) and the
[Radio](../b-radio/b-radio.md), and the fourth member of the family
[Field](../b-field/b-field.md), [Choice](../b-choice/b-choice.md) and [Memo](../b-memo/b-memo.md)
started. Reach for the checkbox or the radio when you know the boxes while you are typing the page;
reach for this when they arrive as data:

```
<form><b-check each="options" size="sm"></b-check></form>
```

One atom covers both controls here, where the authoring-time side needs two. The difference is the
marker: a config property is appended beside whatever the template already declares, so a literal
type can never be overridden, while a binding replaces. So the type comes from the item, and a group
of items all carrying radio renders a radio group, all carrying checkbox renders independent boxes.
The name comes from the item too, which is what makes a radio group possible at all: every button in
one group carries the same name, and a form-wide property would have forced that on every group the
page renders rather than on the ones that want it.

The item shape is label, name, type, value, checked, required, hint and error. Every item carries
every key, null where unset, or a missing one logs an unknown-binding warning in dev. Two of them
have a shape worth stating: checked is bound as the string checked and not as an empty one, because
an empty bound value drops the attribute entirely, and type has no default. There is no literal type
in this template, since a literal would win over the binding, so an item without one renders a text
input in a checkbox's clothes. That is ugly rather than silent, which is the trade taken deliberately.

## Why this one carries no address

Every other atom in this family binds a surface, and the reason it can is that the vocabulary has a
verb which operates the control: field.set resolves the address and writes the value. A tick box has
a value too, and that is exactly the problem. A checkbox's value is what the form submits when the
box is ticked, not whether it is ticked, so a write would land, report success, change what the form
means and leave the control looking untouched. That is worse than the hazard a
[Choice](../b-choice/b-choice.md) carries, where a bad write at least visibly empties the control.

So this atom ships no surface binding, and it is not an oversight to be tidied up later. An address
is a promise that the operations advertised for its kind can be performed on it, and there is no verb
in the vocabulary today that can tick a box. When one exists, the binding goes on the input and this
paragraph goes away. Until then the honest thing is a control the AI can see and cannot pretend to
have set.

## What it renders

```html
<label class="field">
  <input type="checkbox" class="field__box" name="digest" value="yes" checked="checked">
  <span class="field__label">Send me the monthly digest</span>
</label>
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

## The spec behind it

```json
{
  "options": [
    { "label": "Reply by email", "name": "reply", "type": "radio", "value": "email",
      "checked": "checked", "required": null, "hint": null, "error": null },
    { "label": "Reply by phone", "name": "reply", "type": "radio", "value": "call",
      "checked": null, "required": null, "hint": "Only if you leave a number.", "error": null }
  ]
}
```
