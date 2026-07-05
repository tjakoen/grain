// grain/scripts/xray.test.ts — DRIFT GUARD for the x-ray island. The island is a browser module
// (no DOM in bun), so its behavior lives in the e2e; here we guard the CONTRACT it depends on:
// the module path it lazy-imports must resolve to a real file, and it must expose the documented
// window.grain.xray API + entry points so the docs and the terminal caller can't drift from it.
import { test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const js = readFileSync(join(import.meta.dir, "xray.js"), "utf8");

test("lazy-imports a module path that maps to a real /modules file", () => {
  const m = js.match(/"\/modules\/([^"]+)"/);
  expect(m).not.toBeNull();
  // "/modules/grain/ai/manifest-dom.js" → grain/ai/manifest-dom.ts on disk
  const rel = m![1].replace(/^grain\//, "").replace(/\.js$/, ".ts");
  expect(existsSync(join(import.meta.dir, "..", rel))).toBe(true);
});

test("exposes the documented window.grain.xray API", () => {
  expect(js).toMatch(/window\.grain\.xray\s*=\s*\{[^}]*\bon\b[^}]*\boff\b[^}]*\btoggle\b/s);
});

test("wires all four entry points (API, ?xray, data-xray-toggle, Ctrl+Shift+X)", () => {
  expect(js).toMatch(/data-xray-toggle/);
  expect(js).toMatch(/URLSearchParams/);
  expect(js).toMatch(/\.has\("xray"\)/);
  expect(js).toMatch(/ctrlKey.*shiftKey/);
});

test("toggles the data-xray attribute on the document root", () => {
  expect(js).toMatch(/setAttribute\("data-xray"/);
  expect(js).toMatch(/removeAttribute\("data-xray"\)/);
});
