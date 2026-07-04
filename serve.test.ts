// mill/serve.test.ts — piece 3: the live content route factory.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMillRoutes, dirSource, listMillRoutes, packageDocsSource, type MillCollection } from "./serve.ts";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mill-serve-"));
  await writeFile(join(dir, "older.md"),
    `---\ntitle: Older Note\ndate: 2026-07-01\ntags: [a, b]\nsummary: >\n  the old one\n---\n# Older Note\n\nprose`);
  await writeFile(join(dir, "newer.md"),
    `---\ntitle: Newer Note\ndate: 2026-07-03\n---\nprose first\n\n<b-badge label="raw"></b-badge>`);
  await writeFile(join(dir, "not-markdown.txt"), "ignored");
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const notes = (): MillCollection => ({
  prefix: "/notes", title: "Notes", description: "the notebook", source: dirSource(dir),
});

test("index: lists entries newest-first with prefixed links, human grade", async () => {
  const res = await createMillRoutes({ collections: [notes()] })("/notes");
  expect(res?.status).toBe(200);
  const body = await res!.text();
  expect(body.indexOf("Newer Note")).toBeLessThan(body.indexOf("Older Note"));
  expect(body).toContain(`href="/notes/older"`);
  expect(body).toContain("the old one");                       // folded summary, not ">"
  expect(body).toContain(`data-grade="smooth"`);
  expect(body).not.toContain(`data-grade="grain"`);
});

test("entry: renders the note article through the grade guardrail", async () => {
  const res = await createMillRoutes({ collections: [notes()] })("/notes/older");
  const body = await res!.text();
  expect(body).toContain(`<article class="note" data-grade="smooth">`);
  expect(body).toContain(`<h1 class="masthead">Older Note</h1>`);
  expect(body).toContain(`<meta name="description" content="the old one">`);
});

test("escape hatch: raw <b-…> tags survive to the composed page", async () => {
  const composed: string[] = [];
  const handler = createMillRoutes({
    collections: [notes()],
    compose: async (h) => { composed.push(h); return h.replace("<b-badge", "<span data-composed"); },
  });
  const body = await (await handler("/notes/newer"))!.text();
  expect(composed).toHaveLength(1);
  expect(body).toContain("<span data-composed");               // compose ran over the full page
});

test("unknown slug and traversal-shaped slugs → 404; foreign path → null", async () => {
  const handler = createMillRoutes({ collections: [notes()] });
  expect((await handler("/notes/missing"))?.status).toBe(404);
  expect((await handler("/notes/../secret"))?.status).toBe(404);
  expect(await handler("/loop")).toBeNull();
});

test("trailing slash resolves to the index", async () => {
  const res = await createMillRoutes({ collections: [notes()] })("/notes/");
  expect(res?.status).toBe(200);
});

test("collection chrome overrides the default and gets the frontmatter", async () => {
  const handler = createMillRoutes({
    collections: [{ ...notes(), chrome: (p) => `[${p.kind}:${p.title}:${p.frontmatter?.date ?? ""}]` }],
  });
  expect(await (await handler("/notes/newer"))!.text()).toBe("[entry:Newer Note:2026-07-03]");
  expect(await (await handler("/notes"))!.text()).toBe("[index:Notes:]");
});

test("listMillRoutes enumerates the index + every entry; index:false drops the index route", async () => {
  const routes = await listMillRoutes([notes()]);
  expect(routes).toEqual(["/notes", "/notes/newer", "/notes/older"]);
  const noIndex = await listMillRoutes([{ ...notes(), index: false }]);
  expect(noIndex).toEqual(["/notes/newer", "/notes/older"]);
});

test("packageDocsSource resolves layer docs from the installed package (never a sibling path)", async () => {
  const source = packageDocsSource("@tjakoen/grain/docs/GRAIN.md");
  const slugs = await source.list();
  expect(slugs).toContain("grain");
  expect(slugs).toContain("ai-interface");
  expect(await source.read("grain")).toContain("GRAIN");
});
