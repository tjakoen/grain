// proof/core/schema.test.ts — the plan parser: frontmatter → typed Plan, body → title + tasks.
import { test, expect } from "bun:test";
import { parsePlan } from "./schema.ts";

const PLAN = `---
id: 001-timeline
status: doing
track: A
depends: [000-core]
touches: [grain/ai/contract.ts, grain/ai/reasoner.ts]
owner: ai
---

# Interaction timeline

Some prose.

- [x] design the schema
- [ ] build the parser
- [ ] wire the board
`;

test("frontmatter → typed Plan fields", () => {
  const { plan, errors } = parsePlan(PLAN, "001-timeline");
  expect(errors).toEqual([]);
  expect(plan.status).toBe("doing");
  expect(plan.owner).toBe("ai");
  expect(plan.track).toBe("A");
  expect(plan.depends).toEqual(["000-core"]);
  expect(plan.touches).toEqual(["grain/ai/contract.ts", "grain/ai/reasoner.ts"]);
});

test("title comes from the first heading, id from the caller (not frontmatter)", () => {
  const { plan } = parsePlan(PLAN, "001-timeline");
  expect(plan.title).toBe("Interaction timeline");
  expect(plan.id).toBe("001-timeline");
});

test("title falls back to the id when the body has no heading", () => {
  const { plan } = parsePlan("---\nstatus: todo\nowner: ai\n---\n\njust prose\n", "orphan");
  expect(plan.title).toBe("orphan");
});

test("checklist rows become tasks with done state; other lines ignored", () => {
  const { plan } = parsePlan(PLAN, "001-timeline");
  expect(plan.tasks).toEqual([
    { text: "design the schema", done: true },
    { text: "build the parser", done: false },
    { text: "wire the board", done: false },
  ]);
});

test("a done checkbox is case-insensitive on the mark", () => {
  const { plan } = parsePlan("# t\n- [X] upper\n- [x] lower\n", "x");
  expect(plan.tasks.every((t) => t.done)).toBe(true);
});

test("invalid status falls back to todo AND reports the error (never silently dropped)", () => {
  const { plan, errors } = parsePlan("---\nstatus: wip\nowner: ai\n---\n# t\n", "x");
  expect(plan.status).toBe("todo");
  const statusErr = errors.find((e) => e.field === "status");
  expect(statusErr?.message).toContain("wip");
});

test("invalid owner falls back to ai and reports", () => {
  const { plan, errors } = parsePlan("---\nstatus: todo\nowner: robot\n---\n# t\n", "x");
  expect(plan.owner).toBe("ai");
  expect(errors.some((e) => e.field === "owner")).toBe(true);
});

test("missing status/owner default and are reported", () => {
  const { plan, errors } = parsePlan("# just a title\n", "x");
  expect(plan.status).toBe("todo");
  expect(plan.owner).toBe("ai");
  expect(errors.map((e) => e.field).sort()).toEqual(["owner", "status"]);
});

test("a frontmatter id that disagrees with the filename is reported, filename wins", () => {
  const { plan, errors } = parsePlan("---\nid: wrong\nstatus: todo\nowner: ai\n---\n# t\n", "right");
  expect(plan.id).toBe("right");
  expect(errors.some((e) => e.field === "id")).toBe(true);
});

test("empty track is normalized to null", () => {
  const { plan } = parsePlan("---\nstatus: todo\nowner: ai\ntrack:\n---\n# t\n", "x");
  expect(plan.track).toBeNull();
});
