# `field.set` — vocabulary op spec (APPROVED)

> **Status: APPROVED 2026-07-25** — owner signed off with all four open questions resolved to the
> spec defaults (allow overwrite + destructive flag; cap 2000; grain grade in v1 with trusted-input
> settle; input event dispatched). Drafted 2026-07-25 for owner review.
> Origin: the portfolio desk capability roadmap, item B1 (contact form
> prefill — `tjakoen.github.io/nimbalyst-local/plans/desk-ai-capability-roadmap.md`). This is the
> grain half; the portfolio contact page + desk wiring is a separate, later step.

## The move it enables

"Go to contact and tell TJ I want to talk about grain" → the desk navigates deterministically, the
arrival stash carries the drafted message, `field.set` prefills the message field, and the visitor
reviews and sends. **The AI never submits** — the human keeps the send, and that guarantee is
structural: no submit verb exists in the vocabulary, so there is nothing for a reasoner to call.

## Design laws honored

- **The vocabulary grows reluctantly** (contract.ts header): one new verb (`field.set`), one new
  surface kind (`field`), one new render-op kind (`fill`). Nothing else.
- **One door, no privileged AI→DOM channel**: a `field.set` Intent crosses `handleIntent` like any
  other — accepts-check, spotlight bracket when the AI is the actor, timeline log entry.
- **Refusal on non-registered fields is free**: a field is addressable only if the page marked it
  `data-surface="field:…"`. The door's accepts check + `validateMove` (target must exist on the
  live manifest) already reject anything else, echoing the valid moves. No querySelector fallback,
  ever.
- **0.5B rule (portfolio side, stated here as a contract expectation)**: the model may COMPOSE the
  message text; field TARGETING is deterministic code resolving a registered `field:` surface. The
  model never picks selectors or enumerates inputs.

## 1. Contract (`ai/contract.ts`)

### Surface kind

```ts
export type SurfaceKind = /* … */ | "field";
```

Markup: `<input data-surface="field:contact-name">`, `<textarea data-surface="field:contact-message">`.
The `field:` prefix gives `deriveKind` the kind for free; `data-kind` stays optional as everywhere.
Scope v1: **text-like fields only** (INPUT of a text-ish type, TEXTAREA). SELECT / checkbox / radio
are out — option-picking is a choice the model could get wrong silently; a future op can cover them
deliberately.

### Verb

```ts
"field.set": { name: "field.set", depth: "light", accepts: ["field"],
  description: "Prefill a registered form field with drafted text — the human reviews and submits; the AI never submits.",
  payload: { value: REQ("string", "plain text; replaces the field's current value") },
  hints: { destructive: true, idempotent: true } },
```

- `idempotent: true` — same value → same end state; a replay is harmless.
- `destructive: true` — it REPLACES whatever the field currently holds, which may be human-typed
  text. Honest flag, mirrors `note.replace`. (Open question 1 below offers a softer alternative.)

### Value validation (SSOT here, dispatcher mirrors it)

```ts
/** Cap on a field.set value — a prefill is a message draft, not a document. */
export const FIELD_VALUE_CAP = 2000;
/** Plain text only: no C0 control chars except \n and \t (textarea needs both). */
export const isSafeFieldValue = (v: unknown): v is string =>
  typeof v === "string" && v.length <= FIELD_VALUE_CAP &&
  !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
```

A rejection echoes the constraint in `Decision.reason` (informative rejections, AI-INTERFACE §0),
e.g. `field.set value rejected: over 2000 chars` — so a reasoner can shorten and retry.

## 2. Render op: `fill`

```ts
export type RenderOpKind = /* … */ | "fill";
// RenderOp: reuses the existing `text` field — no new envelope fields.
```

Why a new kind instead of reusing an existing one:

- **`type` is wrong physics.** Its INPUT/TEXTAREA branch appends tokens and **clears the field on
  `done`** — composer-submit semantics ("like pressing Enter"). A prefill must PERSIST for review.
  Overloading `type` with a keep-flag would fork its contract in the dispatcher.
- **`replace` is wrong layer.** It swaps `outerHTML`; a field's value is state, not markup, and
  replacing the element would drop listeners and focus.

`fill` is atomic whole-value assignment — matching `field.set`'s payload 1:1 and keeping the op
idempotent. (A typing animation is deliberately NOT in v1: the composing already happened in the
desk before navigation; on arrival the visitor should see the full draft instantly, reviewable. The
spotlight bracket already shows the AI as actor.)

