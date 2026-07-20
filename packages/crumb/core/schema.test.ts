// crumb/core/schema.test.ts — UNIT: the tour parser (frontmatter + `## <surface>` body grammar).
import { test, expect } from "bun:test";
import { parseTour } from "./schema.ts";

const TOUR = `---
id: welcome
mode: demo
title: "A tour"
route: /
---
Intro prose here.

## screen
This screen is global.

## note:hello
- at: /notes
- status: new
- verify: open Notes; the first card is pinned
Content lives on its own page.
`;

test("parses frontmatter + intro + ordered steps", () => {
  const { tour, errors } = parseTour(TOUR, "welcome");
  expect(errors).toEqual([]);
  expect(tour.mode).toBe("demo");
  expect(tour.title).toBe("A tour");
  expect(tour.route).toBe("/");
  expect(tour.intro).toBe("Intro prose here.");
  expect(tour.steps.length).toBe(2);
});

test("a step's heading IS its surface address; meta lines are split from the say prose", () => {
  const { tour } = parseTour(TOUR, "welcome");
  const [s0, s1] = tour.steps;
  expect(s0.surface).toBe("screen");
  expect(s0.at).toBe(null);                 // global surface — no navigation
  expect(s0.say).toBe("This screen is global.");
  expect(s1.surface).toBe("note:hello");
  expect(s1.at).toBe("/notes");
  expect(s1.status).toBe("new");
  expect(s1.verify).toBe("open Notes; the first card is pinned");
  expect(s1.say).toBe("Content lives on its own page.");   // meta lines are NOT in the prose
});

test("an unknown mode falls back to demo and is reported (best-effort, nothing dropped)", () => {
  const { tour, errors } = parseTour(`---\nmode: sideways\n---\n## screen\nx\n`, "t");
  expect(tour.mode).toBe("demo");
  expect(errors.some((e) => e.field === "mode")).toBe(true);
});

test("an invalid verification status is ignored with an error, not accepted", () => {
  const { tour, errors } = parseTour(`---\nmode: dev\n---\n## screen\n- status: shipped\nx\n`, "t");
  expect(tour.steps[0].status).toBe(null);
  expect(errors.some((e) => e.field === "steps[0].status")).toBe(true);
});

test("a tour with no steps is flagged", () => {
  const { errors } = parseTour(`---\nmode: demo\n---\njust intro\n`, "empty");
  expect(errors.some((e) => e.field === "steps")).toBe(true);
});
