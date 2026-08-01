// grain/components/organisms/drawer/drawer.test.ts — conformance guards for the drawer's CSS
// contract (its behavior is guarded in scripts/drawer.test.ts).
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const css = readFileSync(join(here, "drawer.css"), "utf8");
const md = readFileSync(join(here, "drawer.md"), "utf8");

test("closed is the `hidden` attribute — a no-JS page must not get a stranded overlay", () => {
  expect(css).toMatch(/\.drawer\[hidden\]\s*\{\s*display:\s*none/);
});

test("the panel is a flex column so the BODY scrolls and the head (with its close button) stays", () => {
  const panel = css.match(/\.drawer__panel\s*\{([^}]*)\}/);
  expect(panel).not.toBeNull();
  expect(panel![1]).toMatch(/display:\s*flex/);
  expect(panel![1]).toMatch(/flex-direction:\s*column/);
  expect(css).toMatch(/\.drawer__head\s*\{[^}]*flex:\s*none/);
  expect(css).toMatch(/\.drawer__body\s*\{[^}]*overflow-y:\s*auto/);
});

test("the panel goes full-bleed rather than overflowing a narrow viewport", () => {
  expect(css).toMatch(/width:\s*min\([\d.]+rem,\s*100vw\)/);
});

test("both animations opt out under prefers-reduced-motion", () => {
  const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([^}]*)\}/);
  expect(block).not.toBeNull();
  expect(block![1]).toMatch(/\.drawer__backdrop/);
  expect(block![1]).toMatch(/\.drawer__panel/);
});

test("the close control is a plain grain icon-btn — the organism owns the panel, not the button", () => {
  expect(css).not.toMatch(/\.drawer__close/);
  expect(md).toMatch(/class="icon-btn"[^>]*data-drawer-close/);
});

test("the .md states why the catalog renders this one empty (a fixed overlay can't sit in a panel)", () => {
  expect(md).toMatch(/position: fixed/);
  expect(md).toMatch(/catalog/i);
});
