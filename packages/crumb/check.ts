// crumb/check.ts — lint a tours/ folder: schema validity, empty tours, duplicate ids.
// (Dead-surface linting — cross-checking each step's `surface` against grain's live manifest —
// is a later piece; a running host validates targets at tour time. PLAN.md.) Pure over the
// loader's output so it's testable without spawning a process.
import { loadTours, type LoadedTour } from "./loader.ts";
import { templateTokens } from "./core/prompt.ts";
// isSafeFieldValue/FIELD_VALUE_CAP come straight from grain's contract, never mirrored, so this
// lint can never drift from what the door itself enforces when a tour actually calls field.set.
import { isSafeFieldValue, FIELD_VALUE_CAP } from "@tjakoen/grain/ai/contract.ts";

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

// An ask whose id never appears in the template is a question with nowhere to go: the reviewer types
// an answer and the composed prompt does not contain it. The parser cannot call this an error (a
// template referencing an unknown token is the mirror-image case, and it IS a parse error), so the
// direction that leaves a field silently unused is caught here.
function promptProblems(tour: LoadedTour["tour"]): string[] {
  const card = tour.prompt;
  if (!card || card.template === "") return [];
  const used = new Set(templateTokens(card.template));
  return card.asks
    .filter((a) => !used.has(a.id))
    .map((a) => `    prompt: ask "${a.id}" is never used by the template, so its answer is thrown away`);
}

// A prefill the door would refuse is worse than none at all: the tour claims it staged the field
// and either nothing appears or the value silently truncates, and the reviewer has no way to tell
// from the rendered step. `isSafeFieldValue`/`FIELD_VALUE_CAP` are the same functions the door runs
// at submit time (imported, not mirrored), so this can only ever agree with the real refusal.
// A staged value on a step with no `say` is the second failure mode: the feasibility audit's core
// warning was a staged state reading as a real one, and prose-free staging is that exact case — the
// reviewer sees a filled field with nothing explaining it was the tour, not the human.
function prefillProblems(tour: LoadedTour["tour"]): string[] {
  const lines: string[] = [];
  for (const s of tour.steps) {
    const value = s.prefill;
    if (!value) continue;
    // `isSafeFieldValue` is a type predicate (`v is string`); calling it directly in the `if`
    // would have TypeScript narrow `value`'s type in the false branch too, and since `value` is
    // already a `string` here, narrowing "not string" out of "string" leaves `never` — hence the
    // boolean is captured first, which keeps `value` a plain string on both branches.
    const safe: boolean = isSafeFieldValue(value);
    if (!safe) {
      const why = value.length > FIELD_VALUE_CAP
        ? `${value.length} chars, over the ${FIELD_VALUE_CAP}-char cap`
        : "control characters";
      lines.push(`    steps: "${s.surface}" prefill has ${why}, so the door would refuse it`);
    }
    if (s.say.trim() === "")
      lines.push(`    steps: "${s.surface}" stages a value but has no \`say\` — a staged screen with no prose is the exact thing the feasibility audit warned about (a staged state reading as a real one)`);
  }
  return lines;
}

export function checkLoaded(tours: LoadedTour[], duplicates: string[]): CheckResult {
  const lines: string[] = [];
  let problems = 0;
  for (const dup of duplicates) { lines.push(`✗ duplicate tour id "${dup}" (two files fold to the same stem)`); problems++; }
  for (const { tour, errors } of tours) {
    const devProblems = [...devStepProblems(tour), ...promptProblems(tour), ...prefillProblems(tour)];
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
