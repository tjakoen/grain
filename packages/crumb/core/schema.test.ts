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

test("an absent route parses to null, silently — no navigable entry, not an error", () => {
  const { tour, errors } = parseTour(`---\nmode: demo\n---\n## screen\nx\n`, "t");
  expect(tour.route).toBeNull();
  expect(errors.some((e) => e.field === "route")).toBe(false);
});

test("an empty declared route also parses to null, silently", () => {
  const { tour, errors } = parseTour(`---\nmode: demo\nroute:\n---\n## screen\nx\n`, "t");
  expect(tour.route).toBeNull();
  expect(errors.some((e) => e.field === "route")).toBe(false);
});

test("a relative (non-absolute) declared route degrades to null and is reported", () => {
  const { tour, errors } = parseTour(`---\nmode: demo\nroute: notes\n---\n## screen\nx\n`, "t");
  expect(tour.route).toBeNull();
  expect(errors.some((e) => e.field === "route")).toBe(true);
});

test("an absolute declared route is kept exactly as-is (root-mounted multi-page hosts, unchanged)", () => {
  const { tour, errors } = parseTour(`---\nmode: demo\nroute: /notes\n---\n## screen\nx\n`, "t");
  expect(tour.route).toBe("/notes");
  expect(errors.some((e) => e.field === "route")).toBe(false);
});

// ---- prefill: stage a step's own field through the door ---------------------

test("a prefill on a field: surface parses, cleanly, with no error", () => {
  const { tour, errors } = parseTour(`---\nmode: demo\n---\n## field:contact-message\n- prefill: Hi TJ, about grain.\nx\n`, "t");
  expect(tour.steps[0].prefill).toBe("Hi TJ, about grain.");
  expect(errors.some((e) => e.field === "steps[0].prefill")).toBe(false);
});

test("\\n in a prefill becomes a real newline, same convention as the prompt card's template", () => {
  const { tour } = parseTour(`---\nmode: demo\n---\n## field:contact-message\n- prefill: line one\\nline two\nx\n`, "t");
  expect(tour.steps[0].prefill).toBe("line one\nline two");
});

test("a prefill on a non-field: surface can never work, so it is reported and degrades to null", () => {
  const { tour, errors } = parseTour(`---\nmode: demo\n---\n## nav:/notes\n- prefill: Hi TJ.\nx\n`, "t");
  expect(tour.steps[0].prefill).toBeNull();
  expect(errors.some((e) => e.field === "steps[0].prefill" && /not a .field:. surface/.test(e.message))).toBe(true);
});

test("a prefill that is empty after trimming is reported and degrades to null", () => {
  const { tour, errors } = parseTour(`---\nmode: demo\n---\n## field:contact-message\n- prefill:    \nx\n`, "t");
  expect(tour.steps[0].prefill).toBeNull();
  expect(errors.some((e) => e.field === "steps[0].prefill" && /empty/.test(e.message))).toBe(true);
});

test("a step with no prefill line parses to null, silently — most steps stage nothing", () => {
  const { tour, errors } = parseTour(`---\nmode: demo\n---\n## screen\nx\n`, "t");
  expect(tour.steps[0].prefill).toBeNull();
  expect(errors.some((e) => e.field === "steps[0].prefill")).toBe(false);
});
