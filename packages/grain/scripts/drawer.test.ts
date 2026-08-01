// grain/scripts/drawer.test.ts — DRIFT GUARD for the drawer island.
//
// Scope, stated honestly: this package has no DOM in test (zero runtime deps, and a hand-rolled
// fake would test the fake). So these are grep-style contract guards in the tabs.test.ts mould —
// they catch a modal obligation being DELETED, which is the realistic regression, not one being
// subtly wrong. The behavior itself (focus lands in the panel, Tab wraps, focus returns to the
// opener) is asserted in a browser against a consumer — see plans/0007 in STEWARD. Lesson 9 cuts
// both ways: don't claim a behavior a mechanism can't render, and don't claim a test proves more
// than it does.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const js = readFileSync(join(import.meta.dir, "drawer.js"), "utf8");
const md = readFileSync(join(import.meta.dir, "..", "components/organisms/drawer/drawer.md"), "utf8");

test("idempotent, like every grain island", () => {
  expect(js).toMatch(/if \(window\.grain && window\.grain\.drawer\) return/);
});

test("state is the `hidden` attribute, not a class — SSR ships it, no-JS renders it closed", () => {
  expect(js).toMatch(/removeAttribute\("hidden"\)/);
  expect(js).toMatch(/setAttribute\("hidden", ""\)/);
  expect(js).not.toMatch(/classList\.(add|remove)\("(is-)?open"\)/);
});

test("focus moves INTO the panel on open", () => {
  expect(js).toMatch(/focusables\(d\)\[0\]/);
  expect(js).toMatch(/first\.focus\(\)/);
});

test("focus RETURNS to the opener on close — never dropped to <body>", () => {
  expect(js).toMatch(/opener = from \|\| /);
  expect(js).toMatch(/if \(opener && opener\.isConnected\) opener\.focus\(\)/);
});

test("Tab is trapped inside the panel, wrapping at BOTH ends", () => {
  expect(js).toMatch(/e\.key !== "Tab"/);
  expect(js).toMatch(/!e\.shiftKey && document\.activeElement === last/);
  expect(js).toMatch(/e\.shiftKey && document\.activeElement === first/);
});

test("the rest of the page goes inert while open, and is restored exactly", () => {
  expect(js).toMatch(/setAttribute\("inert", ""\)/);
  expect(js).toMatch(/removeAttribute\("inert"\)/);
  // only the children WE inerted are un-inerted — a page that inerts something itself keeps it.
  expect(js).toMatch(/!c\.hasAttribute\("inert"\)/);
});

test("Escape and the scrim both close", () => {
  expect(js).toMatch(/e\.key === "Escape"/);
  expect(js).toMatch(/\[data-drawer-close\]/);
});

test("never stacks: opening a second drawer closes the first", () => {
  expect(js).toMatch(/if \(openEl\) close\(\)/);
});

test("delegated off document, so swapped-in markup needs no re-init", () => {
  expect(js).toMatch(/document\.addEventListener\("click"/);
  expect(js).toMatch(/document\.addEventListener\("keydown"/);
});

test("exposes the window.grain.drawer seam and the open/close events the .md promises", () => {
  expect(js).toMatch(/window\.grain\.drawer\s*=\s*\{[\s\S]*\bopen\b[\s\S]*\bclose\b/);
  expect(js).toMatch(/grain:drawer-open/);
  expect(js).toMatch(/grain:drawer-close/);
  expect(md).toMatch(/grain:drawer-open/);
  expect(md).toMatch(/window\.grain\.drawer/);
});
