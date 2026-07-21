// grain/ai/model.ts — the MODEL PORT + the transport-agnostic reasoning CORE (the M★ seam).
//
// The stub (reasoner.ts) is choreography over hardcoded surfaces. A REAL reasoner instead READS the
// manifest a page advertises (manifest-dom.ts / manifestForReasoner — now including inView.readable),
// asks a model to pick ONE move in the vocabulary, and VALIDATES that move against the contract before
// it ever becomes an Intent. This module is that brain — and it is deliberately TRANSPORT-AGNOSTIC:
// it depends on a `Model` PORT, never a concrete SDK. A local in-browser model (WebLLM/WebGPU), a
// cloud API (Claude), or a test fake all satisfy the port; selecting WHICH is the composition root's
// choice, exactly like the OpChannel transport (contract.ts §"the substrate PORT"). That's what keeps
// grain flexible: one reasoning core, many models.
//
// CLIENT-SAFE (ARCHITECTURE §19.2): pure, relative imports only, no DOM, no secrets. The pieces here
// (prompt build, parse, validate) are all pure functions so the whole core is unit-testable with a
// fake `Model` — no browser, no network. Turning a validated move into RenderOps (the side-effecting
// half) lives in the reasoner that composes this core, not here.

import { ACTIONS, isAction, type ActionName, type PayloadField } from "./contract.ts";
import type { Manifest } from "./manifest.ts";

// ── the model boundary ─────────────────────────────────────────────────────────────────────────
/** The model PORT — grain depends on this, never a concrete SDK. `complete` turns a prompt into raw
 *  completion text; the core parses + validates it (a model can't be trusted to emit only legal moves,
 *  so trust is established HERE, not assumed of the model). A streaming model can still satisfy this
 *  by resolving once its final text is assembled — token-level streaming of the human-facing reply is
 *  the composing reasoner's concern, not the port's. */
export interface Model {
  complete(prompt: string): Promise<string>;
}

// ── the structured move a model must return ─────────────────────────────────────────────────────
/** ONE move in the vocabulary, as the model returns it (JSON). `action:null` (or absent) with a
 *  `reply` is a legal "just talk, don't act" move — the model isn't forced to touch the UI to answer.
 *  Everything here is UNTRUSTED until `validateMove` checks it against the contract + live manifest. */
export interface ModelMove {
  action?: string | null;            // an ActionName, or null/absent for a reply-only move
  target?: string;                   // a surface address (required when action acts)
  payload?: Record<string, unknown>; // the verb's args
  reply?: string;                    // conversational text streamed back to the human (optional)
}

/** A move that has passed validation: `action` is a real ActionName targeting a real, accepting
 *  surface with a schema-valid payload — ready to become an Intent — OR a reply-only move
 *  (`action:null`). Either way it's safe for the reasoner to act on without re-checking. */
export interface ValidatedMove {
  action: ActionName | null;
  target: string;
  payload: Record<string, unknown>;
  reply?: string;
}

// ── the prompt ──────────────────────────────────────────────────────────────────────────────────
// EXPORTED so a chat-engine adapter (model-chat.ts) can lift the preamble into a `system` message —
// the prompt is built as `SYSTEM_PREAMBLE + "\n\n" + <manifest/message/contract>`, so a `startsWith`
// split recovers the two halves exactly.
export const SYSTEM_PREAMBLE =
  "You operate a UI through ONE door: you may only choose from the vocabulary below. Every surface " +
  "is addressed by a stable id; every verb lists the payload it needs and behaviour hints (read-only " +
  "/ destructive / idempotent). Read `in view` for the current state before deciding. Choose EXACTLY " +
  "ONE move: either act (pick an action + a target that accepts it + its payload), or reply without " +
  "acting (action: null). Never invent a verb, a target, or a field that isn't listed.";

const OUTPUT_CONTRACT =
  'Respond with ONLY a JSON object, no prose, no code fence:\n' +
  '{"action": "<verb or null>", "target": "<surface id or omit>", ' +
  '"payload": { /* the verb\'s fields, or omit */ }, "reply": "<optional message to the human>"}';

/** Compose the reasoner prompt: the contract preamble, the live manifest (the exact text
 *  `manifestForReasoner()` emits — the move set + targets + `in view` readable state), the human's
 *  message, and the required JSON output shape. Pure + deterministic: same inputs → same string, so
 *  it's testable and cache-friendly. The manifest is passed IN (not harvested here) so this stays
 *  DOM-free and the caller controls which projection (server or live-DOM) the model sees. */
export function buildReasonerPrompt(manifestText: string, message: string): string {
  return [
    SYSTEM_PREAMBLE,
    "",
    "# What's operable right now",
    manifestText,
    "",
    "# The human's message",
    message.trim() || "(no message — decide from what's in view)",
    "",
    "# Your response",
    OUTPUT_CONTRACT,
  ].join("\n");
}

