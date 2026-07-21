// /app/ai/contract.ts — the action vocabulary contract (see https://tjakoen.github.io/grain/docs/ai-interface).
//
// Two closed registries + three envelopes. Both a human interaction and an AI
// decision become the SAME Intent, flow through the SAME door, and come back as
// RenderOps addressed to semantic SURFACES. No privileged AI→DOM back channel.

// ---- Surfaces: "kind:id" for instances, a bare slug for singleton regions -------
// SurfaceKind is the CLOSED set of kinds (the "enum", erasable-style: a union, since
// `enum` is banned by erasableSyntaxOnly). Build addresses with surface(), never by
// hand-concatenating strings, so a typo is a compile error.
export type Surface = string;                       // e.g. "item:ITM-1", "reflection"
// SurfaceKind is exactly the set of kinds a VERB can accept (they drive `actionsForKind` +
// the manifest). Push-only DISPLAY surfaces the AI only ever WRITES to — never a verb
// target — are intentionally NOT kinds: `console` (the takeover narration feed), plus the
// demo-only render targets `plan` / `summary` / `ask-input`. They're addressed by their
// bare `data-surface` slug and need no entry here. Add a kind only when a verb accepts it.
// `notepad` is a verb target (note.append / note.replace) — a persisted markdown surface both
// the AI and the human write into through the one door; the ops land on its inner `notepad-body`
// push surface (below), the wrapper `notepad` is what gets spotlit when the AI is the actor.
export type SurfaceKind = "item" | "reflection" | "say-stream" | "screen" | "chat-log" | "notepad";
export const surface = (kind: SurfaceKind, id?: string): Surface => (id ? `${kind}:${id}` : kind);
export const surfaceKind = (s: Surface): SurfaceKind => (s.split(":")[0] ?? "") as SurfaceKind;
export const surfaceId = (s: Surface): string => s.split(":").slice(1).join(":");

// ---- Actions: the closed verb vocabulary (grows reluctantly) --------------------
//   item.archive  — stands in for task.complete (optimistic light path)
//   say.set       — input → AI writes back into a reflection line (grain → settles clean)
//   say.stream    — button → AI types a line out, token by token, over SSE
//   chat.send     — composer → your message (clean) + the AI's reply streamed (grain) into a chat log
//   note.append   — add a markdown entry to the notepad (AI writes grain; a human commit settles clean)
//   note.replace  — rewrite the whole notepad from one markdown body (same door, same grade rule)
//   navigate      — a control (or a reasoner's own decision) asks to change screens; see below
// The full product vocabulary lives at https://tjakoen.github.io/grain/docs/ai-interface.
export type ActionName =
  | "item.archive" | "say.set" | "say.stream" | "demo.run" | "desk.stop" | "chat.send"
  | "note.append" | "note.replace" | "navigate";
export type Depth = "light" | "heavy";

export interface ActionDef {
  name: ActionName;
  depth: Depth;
  accepts: SurfaceKind[];   // surface KINDS this verb applies to (typed → no stray kinds)
}

export const ACTIONS: Record<ActionName, ActionDef> = {
  "item.archive": { name: "item.archive", depth: "light", accepts: ["item"] },
  "say.set":      { name: "say.set",      depth: "light", accepts: ["reflection"] },
  "say.stream":   { name: "say.stream",   depth: "light", accepts: ["say-stream"] },
  "demo.run":     { name: "demo.run",     depth: "heavy", accepts: ["screen"] },   // plays an AI-acting demo
  "desk.stop":    { name: "desk.stop",    depth: "light", accepts: ["screen"] },   // user asks the AI to halt (mediated)
  "chat.send":    { name: "chat.send",    depth: "light", accepts: ["chat-log"] }, // send a message; AI replies over SSE
  "note.append":  { name: "note.append",  depth: "light", accepts: ["notepad"] },  // append one markdown entry to the notepad
  "note.replace": { name: "note.replace", depth: "light", accepts: ["notepad"] },  // rewrite the notepad from one markdown body
  // ActionName AND a RenderOpKind, deliberately BOTH (see the `navigate` RenderOpKind below for why
  // one alone doesn't cover it): registering it here as a "screen" verb is what makes it show up in
  // `actionsForKind("screen")` — and so in the manifest (manifest.ts/manifest-dom.ts) — as something
  // a control (or a reasoner reading the manifest) can see is legal to invoke on the current screen.
  "navigate":     { name: "navigate",     depth: "light", accepts: ["screen"] },
};

