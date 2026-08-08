// proof/core/verify.ts — the PURE half of `proof verify`: hold a set of plans against a
// description of what actually changed, and report where the two disagree.
//
// `proof check` asks whether the board is well formed. It never looks at code, so a plan can be
// marked done, its tasks all ticked, and nothing whatsoever have happened. This module closes that
// gap. LOOP section 4b already asks every run to declare a scope cap and says it should be enforced
// mechanically where the tooling allows; `touches` has been that declared cap in every plan since
// the schema shipped, and nothing has ever read it. This reads it.
//
// PURE — no fs, no git, no clock. `verify.ts` above collects the Diff from git and calls in here,
// the same split check.ts uses (loader does the io, core/index.ts does the judging).
import type { Plan } from "./types.ts";

// What the caller must dig out of version control. Deliberately small: a list of paths, and for
// each plan file, the checklist lines the diff newly ticked. Anything richer would push git
// knowledge into the pure layer.
export interface Diff {
  /** repo-relative paths of every file the diff touches (modified, added, deleted, untracked) */
  files: string[];
  /** plan id → the task texts this diff newly ticked (`- [ ]` became `- [x]`) */
  newlyTicked: Record<string, string[]>;
  /** plan ids this diff moved into `done` */
  newlyDone: string[];
}

export interface VerifyProblem {
  planId: string | null;
  severity: "error" | "warning";
  field: string;
  message: string;
}

export interface VerifyOptions {
  /** paths that are bookkeeping rather than work, excluded from the scope check.
   *  Defaults to the plans folder itself: editing a plan IS the trail, not scope growth. */
  ignore?: string[];
}

// ---- path coverage ----------------------------------------------------------
// `touches` is prose-adjacent: entries are written by hand and land as "standards/", "src/foo.ts",
// or "../pantry/". So the match is deliberately forgiving in one direction only — an entry covers a
// file when the file sits at or under it. It never covers by suffix or by basename, because that
// would quietly make an entry like "server.ts" match every server.ts in the tree and turn the scope
// cap into a rubber stamp.
const norm = (p: string) => p.replace(/^\.\//, "").replace(/\/+$/, "");

// An entry that climbs out of the repo (`../pantry/`) names a path this diff cannot see. It is not
// a failure and it is not coverage either — see `outOfTree` below, which reports it rather than
// letting it read as a silent pass.
const escapesTree = (entry: string) => norm(entry).split("/").includes("..");

export function covers(entry: string, file: string): boolean {
  const e = norm(entry), f = norm(file);
  if (!e || escapesTree(e)) return false;
  return f === e || f.startsWith(e + "/");
}

const coveredBy = (plans: Plan[], file: string) => plans.filter((p) => p.touches.some((t) => covers(t, file)));

/**
 * The core judgement: plans + what changed → where they disagree.
 *
 * Three findings, and the severities are not arbitrary. An unbacked tick is an ERROR because it is
 * the board stating something false. Scope growth and an untouched done are WARNINGS because both
 * have honest explanations (work legitimately grew, or the code landed in an earlier commit than
 * the one being verified) and a gate that cries wolf gets muted, which is worse than no gate.
 */
export function verifyAgainstDiff(plans: Plan[], diff: Diff, opts: VerifyOptions = {}): VerifyProblem[] {
  const problems: VerifyProblem[] = [];
  const ignore = opts.ignore ?? [];
  const byId = new Map(plans.map((p) => [p.id, p]));
  const doing = plans.filter((p) => p.status === "doing");

  // a. scope growth — a changed file no in-progress plan claims. The declared envelope, read.
  const files = diff.files.filter((f) => !ignore.some((i) => covers(i, f)));
  for (const file of files) {
    if (coveredBy(doing, file).length > 0) continue;
    // covered by a plan that is not started is a different, more specific complaint: the work is
    // planned but unclaimed, which LOOP section 4a's "claim before you touch" exists to prevent.
    const elsewhere = coveredBy(plans, file);
    if (elsewhere.length > 0) {
      problems.push({
        planId: elsewhere[0].id,
        severity: "warning",
        field: "touches",
        message: `${file} belongs to "${elsewhere[0].id}" (${elsewhere[0].status}), which is not claimed as doing`,
      });
    } else {
      problems.push({ planId: null, severity: "warning", field: "touches", message: `${file} is outside every plan's touches` });
    }
  }

  // b. unbacked tick — the board says a task got done and the diff shows nothing under that plan.
  for (const [planId, tasks] of Object.entries(diff.newlyTicked)) {
    const plan = byId.get(planId);
    if (!plan || tasks.length === 0) continue;
    if (plan.touches.length === 0) continue;              // reported by (d), not silently passed
    if (diff.files.some((f) => plan.touches.some((t) => covers(t, f)))) continue;
    problems.push({
      planId,
      severity: "error",
      field: "tasks",
      message: `ticked ${tasks.length} task(s) but changed nothing under its touches: ${tasks[0]}`,
    });
  }

  // c. an untouched done — a plan closed over a diff that never entered its own blast radius.
  for (const planId of diff.newlyDone) {
    const plan = byId.get(planId);
    if (!plan || plan.touches.length === 0) continue;
    if (diff.files.some((f) => plan.touches.some((t) => covers(t, f)))) continue;
    problems.push({
      planId,
      severity: "warning",
      field: "status",
      message: "marked done but this diff changed nothing under its touches",
    });
  }

  // d. what could not be verified, said out loud. A doing plan with no `touches` has no declared
  // envelope, so none of the above can judge it — and a checker that stays quiet about what it
  // skipped reads as "all clear", which is the exact dishonesty this command exists to catch.
  for (const plan of doing) {
    if (plan.touches.length === 0) {
      problems.push({ planId: plan.id, severity: "warning", field: "touches", message: "doing with no touches, so nothing about it can be verified" });
      continue;
    }
    const outOfTree = plan.touches.filter(escapesTree);
    if (outOfTree.length === plan.touches.length) {
      problems.push({ planId: plan.id, severity: "warning", field: "touches", message: `every touches entry points outside this repo (${outOfTree.join(", ")}), so nothing about it can be verified here` });
    }
  }

  return problems;
}
