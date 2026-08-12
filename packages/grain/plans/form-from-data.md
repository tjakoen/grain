# `b-field`: forms from data (DRAFT)

> **Status: DRAFT 2026-08-13.** Written for owner review, nothing built. Origin: the forms-from-data
> research pass of 2026-08-12, which asked whether GRAIN needs a form builder and concluded that it
> does not. Every claim below marked *probed* was produced by running `createRenderer` and reading
> its output, not by reading the engine. Sibling spec: [`field-set-op.md`](field-set-op.md), which
> owns how the AI writes into a field once it exists.

## The move it enables

A form whose fields come from data. The field list lives as JSON next to `cv.json` and
`mailbox.json`, the page composes one tag, and the renderer produces N different labelled inputs:

```html
<form><b-field each="fields" size="sm"></b-field></form>
```

Every rendered field carries `data-surface="field:…"` straight from its own item, so a generated
form is AI-operable the moment it renders. `field.set` reaches each field with no hand registration
and no second mechanism. That is the payoff, and it is the reason this is worth building at all:
the AI half comes free.

**No renderer change.** Not one line in BATCH. This spec adds three component files and a JSON
shape, and it uses only markers the engine already ships.

## Design laws honored

- **The vocabulary grows reluctantly** (contract.ts header): zero new verbs, zero new surface kinds,
  zero new markup markers. `each`, `data-field` and `data-bind-*` already do this.
- **`b-input` stays exactly as it is.** `b-field` is a data-first *sibling*, not a replacement and
  not a retrofit. Both ship. An author who knows their fields at authoring time writes `b-input`;
  an author whose fields come from data writes `b-field`. Binding both ways on one element collides,
  which is why this is two components and not one clever one.
- **One class per component, variants as attributes.** These three atoms introduce **no new CSS
  class**. They reuse the `.field` / `.field__label` / `.field__input` / `.field__select` frame that
  `b-input.css` already declares, so the AI treatment, the focus ring, the sizes and the inline
  variant all arrive for free and cannot drift from `b-input`.
- **No outer margin, no hardcoded values.** Nothing new to style, so nothing new to get wrong.
- **Parent-context requirement stated in the `.md`**, per grain lesson 3: `b-option` renders a bare
  `<option>` and is meaningless outside `b-choice`.

## 1. What the probe settled

Six results, all reproduced on 2026-08-13 against `batch/render/render.ts`.

1. **`each` over a data-first component works.** One template, N different fields, each with its own
   label, name, type, placeholder and required flag.
2. **A nested `each` renders a select's options** from the item's own array, so choices work at the
   same depth.
3. **`data-bind-data-surface="surface"` sets `data-surface="field:name"` from data.** The AI half is
   free, as above.
4. **Config props and `each` coexist.** Literal attributes on the tag are collected as `childProps`
   and passed to *every* item (`render.ts:169` and `:176`). So `<b-field each="fields" size="sm">`
   applies one size to the whole form while per-item data drives the content. This is the clean
   split the design rests on: **presentation is form-wide config, content is per-item data.**
5. **An absent key warns; an explicit `null` does not.** `resolvePath` reports `found: true` for a
   key whose value is `null` (`render.ts:24`), and `format(null)` is the empty string, so the
   attribute is dropped silently. A key left out entirely logs `[render] unknown binding` because
   `missing` is `warn` in dev. **Rule: the field spec always emits every key, using `null` for
   "not set".** This dissolves the third blocker the research pass recorded.
6. **A boolean attribute cannot be bound as an empty string.** `data-bind-required` with `""` is
   dropped, because the engine omits an attribute whose bound value is empty (`render.ts:154`). The
   spec therefore carries `"required": "required"`, which is valid HTML and renders
   `required="required"`. Bare `required` is reachable only through a config prop, and a config prop
   is form-wide, which is wrong for a per-field flag.

### A defect found on the way

`b-list.html` carries `each="items"` on a plain `<li>`. **It never fires.** PASS 2 walks only known
component tags (`render.ts:163`), so `each` on an ordinary element is inert, and the sibling
`data-field="."` then prints `[object Object]` when the atom is handed real data. The atom works
only when a page authors its `<li class="list__item">` children by hand, which its own `.md` shows
and its comment contradicts. Grain's `CLAUDE.md` also lists `b-list` among the data-driven atoms
that skip `.html`, and it has one. This is out of scope here and belongs in its own fix; it is
recorded so the next reader does not copy the pattern.

## 2. The three atoms

### `b-field`

```html
<!-- atoms/b-field — a labelled text field built from DATA (the data-first sibling of b-input).
     Content per item: label, name, type, placeholder, value, required, surface.
     Presentation form-wide: size, variant (config props, applied to every item of an each). -->
<label class="field" prop-attr-data-size="size" prop-attr-data-variant="variant"
       data-bind-data-surface="surface">
  <span class="field__label" data-field="label">Label</span>
  <input class="field__input"
         data-bind-name="name" data-bind-type="type" data-bind-value="value"
         data-bind-placeholder="placeholder" data-bind-required="required">
</label>
```

### `b-choice`

```html
<!-- atoms/b-choice — the select sibling of b-field. Options come from the item's own
     `options` array via a nested each. Same .field frame, same config props. -->
<label class="field" prop-attr-data-size="size" prop-attr-data-variant="variant"
       data-bind-data-surface="surface">
  <span class="field__label" data-field="label">Label</span>
  <select class="field__select" data-bind-name="name">
    <b-option each="options"></b-option>
  </select>
</label>
```

