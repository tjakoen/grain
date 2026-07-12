# Chip group

A set of selectable pills acting as a form control (single- or multi-select) — a filter
bar / tag picker / facet control. Native inputs → zero JS, form-postable, keyboard + AX
for free. Monochrome selected state: ink vs muted, not hue.

Parent-context note: a chip is a `<label class="chips__chip">` child of a
`<fieldset class="chips">` — the checkbox/radio + a `<span>` for the visible text live
inside the label; the fieldset owns the layout (`display: flex; flex-wrap: wrap`) and the
`data-select` attribute. A `chips__chip` outside a `.chips` fieldset has no layout context.

A chip's value may carry `data-surface="…"` so an AI can address one selection later —
this is a plain attribute hook only; it does not add a surface kind or action to
`ai/contract.ts`.

## Multi-select
```html
<fieldset class="chips" data-select="multi">
  <label class="chips__chip"><input type="checkbox" name="env" value="staging" checked><span>staging</span></label>
  <label class="chips__chip"><input type="checkbox" name="env" value="prod"><span>prod</span></label>
  <label class="chips__chip"><input type="checkbox" name="env" value="local"><span>local</span></label>
</fieldset>
```

## Single-select
```html
<fieldset class="chips" data-select="single">
  <label class="chips__chip"><input type="radio" name="priority" value="low"><span>Low</span></label>
  <label class="chips__chip"><input type="radio" name="priority" value="medium" checked><span>Medium</span></label>
  <label class="chips__chip"><input type="radio" name="priority" value="high"><span>High</span></label>
</fieldset>
```

## Selected + focus
The checked chip reads ink vs faint (monochrome, no hue); a keyboard focus on a chip's
hidden input shows the same accent focus ring as the rest of the field family.
```html
<fieldset class="chips" data-select="multi">
  <label class="chips__chip"><input type="checkbox" name="tag" value="urgent" checked><span>urgent</span></label>
  <label class="chips__chip"><input type="checkbox" name="tag" value="backlog"><span>backlog</span></label>
</fieldset>
```
