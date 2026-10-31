// proof/verify.test.ts — the git half of `proof verify`: turning a repository's state into the
// `Diff` the pure core judges. The GitReader is injected, so the suite describes a repository
// instead of building one. A real nested-directory fixture also checks Git path semantics.
import { test, expect } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runVerify, formatVerifyReport, gitReader, type GitReader } from "./verify.ts";

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

for (const method of ["changedFiles", "untrackedFiles", "addedLines"] as const) {
  test(`a failed ${method} command fails verification rather than supplying an empty diff`, async () => {
    await withPlans({ "a.md": PLAN_A }, async (root, plansDir) => {
      const git = fakeGit(root, {
        changedFiles: async () => ["plans/a.md"],
        [method]: async () => { throw new Error(`git ${method} failed`); },
      });
      const report = await runVerify(plansDir, { git });
      expect(report.ok).toBe(false);
      expect(report.problems[0]).toMatchObject({ field: "git", severity: "error" });
      expect(report.problems[0].message).toContain(method);
    });
  });
}

test("the real reader rejects an invalid comparison reference", async () => {
  const reader = gitReader(import.meta.dir);
  await expect(reader.changedFiles("PROOF_AUDIT_MISSING_REF_20261031")).rejects.toThrow();
});

test("a successful empty comparison is still verifiable", async () => {
  await withPlans({}, async (root, plansDir) => {
    const report = await runVerify(plansDir, { git: fakeGit(root) });
    expect(report.ok).toBe(true);
    expect(report.fileCount).toBe(0);
  });
});

test("a real reader inside plans collects root-relative untracked files and plan additions", async () => {
  await withPlans({ "a.md": PLAN_A.replace("[x]", "[ ]") }, async (root, plansDir) => {
    const git = async (...args: string[]) => {
      const process = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
      const error = await new Response(process.stderr).text();
      if (await process.exited) throw new Error(error);
    };
    await git("init");
    await git("add", ".");
    await git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "Initial fixture");
    await writeFile(join(plansDir, "a.md"), PLAN_A);
    await writeFile(join(root, "outside.txt"), "unclaimed root file");
    await writeFile(join(plansDir, "new.md"), PLAN_A.replace("id: a", "id: new"));
    const reader = gitReader(plansDir);
    expect(await reader.untrackedFiles()).toEqual(["outside.txt", "plans/new.md"]);
    expect(await reader.changedFiles("HEAD")).toEqual(["plans/a.md"]);
    expect(await reader.addedLines("HEAD", "plans/a.md")).toContain("- [x] the done one");
    const report = await runVerify(plansDir);
    expect(report.fileCount).toBe(3);
    expect(report.ok).toBe(false);
    expect(report.problems.some(problem => problem.planId === "a" && problem.field === "tasks")).toBe(true);
    expect(report.problems.some(problem => problem.planId === "new" && problem.field === "tasks")).toBe(true);
  });
});
