// grain/ai/accepts.test.ts — UNIT: component affordance harvester in isolation.
// Uses tmp files to simulate component HTML so no real fs state is needed.
import { test, expect } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { createAccepts } from "./accepts.ts";

const TMP = join(import.meta.dir, "__accepts_test_tmp__");
function setup(files: Record<string, string>) {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  for (const [name, html] of Object.entries(files)) writeFileSync(join(TMP, name), html, "utf8");
}
function teardown() { rmSync(TMP, { recursive: true, force: true }); }

test("byKind: double-quoted attributes are harvested", () => {
  setup({ "item.html": `<div data-kind="item" data-accepts="item.archive"></div>` });
  const a = createAccepts(TMP);
  expect(a.byKind()).toEqual({ item: ["item.archive"] });
  teardown();
});

test("byKind: single-quoted attributes are harvested", () => {
  setup({ "item.html": `<div data-kind='item' data-accepts='item.archive'></div>` });
  const a = createAccepts(TMP);
  expect(a.byKind()).toEqual({ item: ["item.archive"] });
  teardown();
});

test("byKind: multiple accepts are split on whitespace", () => {
  setup({ "item.html": `<div data-kind="item" data-accepts="item.archive say.set"></div>` });
  const a = createAccepts(TMP);
  expect(a.byKind()["item"]).toEqual(["item.archive", "say.set"]);
  teardown();
});

test("byKind: data-kind without data-accepts is excluded with a warning", () => {
  const warns: string[] = [];
  const orig = console.warn;
  console.warn = (...args: unknown[]) => warns.push(String(args[0]));
  setup({ "item.html": `<div data-kind="item"></div>` });
  const a = createAccepts(TMP);
  expect(a.byKind()["item"]).toBeUndefined();
  expect(warns.some((w) => w.includes("[accepts]") && w.includes("data-kind"))).toBe(true);
  console.warn = orig;
  teardown();
});

test("actions: data-action verbs are collected across components", () => {
  setup({
    "a.html": `<button data-action="item.archive"></button>`,
    "b.html": `<input data-action="say.set">`,
  });
  const a = createAccepts(TMP);
  const verbs = a.actions();
  expect(verbs).toContain("item.archive");
  expect(verbs).toContain("say.set");
  teardown();
});

test("refresh: clears cache so a second call re-reads files", () => {
  setup({ "item.html": `<div data-kind="item" data-accepts="item.archive"></div>` });
  const a = createAccepts(TMP);
  expect(a.byKind()).toEqual({ item: ["item.archive"] });
  writeFileSync(join(TMP, "item.html"), `<div data-kind="item" data-accepts="say.set"></div>`, "utf8");
  a.refresh();
  expect(a.byKind()).toEqual({ item: ["say.set"] });
  teardown();
});
