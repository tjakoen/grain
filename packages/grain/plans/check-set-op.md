# `check.set` — vocabulary op spec (BUILT 2026-08-14)

> **Status: BUILT 2026-08-14.** Authorized by the owner on 2026-08-13, answering the finding
> `form-from-data.md` §5b left open: a tick box was the one control the AI could not operate. The two
> calls that finding delegated to whoever took the work are settled here, in §1: the verb earns its
> own surface kind rather than joining `field`, and it is a set rather than a toggle.
> Sibling spec: `field-set-op.md`, which this one follows closely on purpose.

## The move it enables

"Tell TJ I want to talk about GRAIN, and copy me in" → the desk drafts the message into the contact
form through `field.set`, and ticks the copy-me-in box through `check.set`. The visitor reviews both
and sends. **The AI never submits**, structurally: no submit verb exists in the vocabulary, so there
is nothing for a reasoner to call.

## The finding this closes

`b-check` shipped on 2026-08-13 with no address at all, and the absence was the honest answer rather
than an oversight. Every other atom in the form family is addressable because `field.set` can operate
its control: it resolves the address and writes `el.value`. A tick box has a `value` too, and that is
exactly the problem. **A tick box's value is what the form submits when the box is ticked, not
whether it is ticked.** So a `field.set` aimed at one passes the dispatcher's `"value" in el` guard,
lands, reports success, changes what the form means, and leaves the control looking untouched.

That is worse than the select hazard the same plan records, where a bad write at least blanks the
control visibly. And it could not be fixed by moving the binding, the way the label addressing was:
there is no element to move it to.

## Design laws honored

- **The vocabulary grows reluctantly** (contract.ts header): one new verb (`check.set`), one new
  surface kind (`check`), one new render-op kind (`tick`). Nothing else.
- **One door, no privileged AI→DOM channel**: a `check.set` Intent crosses `handleIntent` like any
  other — accepts check, spotlight bracket when the AI is the actor, timeline log entry.
- **A kind is a promise about which verbs work.** That is the whole of §1 below.
- **The atom is the last step, not the first.** An address that lands before the verb exists is the
  same false promise in the other direction, so the binding went on `b-check` only after the verb was
  proved to tick a real control in a real browser.

## 1. The two calls §5b left open

### It earns its own kind, `check`, rather than joining `field`

Were a tick box a `field`, the manifest would advertise `field.set` on it, because a manifest target's
`accepts` is derived from the registry (`actionsForKind`). One of the two verbs on that kind would
work on any given control and the other would land silently wrong — a documented promise the
mechanism cannot render, which is precisely what lesson 9 says never to ship.

Two kinds make the advertisement honest per control with no special-casing anywhere: a text field
lists `field.set` and a tick box lists `check.set`, and each rejects the other verb at the door with
the usual accepts echo. The cost is one more word in the vocabulary; the alternative is a manifest
that lies about one control in every form.

### It is a SET, not a toggle

`field.toggle` was the shape the finding sketched, and a toggle is the wrong one. A toggle flips
whatever is there, so a replay lands in the opposite state and the verb cannot honestly carry
`idempotent: true` — the flag a reasoner reads to decide whether a retry is safe. A set states the
state it wants, so the same payload always reaches the same end state and the reasoner never has to
read the box before writing it. There is no toggle verb in the vocabulary, and a test asserts it.

## 2. Contract (`ai/contract.ts`)

```ts
export type SurfaceKind = /* … */ | "check";

"check.set": { name: "check.set", depth: "light", accepts: ["check"],
  description: "Tick or clear a registered tick box (checkbox or radio) — the human reviews and submits; the AI never submits.",
  payload: { checked: REQ("boolean", "true ticks the box, false clears it") },
  hints: { destructive: true, idempotent: true } },

export const isCheckedState = (v: unknown): v is boolean => typeof v === "boolean";
```

Markup: `<input type="checkbox" data-surface="check:contact-copy">`. The `check:` prefix gives
`deriveKind` the kind for free, as every other kind does.

- `destructive: true` — it replaces a state the human may have set, the same honest flag `field.set`
  carries for the same reason.
- `isCheckedState` rejects strings on purpose. `"false"` is truthy, so a coercing guard would tick
  every box a reasoner asked to clear, silently — the exact failure this verb exists to close.

## 3. Render op: `tick`

```ts
export type RenderOpKind = /* … */ | "tick";
// RenderOp gains one field: checked?: boolean
```

A new kind rather than a boolean mode on `fill`, for the reason `fill` is separate from `type`: an op
that branches on which of two payload fields arrived is two ops sharing a name, and the dispatcher
would have to guess which one it was handed. `tick` carries `checked` and nothing else.

