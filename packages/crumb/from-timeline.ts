// crumb/from-timeline.ts — the FLAGSHIP engine: project grain's audit trail into a review tour.
//
// The pitch (PLAN.md): "the AI's work reviewable — the review tour writes itself from the audit
// trail." Because the AI already acts through the visible door, emitting `RenderOp`s to addressable
// `data-surface` targets, grain's `timeline-log` already holds an ordered record of every crossing
// (`LogEntry[]`). This module is the pure projection `LogEntry[] → Step[]` (and, above it, a full
// dev-mode `Tour` + its markdown serialization) — nothing is authored by hand.
//
// It is PURE — no fs, no clock, no DOM. The loader owns the filesystem; the client drives the lamp.
// Reuse over rebuild (grain lessons 1 & 8): the Step shape, the verification vocab, and the tour
// grammar all come from `core/` — this file only decides WHICH crossings become steps and HOW they
// read. A tour it emits re-parses through the same `parseTour` a human-authored tour uses.

import type { LogEntry } from "@tjakoen/grain/ai/contract.ts";
import type { Step, Tour } from "./core/types.ts";

// ---- What counts as a reviewable crossing -----------------------------------
// A review tour is about what the AI DID. From the timeline that means AI-authored crossings that
// changed a surface (`ops > 0`) — or TRIED and were refused/failed (`ok === false`, worth flagging
// as a known issue). A `user` crossing isn't AI work; an `intent` record emits 0 ops and, when it
// succeeded, is just the request half of a response we already keep — both are skipped.
function isReviewable(e: LogEntry): boolean {
  return e.source === "ai" && (e.ops > 0 || e.ok === false);
}

export interface TimelineFilter {
  /** limit to one SSE session (a review tour is per-session — PLAN: `tours/review/<session>.md`) */
  session?: string;
}

// A surface may be touched by several crossings; the human reviews each CHANGED surface once, not
// once per op. So we group by surface (first-seen order = a natural walk order) and fold the
// crossings for that surface into a single step.
interface Group {
  surface: string;
  at: string | null;
  actions: string[];   // unique, in encounter order
  ops: number;         // total render ops emitted to this surface
  failed: boolean;     // any crossing on this surface was rejected / failed
}

/**
 * The core projection: an ordered audit trail → the ordered review steps.
 * Pure and total — an empty (or all-filtered) trail yields `[]`.
 */
export function stepsFromTimeline(entries: LogEntry[], filter: TimelineFilter = {}): Step[] {
  const groups = new Map<string, Group>();

  for (const e of entries) {
    if (filter.session !== undefined && e.session !== filter.session) continue;
    if (!isReviewable(e)) continue;

    let g = groups.get(e.surface);
    if (!g) {
      // `screen`-scoped surfaces live on a route; the everywhere-surfaces (a bare screen kind)
      // carry no route so the tour needn't navigate — mirror Step.at's null contract.
      g = { surface: e.surface, at: e.screen || null, actions: [], ops: 0, failed: false };
      groups.set(e.surface, g);
    }
    if (!g.actions.includes(e.action)) g.actions.push(e.action);
    g.ops += e.ops;
    if (!e.ok) g.failed = true;
  }

  return [...groups.values()].map(groupToStep);
}

function groupToStep(g: Group): Step {
  const verbs = g.actions.join(", ");
  if (g.failed) {
    // The AI's action on this surface was refused or failed — a known issue to look at, not a
    // silent no-op (the whole point of surfacing failures in the review).
    return {
      surface: g.surface,
      at: g.at,
      say: `The AI's ${verbs} on ${g.surface} did not complete — this one needs a look.`,
      review: `${verbs} was rejected or failed here (${g.ops} op${g.ops === 1 ? "" : "s"} landed).`,
      status: "known-issue",
      verify: `Investigate the failed ${verbs} on ${g.surface}.`,
    };
  }
  return {
    surface: g.surface,
    at: g.at,
    say: `The AI updated ${g.surface} via ${verbs}.`,
    review: `Emitted ${g.ops} render op${g.ops === 1 ? "" : "s"} to this surface via ${verbs}.`,
    // The AI changed it and no human has signed off yet — that is exactly `needs-verification`.
    // Deliberately NOT grade (grade = who authored the pixels; this is review state — lesson 3).
    status: "needs-verification",
    verify: `Confirm ${g.surface} looks right after ${verbs}.`,
  };
}

// ---- Assemble a full dev-mode tour ------------------------------------------
export interface TourMeta {
  /** the tour id = filename stem (PLAN: `review/<session>.md`) */
  id: string;
  title?: string;
  /** entry route; defaults to the first step's route, else "/" */
  route?: string;
  /** limit the projection to one session */
  session?: string;
}

/** Project a trail into a complete `dev` Tour — the artifact the AI drops after a UI-touching task. */
export function tourFromTimeline(entries: LogEntry[], meta: TourMeta): Tour {
  const steps = stepsFromTimeline(entries, { session: meta.session });
  const route = meta.route ?? steps.find((s) => s.at)?.at ?? "/";
  const n = steps.length;
  return {
    id: meta.id,
    mode: "dev",
    title: meta.title ?? `Review — ${meta.id}`,
    route,
    intro: `Auto-generated from the interaction timeline: ${n} surface${n === 1 ? "" : "s"} the AI ` +
      `touched, walk each and mark it verified.`,
    steps,
  };
}

// ---- Serialize a tour back to the markdown grammar --------------------------
// The generated review tour must be a REAL, editable file a human keeps — so we emit exactly the
// grammar `core/schema.ts` reads back: `---` frontmatter (mode/id/title/route), the intro, then one
// `## <surface>` block per step with the `say` prose and `- key: value` meta lines. A tour from
// `tourFromTimeline` round-trips through `parseTour` unchanged (see the test). Only non-null meta
// lines are emitted, matching parseTour's null contract.
const dq = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export function toTourMarkdown(tour: Tour): string {
  const fm = [
    "---",
    `mode: ${tour.mode}`,
    `id: ${tour.id}`,
    `title: ${dq(tour.title)}`,
    `route: ${tour.route}`,
    "---",
  ].join("\n");

  const blocks = tour.steps.map((s) => {
    const lines = [`## ${s.surface}`, ""];
    if (s.say) lines.push(s.say, "");
    if (s.at) lines.push(`- at: ${s.at}`);
    if (s.review) lines.push(`- review: ${s.review}`);
    if (s.status) lines.push(`- status: ${s.status}`);
    if (s.verify) lines.push(`- verify: ${s.verify}`);
    return lines.join("\n");
  });

  return [fm, "", tour.intro, "", ...blocks, ""].join("\n");
}
