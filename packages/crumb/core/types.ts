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
  /** text this step stages into its OWN field surface, through the host's door, never a direct
   *  write; null = the step stages nothing. */
  prefill: string | null;
}

// ---- The prompt card (the review loop's last step) --------------------------
// A review tour ends by asking the reviewer what it could not check itself, and hands back a PROMPT
// rather than a form submission: the reviewer pastes it into a session, or opens it in one. This is
// the only part of a tour that collects input, and it still writes nothing to the app: the answers
// are composed into text in the browser and the destination is somewhere else entirely.
export interface Ask {
  /** the token this answer fills in the template (`{id}`) */
  id: string;
  /** the question shown above the field */
  label: string;
  /** a closed set of answers, making this ask a DECISION rather than a free-text question. Empty
   *  (the default, and every ask written before this existed) = a text field.
   *
   *  Kept as plain strings rather than grain's `Choice` ({ label, value? }), and the difference is
   *  the point: a `choices` op sends its `value` back through the door as the next turn, so label
   *  and value must be able to differ. Here the answer only ever becomes text in a template, so a
   *  second field would be a distinction with nothing behind it. The two vocabularies still mean
   *  the same thing to a reader: a short, closed set the human picks from. */
  options: string[];
}

export interface PromptCard {
  /** prose above the questions (the section's body text) */
  intro: string;
  asks: Ask[];
  /** the text composed from the answers; `{id}` per ask, plus `{title}` and `{tour}` */
  template: string;
  /** a URL template with `{payload}` (grain's handoff contract) that opens the composed prompt in a
   *  session. null = no destination declared, so the card offers the text and nothing else. */
  handoff: string | null;
}

/** The reserved step heading that carries the prompt card. It can never collide with a real surface
 *  address: a surface is `kind` or `kind:id` over grain's closed kind vocabulary, and `prompt` is
 *  not one of those kinds. */
export const PROMPT_SECTION = "prompt";

// ---- A parsed tour ----------------------------------------------------------
export interface Tour {
  id: string;          // = the filename stem; the stable address
  mode: TourMode;
  title: string;
  /** the entry route the tour opens on (its intro / step -1 card); an ABSOLUTE pathname
   *  ("/", "/notes") for a root-mounted multi-page host. null = no navigable entry route — a
   *  declared-empty, absent, or non-absolute (relative-looking) value all degrade to this, so a
   *  host with nothing sensible to navigate to (e.g. a hash-router SPA under one pathname) never
   *  gets forced off its own page; the client renders the intro in place instead. */
  route: string | null;
  intro: string;       // the body prose before the first `## <surface>` heading
  steps: Step[];
  /** the `## prompt` section, when the tour has one; null = the tour just ends */
  prompt: PromptCard | null;
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
