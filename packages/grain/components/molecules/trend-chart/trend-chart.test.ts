import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const css = readFileSync(join(here, "trend-chart.css"), "utf8");
const md = readFileSync(join(here, "trend-chart.md"), "utf8");

test("the component gives a chart an equivalent tabular text alternative", () => {
  expect(md).toMatch(/<svg[^>]+role="img"/);
  expect(md).toMatch(/<table class="trend-chart__table">/);
  expect(md).toMatch(/<th scope="col">Label<\/th>/);
  expect(md).toMatch(/<th scope="row">Group A<\/th>/);
  expect(md).toMatch(/class="trend-chart__axis-label" x="70" y="158"/);
});

test("the data contract requires a visible unit and an optional comparison range", () => {
  expect(md).toMatch(/state a unit/i);
  expect(md).toMatch(/optional comparison range/i);
  expect(md).toMatch(/Without a comparison/);
  expect(md).toMatch(/same y scale/i);
  expect(md).toMatch(/ordered category labels/i);
  expect(md).toMatch(/opaque strings/i);
});

test("chart ink and range use semantic tokens rather than a judgment color", () => {
  expect(css).toMatch(/\.trend-chart__series\s*\{[^}]*stroke:\s*var\(--color-fg\)/);
  expect(css).toMatch(/\.trend-chart__range\s*\{[^}]*fill:\s*var\(--color-muted\)/);
  expect(css).toMatch(/\.trend-chart__grid\s*\{[^}]*stroke:\s*var\(--color-line\)/);
  expect(md).toMatch(/assigns no meaning\s+to direction/i);
  expect(md).toMatch(/does not imply a target or\s+evaluate a person/i);
});

test("the component is static and keeps the reduced-motion contract explicit", () => {
  expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  expect(md).toMatch(/It has no animation/i);
  expect(css).not.toMatch(/\banimation\s*:/);
});

test("the shared GRAIN in-transit treatment applies to the component root", () => {
  expect(css).toMatch(/\.trend-chart\[data-commit="pending"\]/);
  expect(css).toMatch(/\[data-grade="grain"\] \.trend-chart/);
  expect(md).toMatch(/class="trend-chart" data-commit="pending"/);
});
