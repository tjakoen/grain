// grain/ai/contract.test.ts — CONFORMANCE: the `navigate` verb (CLAUDE.md lesson #5 — "if you
// keep getting something wrong, the contract is unclear... add a conformance test that catches
// misuse"). Pins three things a real consumer reasoner depends on: the verb is registered in the
// closed ACTIONS vocabulary (so it shows up in the manifest, see manifest-dom.test.ts), an
// unsafe/external href is rejected, and a same-origin root-relative one is accepted.
import { test, expect, describe } from "bun:test";
import {
  ACTIONS, BLOCK_SPANS, MOVE_DIRECTIONS, isAction, actionsForKind, isBlockSpan, isCheckedState,
  isMoveDirection, isSafeFieldValue, isSafeNavigateHref, isValidChoiceList, FIELD_VALUE_CAP,
} from "./contract.ts";

describe("navigate: registered in the closed ACTIONS vocabulary", () => {
  test("is a real action, light depth, accepts the screen kind", () => {
    expect(isAction("navigate")).toBe(true);
    expect(ACTIONS.navigate).toMatchObject({ name: "navigate", depth: "light", accepts: ["screen"] });
  });
  test("actionsForKind('screen') includes it — so the manifest surfaces it as legal", () => {
    expect(actionsForKind("screen")).toContain("navigate");
  });
});

describe("note.append / note.replace: the notepad verbs", () => {
  test("both are real actions, light depth, accept the notepad kind", () => {
    expect(isAction("note.append")).toBe(true);
    expect(isAction("note.replace")).toBe(true);
    expect(ACTIONS["note.append"]).toMatchObject({ name: "note.append", depth: "light", accepts: ["notepad"] });
    expect(ACTIONS["note.replace"]).toMatchObject({ name: "note.replace", depth: "light", accepts: ["notepad"] });
  });
  test("actionsForKind('notepad') surfaces both — the manifest advertises them on the pad", () => {
    const acts = actionsForKind("notepad");
    expect(acts).toContain("note.append");
    expect(acts).toContain("note.replace");
  });
});

describe("payload schema + description: every verb advertises how to call it", () => {
  test("each ACTIONS entry declares a non-empty description and a payload object", () => {
    for (const def of Object.values(ACTIONS)) {
      expect(typeof def.description).toBe("string");
      expect(def.description.trim().length).toBeGreaterThan(0);
      expect(typeof def.payload).toBe("object");
      for (const field of Object.values(def.payload)) {
        expect(["string", "number", "boolean"]).toContain(field.type);
        expect(typeof field.required).toBe("boolean");
      }
    }
  });
  test("text verbs require a text field; navigate requires an href; no-arg verbs are empty", () => {
    expect(ACTIONS["chat.send"].payload.text).toMatchObject({ type: "string", required: true });
    expect(ACTIONS["note.append"].payload.text).toMatchObject({ type: "string", required: true });
    expect(ACTIONS.navigate.payload.href).toMatchObject({ type: "string", required: true });
    expect(ACTIONS["item.archive"].payload).toEqual({});
    expect(ACTIONS["say.stream"].payload).toEqual({});
  });
});

describe("hints: MCP-style behaviour annotations for safe choice + retry", () => {
  test("every verb declares a hints object", () => {
    for (const def of Object.values(ACTIONS)) expect(typeof def.hints).toBe("object");
  });
  test("note.replace is destructive + idempotent; note.append is neither (additive)", () => {
    expect(ACTIONS["note.replace"].hints).toMatchObject({ destructive: true, idempotent: true });
    expect(ACTIONS["note.append"].hints.destructive).toBeUndefined();
    expect(ACTIONS["note.append"].hints.idempotent).toBeUndefined();
  });
  test("navigate + desk.stop are read-only (no persisted-state mutation)", () => {
    expect(ACTIONS.navigate.hints.readOnly).toBe(true);
    expect(ACTIONS["desk.stop"].hints.readOnly).toBe(true);
  });
  test("item.archive is idempotent — a replay is a harmless no-op", () => {
    expect(ACTIONS["item.archive"].hints.idempotent).toBe(true);
  });
});

