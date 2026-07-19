// proof/loader.test.ts — the filesystem loader against the example plans folder.
import { test, expect } from "bun:test";
import { join } from "node:path";
import { loadPlans } from "./loader.ts";

const EXAMPLE = join(import.meta.dir, "example");
// a stub so the loader never touches git/the clock in tests (deterministic)
const noAge = async () => null;

test("loads every .md in the folder as a plan, id = lowercased stem", async () => {
  const { plans } = await loadPlans(EXAMPLE, noAge);
  const ids = plans.map((p) => p.plan.id).sort();
  expect(ids).toEqual(["001-core-parser", "002-board-server", "003-inject", "004-mindmap"]);
});

test("parses frontmatter + body into the Plan (status, owner, depends, tasks)", async () => {
  const { plans } = await loadPlans(EXAMPLE, noAge);
  const board = plans.find((p) => p.plan.id === "002-board-server")!;
  expect(board.plan.status).toBe("doing");
  expect(board.plan.depends).toEqual(["001-core-parser"]);
  expect(board.plan.tasks.length).toBe(4);
  expect(board.raw).toContain("# The board server");
});

test("a README.md in the folder is NOT treated as a plan", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const d = await mkdtemp(join(tmpdir(), "proof-loader-"));
  try {
    await writeFile(join(d, "README.md"), "# not a plan\n", "utf8");
    await writeFile(join(d, "001-real.md"), "---\nstatus: todo\nowner: ai\n---\n# Real\n", "utf8");
    const { plans } = await loadPlans(d, noAge);
    expect(plans.map((p) => p.plan.id)).toEqual(["001-real"]);
  } finally {
    await rm(d, { recursive: true, force: true });
  }
});

test("a missing plans folder yields an empty board, not a crash", async () => {
  const { plans, duplicates } = await loadPlans(join(EXAMPLE, "does-not-exist"), noAge);
  expect(plans).toEqual([]);
  expect(duplicates).toEqual([]);
});

test("lastModified is populated by the injected function", async () => {
  const { plans } = await loadPlans(EXAMPLE, async () => "2026-07-08T00:00:00Z");
  expect(plans[0].lastModified).toBe("2026-07-08T00:00:00Z");
});
