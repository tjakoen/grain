// crumb/core/schema.ts — parse one tour file's raw markdown into a typed Tour.
// Frontmatter splitting is REUSED from MILL (the layer below): CRUMB is a consumer of MILL, so it
// doesn't reinvent the YAML-ish parser (the same move PROOF makes). MILL emits a tiny subset
// (string | string[]), so the STEPS can't live in frontmatter as a list-of-objects — they live in
// the BODY as `## <surface>` sections (also better authoring ergonomics, PROOF's body-checklist
// lesson). Import via the `@tjakoen/mill` specifier (workspace:*), never a relative sibling path.
import { parseFrontmatter } from "@tjakoen/mill/core/frontmatter.ts";
import type { Frontmatter, FrontmatterValue } from "@tjakoen/mill/core/types.ts";
import {
  TOUR_MODES, VERIFICATION_STATUSES, PROMPT_SECTION,
  type Tour, type Step, type VerificationStatus, type ParsedTour, type TourError,
  type PromptCard, type Ask,
} from "./types.ts";
import { templateTokens } from "./prompt.ts";

// ---- frontmatter coercion (MILL emits string | string[]) --------------------
function asString(v: FrontmatterValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

// ---- the body → steps grammar -----------------------------------------------
// A step is a level-2 heading whose text IS the surface address, then prose (the `say`) plus
// optional `- key: value` meta lines (at / review / status / verify). Everything before the first
// `## ` is the tour's intro. Kept line-based and boring on purpose — a heavy schema makes the AI
// do bookkeeping instead of work (PLAN.md).
const STEP_HEADING = /^##\s+(.+?)\s*$/;                      // `## nav:/notes`
const META = /^\s*[-*]\s+(at|review|status|verify)\s*:\s*(.*)$/i;   // `- verify: open the drawer`
const STEP_META_KEYS = new Set(["at", "review", "status", "verify"]);
// The `## prompt` section has its own three keys, kept OUT of the step grammar so neither can eat
// the other's lines: a stray `- ask:` inside a step stays visible prose instead of vanishing.
const ASK = /^\s*[-*]\s+ask\s*:\s*(.*)$/i;                   // `- ask: what-broke | What looked off?`
const PROMPT_META = /^\s*[-*]\s+(template|handoff)\s*:\s*(.*)$/i;
const ASK_ID = /^[a-z0-9][a-z0-9_-]*$/i;

interface RawStep { surface: string; lines: string[]; }

// Split the body into the intro + an ordered list of `## <surface>` blocks.
function splitBody(body: string): { intro: string; blocks: RawStep[] } {
  const introLines: string[] = [];
  const blocks: RawStep[] = [];
  let current: RawStep | null = null;
  for (const line of body.split("\n")) {
    const h = line.match(STEP_HEADING);
    if (h) {
      current = { surface: h[1].trim(), lines: [] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      introLines.push(line);
    }
  }
  return { intro: introLines.join("\n").trim(), blocks };
}

// Parse the reserved `## prompt` block: `- ask: <id> | <label>` lines, one `- template:`, an optional
// `- handoff:`, and whatever prose is left as the card's intro. `\n` in a template is a real newline,
// because a prompt worth pasting is usually more than one line and MILL's frontmatter subset has no
// place to put a block of text.
function toPromptCard(raw: RawStep, errors: TourError[]): PromptCard {
  const asks: Ask[] = [];
  const seen = new Set<string>();
  const intro: string[] = [];
  let template = "";
  let handoff: string | null = null;

  for (const line of raw.lines) {
    const a = line.match(ASK);
    if (a) {
      const [rawId, ...rest] = a[1].split("|");
      const id = (rawId ?? "").trim();
      const label = rest.join("|").trim();
      if (!ASK_ID.test(id)) { errors.push({ field: "prompt.ask", message: `"${a[1].trim()}" is not \`<id> | <label>\` with a token-safe id; ignoring` }); continue; }
      if (label === "") { errors.push({ field: "prompt.ask", message: `ask "${id}" has no question after the "|"; ignoring` }); continue; }
      if (seen.has(id)) { errors.push({ field: "prompt.ask", message: `duplicate ask id "${id}"; ignoring the second` }); continue; }
      seen.add(id);
      asks.push({ id, label });
      continue;
    }
    const m = line.match(PROMPT_META);
    if (m) {
      if (m[1].toLowerCase() === "template") template = m[2].trim().replaceAll("\\n", "\n");
      else handoff = m[2].trim() || null;
      continue;
    }
    intro.push(line);
  }

  if (template === "") errors.push({ field: "prompt.template", message: "the prompt section has no `- template:` line, so there is nothing to hand back" });
  else {
    const unknown = templateTokens(template).filter((t) => t !== "title" && t !== "tour" && !seen.has(t));
    for (const t of unknown)
      errors.push({ field: "prompt.template", message: `"{${t}}" is not an ask id (or \`title\`/\`tour\`), so it stays in the composed text as written` });
  }

  return { intro: intro.join("\n").trim(), asks, template, handoff };
}

function toStep(raw: RawStep, index: number, errors: TourError[]): Step {
  const meta: Record<string, string> = {};
  const say: string[] = [];
  for (const line of raw.lines) {
    const m = line.match(META);
    if (m && STEP_META_KEYS.has(m[1].toLowerCase())) meta[m[1].toLowerCase()] = m[2].trim();
    else say.push(line);
  }

  let status: VerificationStatus | null = null;
  if (meta.status !== undefined && meta.status !== "") {
    if ((VERIFICATION_STATUSES as readonly string[]).includes(meta.status)) status = meta.status as VerificationStatus;
    else errors.push({ field: `steps[${index}].status`, message: `"${meta.status}" is not a verification status (${VERIFICATION_STATUSES.join(" | ")}); ignoring` });
  }

  if (raw.surface === "") errors.push({ field: `steps[${index}].surface`, message: "empty `## ` heading — a step must name a data-surface address" });

  return {
    surface: raw.surface,
    at: meta.at ? meta.at.trim() : null,
    say: say.join("\n").trim(),
    review: meta.review ? meta.review.trim() : null,
    status,
    verify: meta.verify ? meta.verify.trim() : null,
  };
}

// Parse a tour file. `id` is supplied by the caller (the filename stem) — the loader owns the
// filesystem, so the core never touches it. Best-effort: an invalid mode falls back to `demo`
// and is reported; a tour with no steps still parses (check.ts flags it). Nothing is dropped.
export function parseTour(raw: string, id: string): ParsedTour {
  const { data, body } = parseFrontmatter(raw);
  const errors: TourError[] = [];

  const mode = validateEnum(data, "mode", TOUR_MODES, "demo", errors);

  const declaredId = asString(data.id);
  if (declaredId !== undefined && declaredId !== id)
    errors.push({ field: "id", message: `frontmatter id "${declaredId}" != filename "${id}"; using the filename` });

  // `route` must be an ABSOLUTE pathname to be a navigable entry point (crumb-live location.assign
  // target). Absent/empty is the common, silent "this tour has no entry navigation" case (no error
  // — it's a valid, meaningful declaration, not a defect). A non-empty value that isn't absolute
  // (missing the leading "/") is almost certainly an author typo, so it's reported AND still
  // degrades to null rather than becoming a broken relative navigation.
  const routeRaw = (asString(data.route) ?? "").trim();
  let route: string | null = null;
  if (routeRaw) {
    if (routeRaw.startsWith("/")) route = routeRaw;
    else errors.push({ field: "route", message: `"${routeRaw}" is not an absolute pathname (must start with "/"); this tour has no navigable entry route` });
  }
  const { intro, blocks } = splitBody(body);
  // The reserved section is pulled out BEFORE the steps are built, so `## prompt` is never a step
  // (and a tour that is nothing but a prompt card still reports "no steps", which is right: a card
  // with no walk in front of it is not a tour).
  const promptBlocks = blocks.filter((b) => b.surface.toLowerCase() === PROMPT_SECTION);
  if (promptBlocks.length > 1) errors.push({ field: "prompt", message: `${promptBlocks.length} \`## ${PROMPT_SECTION}\` sections; using the first` });
  const prompt = promptBlocks[0] ? toPromptCard(promptBlocks[0], errors) : null;

  const steps = blocks.filter((b) => b.surface.toLowerCase() !== PROMPT_SECTION).map((b, i) => toStep(b, i, errors));
  if (steps.length === 0) errors.push({ field: "steps", message: "no `## <surface>` steps — a tour needs at least one" });

  const tour: Tour = {
    id,
    mode,
    title: (asString(data.title) ?? "").trim() || id,
    route,
    intro,
    steps,
    prompt,
  };
  return { tour, errors };
}

function validateEnum<T extends string>(
  data: Frontmatter, field: string, allowed: readonly T[], fallback: T, errors: TourError[],
): T {
  const raw = asString(data[field]);
  if (raw === undefined) {
    errors.push({ field, message: `missing "${field}"; defaulting to "${fallback}"` });
    return fallback;
  }
  if (!allowed.includes(raw as T)) {
    errors.push({ field, message: `"${raw}" is not a valid ${field} (${allowed.join(" | ")}); defaulting to "${fallback}"` });
    return fallback;
  }
  return raw as T;
}