describe("isSafeNavigateHref: same-origin, root-relative only", () => {
  test.each([
    ["/", true],
    ["/notes", true],
    ["/notes/some-slug", true],
    ["/notes?x=1#y", true],
  ])("%s -> %s (valid, same-origin root-relative)", (href, expected) => {
    expect(isSafeNavigateHref(href)).toBe(expected);
  });

  test.each([
    ["https://evil.example", false],
    ["http://evil.example", false],
    ["//evil.example", false],           // protocol-relative
    ["javascript:alert(1)", false],       // no leading "/" — never executable
    ["data:text/html,<script>", false],
    ["mailto:a@b.com", false],
    ["/\\evil.example", false],           // backslash-as-slash browser quirk
    ["", false],
    ["not-a-path", false],
    ["/has space", false],
  ])("%s -> %s (rejected)", (href, expected) => {
    expect(isSafeNavigateHref(href)).toBe(expected);
  });

  test("rejects non-string values without throwing", () => {
    expect(isSafeNavigateHref(undefined as unknown as string)).toBe(false);
    expect(isSafeNavigateHref(null as unknown as string)).toBe(false);
    expect(isSafeNavigateHref(42 as unknown as string)).toBe(false);
  });
});

describe("field.set: registered in the closed ACTIONS vocabulary (plans/field-set-op.md)", () => {
  test("is a real action, light depth, accepts the field kind, requires value:string", () => {
    expect(isAction("field.set")).toBe(true);
    expect(ACTIONS["field.set"]).toMatchObject({ name: "field.set", depth: "light", accepts: ["field"] });
    expect(ACTIONS["field.set"].payload.value).toMatchObject({ type: "string", required: true });
  });
  test("actionsForKind('field') surfaces it — the manifest advertises it on registered fields", () => {
    expect(actionsForKind("field")).toContain("field.set");
  });
  test("destructive + idempotent — it REPLACES a field's value; same value → same end state", () => {
    expect(ACTIONS["field.set"].hints).toMatchObject({ destructive: true, idempotent: true });
  });
  test("no submit verb exists — the AI-never-submits guarantee is structural", () => {
    for (const name of Object.keys(ACTIONS)) expect(name).not.toMatch(/submit/i);
  });
});

describe("isSafeFieldValue: plain text, capped, no control chars", () => {
  test("accepts plain text, newlines + tabs (a textarea needs both), and exactly the cap", () => {
    expect(isSafeFieldValue("Hi TJ — I want to talk about grain.")).toBe(true);
    expect(isSafeFieldValue("line one\nline two\tindented")).toBe(true);
    expect(isSafeFieldValue("x".repeat(FIELD_VALUE_CAP))).toBe(true);
    expect(isSafeFieldValue("")).toBe(true);   // shape-safe; an EMPTY prefill is the reasoner's call to reject
  });
  test("rejects over-cap and control characters", () => {
    expect(isSafeFieldValue("x".repeat(FIELD_VALUE_CAP + 1))).toBe(false);
    expect(isSafeFieldValue("null\x00byte")).toBe(false);
    expect(isSafeFieldValue("bell\x07")).toBe(false);
    expect(isSafeFieldValue("esc\x1b[31m")).toBe(false);
    expect(isSafeFieldValue("vt\x0b")).toBe(false);
  });
  test("rejects non-string values without throwing", () => {
    expect(isSafeFieldValue(undefined)).toBe(false);
    expect(isSafeFieldValue(null)).toBe(false);
    expect(isSafeFieldValue(42)).toBe(false);
    expect(isSafeFieldValue(["a"])).toBe(false);
  });
});

describe("check.set: the tick-box verb, and the kind that keeps it apart from field.set", () => {
  test("is a real action, light depth, accepts the check kind, requires checked:boolean", () => {
    expect(isAction("check.set")).toBe(true);
    expect(ACTIONS["check.set"]).toMatchObject({ name: "check.set", depth: "light", accepts: ["check"] });
    expect(ACTIONS["check.set"].payload.checked).toMatchObject({ type: "boolean", required: true });
  });
  test("destructive + idempotent — it REPLACES a state the human may have set; same payload → same end state", () => {
    expect(ACTIONS["check.set"].hints).toMatchObject({ destructive: true, idempotent: true });
  });
  // The point of the whole design, and the one assertion worth reading twice: each control kind
  // advertises ONLY the verb that can operate it. Were both verbs on one kind, the manifest would
  // tell a reasoner that field.set is legal on a tick box — and field.set writes el.value, which on
  // a tick box is what the form SUBMITS rather than whether it is ticked. The write would land,
  // report success, change the form's meaning and leave the control looking untouched.
  test("the two kinds do not overlap: a field advertises no tick verb, a tick box no field verb", () => {
    expect(actionsForKind("check")).toEqual(["check.set"]);
    expect(actionsForKind("field")).toEqual(["field.set"]);
  });
  test("a set, not a toggle — a toggle could not honestly carry the idempotent flag", () => {
    for (const name of Object.keys(ACTIONS)) expect(name).not.toMatch(/toggle/i);
  });
});

