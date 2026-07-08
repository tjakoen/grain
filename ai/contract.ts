// /app/ai/contract.ts — the action vocabulary contract (see docs/AI-INTERFACE.md).
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
export type SurfaceKind = "item" | "reflection" | "say-stream" | "screen" | "chat-log";
export const surface = (kind: SurfaceKind, id?: string): Surface => (id ? `${kind}:${id}` : kind);
export const surfaceKind = (s: Surface): SurfaceKind => (s.split(":")[0] ?? "") as SurfaceKind;
export const surfaceId = (s: Surface): string => s.split(":").slice(1).join(":");

// ---- Actions: the closed verb vocabulary (grows reluctantly) --------------------
//   item.archive  — stands in for task.complete (optimistic light path)
//   say.set       — input → AI writes back into a reflection line (grain → settles clean)
//   say.stream    — button → AI types a line out, token by token, over SSE
//   chat.send     — composer → your message (clean) + the AI's reply streamed (grain) into a chat log
// The full product vocabulary lives in docs/AI-INTERFACE.md.
export type ActionName = "item.archive" | "say.set" | "say.stream" | "demo.run" | "desk.stop" | "chat.send";
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
export type RenderOpKind = "replace" | "append" | "remove" | "flash" | "type" | "spotlight" | "log";
export type Provenance = "user" | "ai" | "system";
export type Commit = "pending" | "committed";   // grade = commit state (DESIGN-SYSTEM §3)

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
  provenance: Provenance;
  commit: Commit;
}

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
