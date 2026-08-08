// proof/verify.ts — `proof verify`: the diff-aware gate. Where `proof check` asks whether the board
// is well formed, this asks whether the board is TRUE: it reads the plans, reads what version
// control says actually changed, and reports where the two disagree.
//
// This module is the git half only. Every judgement lives in core/verify.ts (pure), the same split
// check.ts uses. Nothing here decides anything; it collects a `Diff` and hands it over.
import { relative, resolve } from "node:path";
import { loadPlans } from "./loader.ts";
import { verifyAgainstDiff, type Diff, type VerifyProblem } from "./core/verify.ts";

export interface VerifyReport {
  ok: boolean;
  problems: VerifyProblem[];
  planCount: number;
  fileCount: number;
  base: string;
}

export interface VerifyOptions {
  /** what to diff against. Default "HEAD" (the working tree, staged and not). A branch review
   *  passes something like "main" to see the whole branch rather than only what is still dirty. */
  base?: string;
  /** injected for tests, so the suite never shells out to git */
  git?: GitReader;
}

// The whole git surface this needs, as one injectable interface — so the tests can describe a
// repository instead of building one.
export interface GitReader {
  root(): Promise<string | null>;
  changedFiles(base: string): Promise<string[]>;
  untrackedFiles(): Promise<string[]>;
  /** the added (`+`) lines of one file's diff; [] for a file git has never seen */
  addedLines(base: string, file: string): Promise<string[]>;
}

async function run(args: string[], cwd: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "ignore" });
    const out = await new Response(proc.stdout).text();
    return (await proc.exited) === 0 ? out : null;
  } catch {
    return null;   // git absent
  }
}
const lines = (out: string | null) => (out ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

export function gitReader(cwd: string): GitReader {
  return {
    async root() {
      const out = await run(["rev-parse", "--show-toplevel"], cwd);
      return out ? out.trim() : null;
    },
    async changedFiles(base) {
      return lines(await run(["diff", "--name-only", base], cwd));
    },
    async untrackedFiles() {
      return lines(await run(["ls-files", "--others", "--exclude-standard"], cwd));
    },
    async addedLines(base, file) {
      const out = await run(["diff", "-U0", base, "--", file], cwd);
      // a file git has no history for produces no diff; the caller handles that case by reading
      // the whole file instead, so an empty result here is not the same as "nothing was added"
      return (out ?? "").split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
    },
  };
}

const TICKED = /^\s*[-*]\s*\[[xX]\]\s*(.+?)\s*$/;
const DONE_STATUS = /^\s*status:\s*["']?done["']?\s*$/;

/**
 * Read the plans in `dir`, read the diff, and report the disagreements.
 *
 * Untracked plan files are read whole rather than diffed, because git has no before-image to
 * compare against: a plan that arrives already carrying ticks is claiming that work is done, and
 * treating "no diff" as "nothing ticked" would let the newest plans through unchecked.
 */
export async function runVerify(dir: string, opts: VerifyOptions = {}): Promise<VerifyReport> {
  const base = opts.base ?? "HEAD";
  const plansDir = resolve(dir);
  const git = opts.git ?? gitReader(plansDir);

  const root = await git.root();
  if (root === null) {
    return { ok: false, planCount: 0, fileCount: 0, base, problems: [{ planId: null, severity: "error", field: "git", message: `not a git repository (or git is unavailable), so there is no diff to verify against` }] };
  }

  const { plans: loaded } = await loadPlans(plansDir);
  const plans = loaded.map((lp) => lp.plan);

  const untracked = await git.untrackedFiles();
  const untrackedSet = new Set(untracked);
  const files = [...new Set([...(await git.changedFiles(base)), ...untracked])].sort();

  // plan id → its path as git reports it, so a changed file can be traced back to the plan it is
  const rel = relative(root, plansDir).split("\\").join("/");
  const pathOf = (id: string) => (rel ? `${rel}/${id}.md` : `${id}.md`);

  const newlyTicked: Record<string, string[]> = {};
  const newlyDone: string[] = [];
  for (const lp of loaded) {
    const path = pathOf(lp.plan.id);
    if (!files.includes(path)) continue;
    const added = untrackedSet.has(path)
      ? lp.plan.body.split("\n")                       // no before-image: the whole plan is new
      : await git.addedLines(base, path);
    const ticks = added.map((l) => l.match(TICKED)?.[1]).filter((t): t is string => !!t);
    if (ticks.length > 0) newlyTicked[lp.plan.id] = ticks;
    if (lp.plan.status === "done" && (untrackedSet.has(path) || added.some((l) => DONE_STATUS.test(l)))) {
      newlyDone.push(lp.plan.id);
    }
  }

  const diff: Diff = { files, newlyTicked, newlyDone };
  const problems = verifyAgainstDiff(plans, diff, { ignore: rel ? [rel] : [] });

  return { ok: !problems.some((p) => p.severity === "error"), problems, planCount: plans.length, fileCount: files.length, base };
}

// Plain text for a terminal or a CI log — no ANSI, no backticks, matching formatReport in check.ts.
export function formatVerifyReport(report: VerifyReport): string {
  const out = report.problems.map((p) => `[${p.severity}] ${p.planId ?? "(none)"} ${p.field}: ${p.message}`);
  out.push(`${report.planCount} plans, ${report.fileCount} changed file(s) vs ${report.base}, ${report.problems.length} problems`);
  out.push(report.ok ? "OK" : "FAIL");
  return out.join("\n");
}
