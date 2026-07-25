// grain/scripts/handoff.test.ts — handoff.js is a browser-native IIFE (DOM globals at load
// time) that can't be imported into a bun test, same story as ai-dispatch.test.ts. What CAN
// be verified without a browser: the declarative contract callers author against, and the
// safety rules the header promises — scheme guard, encode-before-substitute, noopener.
import { test, expect } from "bun:test";

const js = await Bun.file(new URL("./handoff.js", import.meta.url)).text();

test("the handoff keeps its declarative contract", () => {
  expect(js).toContain("[data-handoff]");            // the trigger attribute
  expect(js).toContain("handoffUrl");                // the URL-template attribute
  expect(js).toContain("handoffSource");             // the payload-source selector
  expect(js).toContain("handoffPayload");            // the literal-payload fallback
  expect(js).toContain("{payload}");                 // the template slot
});

test("only http(s) templates are accepted — the scheme guard exists and is anchored", () => {
  const re = js.match(/const SAFE_HANDOFF_URL = (\/.*\/i?);/)?.[1];
  expect(re).toBeDefined();
  const guard = new Function(`return ${re}`)() as RegExp;
  expect(guard.test("https://claude.ai/new?q={payload}")).toBe(true);
  expect(guard.test("http://localhost:4000/x?q={payload}")).toBe(true);
  expect(guard.test("javascript:alert(1)")).toBe(false);
  expect(guard.test("mailto:x@y.z?body={payload}")).toBe(false);
  expect(guard.test("  https://padded.example")).toBe(false);   // anchored: no leading junk
});

test("the payload is URI-encoded before substitution, and the tab opens with noopener", () => {
  // the one substitution site encodes inline — no raw-payload path exists
  expect(js).toContain('replaceAll("{payload}", encodeURIComponent(');
  expect(js).toContain('"noopener"');
});

test("modified clicks pass through untouched (the lightbox courtesy)", () => {
  expect(js).toMatch(/metaKey.*ctrlKey.*shiftKey.*altKey/);
});