export const isAction = (s: string): s is ActionName => Object.hasOwn(ACTIONS, s);

// `desk.stop` is a CONTROL signal, not a reasoner verb — named once here so the door
// and the (browser-side) dispatcher agree on the wire string without a magic literal.
export const STOP_ACTION: ActionName = "desk.stop";

// Invert the registry: which verbs apply to a surface kind. Lets the manifest derive
// a region's accepts from the registry instead of hand-listing them (AI-INTERFACE §4).
export const actionsForKind = (kind: SurfaceKind): ActionName[] =>
  Object.values(ACTIONS).filter((a) => a.accepts.includes(kind)).map((a) => a.name);

// ---- Envelope 1: Intent — every interaction (human OR ai) becomes this ----------
export interface Intent {
  source: "user" | "ai";       // provenance, stamped at the entrance — never taken from the client.
                               // HTTP /intent always stamps "user"; only IN-PROCESS actors raise "ai".
  session: string;             // which SSE stream the result is pushed back on
  screen: string;              // "check what's in view"
  surface: Surface;            // what was touched / referred to
  action: ActionName;
  payload: Record<string, unknown>;
}

// ---- Envelope 2: RenderOp — what the single writer emits, addressed to a surface -
//   replace/append/remove — structural;  flash — transient note;
//   type — stream a text token into the target (text), or finish it (done);
//   spotlight — show the AI AS ACTOR: dim everything, light the target, pulse it like a
//          click; `active:false` releases. Driven by AI provenance (AI-INTERFACE §5c).
//   log — append one provenance-tagged entry to the interaction TIMELINE (§5g); the client
//          caps the DOM + pins to newest. The unified human-and-AI log made visible.
//   navigate — change the browser's location (href). The ONLY op that leaves the page, so it's
//          the ONE op the dispatcher validates before acting on (isSafeNavigateHref, below) —
//          every other op only ever touches the DOM the manifest already exposed as addressable.
//          Why a RenderOpKind and not just the `navigate` ActionName above: an ActionName is a
//          REQUEST vocabulary word (what a control may ask the door to do); a RenderOpKind is an
//          EFFECT the single writer (the reasoner) hands back for the dispatcher to apply — and
//          the dispatcher (scripts/ai-dispatch.js) only ever executes RenderOps, never ActionNames
//          directly. So the reasoner handling ANY intent (not only a `navigate` one — e.g. a
//          chat.send reply that decides to route the user somewhere) needs an op it can emit to
//          actually move the browser. Both exist because they answer different questions: "is this
//          verb legal here" (ActionName, surfaced in the manifest) vs "make it happen" (RenderOp,
//          applied by the dispatcher).
// `choices` — the AI ASKS and the human ANSWERS through a control: an AI chat bubble carrying a
// short prompt + a row of buttons. It's the mirror of every other op (which is the AI acting on the
// human's behalf): here the AI hands the decision back. Kept a first-class RenderOpKind, not a bare
// `append` of button HTML, for the same reason `navigate` is (below): it names a distinct intent the
// dispatcher renders + wires uniformly (each button is a normal chat.send trigger through the ONE
// door — no parallel path), and it's conformance-testable as its own vocabulary word.
export type RenderOpKind = "replace" | "append" | "remove" | "flash" | "type" | "spotlight" | "log" | "navigate" | "choices";
export type Provenance = "user" | "ai" | "system";
export type Commit = "pending" | "committed";   // grade = commit state (DESIGN-SYSTEM §3)

/** One option in a `choices` op. `label` is the button text; `value` is the text submitted as the
 *  next chat turn when it's picked (defaults to `label`) — so a choice is just a pre-filled ask. */
export interface Choice { label: string; value?: string }

export interface RenderOp {
  target: Surface;
  op: RenderOpKind;
  html?: string;               // server-rendered fragment (replace / append / flash)
  text?: string;               // a streamed token (type)
  back?: number;               // delete the last N chars (type) — the AI REVISING / overwriting
  done?: boolean;              // last token of a stream → settle grain to clean (type)
  active?: boolean;            // spotlight on (move to target) vs off (release)
  click?: boolean;            // spotlight: this is a "click" → pulse the target (else just lift it)
  message?: string;            // human-facing note (flash)
  href?: string;                // navigate: where to (validated — isSafeNavigateHref, below)
  prompt?: string;             // choices: the question shown above the buttons (optional)
  choices?: Choice[];          // choices: the options the human picks from (validated — isValidChoiceList)
  provenance: Provenance;
  commit: Commit;
}

