// proof/core/types.ts — the PROOF plan model + the derived index shape.
// The design law (see ../PLAN.md): a plan is a markdown file with <=6 frontmatter fields;
// this module turns one file's raw text into a typed Plan, and a set of Plans into the
// derived index (the machine "tasks.json"). It is PURE — no fs, no git, no clock. The
// loader that reads the folder and the git-age enrichment live in the serve piece, so the
// core stays trivially testable and framework-agnostic (the same discipline as mill/core).

// ---- The closed vocabularies ------------------------------------------------
// A plan's lifecycle column. Ordered so a board can lay columns out left→right.
export const STATUSES = ["todo", "doing", "done", "blocked"] as const;
export type PlanStatus = (typeof STATUSES)[number];

// Who owns the plan. `ai` is the default (this is an AI plan board); `human` marks a plan
// a person is driving, so the board can show whose intent it is (provenance-of-intent).
export const OWNERS = ["ai", "human"] as const;
export type PlanOwner = (typeof OWNERS)[number];

// ---- A task (a checklist item in the body) ----------------------------------
export interface PlanTask {
  text: string;
  done: boolean;
}

// ---- A parsed plan ----------------------------------------------------------
// The frontmatter fields (id/status/track/depends/touches/owner) plus the pieces derived
// from the body (title, tasks) and the source (the raw markdown, kept so the board can hand
// it to MILL for the card-detail render without re-reading the file).
export interface Plan {
  id: string;                 // = the filename stem; the stable address
  status: PlanStatus;
  track: string | null;       // optional free grouping label
  depends: string[];          // ids this plan waits on
  touches: string[];          // optional code areas (scopes graphify / shows blast radius)
  owner: PlanOwner;
  title: string;              // first heading, else the id
  tasks: PlanTask[];          // `- [ ]` / `- [x]` items in the body
  body: string;               // the markdown body (frontmatter stripped) for MILL to render
}

// A plan that failed to parse cleanly still yields a Plan (best-effort, with defaults) plus
// the list of problems, so `proof check` can report them and the board can flag the card
// rather than dropping it. Nothing is silently discarded.
export interface ParsedPlan {
  plan: Plan;
  errors: PlanError[];
}

export interface PlanError {
  field: string;              // e.g. "status", "owner", "id"
  message: string;
}

// ---- The derived index (the machine "tasks.json") ---------------------------
// Generated from the Plans, never hand-maintained (the design law). A compact projection:
// enough for a session-start context injection and for tooling, without the bodies.
export interface PlanIndexEntry {
  id: string;
  status: PlanStatus;
  track: string | null;
  owner: PlanOwner;
  title: string;
  depends: string[];
  touches: string[];
  tasksTotal: number;
  tasksDone: number;
}

export interface PlanIndex {
  generatedAt: string;        // ISO; set by the caller (kept out of pure parse)
  counts: Record<PlanStatus, number>;
  plans: PlanIndexEntry[];
}
