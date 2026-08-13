# Memo (from data)

The data-first sibling of the [Textarea](../b-textarea/b-textarea.md), and the third member of the
family [Field](../b-field/b-field.md) and [Choice](../b-choice/b-choice.md) started. Use it when the
boxes arrive as data. The item shape is label, name, placeholder, value, required, hint, error and
surface. There is no type, because a textarea has none, and no rows either: height is presentation,
so it rides on the tag as form-wide config, the split every atom in this family makes.

**The one thing this atom does differently:** a textarea has no value attribute. Its value is its
content, so the item's value binds as content rather than as an attribute. Bound as an attribute the
browser ignores it completely, the box comes up empty, nothing warns, and the spec looks right. Worth
knowing before anyone copies the Field's line into a textarea.

Writing to one is safe in a way a [Choice](../b-choice/b-choice.md) is not: any string is a legal
textarea value, so there is nothing it can be handed that empties it.

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
