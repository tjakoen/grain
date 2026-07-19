// proof/loader.ts — the filesystem side of PROOF: read a `plans/` folder into parsed plans.
// The core (schema.ts / index.ts) is pure; this is the ONLY module that touches the disk and
// git, kept thin on purpose so the parsing/index logic stays trivially testable without fixtures.
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { parsePlan } from "./core/schema.ts";
import type { Plan, PlanError } from "./core/types.ts";

// A plan as loaded from disk: the parsed Plan plus the raw source (handed to MILL for the
// card-detail render, so the file is read once) and the per-file provenance the board shows.
export interface LoadedPlan {
  plan: Plan;
  raw: string;
  errors: PlanError[];
  lastModified: string | null;   // ISO; git commit time, else fs mtime, else null
}

// Filename → plan id: the stem, lowercased, so `001-Timeline.md` addresses as `001-timeline`
// and `depends: [001-timeline]` resolves. Traversal-safe: we only ever read `${dir}/${name}`.
const idOf = (file: string) => basename(file, ".md").toLowerCase();

// A plans/ folder carries docs alongside the plans — chiefly the README that `proof init` writes
// to teach the schema. Those are NOT plans; treating them as one makes a freshly-scaffolded folder
// fail its own `proof check` (missing status/owner). Reserved, case-insensitive.
const RESERVED = new Set(["readme.md"]);
const isPlanFile = (name: string) => name.endsWith(".md") && !RESERVED.has(name.toLowerCase());

// Injected so tests stay off git and the clock. Default: the file's last git commit time
// (the plan's real timeline — see PLAN.md "Git as the timeline"), degrading to fs mtime, then
// null. Never throws: a plan folder that isn't a git repo still loads, just without ages.
export type LastModified = (file: string) => Promise<string | null>;

async function gitOrMtime(file: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "log", "-1", "--format=%cI", "--", file], {
      stdout: "pipe", stderr: "ignore",
    });
    const out = (await new Response(proc.stdout).text()).trim();
    if ((await proc.exited) === 0 && out !== "") return out;
  } catch { /* not a git repo, or git absent — fall through */ }
  try {
    return (await stat(file)).mtime.toISOString();
  } catch {
    return null;
  }
}

export interface LoadResult {
  plans: LoadedPlan[];
  /** ids that appear on more than one file (case-folded collision) — a loader-only check */
  duplicates: string[];
}

// Read every `.md` in `dir` as a plan. A malformed plan is still loaded (best-effort, with its
// errors attached) so the board flags the card rather than hiding it — nothing silently dropped.
export async function loadPlans(dir: string, lastModified: LastModified = gitOrMtime): Promise<LoadResult> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter(isPlanFile).sort();
  } catch {
    return { plans: [], duplicates: [] };   // no plans/ folder yet → an empty board, not a crash
  }

  const seen = new Map<string, number>();
  const plans: LoadedPlan[] = [];
  for (const file of files) {
    const id = idOf(file);
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const path = join(dir, file);
    const raw = await readFile(path, "utf8");
    const { plan, errors } = parsePlan(raw, id);
    plans.push({ plan, raw, errors, lastModified: await lastModified(path) });
  }

  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  return { plans, duplicates };
}
