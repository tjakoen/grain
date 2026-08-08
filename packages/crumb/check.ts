// crumb/check.ts — lint a tours/ folder: schema validity, empty tours, duplicate ids.
// (Dead-surface linting — cross-checking each step's `surface` against grain's live manifest —
// is a later piece; a running host validates targets at tour time. PLAN.md.) Pure over the
// loader's output so it's testable without spawning a process.
import { loadTours, type LoadedTour } from "./loader.ts";

export interface CheckResult { ok: boolean; lines: string[]; }

// A `dev` tour exists to review a change, so a step with no `review` and no `status` is not a
// stylistic slip — it is a review step that reviews nothing, and it renders as a blank card in the
// one mode that was supposed to carry the substance. The parser cannot refuse it (the fields are
// optional by schema, because a `demo` tour legitimately omits them), so the lint is where it gets
// caught. `verify` is deliberately NOT required: plenty of steps are a look, not a do.
function devStepProblems(tour: LoadedTour["tour"]): string[] {
  if (tour.mode !== "dev") return [];
  return tour.steps
    .filter((s) => !s.review && !s.status)
    .map((s) => `    steps: "${s.surface}" is a dev step with no review and no status, so Review mode shows nothing for it`);
}

export function checkLoaded(tours: LoadedTour[], duplicates: string[]): CheckResult {
  const lines: string[] = [];
  let problems = 0;
  for (const dup of duplicates) { lines.push(`✗ duplicate tour id "${dup}" (two files fold to the same stem)`); problems++; }
  for (const { tour, errors } of tours) {
    const devProblems = devStepProblems(tour);
    if (errors.length === 0 && devProblems.length === 0) { lines.push(`✓ ${tour.id} — ${tour.steps.length} step(s), ${tour.mode}`); continue; }
    lines.push(`✗ ${tour.id}`);
    for (const e of errors) { lines.push(`    ${e.field}: ${e.message}`); problems++; }
    for (const p of devProblems) { lines.push(p); problems++; }
  }
  if (tours.length === 0 && duplicates.length === 0) lines.push("no tours found");
  return { ok: problems === 0, lines };
}

export async function checkDir(dir: string): Promise<CheckResult> {
  const { tours, duplicates } = await loadTours(dir);
  return checkLoaded(tours, duplicates);
}
