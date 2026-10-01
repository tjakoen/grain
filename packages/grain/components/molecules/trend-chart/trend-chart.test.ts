import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const css = readFileSync(join(here, "trend-chart.css"), "utf8");
const md = readFileSync(join(here, "trend-chart.md"), "utf8");
const example = md.match(/```html\s*([\s\S]*?)```/)?.[1] ?? "";

function pointPairs(points: string): Array<[number, number]> {
  return Array.from(points.matchAll(/([\d.]+),([\d.]+)/g), (match) => [Number(match[1]), Number(match[2])]);
}

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

test("the documented SVG points and range map exactly to the accessible table and labels", () => {
  const rows = Array.from(example.matchAll(/<tr><th scope="row">Group ([A-D])<\/th><td>(\d+)<\/td><td>(\d+)–(\d+)<\/td><\/tr>/g),
    (match) => ({ label: match[1]!, value: Number(match[2]), low: Number(match[3]), high: Number(match[4]) }));
  const labels = Array.from(example.matchAll(/<text class="trend-chart__axis-label" x="(\d+)" y="158" text-anchor="middle">([A-D])<\/text>/g),
    (match) => ({ label: match[2]!, x: Number(match[1]) }));
  const series = pointPairs(example.match(/<polyline class="trend-chart__series" points="([^"]+)"/)?.[1] ?? "");
  const rangeEdges = Array.from(example.matchAll(/<polyline class="trend-chart__range-edge" points="([^"]+)"/g),
    (match) => pointPairs(match[1]!));
  const band = pointPairs(example.match(/<polygon class="trend-chart__range" points="([^"]+)"/)?.[1] ?? "");
  const circles = Array.from(example.matchAll(/<circle class="trend-chart__point" cx="([\d.]+)" cy="([\d.]+)"/g),
    (match) => [Number(match[1]), Number(match[2])] as [number, number]);
  const y = (value: number) => 20 + (16 - value) * 9.5;
  const xs = labels.map(({ x }) => x);
  const upper = rows.map(({ high }, index) => [xs[index]!, y(high)] as [number, number]);
  const lower = rows.map(({ low }, index) => [xs[index]!, y(low)] as [number, number]);
  const expectedSeries = rows.map(({ value }, index) => [xs[index]!, y(value)] as [number, number]);

  expect(rows).toHaveLength(4);
  expect(labels.map(({ label }) => label)).toEqual(rows.map(({ label }) => label));
  expect(series).toEqual(expectedSeries);
  expect(circles).toEqual(expectedSeries);
  expect(rangeEdges).toEqual([upper, lower]);
  expect(band).toEqual([...upper, ...lower.toReversed()]);
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
