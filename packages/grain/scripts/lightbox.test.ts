// grain/scripts/lightbox.test.ts — the viewer draws its close/prev/next chrome from the shared
// icon sprite via <use href="…#id">. A sprite id that doesn't exist fails silently (an empty
// <svg>), so guard that every id lightbox.js references is real — and that the file still ships
// its declarative contract (the two data-attributes callers author against).
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const js = readFileSync(join(import.meta.dir, "lightbox.js"), "utf8");
const sprite = readFileSync(join(import.meta.dir, "..", "assets", "sprite.svg"), "utf8");

test("every sprite id the lightbox references exists in the sprite", () => {
  const ids = [...js.matchAll(/sprite\.svg#([\w-]+)/g)].map((m) => m[1]);
  expect(ids.length).toBeGreaterThan(0);                       // sanity: refs were parsed
  const known = new Set([...sprite.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  expect(ids.filter((id) => !known.has(id))).toEqual([]);
});

test("the lightbox keeps its declarative contract", () => {
  expect(js).toContain("[data-lightbox]");                    // the trigger attribute
  expect(js).toContain("[data-lightbox-group]");              // the gallery-grouping attribute
  expect(js).toContain("showModal");                          // native <dialog>, not a bespoke scrim
});
