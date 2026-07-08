// proof/check.test.ts — `runCheck` against real (temp) plan files, hermetic and clock-free.
// Each test writes its own throwaway plans/ folder under the OS tmpdir and removes it after —
// no fixtures shared with loader.test.ts, since these are deliberately malformed on purpose.
import { test, expect, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCheck, formatReport } from "./check.ts";

// stub so tests never touch git/the clock — deterministic "no age info" unless a test injects one
const noAge = async () => null;

let dir: string | null = null;

async function makeDir(files: Record<string, string>): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), "proof-check-"));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content, "utf8");
  }
  return dir;
}

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = null;
});

test("a clean board is ok with zero error-severity problems", async () => {
  const d = await makeDir({
    "001-a.md": "---\nstatus: todo\nowner: ai\n---\n\n# A\n\n- [ ] step one\n",
    "002-b.md": "---\nstatus: doing\nowner: human\ndepends: [001-a]\n---\n\n# B\n",
  });
  const report = await runCheck(d, { lastModified: noAge });
  expect(report.ok).toBe(true);
  expect(report.problems.filter((p) => p.severity === "error")).toEqual([]);
  expect(report.planCount).toBe(2);
});

test("an invalid status value is an error problem", async () => {
  const d = await makeDir({
    "001-a.md": "---\nstatus: bogus\nowner: ai\n---\n\n# A\n",
  });
  const report = await runCheck(d, { lastModified: noAge });
  expect(report.ok).toBe(false);
  const problem = report.problems.find((p) => p.field === "status");
  expect(problem?.severity).toBe("error");
  expect(problem?.planId).toBe("001-a");
});

test("a dangling depends is an error", async () => {
  const d = await makeDir({
    "001-a.md": "---\nstatus: todo\nowner: ai\ndepends: [does-not-exist]\n---\n\n# A\n",
  });
  const report = await runCheck(d, { lastModified: noAge });
  expect(report.ok).toBe(false);
  const problem = report.problems.find((p) => p.field === "depends");
  expect(problem).toEqual({
    planId: "001-a",
    severity: "error",
    field: "depends",
    message: 'depends on "does-not-exist", which no plan provides',
  });
});

test("a done plan with an open task is an error", async () => {
  const d = await makeDir({
    "001-a.md": "---\nstatus: done\nowner: ai\n---\n\n# A\n\n- [ ] still open\n- [x] finished\n",
  });
  const report = await runCheck(d, { lastModified: noAge });
  expect(report.ok).toBe(false);
  const problem = report.problems.find((p) => p.field === "status" && p.planId === "001-a");
  expect(problem?.message).toContain("unticked task(s)");
});

test("a doing plan untouched past staleDays is a warning, and ok stays true", async () => {
  const d = await makeDir({
    "001-a.md": "---\nstatus: doing\nowner: ai\n---\n\n# A\n",
  });
  const now = new Date("2026-07-08T00:00:00Z");
  const lastModified = async () => "2026-06-01T00:00:00Z"; // 37 days before `now`
  const report = await runCheck(d, { now, lastModified, staleDays: 14 });
  const warning = report.problems.find((p) => p.severity === "warning");
  expect(warning).toBeDefined();
  expect(warning?.field).toBe("status");
  expect(warning?.message).toBe("doing but untouched for 37 days");
  expect(report.ok).toBe(true); // a warning must never fail the check
});

test("duplicate plan ids (two files, same stem) are an error", async () => {
  // The collision only exists on a CASE-SENSITIVE filesystem: "001-a.md" and "001-A.md" are the
  // same inode on macOS's default case-insensitive FS, so the two writes collapse to one file and
  // there is nothing to detect. Skip the assertion there; the guard still protects Linux/CI.
  const { readdir } = await import("node:fs/promises");
  const d = await makeDir({
    "001-a.md": "---\nstatus: todo\nowner: ai\n---\n\n# A lower\n",
    "001-A.md": "---\nstatus: todo\nowner: ai\n---\n\n# A upper\n",
  });
  if ((await readdir(d)).length < 2) return;   // case-insensitive FS collapsed them → nothing to test
  const report = await runCheck(d, { lastModified: noAge });
  expect(report.ok).toBe(false);
  const problem = report.problems.find((p) => p.field === "id" && p.message.includes("duplicate"));
  expect(problem).toEqual({
    planId: "001-a",
    severity: "error",
    field: "id",
    message: 'duplicate plan id "001-a" (more than one file)',
  });
});

test("formatReport renders one line per problem plus a footer and OK/FAIL", async () => {
  const d = await makeDir({
    "001-a.md": "---\nstatus: bogus\nowner: ai\n---\n\n# A\n",
  });
  const report = await runCheck(d, { lastModified: noAge });
  const text = formatReport(report);
  expect(text).toContain("[error] 001-a status:");
  expect(text).toContain("1 plans, ");
  expect(text.trim().endsWith("FAIL")).toBe(true);
});
