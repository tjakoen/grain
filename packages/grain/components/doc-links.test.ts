// grain/components/doc-links.test.ts — a doc example must not invent a route.
//
// Why this exists. The catalog renders these examples as real markup, so a root-absolute href in a
// component doc becomes a real link on every consumer that mounts the catalog. Point one at a page
// that only exists in the example's imagination and you have handed every consumer a dead link,
// which their export walk will find long after the person who wrote the example has left.
//
// It happened: /clients/acme, /clients/borden and /tickets shipped in the admin-surface docs and
// broke the portfolio's Pages deploy the first time it consumed that version. The fix was to point
// fictional destinations at in-page anchors. This test is that fix, made mechanical.
//
// A doc may still link a route the REFERENCE CONSUMER really serves (the portfolio), and those are
// listed below, deliberately, one by one.
import { test, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;

// Two kinds of allowed reference, and the difference matters.
//
// Assets GRAIN itself ships, at the mount points a consumer wires up (/assets, /scripts). These
// resolve for anyone who mounted the package the way the README says to.
const SHIPPED_ASSETS = new Set([
  "/assets/figure-sample.svg",
  "/scripts/terminal.js",
]);

// Routes the REFERENCE CONSUMER really serves. Adding one is a decision: it means every consumer
// mounting grain's catalog is expected to serve that path too, or accept a dead link on their site.
const REAL_ROUTES = new Set([
  "/",
  "/calendar",
  "/grain",
  "/notes",
  "/notes/ten-times-zero",
  "/notes/the-browser-grew-up",
  "/notes/the-browser-grew-up.md",
]);

function docs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) docs(full, out);
    else if (name.endsWith(".md")) out.push(full);
  }
  return out;
}

test("no component doc links at a route that does not exist", () => {
  const offenders: string[] = [];
  for (const file of docs(here)) {
    const md = readFileSync(file, "utf8");
    for (const m of md.matchAll(/(?:href|src)="(\/[^"#][^"]*)"/g)) {
      const ref = m[1];
      if (ref.startsWith("//")) continue;                 // protocol-relative, not a route
      if (SHIPPED_ASSETS.has(ref) || REAL_ROUTES.has(ref)) continue;
      offenders.push(`${file.slice(here.length)}: ${ref}`);
    }
  }
  expect(offenders).toEqual([]);
});
