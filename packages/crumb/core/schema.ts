// crumb/core/schema.ts — parse one tour file's raw markdown into a typed Tour.
// Frontmatter splitting is REUSED from MILL (the layer below): CRUMB is a consumer of MILL, so it
// doesn't reinvent the YAML-ish parser (the same move PROOF makes). MILL emits a tiny subset
// (string | string[]), so the STEPS can't live in frontmatter as a list-of-objects — they live in
// the BODY as `## <surface>` sections (also better authoring ergonomics, PROOF's body-checklist
// lesson). Import via the `@tjakoen/mill` specifier (workspace:*), never a relative sibling path.
import { parseFrontmatter } from "@tjakoen/mill/core/frontmatter.ts";
import type { Frontmatter, FrontmatterValue } from "@tjakoen/mill/core/types.ts";
import {
  TOUR_MODES, VERIFICATION_STATUSES,
  type Tour, type TourMode, type Step, type VerificationStatus, type ParsedTour, type TourError,
} from "./types.ts";

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

  const mode = validateEnum(data, "mode", TOUR_MODES, "demo", errors) as TourMode;

  const declaredId = asString(data.id);
  if (declaredId !== undefined && declaredId !== id)
    errors.push({ field: "id", message: `frontmatter id "${declaredId}" != filename "${id}"; using the filename` });

  const route = (asString(data.route) ?? "/").trim() || "/";
  const { intro, blocks } = splitBody(body);
  const steps = blocks.map((b, i) => toStep(b, i, errors));
  if (steps.length === 0) errors.push({ field: "steps", message: "no `## <surface>` steps — a tour needs at least one" });

  const tour: Tour = {
    id,
    mode,
    title: (asString(data.title) ?? "").trim() || id,
    route,
    intro,
    steps,
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
