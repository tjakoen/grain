# Memo (from data)

The data-first sibling of the [Textarea](../b-textarea/b-textarea.md), and the third member of the
family [Field](../b-field/b-field.md) and [Choice](../b-choice/b-choice.md) started. Reach for
`b-textarea` when you know the box is there while you are typing the page; reach for `b-memo` when
the fields arrive as data: `<form><b-memo each="messages" rows="6" size="sm"></b-memo></form>`.
The item shape is label, name, placeholder, value, required, hint, error and surface. There is no `type`, because
a textarea has none, and there is no `rows` either: height is presentation, so it is a form-wide
config prop on the tag alongside `size` and `variant`, the same split every atom in this family
makes. Every item carries every key, `null` where unset, or a missing one logs an unknown-binding
warning in dev.
**The one thing this atom does differently:** a textarea has no `value` attribute. Its value is its
content, so the item's `value` binds through `data-field`, not through `data-bind-value`. Bind it as
an attribute and the browser renders a `value` it ignores completely: the box comes up empty, nothing
warns, and the spec looks right. That is the same class of silent failure as addressing the label,
and it is worth knowing before someone copies b-field's line into a textarea.
**Writing to one:** the address sits on the textarea, so a generated message box is a `field.set`
target with nothing to register by hand, and unlike a [Choice](../b-choice/b-choice.md) there is no
value it can be handed that empties it, since any string is a legal textarea value. The dispatcher
has always typed into a textarea through the same branch as an input, so what was missing was never
the operation, only the control.

## What it renders

```html
<label class="field">
  <span class="field__label">Message</span>
  <textarea class="field__textarea" data-surface="field:contact-message" name="message"
    placeholder="What would you like to say?"></textarea>
</label>
```

## Six rows, form-wide (config)

```html
<label class="field" data-size="sm">
  <span class="field__label">Message</span>
  <textarea class="field__textarea" data-surface="field:contact-message" name="message" rows="6"></textarea>
</label>
```
