// mill/diagrams/cache.test.ts — the committed disk cache. Real files in a temp directory:
// the whole point of this module is what lands on disk, so a mocked fs would test nothing.
import { test, expect } from "bun:test";
import { mkdtemp, readdir, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cachedRenderer, CACHE_VERSION } from "./cache.ts";
import type { DiagramRenderer } from "./prepare.ts";

const withTempDir = async (fn: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), "mill-diagrams-"));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
};

const counting = (svg: string | null) => {
  let calls = 0;
  const render: DiagramRenderer = async () => { calls++; return svg; };
  return { render, calls: () => calls };
};

test("a miss renders and writes; a hit reads the file and never calls the renderer", async () => {
  await withTempDir(async (dir) => {
    const inner = counting("<svg data-one></svg>");
    const cached = cachedRenderer(dir, inner.render);

    expect(await cached("mermaid", "graph TD; A-->B;")).toBe("<svg data-one></svg>");
    expect(inner.calls()).toBe(1);
    expect((await readdir(dir)).length).toBe(1);

    expect(await cached("mermaid", "graph TD; A-->B;")).toBe("<svg data-one></svg>");
    expect(inner.calls()).toBe(1);                       // still one: the second call was a hit
  });
});

test("the key changes with source, with language, and with the version tag", async () => {
  await withTempDir(async (dir) => {
    const inner = counting("<svg/>");

    await cachedRenderer(dir, inner.render)("mermaid", "A");
    await cachedRenderer(dir, inner.render)("mermaid", "B");          // different source
    await cachedRenderer(dir, inner.render)("dot", "A");              // different language
    await cachedRenderer(dir, inner.render, "bumped")("mermaid", "A");// different version tag

    expect(inner.calls()).toBe(4);
    expect((await readdir(dir)).length).toBe(4);
  });
});

test("a failed render is not cached, so a capable machine can still render it later", async () => {
  await withTempDir(async (dir) => {
    const failing = counting(null);
    const cached = cachedRenderer(dir, failing.render);

    expect(await cached("mermaid", "bad")).toBeNull();
    expect(await cached("mermaid", "bad")).toBeNull();
    expect(failing.calls()).toBe(2);                     // called again, not remembered as a failure
    expect(await readdir(dir)).toEqual([]);
  });
});

test("a throwing renderer degrades to null rather than taking the page down", async () => {
  await withTempDir(async (dir) => {
    const cached = cachedRenderer(dir, async () => { throw new Error("no browser"); });
    expect(await cached("mermaid", "graph TD; A-->B;")).toBeNull();
  });
});

test("an unwritable cache directory still serves the render", async () => {
  await withTempDir(async (parent) => {
    const dir = join(parent, "readonly", "cache");
    await chmod(parent, 0o500);                          // cannot create the subdirectory
    try {
      const cached = cachedRenderer(dir, async () => "<svg data-two></svg>");
      expect(await cached("mermaid", "graph TD; A-->B;")).toBe("<svg data-two></svg>");
    } finally {
      await chmod(parent, 0o700);                        // let the temp cleanup succeed
    }
  });
});

test("the cache version constant is exported so a consumer can fold in its own", () => {
  expect(typeof CACHE_VERSION).toBe("string");
  expect(CACHE_VERSION.length).toBeGreaterThan(0);
});
