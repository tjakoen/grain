// grain-lint.test.ts: every rule against its pair, a page that fails it and one clean page that
// passes every rule. Rendered checks drive a real Chromium, like the mermaid diagram test.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { RULES, allowReason } from "./grain-lint-rules.ts";
import { lintPage, lintSource, blocks, DEFAULT_WIDTHS, type LintPage } from "./grain-lint.ts";

const DIR = join(import.meta.dir, "fixtures", "grain-lint");
const url = (name: string) => pathToFileURL(join(DIR, name)).href;
const source = (name: string) => ({ path: name, text: readFileSync(join(DIR, name), "utf8"), kind: "html" as const });

let browser: Browser;
let page: Page;
beforeAll(async () => {
  browser = await chromium.launch();
  page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
});
afterAll(async () => { await browser?.close(); });

test("every rule has a failing fixture, and no fixture names an unknown rule", () => {
  const fails = readdirSync(DIR).filter(f => f.endsWith(".fail.html")).map(f => f.replace(".fail.html", ""));
  expect(fails.sort()).toEqual(RULES.map(r => r.id).sort());
});

test("every rule carries a tier, a description and a fix line", () => {
  for (const r of RULES) {
    expect(["floor", "reflex", "finish"]).toContain(r.tier);
    expect(r.description.length).toBeGreaterThan(10);
    expect(r.fix).toMatch(/--[a-z]|\.[a-z]|grain|b-|aspect-ratio|width|action|text-wrap/);
    expect(Boolean(r.static || r.rendered)).toBe(true);
  }
});

test("the clean page passes every rule, static and rendered, at every width", async () => {
  expect(lintSource(source("clean.html"))).toEqual([]);
  expect(await lintPage(page as unknown as LintPage, url("clean.html"), { widths: DEFAULT_WIDTHS })).toEqual([]);
}, 60_000);

for (const rule of RULES) {
  const file = `${rule.id}.fail.html`;
  if (rule.static) test(`${rule.id} (static) fails its fixture`, () => {
    const found = lintSource(source(file), { rules: [rule.id] });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every(f => f.rule === rule.id && f.fix === rule.fix)).toBe(true);
  });
  if (rule.rendered) test(`${rule.id} (rendered) fails its fixture`, async () => {
    const widths = rule.id === "phone-overflow" ? [360] : [1280];
    const found = await lintPage(page as unknown as LintPage, url(file), { rules: [rule.id], widths });
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.selector.length).toBeGreaterThan(0);
    expect(blocks(found[0]!)).toBe(rule.tier !== "finish");
  }, 30_000);
}

test("a reflex finding with a stated reason is allowed and does not block", async () => {
  const found = await lintPage(page as unknown as LintPage, url("text-above-h1.allowed.html"), { rules: ["text-above-h1"], widths: [1280] });
  expect(found).toHaveLength(1);
  expect(found[0]!.allowed).toBe("a series name the reader navigates by");
  expect(blocks(found[0]!)).toBe(false);
  expect(lintSource(source("text-above-h1.allowed.html"), { rules: ["text-above-h1"] }).every(f => !blocks(f))).toBe(true);
}, 30_000);

test("an allow needs a reason, and names the rule it excuses", () => {
  expect(allowReason("text-above-h1: series name", "text-above-h1")).toBe("series name");
  expect(allowReason("text-above-h1:", "text-above-h1")).toBeUndefined();
  expect(allowReason("card-run: picker; tracked-caps: kbd hints", "tracked-caps")).toBe("kbd hints");
  expect(allowReason("card-run: picker", "tracked-caps")).toBeUndefined();
});

test("static mode stays under a second on the whole fixture set", () => {
  const t = performance.now();
  for (const f of readdirSync(DIR).filter(f => f.endsWith(".html"))) lintSource(source(f));
  expect(performance.now() - t).toBeLessThan(1000);
});
