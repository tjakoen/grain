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
   free, as above. **Corrected 2026-08-13 by building it: the binding works and the conclusion does
   not.** See "What building it contradicted" below.
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

### What building it contradicted

The portfolio built the first real form on 2026-08-13 (its `/about` Contact tab, then the `/builder`
demo), and the build contradicted result 3's conclusion. The binding works exactly as probed. The
conclusion drawn from it does not.

**`data-surface` lands on the wrapping `<label>`, and a label cannot be filled.** Both atoms carry
`data-bind-data-surface="surface"` on the `.field` label, so a generated field's address resolves to
the label rather than to the `<input>` or `<select>` inside it. Grain's own dispatcher resolves
`document.querySelector('[data-surface=…]')` and then gates on `"value" in el`. A label has no
`value`, so a `field.set` aimed at a generated field silently does nothing. Measured in the live
page: all three addresses on `/about` resolve to `LABEL`, `"value" in el` false for every one.

So **the AI half is not free after all**, and the sentence that says it is was the load-bearing claim
of this whole spec. B1's `field:contact-message` never hit this because that surface sits on a bare
`<textarea>` a page authored by hand, not on an atom rendered through `each`.

The portfolio works around it in its own page, moving each address down onto its own control after
render, and that workaround is deliberately **text inputs only**. The same `"value" in el` guard
passes on a `<select>`, and assigning a select anything that is not one of its option values sets
`.value` to the empty string, so the control goes blank with no warning at all. Measured the same
day. Leaving a choice's address on its label makes a stray write inert instead of destructive, which
is the safer of the two failure modes.

**CLOSED the same day, by the owner's call: the binding moved onto the control.** `b-field` binds the
surface on its `<input>` and `b-choice` on its `<select>`, the conformance test now asserts *where* the
address lands rather than only that the binding exists, and the portfolio deleted the script it had
been carrying to move each address down by hand. Result 3 is true for the first time: measured on the
live page, all three addresses resolve to a fillable control and the desk writes into a generated
field with nothing registered by hand.

**What stays open is the select, and it is a caller problem now rather than an addressing one.** A
choice is reachable like anything else, and a write that is not one of its option values empties it
instead of failing. `b-choice.md` says so plainly, and the demo's own draft code refuses to draft a
value for a choice at all. Guarding the dispatcher against a write it cannot land is the obvious next
move and it was deliberately not taken here.

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

1. **A textarea atom. BUILT 2026-08-13** (`b-textarea` + `b-memo`, see §5a below). `field.set`
   already targeted `TEXTAREA`, and `.field` had no textarea rule at all, so the op had a target the
   design system did not draw. The owner pulled this forward ahead of the rest of the list.
2. **Checkbox and radio. BUILT 2026-08-13** (`b-checkbox` + `b-radio` + `b-check`, see §5b).
   `b-switch` exists but is a switch, not a checkbox in a `.field` frame.
3. **`.field__hint` and `.field__error`. BUILT 2026-08-13.** Validation today is `:user-invalid`
   bumping the border width, with nowhere to say what went wrong.
4. **A required marker. BUILT 2026-08-13.** The attribute is bound; nothing shows the reader which
   fields are required.
5. **A form-grid layout. BUILT 2026-08-13.** `.field` is `flex: 1` in a column and there is no
   component that lays several fields out.

The owner asked for all four in one answer on 2026-08-13 ("Lets cover all controls"), so they were
built as one bundle rather than as four small changes. The line above about not smuggling them into
§2 still holds and is the reason they came after it rather than with it.

## 5a. The textarea, built (2026-08-13)

Two atoms, not one, and the argument for that is the same one that made `b-input` and `b-field` two
components rather than one clever one.

**`b-textarea` is the authoring-time atom and it owns the stylesheet.** The actual gap was never a
missing template, it was a missing *rule*: `.field` had nothing to say about a multi-line control, so
a page that wanted a message box hand-authored a bare `<textarea>` with no frame, no sizes and no AI
treatment, which is exactly what the portfolio's `/mail` compose panel does to this day. Somebody has
to declare `.field__textarea`, and the data-first atoms cannot: they ship no CSS on purpose, and the
conformance test that enforces it is the thing keeping two components from becoming two designs.
`b-select` is the precedent, adding `.field__select` to a frame `b-input` owns.

**`b-memo` is the data-first sibling and it ships no CSS,** the way `b-field` and `b-choice` do not.
A single atom could not have covered both callers: config props resolve from a literal attribute on
the tag and are therefore identical for every item of an `each`, which is precisely what a per-field
label must not be. That collision is the whole reason this family is siblings rather than one
retrofit.

