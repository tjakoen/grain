// proof/verify.test.ts — the git half of `proof verify`: turning a repository's state into the
// `Diff` the pure core judges. The GitReader is injected, so the suite describes a repository
// instead of building one (no temp git repos, no shelling out, deterministic).
import { test, expect } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runVerify, formatVerifyReport, type GitReader } from "./verify.ts";

// a plans dir under <root>/plans, so the relative-path plumbing is actually exercised
async function withPlans(files: Record<string, string>, fn: (root: string, plansDir: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "proof-verify-"));
  const plansDir = join(root, "plans");
  await Bun.write(join(plansDir, ".keep"), "");
  try {
    for (const [name, body] of Object.entries(files)) await writeFile(join(plansDir, name), body, "utf8");
    await fn(root, plansDir);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const fakeGit = (root: string, over: Partial<GitReader> = {}): GitReader => ({
  root: async () => root,
  changedFiles: async () => [],
  untrackedFiles: async () => [],
  addedLines: async () => [],
  ...over,
});

const PLAN_A = `---
id: a
status: doing
touches: [src/]
owner: ai
---
# Plan A

- [x] the done one
- [ ] the open one
`;

test("a change inside the plan's touches passes", async () => {
  await withPlans({ "a.md": PLAN_A }, async (root, plansDir) => {
    const git = fakeGit(root, { changedFiles: async () => ["src/server.ts"] });
    const report = await runVerify(plansDir, { git });
    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
    expect(report.fileCount).toBe(1);
  });
});

test("the plans dir itself is never counted as scope growth", async () => {
  await withPlans({ "a.md": PLAN_A }, async (root, plansDir) => {
    const git = fakeGit(root, { changedFiles: async () => ["plans/a.md", "src/server.ts"] });
    const report = await runVerify(plansDir, { git });
    expect(report.problems).toEqual([]);
  });
});

test("a tick added by the diff, with nothing under touches, fails the gate", async () => {
  await withPlans({ "a.md": PLAN_A }, async (root, plansDir) => {
    const git = fakeGit(root, {
      changedFiles: async () => ["plans/a.md"],
      addedLines: async () => ["- [x] the done one"],
    });
    const report = await runVerify(plansDir, { git });
    expect(report.ok).toBe(false);
    expect(report.problems[0]).toMatchObject({ planId: "a", severity: "error", field: "tasks" });
    expect(formatVerifyReport(report)).toContain("FAIL");
  });
});

test("a tick already in the file, untouched by the diff, is not a new claim", async () => {
  await withPlans({ "a.md": PLAN_A }, async (root, plansDir) => {
    // the plan file changed, but the added lines carry no tick — prose was edited, nothing claimed
    const git = fakeGit(root, {
      changedFiles: async () => ["plans/a.md"],
      addedLines: async () => ["Some new prose."],
    });
    const report = await runVerify(plansDir, { git });
    expect(report.ok).toBe(true);
  });
});

test("an UNTRACKED plan is read whole, so a new plan cannot smuggle ticks past the gate", async () => {
  await withPlans({ "a.md": PLAN_A }, async (root, plansDir) => {
    // git has no before-image for an untracked file, so `git diff` is empty. Treating that as
    // "nothing was ticked" would let every brand-new plan through unchecked.
    const git = fakeGit(root, { untrackedFiles: async () => ["plans/a.md"], addedLines: async () => [] });
    const report = await runVerify(plansDir, { git });
    expect(report.ok).toBe(false);
    expect(report.problems[0]).toMatchObject({ planId: "a", field: "tasks" });
  });
});

test("a plan moved to done in the diff, with nothing under touches, warns but does not fail", async () => {
  const donePlan = PLAN_A.replace("status: doing", "status: done").replace("- [ ] the open one", "- [x] the open one");
  await withPlans({ "a.md": donePlan }, async (root, plansDir) => {
    const git = fakeGit(root, {
      changedFiles: async () => ["plans/a.md"],
      addedLines: async () => ["status: done"],
    });
    const report = await runVerify(plansDir, { git });
    expect(report.ok).toBe(true);                                    // a warning, not a failure
    expect(report.problems.some((p) => p.field === "status" && p.severity === "warning")).toBe(true);
  });
});

test("--base is reported, so a run says what it compared against", async () => {
  await withPlans({ "a.md": PLAN_A }, async (root, plansDir) => {
    const git = fakeGit(root, { changedFiles: async () => ["src/x.ts"] });
    const report = await runVerify(plansDir, { git, base: "main" });
    expect(report.base).toBe("main");
    expect(formatVerifyReport(report)).toContain("vs main");
  });
});

test("outside a git repo it fails loudly instead of passing on no evidence", async () => {
  await withPlans({ "a.md": PLAN_A }, async (_root, plansDir) => {
    const report = await runVerify(plansDir, { git: fakeGit("", { root: async () => null }) });
    expect(report.ok).toBe(false);
    expect(report.problems[0].field).toBe("git");
  });
});
