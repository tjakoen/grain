// proof/routes.test.ts — the mountable handler: prefix routing, fall-through, chrome injection.
import { test, expect } from "bun:test";
import { join } from "node:path";
import { createProofRoutes } from "./routes.ts";

const EXAMPLE = join(import.meta.dir, "example");
const noAge = async () => null;
const chrome = (title: string, body: string) => `<!doctype html><title>${title}</title><main>${body}</main>`;

const standalone = () => createProofRoutes({ plansDir: EXAMPLE, chrome, lastModified: noAge });
const mounted = () => createProofRoutes({ plansDir: EXAMPLE, prefix: "/proof", chrome, lastModified: noAge });

test("standalone: / serves the board through the injected chrome", async () => {
  const res = await standalone()("/");
  expect(res).not.toBeNull();
  const html = await res!.text();
  expect(html).toContain("<title>Plans</title>");
  expect(html).toContain('data-status="doing"');
  expect(html).toContain("The board server");   // an example plan's title
});

test("standalone: /plans.json is the derived index", async () => {
  const res = await standalone()("/plans.json");
  const idx = await res!.json();
  expect(idx.counts).toMatchObject({ todo: 1, doing: 1, done: 1, blocked: 1 });
});

test("standalone: /plan/:id renders the plan detail via chrome", async () => {
  const res = await standalone()("/plan/001-core-parser");
  const html = await res!.text();
  expect(html).toContain("proof-facts");
  expect(html).toContain("Core plan parser");
});

test("standalone: an unknown subpath falls through (null)", async () => {
  expect(await standalone()("/nope")).toBeNull();
  expect(await standalone()("/plan/does-not-exist")).toBeNull();
});

test("mounted under /proof: only /proof* is claimed", async () => {
  const h = mounted();
  expect(await h("/proof")).not.toBeNull();
  expect(await h("/proof/plans.json")).not.toBeNull();
  expect(await h("/proof/plan/001-core-parser")).not.toBeNull();
  // not ours → fall through
  expect(await h("/")).toBeNull();
  expect(await h("/notes")).toBeNull();
});

test("mounted: the back-link points at the prefix", async () => {
  const res = await mounted()("/proof/plan/001-core-parser");
  const html = await res!.text();
  expect(html).toContain('href="/proof"');
});

test("a bad plan id shape is rejected (traversal-safe), not served", async () => {
  expect(await standalone()("/plan/..%2f..")).toBeNull();
});