**Probed, not reasoned, on 2026-08-13 through `createRenderer`:**

1. **A textarea's value is its CONTENT.** It has no `value` attribute, so the item's `value` binds
   through `data-field` (`setInnerContent`), never `data-bind-value`. Bound as an attribute, the
   browser renders a `value="…"` it ignores: the box comes up empty, nothing warns, and the spec
   looks correct. Same shape of silent failure as the label addressing, and now a conformance test.
2. **The address lands on the `<textarea>`**, matching the fix `b-field` and `b-choice` took. Verified
   in the live page: `field.set` writes into a generated message box with nothing registered by hand.
3. **Height is form-wide config.** `rows` rides on the tag (`prop-attr-rows`) alongside `size` and
   `variant`, so it reaches every item of the `each` and never appears in the spec. A default of four
   lines comes from the stylesheet, composed from the type tokens rather than a fixed height.
4. **The null contract holds unchanged:** an explicit `null` value renders an empty box quietly, a
   missing key logs `[render] unknown binding`. Escaping and newlines survive the content binding.
5. **A message box has no select hazard.** Any string is a legal textarea value, so unlike a choice
   there is nothing a caller can send that empties it. The dispatcher already typed into `TEXTAREA`
   through the same branch as `INPUT`, so what was missing was only ever the control.

**The portfolio consumed it the same day.** `field-matcher.ts` carried a refusal whose stated reason
was this exact missing atom; the refusal was deleted rather than softened, a message entry joined the
closed set as its own array (a component cannot choose which component it is, §4), the `/about`
contact form grew a message box that its mail handoff now carries, and `/builder` renders one through
`<b-memo each="messages" rows="6">`. A refusal that outlives its cause is worse than no refusal:
it reads as a considered limit.

**Open, and small:** the name. `b-memo` is the role name the family uses (a field, a choice, a memo)
and it dodges `chat-message`, which a `b-message` would sit beside and read as a sibling of. Worth an
owner's minute, cheap to rename while nothing is published.

## 5b. The rest of the controls, built (2026-08-13)

The four remaining §5 gaps, in one bundle. Three new components, three rules added to the frame, one
new layout molecule, and one finding that stops the family's AI half short of the last control.

**Probed, not reasoned, through `createRenderer` before a line was written.** Four results, and two
of them decided the shape of what shipped:

1. **A config prop APPENDS its attribute; it does not replace a literal one already in the
   template.** `<b-checkbox type="radio">` over a template carrying a literal `type="checkbox"`
   renders `type="checkbox" type="radio"`, and the browser honors the first attribute and drops the
   second without complaint. So the obvious design, one tick-box atom with a `type` prop, produces a
   radio that is silently a checkbox. **This is why `b-checkbox` and `b-radio` are two files.** Each
   states its own type as a literal and neither offers a `type` prop at all.
2. **A DATA BINDING replaces, where a config prop appends.** `data-bind-type` lands the item's own
   type cleanly, so the data-first side does in one atom what the authoring side needs two for.
   `b-check` covers both controls, and a radio group is simply every item carrying the same `name`
   and a type of radio. That inversion between the two markers is worth remembering: it is the first
   case where the data-first side is the simpler of the two.
3. **A `prop-text` whose prop is not supplied leaves the template's own text in place.** So a hint
   slot carrying fallback text would print that fallback on every field nobody wrote a hint for. The
   slots ship with empty content and collapse under `:empty`, which is what makes it safe to put them
   in every template unconditionally. Invisible in a diff, so it is a conformance test now.
4. **The null contract holds unchanged for the new keys.** An explicit `null` hint renders an empty
   span that the stylesheet hides; a key left out entirely logs `[render] unknown binding`.

**What shipped.** `b-checkbox` is the authoring-time tick box and it owns `b-checkbox.css`, which
declares `.field__box` and the check row, the same division `b-textarea` makes for `b-memo` and
`b-select` for `b-choice`. `b-radio` is its twin and adds no rule of its own. `b-check` is the
data-first sibling and ships no CSS. The row layout keys off `.field:has(> .field__box)` rather than
off a modifier class, so composing the markup correctly is enough to get it and there is no variant
to forget. The native control is kept as the platform draws it, on the same argument `b-select` makes
about the dropdown arrow: it is accessible, it already distinguishes a tick from a dot, and drawing a
replacement would need a hardcoded color. The tap target is the whole row, because the label wraps
the input, and the row carries the ≥44px floor since a box and a line of text come to about half of it.

