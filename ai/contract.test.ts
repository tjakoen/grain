// grain/ai/contract.test.ts — CONFORMANCE: the `navigate` verb (CLAUDE.md lesson #5 — "if you
// keep getting something wrong, the contract is unclear... add a conformance test that catches
// misuse"). Pins three things a real consumer reasoner depends on: the verb is registered in the
// closed ACTIONS vocabulary (so it shows up in the manifest, see manifest-dom.test.ts), an
// unsafe/external href is rejected, and a same-origin root-relative one is accepted.
import { test, expect, describe } from "bun:test";
import { ACTIONS, isAction, actionsForKind, isSafeNavigateHref } from "./contract.ts";

describe("navigate: registered in the closed ACTIONS vocabulary", () => {
  test("is a real action, light depth, accepts the screen kind", () => {
    expect(isAction("navigate")).toBe(true);
    expect(ACTIONS.navigate).toMatchObject({ name: "navigate", depth: "light", accepts: ["screen"] });
  });
  test("actionsForKind('screen') includes it — so the manifest surfaces it as legal", () => {
    expect(actionsForKind("screen")).toContain("navigate");
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
