// proof/core/schema.ts — parse one plan file's raw markdown into a typed Plan.
// Frontmatter splitting is REUSED from MILL (the layer below): PROOF is a consumer of MILL,
// so it doesn't reinvent the YAML-ish parser. Imported via the `@tjakoen/mill` package
// specifier (sha-pinned git dep) — never a relative sibling path (see PLAN.md).
import { parseFrontmatter } from "@tjakoen/mill/core/frontmatter.ts";
import type { Frontmatter, FrontmatterValue } from "@tjakoen/mill/core/types.ts";
import {
  STATUSES, OWNERS,
  type Plan, type PlanStatus, type PlanOwner, type PlanTask, type ParsedPlan, type PlanError,
} from "./types.ts";

// ---- frontmatter coercion (the tiny subset MILL emits: string | string[]) ---
function asString(v: FrontmatterValue | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function asList(v: FrontmatterValue | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter((s) => s !== "");
}

// A checklist row: `- [ ] text` (open) or `- [x] text` (done). Case-insensitive on the mark.
const TASK = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;
// The first ATX heading in the body → the plan's human title.
const HEADING = /^#{1,6}\s+(.*)$/;

function extractTasks(body: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(TASK);
    if (m) tasks.push({ text: m[2].trim(), done: m[1].toLowerCase() === "x" });
  }
  return tasks;
}

function deriveTitle(body: string, id: string): string {
  for (const line of body.split("\n")) {
    const m = line.match(HEADING);
    if (m && m[1].trim() !== "") return m[1].trim();
  }
  return id;
}

// Parse a plan file. `id` is supplied by the caller (the filename stem) — the loader owns the
// filesystem, so the core never touches it. Returns a best-effort Plan PLUS the problems:
// an invalid status/owner falls back to a default and is reported, never silently dropped, so
// `proof check` can flag the card instead of the board hiding a malformed plan.
export function parsePlan(raw: string, id: string): ParsedPlan {
  const { data, body } = parseFrontmatter(raw);
  const errors: PlanError[] = [];

  const status = validateEnum(data, "status", STATUSES, "todo", errors) as PlanStatus;
  const owner = validateEnum(data, "owner", OWNERS, "ai", errors) as PlanOwner;

  // `id` in frontmatter is optional; when present it should match the filename stem, or the
  // address the rest of the stack links to (`depends: [that-id]`) silently won't resolve.
  const declaredId = asString(data.id);
  if (declaredId !== undefined && declaredId !== id) {
    errors.push({ field: "id", message: `frontmatter id "${declaredId}" != filename "${id}"; using the filename` });
  }

  const track = asString(data.track) ?? null;

  const plan: Plan = {
    id,
    status,
    track: track === "" ? null : track,
    depends: asList(data.depends),
    touches: asList(data.touches),
    owner,
    title: deriveTitle(body, id),
    tasks: extractTasks(body),
    body,
  };

  return { plan, errors };
}

function validateEnum<T extends string>(
  data: Frontmatter, field: string, allowed: readonly T[], fallback: T, errors: PlanError[],
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
