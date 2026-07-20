// crumb/core/types.ts — the CRUMB tour model.
// The design law (see ../PLAN.md): a tour is a markdown file — frontmatter (mode/title/route) +
// a body whose `## <surface>` sections are the ordered steps. This module turns one file's raw
// text into a typed Tour. It is PURE — no fs, no clock, no DOM. The loader (folder → tours) and
// the client (Tour → lamp + popover) live outside, so the core stays trivially testable — the
// same discipline as mill/core and proof/core.

// ---- The closed vocabularies ------------------------------------------------
// A tour's audience. `demo` = onboarding/marketing walkthrough (the `say` prose). `dev` = a
// post-change AI review (adds the `review`/`status` per step). Same component, `data-mode` flip.
export const TOUR_MODES = ["demo", "dev"] as const;
export type TourMode = (typeof TOUR_MODES)[number];

// The verification vocabulary — a CRUMB concept, deliberately SEPARATE from grain's grade
// (grade = provenance/commit state; conflating them is a lesson-3 silent-contract trap). It
// describes a step's REVIEW state, not who authored the pixels.
export const VERIFICATION_STATUSES = ["new", "changed", "needs-verification", "verified", "known-issue"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

// ---- A step (one `## <surface>` section in the body) ------------------------
export interface Step {
  /** the `data-surface="kind:id"` address the lamp lights (the section heading text) */
  surface: string;
  /** the route this surface lives on; null = a surface present on the current/every page
   *  (nav, screen, chat) so the tour needn't navigate to reach it */
  at: string | null;
  /** popover prose — the demo-mode narration (the section's body text) */
  say: string;
  /** dev-mode narration: what CHANGED here (shown only in dev mode) */
  review: string | null;
  /** the verification vocab (dev tours); null when the author didn't mark one */
  status: VerificationStatus | null;
  /** how the human confirms the step ("Open the drawer on mobile; the dock shouldn't clip it") */
  verify: string | null;
}

// ---- A parsed tour ----------------------------------------------------------
export interface Tour {
  id: string;          // = the filename stem; the stable address
  mode: TourMode;
  title: string;
  route: string;       // the entry route the tour opens on
  intro: string;       // the body prose before the first `## <surface>` heading
  steps: Step[];
}

// A tour that failed to parse cleanly still yields a best-effort Tour plus the problems, so
// `crumb check` can report them rather than the tour silently misbehaving. Nothing is dropped.
export interface TourError {
  field: string;       // e.g. "mode", "route", "steps", "status"
  message: string;
}

export interface ParsedTour {
  tour: Tour;
  errors: TourError[];
}