`.field__hint` and `.field__error` are declared in `b-input.css`, because they belong to the frame
rather than to any one control, and both hide when empty. An error is not a red one: status is weight
against the hint's fade, and `--color-danger` is hueless by default so a flavor that owns a hue can
reach it without the component naming a color. The required marker is `.field:has(:required)
.field__label::after`, which means no markup carries it, no author can forget it, every atom in the
family got it at once, and it cannot drift from the constraint the browser actually enforces.

`form-grid` is a CSS-only molecule. Auto-fit columns by default with a `min()` floor, because a bare
`minmax` floor wider than the screen scrolls a phone sideways and that bug only ever shows on a real
device. A fixed column count is an attribute and collapses to one column on a narrow screen. A message
box spans the full width without being asked, keyed off the control being present so it holds for a
hand-authored textarea and a generated one alike.

### The finding: the AI half stops at the tick box

**`b-check` carries no `surface` binding, and that is the honest answer rather than an oversight.**
Every other atom in this family is addressable because `field.set` can operate its control: it
resolves the address and writes `el.value`. A checkbox has a `value` too, and that is exactly the
problem. A checkbox's value is **what the form submits when the box is ticked**, not whether it is
ticked. So a `field.set` aimed at one passes the dispatcher's `"value" in el` guard, lands, reports
success, changes what the form means, and leaves the control looking untouched.

That is strictly worse than the select hazard recorded above, where a bad write at least blanks the
control visibly. And it cannot be fixed by moving the binding, the way the label addressing was:
there is no element to move it to. `field.set` is the only verb the vocabulary has that accepts a
`field` surface, and an address advertises in the manifest that the verbs for its kind are legal on
it. Addressing a tick box would be a documented promise the mechanism cannot render, which is
precisely what lesson 9 says never to ship.

So the atom ships unaddressable, the absence is a conformance test with the reason written next to
it, and the real fix is **a new verb, which is a contract change and therefore an owner's call.**
Something in the shape of a `field.toggle` that sets `checked` rather than `value`. Not taken here.

**ANSWERED 2026-08-13: add the verb.** The owner chose to grow the vocabulary rather than leave the
tick box out of the AI's reach. It is a separate unit of work and deliberately not smuggled into this
one, because it reaches further than any atom: `ai/contract.ts` gains the verb and decides which
surface kind accepts it, `scripts/ai-dispatch.js` gains a branch that sets `checked` and fires the
events a form listens for, the manifest starts advertising it, and only then does `b-check` get its
address and lose the test that asserts it has none. The order matters: the atom is the LAST step, not
the first, because an address that lands before the verb exists is the same false promise in the
other direction. Whoever takes it should also decide whether the verb accepts a `field` surface or
earns a kind of its own, since `field.set` and it would then both accept the same kind and only one
of them would work on any given control.

**Tests.** Eight new assertions in `form-from-data.test.ts`, each proved by mutation before it was
kept: the two literal types with no prop able to shadow them, `b-check` taking its type from data
with no literal to shadow the binding, the deliberate missing surface, both slots present in every
framed template, the empty-fallback rule, the frame declaring the collapse and the marker, and
form-grid shipping CSS only with its overflow floor intact. Gates: 600 unit green, `check` green.

**Open for the owner, and small:** the name `b-check` for the data-first atom, alongside the `b-memo`
naming question §5a already left open. The family now reads field, choice, memo, check.

## 6. What this deliberately does not do

- **No submit, anywhere.** No submit verb exists in the vocabulary by design (`field-set-op.md`),
  and BATCH's `http/` has no POST, no formData and no CSRF helper. A form on a static Pages site has
  nothing to submit to; the portfolio's `/mail` builds a `mailto:` in an inline script.
- **No validation engine.** Native constraints only, as today.
- **No schema-driven form builder that emits markup.** Wrong layer. A generator producing markup
  could not author that markup in the binding vocabulary without becoming a second parallel system,
  and the thing people reach for a builder to get, N fields from one description, is what §2 already
  does in three files. A builder that emits the **spec** instead of the markup is a different animal
  and it belongs in the portfolio, not here: see §8.
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

## 8. The demo this owes the portfolio: a form builder

These atoms are not finished when they render. They are finished when someone watches a form appear
from a sentence, and that demo belongs in the portfolio, where the desk persona lives. The engine
stays persona-neutral in grain, the showcase page does not.