describe("isCheckedState: a real boolean, and nothing that merely looks like one", () => {
  test("accepts both booleans", () => {
    expect(isCheckedState(true)).toBe(true);
    expect(isCheckedState(false)).toBe(true);
  });
  // "false" is a truthy string, so a coercing guard would TICK the box a reasoner asked to clear.
  test("rejects the strings, the numbers and the absent value a model might send instead", () => {
    expect(isCheckedState("true")).toBe(false);
    expect(isCheckedState("false")).toBe(false);
    expect(isCheckedState("checked")).toBe(false);
    expect(isCheckedState(1)).toBe(false);
    expect(isCheckedState(0)).toBe(false);
    expect(isCheckedState(undefined)).toBe(false);
    expect(isCheckedState(null)).toBe(false);
  });
});

describe("isValidChoiceList: 1–6 options, each a non-empty label", () => {
  test("accepts well-formed lists (value optional)", () => {
    expect(isValidChoiceList([{ label: "A" }])).toBe(true);
    expect(isValidChoiceList([{ label: "A", value: "go a" }, { label: "B" }])).toBe(true);
    expect(isValidChoiceList([1, 2, 3, 4, 5, 6].map((n) => ({ label: `opt${n}` })))).toBe(true);
  });
  test("rejects empty, oversized, and malformed lists without throwing", () => {
    expect(isValidChoiceList([])).toBe(false);                                   // must offer at least one
    expect(isValidChoiceList([1, 2, 3, 4, 5, 6, 7].map((n) => ({ label: `o${n}` })))).toBe(false);  // capped at 6
    expect(isValidChoiceList([{ label: "  " }])).toBe(false);                    // blank label
    expect(isValidChoiceList([{ value: "x" } as unknown])).toBe(false);          // missing label
    expect(isValidChoiceList([{ label: "A", value: 3 as unknown }])).toBe(false);// non-string value
    expect(isValidChoiceList("nope" as unknown)).toBe(false);
    expect(isValidChoiceList(null)).toBe(false);
  });
});

// The three block verbs (plans/block-verbs.md). A block is a kind of its own for the reason a check
// is: a kind is a promise about which verbs work, and a block's real state is the composition
// holding it rather than the element showing it.
describe("the block verbs: registered, closed-payload, and honest about idempotence", () => {
  test("all three are registered against the block kind and nothing else", () => {
    expect(actionsForKind("block").toSorted()).toEqual(["block.move", "block.remove", "block.span"]);
    for (const name of ["block.remove", "block.span", "block.move"] as const) {
      expect(ACTIONS[name].accepts).toEqual(["block"]);
      expect(isAction(name)).toBe(true);
    }
  });

  // The whole small-model argument: a payload description that NAMES its legal values is the
  // difference between a 0.5B picking one and a 0.5B guessing.
  test("each payload names its closed word list in the description the manifest carries", () => {
    expect(ACTIONS["block.span"].payload.span).toMatchObject({ type: "string", required: true });
    expect(ACTIONS["block.span"].payload.span!.note).toContain("full");
    expect(ACTIONS["block.span"].payload.span!.note).toContain("third");
    expect(ACTIONS["block.move"].payload.direction!.note).toContain("up");
    expect(ACTIONS["block.remove"].payload).toEqual({});
  });

  // move is the one that is NOT idempotent, and saying so is the point: a replayed move shifts a
  // second place, where a replayed remove or span lands exactly where the first one did.
  test("remove and span claim idempotence; move does not", () => {
    expect(ACTIONS["block.remove"].hints.idempotent).toBe(true);
    expect(ACTIONS["block.span"].hints.idempotent).toBe(true);
    expect(ACTIONS["block.move"].hints.idempotent).toBeUndefined();
  });

  // There is deliberately no verb that ADDS a block: adding goes through field.set on the page's
  // own prompt, which is what keeps the model from ever naming a component.
  test("no verb adds a block", () => {
    expect(Object.keys(ACTIONS).filter((a) => /^block\.(add|create|insert)/.test(a))).toEqual([]);
  });

  test("the closed word lists refuse everything outside them", () => {
    for (const ok of BLOCK_SPANS) expect(isBlockSpan(ok)).toBe(true);
    for (const no of ["wide", "FULL", "", "1/2", 3, null, undefined]) expect(isBlockSpan(no)).toBe(false);
    for (const ok of MOVE_DIRECTIONS) expect(isMoveDirection(ok)).toBe(true);
    for (const no of ["top", "Up", "", 1, null]) expect(isMoveDirection(no)).toBe(false);
  });
});
