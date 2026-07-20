// crumb/from-timeline.test.ts — UNIT: the flagship projection (audit trail → review tour).
// Pure data in, pure data out — no DOM, no fs. The strongest assertion is the round-trip: a tour
// the engine generates re-parses through the same `parseTour` a human-authored tour uses, unchanged.
import { test, expect } from "bun:test";
import type { LogEntry } from "@tjakoen/grain/ai/contract.ts";
import { parseTour } from "./core/schema.ts";
import { stepsFromTimeline, tourFromTimeline, toTourMarkdown } from "./from-timeline.ts";

// A LogEntry with review-shaped defaults; override per case.
const entry = (o: Partial<LogEntry>): LogEntry => ({
  session: "s1", source: "ai", kind: "response", screen: "/notes",
  surface: "note:hello", action: "say.set", ok: true, ops: 1, ...o,
});

test("keeps only AI crossings that changed or attempted a surface", () => {
  const trail: LogEntry[] = [
    entry({ surface: "note:a", ops: 2 }),
    entry({ surface: "note:b", source: "user" }),           // human work — skip
    entry({ surface: "note:c", kind: "intent", ops: 0 }),   // the request half, no ops — skip
    entry({ surface: "note:d", ok: false, ops: 0 }),        // failed AI attempt — keep (known issue)
  ];
  const steps = stepsFromTimeline(trail);
  expect(steps.map((s) => s.surface)).toEqual(["note:a", "note:d"]);
});

test("folds repeated crossings on one surface into a single step, first-seen order", () => {
  const trail: LogEntry[] = [
    entry({ surface: "item:1", action: "item.archive", ops: 1 }),
    entry({ surface: "item:2", action: "say.set", ops: 3 }),
    entry({ surface: "item:1", action: "navigate", ops: 2 }),   // same surface again
    entry({ surface: "item:1", action: "item.archive", ops: 1 }), // dup action — not repeated
  ];
  const steps = stepsFromTimeline(trail);
  expect(steps.map((s) => s.surface)).toEqual(["item:1", "item:2"]);
  const first = steps[0];
  expect(first.review).toContain("4 render ops");            // 1 + 2 + 1 summed
  expect(first.review).toContain("item.archive, navigate");  // unique, in order
  expect(first.status).toBe("needs-verification");
});

test("a failed crossing marks the whole surface a known-issue", () => {
  const steps = stepsFromTimeline([
    entry({ surface: "item:1", ops: 1 }),
    entry({ surface: "item:1", ok: false, action: "item.archive", ops: 0 }),
  ]);
  expect(steps[0].status).toBe("known-issue");
  expect(steps[0].verify).toContain("Investigate");
});

test("session filter scopes the projection", () => {
  const steps = stepsFromTimeline([
    entry({ surface: "note:a", session: "s1" }),
    entry({ surface: "note:b", session: "s2" }),
  ], { session: "s2" });
  expect(steps.map((s) => s.surface)).toEqual(["note:b"]);
});

test("empty / all-filtered trail yields no steps", () => {
  expect(stepsFromTimeline([])).toEqual([]);
  expect(stepsFromTimeline([entry({ source: "user" })])).toEqual([]);
});

test("tourFromTimeline assembles a dev tour, route from the first routed step", () => {
  const tour = tourFromTimeline([
    entry({ surface: "screen", screen: "", ops: 1 }),       // global surface — no route
    entry({ surface: "note:hello", screen: "/notes", ops: 1 }),
  ], { id: "review-abc" });
  expect(tour.mode).toBe("dev");
  expect(tour.id).toBe("review-abc");
  expect(tour.title).toBe("Review — review-abc");
  expect(tour.route).toBe("/notes");                        // first step with a route wins
  expect(tour.steps[0].at).toBeNull();                      // bare screen carries no route
});

test("a generated tour round-trips through parseTour unchanged", () => {
  const tour = tourFromTimeline([
    entry({ surface: "note:hello", screen: "/notes", action: "say.set", ops: 2 }),
    entry({ surface: "item:1", screen: "/notes", ok: false, action: "item.archive", ops: 0 }),
  ], { id: "review-xyz", title: "Nav drawer review" });

  const md = toTourMarkdown(tour);
  const { tour: reparsed, errors } = parseTour(md, tour.id);
  expect(errors).toEqual([]);
  expect(reparsed).toEqual(tour);
});