**It is `DEMO-PLAN.md` piece 4, Tier 1, and it is the cheapest instance that plan has.** That piece
argues for a composition generator over a text generator: GRAIN's components are a closed,
machine-readable vocabulary, so "a contact card with mail and GitHub" is a **selection** problem
rather than a writing problem. A form is the purest case of it, because the thing the generator has
to emit **is not markup at all**. It is the JSON of §3. The page already knows how to turn that into
controls, so the generator's whole job is picking field kinds, labels, types and surfaces, which is
a list of choices from a closed set. Nothing has to write a `<label>`.

The shape of the page:

- **The prompt.** "A contact form with a name, an email and what they want to talk about."
- **The spec it produced,** shown as JSON, because the honest claim is that a small model chose keys
  from a closed set rather than that it wrote a form.
- **The form itself,** rendered live from that spec through `b-field` and `b-choice`, next to the
  one tag that rendered it. The tag never changes between runs, which is the point worth seeing.
- **The close, and this is the part that only GRAIN can do:** the desk then fills in the form it
  just generated, through `field.set`, against the `data-surface` values the spec carried. A
  generator that can also operate its own output is a different demo from a code generator, and it
  costs nothing extra because §1 result 3 already delivered it.

**The model is not the blocker, and this is the part that dates the old framing.** `DEMO-PLAN.md`
put the model tier after M★, but the desk has run a real in-browser Qwen2.5-0.5B since 2026-07-24,
and B1 already drives `field.set` from it on the portfolio's compose panel. So the demo is buildable
now, provided it obeys the rule that model has earned: **deterministic code selects, the model only
composes text.** A 0.5B that is allowed to enumerate invents slugs, and a field spec is a list of
slugs by another name. The honest split for this demo:

- **Deterministic code owns the spec.** Which kinds a description maps to, the `name` keys, the
  `type` values and every `surface` are chosen by a matcher over a closed set, the same way notes
  filtering picks tags and navigation picks routes. Widening the matcher beats tuning the prompt,
  which is the lesson that survived the whole desk retune.
- **The model owns the wording.** Labels, placeholders and the drafted values it later fills in.
  That is composition, which is what it is good at, and it is grain-graded ink when it lands.
- **The renderer is the validator.** A key the spec invents warns, and a kind that does not exist
  has no component to render, so an over-reaching run degrades to a missing field rather than a
  broken page.

A run driven this way is not a scripted run, so it does not need the scripted label. What it does
need is the audit scenario every desk candidate ships with, plus a fake-engine e2e, per the roadmap
bar. Track the flakiness honestly: the model tail varies run to run and always has.

**Say plainly what it does not do.** There is nothing to submit to, on this site or in this stack
(§6). The demo generates a form and prefills it; it never sends. That limit is the honest half of
the pitch, and hiding it would be the one thing that makes the rest untrustworthy.

Sibling backlog item, for whoever schedules this: the theme builder, `DEMO-PLAN.md` piece 5, is the
other half of the same idea, a closed set of token slots driven by a human or an AI through one
vocabulary. Both are listed in the portfolio's `docs/architecture/PLAN.md` backlog as captured and
not built.

## 9. Open questions for the owner

1. **Names.** `b-field` / `b-choice` / `b-option`, or plural collection atoms in the `b-list` shape?
   The plural shape is what `b-list` was reaching for, and probe result 1 shows the singular shape
   is the one that actually works today.
2. **Where the spec JSON lives.** The portfolio's `content/data/`, per the research pass, or does
   grain ship an example spec of its own for the catalog?
3. **Whether `b-input` eventually retires.** This spec says no, both ship. The cost is two
   components documenting one control, and the `.md` files have to say plainly which is which.
4. **Whether §5 item 1, the textarea, jumps the queue. ANSWERED yes, 2026-08-13,** and built the same
   day: see §5a. What is left of this question is the naming call recorded there.
5. **Whether the §8 demo is one candidate or two.** The roadmap's rule is one candidate per session,
   and the demo is really a matcher plus a page. Building the matcher against a committed spec
   first, then the page, keeps each half auditable; building both at once makes a bad run
   ambiguous.

## Rollout (after approval)

grain: `b-field` + `b-choice` + `b-option` templates and their `.md` catalog docs, then the render
tests, then the catalog entries. No CSS, no contract change, no version-sensitive surface, so this
is a normal grain change followed by the usual bump and publish. Then the portfolio, in two steps
that are worth keeping apart: first a real form built from a committed JSON spec, which is what will
find whatever this spec got wrong, and only then the §8 builder demo, which should be built on a
form that already works rather than debugging both at once.