### Dispatcher (`scripts/ai-dispatch.js`)

```js
case "tick":
  if (el && TICKABLE_TYPES.has(el.type) && CHECKED_STATE(op.checked)) {
    if (el.type === "radio" && op.checked === false) {
      console.error("[ai-dispatch] refused to clear a radio — no click can reach that state", op.target);
      return;
    }
    el.checked = op.checked;
    el.setAttribute("data-grade", "grain");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return;
```

Three things in there are load-bearing:

- **The element guard is the TYPE, not the property.** `"checked" in el` is the obvious guard and the
  wrong one: every input carries a `checked` property, so a tick aimed at a text field would pass it,
  assign a property nothing renders, and report a success nobody can see. `TICKABLE_TYPES` is the set
  `{checkbox, radio}` and the type is what actually decides whether a box can be ticked.
- **A radio may only be ticked, never cleared.** A group with nothing selected is a state no click can
  reach, so the AI must not be able to put a form there either. Refused out loud on the `navigate`
  precedent, because a silent refusal is indistinguishable from a broken op.
- **Both events fire.** A real tick fires `input` and `change`; `change` is the one a form listens to
  for a tick box, and `input` is the one the trusted-input settle listener reads.

### Grade: AI ink settles when the human touches it

`tick` marks the box `data-grade="grain"`, and the existing delegated listener clears it on the first
**trusted** input event. A tick box needs no special case there: clicking one fires a trusted `input`
like any other control, and the listener's `"value" in el` holds for it — a tick box has a value, it
is just not the state, which is the whole reason this verb exists.

## 4. Reasoner + kit

- `reasoner-kit.ts` gains `tickOp(target, checked)`, which throws on a non-boolean at compose time
  rather than letting a truthy string reach the dispatcher.
- The stub reasoner gains a `check.set` branch: validate with `isCheckedState` (the reject echoes the
  constraint), narrate, emit `tickOp`.
- `validateMove` needs no change: the verb becomes legal automatically once it is in `ACTIONS` and a
  `check:` target is on the live manifest.

## 5. What comes free

The manifest, `manifestForReasoner`, the x-ray labels and the generated `/reference` table all derive
from the registry, so the new verb and kind appear with no extra wiring. `vocab-reference.ts`'s
`RENDER_OP_KINDS` is the one hand-kept list, and a test grep-guards it against `contract.ts`.

## 6. Non-goals

- **No submit verb**, unchanged and structural.
- **No group verb.** A radio group is addressed one control at a time, because a verb operates a
  control and a group is not one.
- **No reading.** Whether a visitor ticked a box is theirs; a page may opt a surface into `data-read`
  deliberately, but a contact form should not.

## 7. Tests, each proved by mutation before it was kept

- `contract.test.ts`: the registry shape; `isCheckedState` against the strings and numbers a model
  might send; **the non-overlap assertion** (`actionsForKind("check")` is exactly `["check.set"]` and
  `actionsForKind("field")` exactly `["field.set"]`), which is the design stated as a test; and that
  no verb in the vocabulary is named toggle.
- `ai-dispatch.test.ts`: the drift guard against `isCheckedState`; the type guard present and
  `"checked" in el` absent; the assignment, the grade and both events; the radio refusal returning
  before the assignment rather than logging and carrying on.
- `reasoner-kit.test.ts`: `tickOp`'s shape, and that a non-boolean throws at compose time.
- `interaction-layer.test.ts`: the happy path both ways; `check.set` on a field surface and
  `field.set` on a check surface both rejected with the accepts echo; a non-boolean rejected with
  nothing reaching the box; the spotlight bracket.
- `form-from-data.test.ts`: the old "carries NO surface" assertion is replaced by the one that keeps
  the new address honest — the binding is on the input, never on the wrapper.
- Portfolio `about.e2e.ts`: the tick box is a real checkbox addressed `check:`, `check.set` through
  the one door ticks it and grades it grain, `field.set` aimed at the same surface leaves its submit
  value alone, and a human click settles the ink.

## 8. Proved live before the atom was addressed

The ordering was the point of the whole unit, so it is worth recording that it was actually followed.
The verb was built first and proved on a hand-authored checkbox on the portfolio's contact form: a
`check.set` through the real door ticked it and graded it grain, a `field.set` carrying `OVERWRITTEN`
aimed at the same surface left its value as `yes`, and a human click settled the grade. Only then did
`b-check` get its `data-bind-data-surface`, and the hand-authored control was replaced by the atom
rendering the same markup from `contact-form.json`.

## Open for the owner, and small

The names, alongside the `b-memo` and `b-check` naming questions §5a and §5b already left open. The
kind is `check`, the verb `check.set`, the op `tick`. Cheap to rename while nothing is published.
