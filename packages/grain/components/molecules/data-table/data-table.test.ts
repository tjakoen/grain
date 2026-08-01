// grain/components/molecules/data-table/data-table.test.ts — conformance guards for the record
// table upstreamed from STEWARD (0007).
//
// Two of these encode decisions that are easy to undo by accident and expensive to notice:
// data-table and table are deliberately SEPARATE components (merging them looks like a cleanup
// and quietly changes what MILL renders), and the sticky header depends on an ancestor scroll
// container, which is a parent-context requirement the .md must keep stating (lesson 3: a
// contract that fails silently is the bug).
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const root = join(here, "..", "..", "..");
const css = readFileSync(join(here, "data-table.css"), "utf8");
const md = readFileSync(join(here, "data-table.md"), "utf8");
const tableMd = readFileSync(join(root, "components/molecules/table/table.md"), "utf8");

test("the header is sticky and opaque — a transparent one lets rows show through as they pass", () => {
  const th = css.match(/\.data-table thead th\s*\{([^}]*)\}/);
  expect(th).not.toBeNull();
  expect(th![1]).toMatch(/position:\s*sticky/);
  expect(th![1]).toMatch(/top:\s*0/);
  expect(th![1]).toMatch(/background:\s*var\(--color-/);
});

test("the sticky header's parent-context requirement is documented, not just implied", () => {
  // it resolves against the nearest scrollable ancestor: silently inert on a body-scrolled page.
  expect(md).toMatch(/scroll(able)? (container|ancestor)/i);
  expect(md).toMatch(/app-shell__main/);
});

test("data-table and table stay two components, each pointing at the other", () => {
  expect(md).toMatch(/\btable\b/);
  expect(md).toMatch(/Markdown/);          // "if you're rendering Markdown, you want table"
  expect(tableMd).toMatch(/data-table/);   // and the reverse, so neither is a dead end
});

test("a whole-row link ships the affordance only — the anchor is still required", () => {
  expect(css).toMatch(/\.data-table tbody tr\[data-href\]\s*\{\s*cursor:\s*pointer/);
  // grain must not imply it navigates: no grain script reads data-href.
  expect(md).toMatch(/keep a real `?<a>`?/i);
});

test("carries the shared in-transit idiom (dashed edge), like table and the atoms", () => {
  expect(css).toMatch(/\.data-table\[data-commit="pending"\]/);
  expect(css).toMatch(/\[data-grade="grain"\] \.data-table/);
  expect(css).toMatch(/border:\s*1px dashed/);
});

test("the empty state is a row, so the header still names the columns", () => {
  expect(css).toMatch(/\.data-table__empty td/);
  expect(md).toMatch(/<tr class="data-table__empty">/);
});