/** A well-formed choice list: 1–6 options, each with a non-empty string label (value optional). The
 *  cap keeps a chat dialog scannable; the shape guard is the SSOT the dispatcher's own check mirrors. */
export const isValidChoiceList = (x: unknown): x is Choice[] =>
  Array.isArray(x) && x.length >= 1 && x.length <= 6 &&
  x.every((c) => !!c && typeof (c as Choice).label === "string" && (c as Choice).label.trim().length > 0 &&
    ((c as Choice).value === undefined || typeof (c as Choice).value === "string"));

// ---- navigate's href validator — the SSOT the dispatcher's own guard must never drift from ------
// Same-origin, ROOT-RELATIVE paths only. Rejects:
//   - any absolute URL ("https://…", "http://…") — external navigation is never AI-directed
//   - a scheme with no "//" ("javascript:…", "data:…", "mailto:…") — never starts with "/"
//   - protocol-relative ("//evil.com") — a second leading "/" is rejected by the lookahead
//   - a leading backslash right after the slash ("/\evil.com") — some browsers treat "\" as "/",
//     which would otherwise smuggle a protocol-relative URL past the "//" check
//   - any whitespace — blocks control-character / smuggling tricks, and no real route needs one
// A bare "/" (root) is valid. Query strings and hashes are valid ("/notes?x=1#y").
const SAFE_NAV_HREF = /^\/(?!\/)[^\s\\]*$/;
export const isSafeNavigateHref = (href: unknown): href is string =>
  typeof href === "string" && SAFE_NAV_HREF.test(href);

// ---- The reasoner's verdict ------------------------------------------------------
export interface Decision {
  ok: boolean;
  ops: RenderOp[];
  reply?: string;              // conversational feedback (chat) — optional
  reason?: string;             // trace / failure note
}

// Push-only display surfaces — the AI only ever WRITES to these; no verb accepts them
// as a kind target. Typed here so a typo is caught at the call site, not silently dropped.
export const PUSH_SURFACES = {
  console:       "console",        // takeover narration feed (narrate/clearConsole)
  plan:          "plan",           // demo plan bullet list
  summary:       "summary",        // demo summary text
  askInput:      "ask-input",      // demo ask-input field
  demoTaskBadge: "demo-task-badge",// demo task badge
  timeline:      "timeline",       // the interaction TIMELINE feed (unified log, §5g) — `log` ops land here
  notepadBody:   "notepad-body",   // the notepad's inner content — note.append/replace ops land here (the `notepad` wrapper is the verb target + spotlight surface)
} as const;
export type PushSurface = typeof PUSH_SURFACES[keyof typeof PUSH_SURFACES];

// The SSE event name render ops are pushed under (the dispatcher listens for it).
export const OP_EVENT = "op";

// ---- The substrate PORT GRAIN needs: a way to push to a session ----------------
// GRAIN depends on this interface, never on a concrete substrate. BATCH's SSE hub
// satisfies it structurally; a WebSocket hub, a test double, or another substrate
// would too. This is what keeps GRAIN runnable on something other than BATCH.
export interface OpChannel {
  push(session: string, event: string, data: unknown): void;
}

// ---- The interaction LOG — a uniform record of every door crossing --------------
// Every Intent — human OR AI — enters through handleIntent (the single writer, the natural
// choke point). Recording it THERE yields ONE uniform, source-tagged history of both operators
// for a few lines at one place — and because both cross the same door, they're recorded
// IDENTICALLY (uniform auditability; AI-INTERFACE §5g). The visual "interaction timeline" is
// just a LogSink impl that pushes `log` RenderOps to the `timeline` surface (timeline-log.ts).
export interface LogEntry {
  session: string;              // the SSE stream this crossing belongs to (where a `log` op is pushed)
  source: Provenance;           // WHO authored it — user | ai | system (drives the timeline colour + grade)
  kind: "intent" | "response";  // the request that came IN, or the decision that went OUT
  screen: string;
  surface: Surface;             // what was touched / referred to
  action: ActionName;
  ok: boolean;                  // request valid / write succeeded
  ops: number;                  // how many RenderOps the decision emitted (0 for an intent record)
}

// The LOG PORT GRAIN needs — a place to record each crossing. Like OpChannel, GRAIN depends on
// this interface, never a concrete store: a console logger, an audit journal, or the timeline
// stream-sink all satisfy it. OPTIONAL at the door (observability, not core correctness).
export interface LogSink {
  record(entry: LogEntry): void;
}
