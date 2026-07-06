// grain/scripts/tabs.test.ts — DRIFT GUARD for the open-tabs island (behavior lives in the e2e;
// here we guard the contracts other pieces build on).
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const js = readFileSync(join(import.meta.dir, "tabs.js"), "utf8");

test("only mounts an opt-in strip (data-open-tabs)", () => {
  expect(js).toMatch(/\[data-open-tabs\]/);
});

test("pinned tabs are never stored or closable (data-pinned contract)", () => {
  expect(js).toMatch(/a\[data-pinned\]/);
  expect(js).toMatch(/filter\(\(p\) => !pinned\.has\(p\)\)/);
});

test("labels come from the data-tab-source nav (the file-tree pairing)", () => {
  expect(js).toMatch(/\[data-tab-source\]/);
  expect(js).toMatch(/data-tab-label/);
});

test("tabs are real anchors — hypermedia, not a router", () => {
  expect(js).toMatch(/createElement\("a"\)/);
  expect(js).not.toMatch(/preventDefault\(\);\s*history\.pushState/);
});

test("exposes the window.grain.tabs seam", () => {
  expect(js).toMatch(/window\.grain\.tabs\s*=\s*\{[\s\S]*\bclose\b/);
});

test("close-all is opt-in (data-shell=\"tabs-close-all\") and exposed on the seam", () => {
  expect(js).toMatch(/\[data-shell="tabs-close-all"\]/);
  expect(js).toMatch(/window\.grain\.tabs\s*=\s*\{[\s\S]*\bcloseAll\b/);
});

test("the sidebar (data-tab-source) gets a live close affordance for open tabs, not static markup", () => {
  expect(js).toMatch(/file-tree__close/);
  expect(js).not.toMatch(/<span class="file-tree__close"/);   // injected via createElement, not templated
});