// ── parsing the model's output ──────────────────────────────────────────────────────────────────
/** Pull the first balanced JSON object out of raw model text and parse it. Models wrap JSON in prose
 *  or ```json fences despite instructions, so we scan for the first `{` and match to its closing `}`
 *  (bracket-depth, string-aware) rather than trusting the whole string to be clean JSON. Returns a
 *  ModelMove on success or an informative reason on failure — the reason feeds the same
 *  informative-rejection path a bad human intent takes (interaction-layer.ts), so a model can be told
 *  WHY its output was unusable and retry. */
export function parseModelMove(raw: string): { ok: true; move: ModelMove } | { ok: false; reason: string } {
  const json = extractJsonObject(raw);
  if (json === null) return { ok: false, reason: "model returned no JSON object" };
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { return { ok: false, reason: "model returned malformed JSON" }; }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return { ok: false, reason: "model output is not a JSON object" };
  return { ok: true, move: parsed as ModelMove };
}

/** Scan for the first `{` and return the substring through its matching `}`, respecting string
 *  literals + escapes so a brace inside a JSON string doesn't throw off the depth count. null if
 *  there's no balanced object. */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inStr = false, escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return raw.slice(start, i + 1);
  }
  return null;
}

// ── validating the move against the contract + the live manifest ─────────────────────────────────
/** Turn an UNTRUSTED ModelMove into a ValidatedMove or an informative rejection. This is the safety
 *  boundary: the model can PROPOSE anything, but only moves that are legal in the vocabulary AND
 *  legal on THIS page's surfaces survive. Checks, in order:
 *   - a reply-only move (action null/absent) is legal iff it carries a non-empty reply;
 *   - the action must be a real ActionName (registry), else "unknown verb";
 *   - the target must be a surface the manifest lists AND that accepts this verb, else the valid
 *     targets are named back (so the model can self-correct — the same echo a human rejection gets);
 *   - the payload must satisfy the verb's schema: every required field present + every provided field
 *     the right primitive type. Unknown extra fields are dropped, not fatal.
 *  The registry (ACTIONS) is the SSOT for verbs + payload shape; the live manifest is the SSOT for
 *  which targets accept a verb RIGHT NOW — so this never drifts from what's on screen. */
export function validateMove(
  move: ModelMove,
  manifest: Manifest,
): { ok: true; move: ValidatedMove } | { ok: false; reason: string } {
  const action = move.action ?? null;

  // reply-only: the model chose to talk, not act.
  if (action === null) {
    const reply = (move.reply ?? "").trim();
    if (!reply) return { ok: false, reason: "reply-only move carries no reply text" };
    return { ok: true, move: { action: null, target: "", payload: {}, reply } };
  }

  if (typeof action !== "string" || !isAction(action))
    return { ok: false, reason: `unknown verb ${JSON.stringify(action)} — not in the vocabulary` };

  const target = typeof move.target === "string" ? move.target : "";
  if (!target) return { ok: false, reason: `verb ${action} needs a target surface` };

  const surface = manifest.targets.find((t) => t.id === target);
  if (!surface)
    return { ok: false, reason: `no surface ${JSON.stringify(target)} on this screen` };
  if (!surface.accepts.includes(action)) {
    const valid = validTargetsFor(action, manifest);
    const echo = valid.length ? ` — ${action} applies to: ${valid.join(", ")}` : ` — nothing here accepts ${action}`;
    return { ok: false, reason: `surface ${target} does not accept ${action}${echo}` };
  }

  const rawPayload = (move.payload && typeof move.payload === "object" && !Array.isArray(move.payload))
    ? move.payload as Record<string, unknown> : {};
  const checked = checkPayload(ACTIONS[action].payload, rawPayload);
  if (!checked.ok) return checked;

  return { ok: true, move: { action, target, payload: checked.payload, reply: (move.reply ?? "").trim() || undefined } };
}

/** Every target on the current screen that accepts `action` — named back on a rejection so the model
 *  can retry against a real surface (the manifest is the SSOT, so this can't drift). */
export function validTargetsFor(action: ActionName, manifest: Manifest): string[] {
  return manifest.targets.filter((t) => t.accepts.includes(action)).map((t) => t.id);
}

/** Validate a payload against a verb's schema: required fields present, provided fields the right
 *  primitive type. Returns only the SCHEMA-DECLARED fields (extras dropped — a model padding the bag
 *  can't smuggle anything past the door). */
function checkPayload(
  schema: Record<string, PayloadField>,
  raw: Record<string, unknown>,
): { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string } {
  const out: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(schema)) {
    const has = Object.hasOwn(raw, name) && raw[name] !== null && raw[name] !== undefined;
    if (!has) {
      if (field.required) return { ok: false, reason: `payload missing required field ${JSON.stringify(name)} (${field.type})` };
      continue;
    }
    if (typeof raw[name] !== field.type)
      return { ok: false, reason: `payload field ${JSON.stringify(name)} must be ${field.type}, got ${typeof raw[name]}` };
    out[name] = raw[name];
  }
  return { ok: true, payload: out };
}
