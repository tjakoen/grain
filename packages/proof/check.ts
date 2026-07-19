// proof/check.ts — `proof check`: the lint over a plans folder. Aggregates every way a plan
// (or the board as a whole) can be wrong — duplicate ids, per-file parse errors, board-level
// integrity (dangling `depends`, `done`-with-open-tasks), and staleness (a `doing` plan nobody
// has touched in a while) — into one report a CLI or CI step can act on. Pure aggregation: the
// actual checks live in loader.ts (fs/duplicates) and core/index.ts (validateBoard); this module
// adds nothing new except staleness and the report shape.
import { loadPlans, type LastModified } from "./loader.ts";
import { validateBoard } from "./core/index.ts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_STALE_DAYS = 14;

export interface CheckProblem {
  planId: string | null;
  severity: "error" | "warning";
  field: string;
  message: string;
}

export interface CheckReport {
  ok: boolean;
  problems: CheckProblem[];
  planCount: number;
}

export interface CheckOptions {
  now?: Date;
  staleDays?: number;
  lastModified?: LastModified;
}

// Run every check over the folder at `dir` and return one aggregated report. `now`/`lastModified`
// are injected (not read from the clock/git directly) so callers — tests included — get a
// deterministic result; the loader's own default (git commit time, else mtime) is used when
// `lastModified` is omitted.
export async function runCheck(dir: string, opts: CheckOptions = {}): Promise<CheckReport> {
  const now = opts.now ?? new Date();
  const staleDays = opts.staleDays ?? DEFAULT_STALE_DAYS;
  const problems: CheckProblem[] = [];

  const { plans: loaded, duplicates } = opts.lastModified
    ? await loadPlans(dir, opts.lastModified)
    : await loadPlans(dir);

  // a. duplicate plan ids — two files claiming the same address
  for (const id of duplicates) {
    problems.push({ planId: id, severity: "error", field: "id", message: `duplicate plan id "${id}" (more than one file)` });
  }

  // b. per-plan parse errors (invalid status/owner, id mismatch, ...)
  for (const lp of loaded) {
    for (const err of lp.errors) {
      problems.push({ planId: lp.plan.id, severity: "error", field: err.field, message: err.message });
    }
  }

  // c. board-level integrity (dangling depends, done-with-open-tasks) — needs the whole set
  const plans = loaded.map((lp) => lp.plan);
  for (const issue of validateBoard(plans)) {
    problems.push({ planId: issue.planId, severity: "error", field: issue.field, message: issue.message });
  }

  // d. staleness — a "doing" plan nobody has touched in `staleDays`; a warning, not a failure,
  // since it's a nudge ("check on this"), not a broken contract. Unknown age (no git, no fs
  // stat) can't be judged, so it's skipped rather than guessed at.
  for (const lp of loaded) {
    if (lp.plan.status !== "doing" || lp.lastModified === null) continue;
    const ageDays = Math.floor((now.getTime() - new Date(lp.lastModified).getTime()) / MS_PER_DAY);
    if (ageDays > staleDays) {
      problems.push({
        planId: lp.plan.id,
        severity: "warning",
        field: "status",
        message: `doing but untouched for ${ageDays} days`,
      });
    }
  }

  return {
    ok: !problems.some((p) => p.severity === "error"),
    problems,
    planCount: plans.length,
  };
}

// Plain-text rendering for a terminal/CI log — no backticks, no ANSI (see loop.html's grain
// grade rule: color is a signal reserved for the UI, not stdout).
export function formatReport(report: CheckReport): string {
  const lines = report.problems.map(
    (p) => `[${p.severity}] ${p.planId ?? "(none)"} ${p.field}: ${p.message}`,
  );
  lines.push(`${report.planCount} plans, ${report.problems.length} problems`);
  lines.push(report.ok ? "OK" : "FAIL");
  return lines.join("\n");
}