### Dispatcher (`scripts/ai-dispatch.js`), per ADD-A-RENDER-OP-KIND

```js
case "fill":                                   // AI prefills a form field; value persists for human review
  if (el && ("value" in el) && typeof op.text === "string" && SAFE_FIELD_VALUE(op.text)) {
    el.value = op.text;
    el.setAttribute("data-grade", "grain");    // AI ink until the human touches it (see below)
    el.dispatchEvent(new Event("input", { bubbles: true }));   // page validation/counters stay honest
  }
  return;
```

- The dispatcher **re-checks** the value guard (cap + control chars) as the last line of defense,
  an intentional self-contained copy of `isSafeFieldValue` — drift-guarded by a test against
  contract.ts, exactly the `SAFE_NAV_HREF` pattern.
- `"value" in el` keeps the op inert on a non-field element even if a page mislabels a surface.
- **No focus steal, no submit, no form access** — the handler touches `el.value` and nothing else.

### Grade: AI ink settles when the human touches it

`fill` marks the field `data-grade="grain"` (AI-authored, DESIGN-SYSTEM §3). One delegated listener
in the dispatcher clears it on the first **trusted** input event (`ev.isTrusted`) on a grain-graded
field — the human edited, the ink settles clean. Synthetic events (including fill's own) don't
clear it. Small, honest, and the first time grade-as-signal reaches a form control.

## 3. Reasoner + kit

- `reasoner-kit.ts` builder:

  ```ts
  export const fillOp = (target: Surface, value: string): RenderOp =>
    ({ target, op: "fill", text: value, provenance: "ai", commit: "committed" });
  ```

  `committed` because the write is complete in one op; provenance `ai` drives the spotlight/grade.
- Default handling (stub reasoner / client door): a `field.set` intent validates the payload with
  `isSafeFieldValue` (reject echoes the constraint), then emits `fillOp` plus a console narration
  line (`narrateOp("field.set", …)`). The door already brackets AI-sourced intents with spotlight
  ops and logs both crossings to the timeline — nothing new needed there.
- `validateMove` (model.ts) needs no change: `field.set` becomes legal automatically once it's in
  `ACTIONS` and a `field:` target is on the live manifest.

## 4. What comes free

- Manifest + `manifestForReasoner` + x-ray labels + the generated `/reference` table all derive
  from the registry — the new verb and kind appear with zero extra wiring.
- `observe()` re-harvest shows the field as a target after navigation (the arrival case).
- Fields do **not** get `data-read` by default — what a visitor types into a contact form is theirs;
  a page may opt a field in deliberately, but the contact page shouldn't.

## 5. Tests

- `contract.test.ts`: `field.set` registry shape; `isSafeFieldValue` (cap boundary, control chars
  rejected, `\n`/`\t` accepted, non-string rejected).
- `ai-dispatch.test.ts`: `fill` sets `.value` and KEEPS it; dispatches a bubbling `input` event;
  inert on an element without `.value`; grade set on fill, cleared on trusted input only;
  drift-guard: dispatcher's value guard ≡ contract's.
- `interaction-layer.test.ts` / `client-door.test.ts`: `field.set` on a non-field surface rejected
  with the accepts echo; oversized value rejected with the constraint echo; happy path emits `fill`.
- `reasoner-kit.test.ts`: `fillOp` shape.
- Portfolio e2e (later, B1 second half): arrival stash → prefilled message field → human edit
  clears grain grade → mailto send untouched by the AI.

## 6. Non-goals (v1)

- No submit verb, no form.submit, no Enter synthesis — structural, not policy.
- No SELECT / checkbox / radio; no file inputs.
- No field READING (unless a page opts in via the existing `data-read`).
- No streaming/typing animation for fills.

## Open questions — RESOLVED (owner, 2026-07-25)

1. **Overwrite stance**: allow overwrite + `destructive: true` (as written).
2. **`FIELD_VALUE_CAP = 2000`**: confirmed.
3. **Grain grade on prefill**: in v1, trusted-input settle (as written).
4. **`input` event dispatch**: yes, dispatch it (as written).

## Rollout (after approval)

grain: contract → dispatcher → kit → door/reasoner handling → tests → AI-INTERFACE.md verb + render-op
tables (portfolio repo, `docs/grain/AI-INTERFACE.md`) → version bump + publish per the release flow.
Then, separately: portfolio contact page + desk arrival-prefill wiring (roadmap B1 second half).
