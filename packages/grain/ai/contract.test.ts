// grain/ai/contract.test.ts — CONFORMANCE: the `navigate` verb (CLAUDE.md lesson #5 — "if you
// keep getting something wrong, the contract is unclear... add a conformance test that catches
// misuse"). Pins three things a real consumer reasoner depends on: the verb is registered in the
// closed ACTIONS vocabulary (so it shows up in the manifest, see manifest-dom.test.ts), an
// unsafe/external href is rejected, and a same-origin root-relative one is accepted.
import { test, expect, describe } from "bun:test";
import { ACTIONS, isAction, actionsForKind, isSafeNavigateHref, isValidChoiceList } from "./contract.ts";

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
