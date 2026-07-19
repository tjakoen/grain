// proof/core/index.test.ts — the derived index + the board-level checks.
import { test, expect } from "bun:test";
import { buildIndex, validateBoard } from "./index.ts";
import type { Plan } from "./types.ts";

function plan(over: Partial<Plan>): Plan {
  return {
    id: "p", status: "todo", track: null, depends: [], touches: [], owner: "ai",
    title: "P", tasks: [], body: "", ...over,
  };
}

test("buildIndex tallies status counts across plans", () => {
  const idx = buildIndex(
    [plan({ id: "a", status: "todo" }), plan({ id: "b", status: "doing" }), plan({ id: "c", status: "doing" })],
    "2026-07-08T00:00:00Z",
  );
  expect(idx.counts).toEqual({ todo: 1, doing: 2, done: 0, blocked: 0 });
  expect(idx.generatedAt).toBe("2026-07-08T00:00:00Z");
});

test("index entries carry task progress but not the body", () => {
  const idx = buildIndex(
    [plan({ id: "a", tasks: [{ text: "x", done: true }, { text: "y", done: false }] })],
    "t",
  );
  const entry = idx.plans[0];
  expect(entry.tasksTotal).toBe(2);
  expect(entry.tasksDone).toBe(1);
  expect(entry as unknown as Record<string, unknown>).not.toHaveProperty("body");
});

test("validateBoard flags a dangling dependency", () => {
  const issues = validateBoard([plan({ id: "a", depends: ["ghost"] })]);
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ planId: "a", field: "depends" });
});

test("a satisfied dependency is not flagged", () => {
  const issues = validateBoard([plan({ id: "a", depends: ["b"] }), plan({ id: "b" })]);
  expect(issues).toEqual([]);
});

test("validateBoard flags done-with-open-tasks (a done plan must not lie)", () => {
  const issues = validateBoard([
    plan({ id: "a", status: "done", tasks: [{ text: "x", done: true }, { text: "y", done: false }] }),
  ]);
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({ planId: "a", field: "status" });
  expect(issues[0].message).toContain("1");
});

test("a done plan with all tasks ticked is clean", () => {
  const issues = validateBoard([plan({ id: "a", status: "done", tasks: [{ text: "x", done: true }] })]);
  expect(issues).toEqual([]);
});
