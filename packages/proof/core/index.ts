// proof/core/index.ts — the framework-agnostic core's public surface + the derived index.
// PURE: given a set of parsed plans it builds the machine index and runs the board-level
// checks (dependency integrity, done-with-open-tasks) that a single file can't see. The
// filesystem loader, git-age enrichment, and the SSE board all sit above this.
export * from "./types.ts";
export { parsePlan } from "./schema.ts";

import { STATUSES, type Plan, type PlanStatus, type PlanIndex, type PlanIndexEntry, type PlanError } from "./types.ts";

// Build the derived index (the "tasks.json") from the plans. Never hand-maintained — this IS
// the generator the design law calls for. `generatedAt` is injected by the caller so the core
// stays clock-free (and the output is deterministic in tests).
export function buildIndex(plans: Plan[], generatedAt: string): PlanIndex {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<PlanStatus, number>;
  const entries: PlanIndexEntry[] = plans.map((p) => {
    counts[p.status]++;
    return {
      id: p.id,
      status: p.status,
      track: p.track,
      owner: p.owner,
      title: p.title,
      depends: p.depends,
      touches: p.touches,
      tasksTotal: p.tasks.length,
      tasksDone: p.tasks.filter((t) => t.done).length,
    };
  });
  return { generatedAt, counts, plans: entries };
}

// A board-level problem, tagged with the plan it belongs to (single-file parse errors don't
// have an owner id yet; these do). `proof check` renders these; the board flags the card.
export interface BoardIssue extends PlanError {
  planId: string;
}

// The checks that need the whole board, not one file:
//  - a `depends` id that no plan provides (a dangling dependency = a link that won't resolve),
//  - a plan marked `done` while its checklist still has open items (the inconsistency the
//    lint exists to catch — a done plan should not lie).
// Duplicate ids are a loader concern (two files, same stem) and are checked there.
export function validateBoard(plans: Plan[]): BoardIssue[] {
  const issues: BoardIssue[] = [];
  const ids = new Set(plans.map((p) => p.id));

  for (const p of plans) {
    for (const dep of p.depends) {
      if (!ids.has(dep)) {
        issues.push({ planId: p.id, field: "depends", message: `depends on "${dep}", which no plan provides` });
      }
    }
    if (p.status === "done") {
      const open = p.tasks.filter((t) => !t.done).length;
      if (open > 0) {
        issues.push({ planId: p.id, field: "status", message: `marked done with ${open} unticked task(s)` });
      }
    }
  }
  return issues;
}
