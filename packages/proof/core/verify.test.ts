// proof/core/verify.test.ts — the pure half of `proof verify`: plans + a diff → disagreements.
import { test, expect } from "bun:test";
import { covers, verifyAgainstDiff, type Diff } from "./verify.ts";
import type { Plan, PlanStatus } from "./types.ts";

const plan = (id: string, status: PlanStatus, touches: string[]): Plan => ({
  id, status, touches, track: null, depends: [], owner: "ai", title: id, tasks: [], body: "",
});
const diff = (over: Partial<Diff> = {}): Diff => ({ files: [], newlyTicked: {}, newlyDone: [], ...over });

// ---- path coverage ----------------------------------------------------------

test("an entry covers a file at or under it, in that direction only", () => {
  expect(covers("src/", "src/server.ts")).toBe(true);
  expect(covers("src", "src/deep/thing.ts")).toBe(true);
  expect(covers("src/server.ts", "src/server.ts")).toBe(true);
  expect(covers("./src/", "src/server.ts")).toBe(true);
  // NOT the other way round: a file does not cover its own parent entry
  expect(covers("src/server.ts", "src")).toBe(false);
});

test("coverage never matches on a suffix or a basename", () => {
  // the rubber-stamp failure mode: "server.ts" must not cover every server.ts in the tree
  expect(covers("server.ts", "src/server.ts")).toBe(false);
  expect(covers("src/", "other-src/server.ts")).toBe(false);
  expect(covers("src", "srcfile.ts")).toBe(false);
});

test("an entry pointing out of the repo covers nothing", () => {
  expect(covers("../pantry/", "../pantry/cli.ts")).toBe(false);
});

// ---- a. scope growth --------------------------------------------------------

test("a changed file under a doing plan's touches is clean", () => {
  const problems = verifyAgainstDiff([plan("a", "doing", ["src/"])], diff({ files: ["src/server.ts"] }));
  expect(problems).toEqual([]);
});

test("a changed file no plan claims is scope growth", () => {
  const problems = verifyAgainstDiff([plan("a", "doing", ["src/"])], diff({ files: ["tools/export.ts"] }));
  expect(problems).toHaveLength(1);
  expect(problems[0]).toMatchObject({ planId: null, severity: "warning", field: "touches" });
  expect(problems[0].message).toContain("tools/export.ts");
});

test("a changed file claimed only by an unstarted plan names that plan", () => {
  const plans = [plan("a", "doing", ["src/"]), plan("b", "todo", ["tools/"])];
  const problems = verifyAgainstDiff(plans, diff({ files: ["tools/export.ts"] }));
  expect(problems).toHaveLength(1);
  expect(problems[0].planId).toBe("b");
  expect(problems[0].message).toContain("not claimed as doing");
});

test("ignored paths are not scope growth (editing a plan is the trail, not the work)", () => {
  const problems = verifyAgainstDiff([plan("a", "doing", ["src/"])], diff({ files: ["plans/a.md"] }), { ignore: ["plans"] });
  expect(problems).toEqual([]);
});

// ---- b. the unbacked tick (the one error) -----------------------------------

test("ticking a task with no change under that plan is an ERROR", () => {
  const problems = verifyAgainstDiff(
    [plan("a", "doing", ["src/"])],
    diff({ files: ["plans/a.md"], newlyTicked: { a: ["build the parser"] } }),
    { ignore: ["plans"] },
  );
  expect(problems).toHaveLength(1);
  expect(problems[0]).toMatchObject({ planId: "a", severity: "error", field: "tasks" });
  expect(problems[0].message).toContain("build the parser");
});

test("ticking a task IS backed when the diff touches the plan's area", () => {
  const problems = verifyAgainstDiff(
    [plan("a", "doing", ["src/"])],
    diff({ files: ["plans/a.md", "src/server.ts"], newlyTicked: { a: ["build the parser"] } }),
    { ignore: ["plans"] },
  );
  expect(problems).toEqual([]);
});

test("a tick against an unknown plan id is ignored, not crashed on", () => {
  const problems = verifyAgainstDiff([plan("a", "doing", ["src/"])], diff({ newlyTicked: { ghost: ["x"] } }));
  expect(problems).toEqual([]);
});

// ---- c. the untouched done --------------------------------------------------

test("closing a plan over a diff that never entered its area is a warning", () => {
  const problems = verifyAgainstDiff(
    [plan("a", "done", ["src/"])],
    diff({ files: ["plans/a.md"], newlyDone: ["a"] }),
    { ignore: ["plans"] },
  );
  expect(problems).toHaveLength(1);
  expect(problems[0]).toMatchObject({ planId: "a", severity: "warning", field: "status" });
});

test("a done plan that was not closed by THIS diff is not judged", () => {
  const problems = verifyAgainstDiff([plan("a", "done", ["src/"])], diff({ files: ["plans/a.md"] }), { ignore: ["plans"] });
  expect(problems).toEqual([]);
});

// ---- d. saying what could not be verified -----------------------------------

test("a doing plan with no touches is reported rather than silently passed", () => {
  const problems = verifyAgainstDiff([plan("a", "doing", [])], diff());
  expect(problems).toHaveLength(1);
  expect(problems[0].message).toContain("nothing about it can be verified");
});

test("a doing plan whose touches all leave the repo is reported too", () => {
  const problems = verifyAgainstDiff([plan("a", "doing", ["../pantry/", "../greenroom/"])], diff());
  expect(problems).toHaveLength(1);
  expect(problems[0].message).toContain("outside this repo");
});

test("a plan with a mix of in-tree and out-of-tree touches is verifiable", () => {
  const problems = verifyAgainstDiff([plan("a", "doing", ["src/", "../pantry/"])], diff({ files: ["src/x.ts"] }));
  expect(problems).toEqual([]);
});

// ---- the whole shape --------------------------------------------------------

test("only an unbacked tick can fail the gate; the rest are warnings", () => {
  const plans = [plan("a", "doing", ["src/"]), plan("b", "done", ["tools/"])];
  const problems = verifyAgainstDiff(
    plans,
    diff({ files: ["docs/thing.md", "plans/b.md"], newlyDone: ["b"] }),
    { ignore: ["plans"] },
  );
  expect(problems.every((p) => p.severity === "warning")).toBe(true);
  expect(problems).toHaveLength(2);   // the stray doc, and b closed without touching tools/
});