### `b-option`

```html
<!-- atoms/b-option — one <option>. Only meaningful inside b-choice's select. -->
<option data-bind-value="value" data-bind-selected="selected" data-field="label">Option</option>
```

No `.css` file for any of the three. That is the point: the frame is `b-input.css`, and a second
stylesheet describing the same control is how two components drift apart.

## 3. The field spec

Lives as JSON in the consuming app, next to its other content data. Grouped by kind, because
nothing branches by kind (§4).

```json
{
  "fields": [
    { "surface": "field:contact-name",  "label": "Name",  "name": "name",
      "type": "text",  "placeholder": "Jane", "value": null, "required": "required" },
    { "surface": "field:contact-email", "label": "Email", "name": "email",
      "type": "email", "placeholder": null,   "value": null, "required": null }
  ],
  "choices": [
    { "surface": "field:contact-topic", "label": "About", "name": "topic",
      "options": [ { "value": "grain",  "label": "GRAIN",  "selected": null },
                   { "value": "hiring", "label": "Hiring", "selected": "selected" } ] }
  ]
}
```

Every key present on every item, `null` where unset, per probe result 5. A generator writing this
JSON emits the full key set or the page is noisy in dev.

## 4. Why there is no polymorphic field atom

`each` renders one component per item and a component cannot choose which component it is. A mixed,
interleaved list of text fields, selects and checkboxes needs one of two things:

- **Separate arrays per kind**, which is what §3 does. It costs no renderer change and it loses
  interleaved ordering: all the text fields, then all the choices.
- **A polymorphic binding**, some `data-as="kind"` that picks the component per item. That is a real
  addition to BATCH's markup vocabulary, it belongs in a BATCH spec rather than a grain one, and it
  is exactly the kind of growth the vocabulary law says to earn first.

**v1 groups by kind and skips interleaving.** If a real form wants a select in the middle, the page
composes two tags in the order it wants and the JSON carries two arrays. That is honest markup, not
a workaround, and it defers a vocabulary decision until something needs it.

## 5. The `.field` gaps, sequenced separately

None of these block §2, and none of them should be smuggled into it. Each is its own small change:

1. **A textarea atom.** `field.set` already targets `TEXTAREA`, and `.field` has no textarea rule at
   all, so the op currently has a target the design system does not draw.
2. **Checkbox and radio.** `b-switch` exists but is a switch, not a checkbox in a `.field` frame.
3. **`.field__hint` and `.field__error`.** Validation today is `:user-invalid` bumping the border
   width, with nowhere to say what went wrong.
4. **A required marker.** The attribute is bound; nothing shows the reader which fields are required.
5. **A form-grid layout.** `.field` is `flex: 1` in a column and there is no component that lays
   several fields out.

## 6. What this deliberately does not do

- **No submit, anywhere.** No submit verb exists in the vocabulary by design (`field-set-op.md`),
  and BATCH's `http/` has no POST, no formData and no CSRF helper. A form on a static Pages site has
  nothing to submit to; the portfolio's `/mail` builds a `mailto:` in an inline script.
- **No validation engine.** Native constraints only, as today.
- **No schema-driven form builder.** Wrong layer. A generator producing markup could not author that
  markup in the binding vocabulary without becoming a second parallel system, and the thing people
  reach for a builder to get, N fields from one description, is what §2 already does in three files.
- **No new render op and no contract change.** `field.set` and `fill` cover the AI side unchanged.

## 7. Tests

- **`render` integration** (grain-side, colocated): `b-field` under `each` produces N labelled
  inputs with distinct names; `b-choice` renders its options through the nested `each`;
  `data-surface` lands from data; config props reach every item of an `each`.
- **The null contract:** a spec item with every key present and `null` values renders without a
  single `[render] unknown binding` warning. This is the test that keeps result 5 from rotting.
- **The boolean contract:** `"required": "required"` emits the attribute; `""` does not. A drift
  guard, since the engine behaviour it depends on lives in another repo.
- **Conformance e2e:** a generated field is on the manifest as a `field:` surface and `field.set`
  reaches it, which is the whole reason for the `surface` key.
- **`tokens.test`:** nothing new to check, since no CSS ships, and that is worth asserting once so
  the next person does not add a stylesheet here by reflex.

## 8. Open questions for the owner

1. **Names.** `b-field` / `b-choice` / `b-option`, or plural collection atoms in the `b-list` shape?
   The plural shape is what `b-list` was reaching for, and probe result 1 shows the singular shape
   is the one that actually works today.
2. **Where the spec JSON lives.** The portfolio's `content/data/`, per the research pass, or does
   grain ship an example spec of its own for the catalog?
3. **Whether `b-input` eventually retires.** This spec says no, both ship. The cost is two
   components documenting one control, and the `.md` files have to say plainly which is which.
4. **Whether §5 item 1, the textarea, jumps the queue.** `field.set` targets textareas today and the
   design system has no rule for them, which is a live gap rather than a future one.

## Rollout (after approval)

grain: `b-field` + `b-choice` + `b-option` templates and their `.md` catalog docs, then the render
tests, then the catalog entries. No CSS, no contract change, no version-sensitive surface, so this
is a normal grain change followed by the usual bump and publish. The portfolio side, a real form
built from JSON, is separate and later, and it is the thing that will find whatever this spec got
wrong.
