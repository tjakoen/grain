// grain/components/dashboards/dashboards.test.ts — holds the dashboards layer to its own rules
// (plans/dashboard-layer.md): every component ships a doc and a stylesheet, every doc has an
// Accessibility section and addresses its examples through data-surface, no stylesheet reaches for
// a raw colour or tracked capitals, and every class an example uses is one the layer defines.
import { test, expect } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = import.meta.dir;
const names = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const md = (n: string) => readFileSync(join(root, n, `${n}.md`), "utf8");
const css = (n: string) => readFileSync(join(root, n, `${n}.css`), "utf8");

test("the layer holds the five components", () => {
  expect(names.sort()).toEqual(["bullet-graph", "dash-panel", "dashboard", "delta", "rank-list"]);
  for (const n of names) { expect(existsSync(join(root, n, `${n}.md`))).toBe(true); expect(existsSync(join(root, n, `${n}.css`))).toBe(true); }
});

test("every doc carries an Accessibility section and a data-surface address", () => {
  for (const n of names) {
    expect(md(n)).toMatch(/^## Accessibility$/m);
    expect(md(n)).toContain("data-surface=");
  }
});

test("no stylesheet hardcodes a colour or tracks its capitals", () => {
  for (const n of names) {
    const src = css(n);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl)a?\(/);
    expect(src).not.toMatch(/text-transform:\s*uppercase|letter-spacing/);
  }
});

test("every dashboard-layer class an example uses is defined in the layer", () => {
  const defined = new Set(names.flatMap((n) => [...css(n).matchAll(/\.([a-z][a-z0-9_-]*)/g)].map((m) => m[1])));
  const prefixes = ["dash", "dash-panel", "delta", "bullet", "rank-list"];
  for (const n of names) for (const m of md(n).matchAll(/class="([^"]+)"/g))
    for (const cls of m[1].split(/\s+/))
      if (prefixes.some((p) => cls === p || cls.startsWith(`${p}__`))) expect(defined.has(cls)).toBe(true);
});

test("no example colours a delta by direction", () => {
  expect(css("delta")).not.toMatch(/--color-(danger|success)/);
});
