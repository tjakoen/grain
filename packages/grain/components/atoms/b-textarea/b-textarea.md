# Textarea

A labelled multi-line field: the long-answer sibling of the [Input](../b-input/b-input.md).
As a component: `<b-textarea name="message" label="Message" rows="6" required />`. As in the input,
`required` is a bare boolean and the tag may self-close.

This is the rule the field family was missing. The AI layer could always type into a textarea, since
the dispatcher handles the tag by name in the same branch as an input, so a page that wanted a
message box had to hand-author one with no frame, no sizes and no AI treatment. It has one now, and
the data-first sibling is [Memo](../b-memo/b-memo.md).

Height is a plain `rows` attribute. Without one the box comes up four lines tall, which is a
stylesheet rule composed from the type tokens rather than a fixed height, so re-skinning the type
scale moves it. Resizing is vertical only: a reader can grow the box, and the layout can never be
pushed sideways by it. The inline variant the `.field` frame offers works here, because it is
declared on `.field` itself, but a label beside a paragraph box reads badly and stacked is the
sensible default.

## States

### Default
```html
<label class="field">
  <span class="field__label">Message</span>
  <textarea class="field__textarea" name="message" rows="4" placeholder="What's on your mind?"></textarea>
</label>
```

### Filled
```html
<label class="field">
  <span class="field__label">Message</span>
  <textarea class="field__textarea" name="message" rows="4">Two lines of a real answer,
so the line height is visible rather than described.</textarea>
</label>
```

### Focus
```html
<label class="field">
  <span class="field__label">Message</span>
  <textarea class="field__textarea" name="message" rows="4" data-force="focus"></textarea>
</label>
```

### AI is writing (grain ink)
```html
<label class="field" data-commit="pending">
  <span class="field__label">Message</span>
  <textarea class="field__textarea" name="message" rows="4" data-grade="grain">Drafted by the desk, still the AI's ink until you touch it.</textarea>
</label>
```

## Sizes

### Small
```html
<label class="field" data-size="sm">
  <span class="field__label">Message</span>
  <textarea class="field__textarea" name="message" rows="3"></textarea>
</label>
```

### Large
```html
<label class="field" data-size="lg">
  <span class="field__label">Message</span>
  <textarea class="field__textarea" name="message" rows="3"></textarea>
</label>
```
