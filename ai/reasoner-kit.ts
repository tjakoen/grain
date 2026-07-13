// grain/ai/reasoner-kit.ts — reusable building blocks for ANY reasoner (the built-in stub OR a
// consumer's real cloud/local model). Before this, the chat markup + op shapes lived as closures
// INSIDE makeStubReasoner, so a consumer writing its own reasoner had to COPY them — a silent-drift
// trap (grain's own hard-won lessons #3/#5: a contract that fails silently). The kit makes those
// primitives first-class and EXPORTED; the stub dogfoods them (reasoner.ts), so the kit and the
// shipped behaviour can never diverge. CLIENT-SAFE (§19.2): pure, no DOM, relative import only.

import type { RenderOp, Surface } from "./contract.ts";
import { PUSH_SURFACES } from "./contract.ts";

// ---- markup: the exact fragments the dispatcher's applyOp expects (chat bubbles, console lines) ----

/** Escape untrusted text before it enters an emitted HTML fragment — chat carries USER input, so it
 *  must be escaped at the single writer. */
export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One chat bubble — a human's message (clean) or the AI's (grain; provenance persists). `who`
 *  defaults from the role ("You"/"AI"); pass it to override (the /grain showcase signs "GRAIN"). */
export const chatBubble = (role: string, grade: string, inner: string, who?: string): string =>
  `<div class="chat-message" data-role="${role}"${grade ? ` data-grade="${grade}"` : ""}>` +
  `<span class="chat-message__who">${who ?? (role === "you" ? "You" : "AI")}</span>${inner}</div>`;

/** The message body span. Pass a `surface` for an AI bubble that will be STREAMED into (later `type`
 *  ops address it by data-surface); omit it for a static human message. */
export const chatBody = (inner = "", surface?: Surface): string =>
  `<span class="chat-message__body"${surface ? ` data-surface="${surface}"` : ""}>${inner}</span>`;

/** One console narration line — the AI's verb vocabulary (contract.ts) made visible in the takeover
 *  feed, so a multi-second run never reads as stuck (lesson #7). */
export const narrationLine = (verb: string, desc: string): string =>
  `<div class="console__line"><span class="action-badge">${verb}</span><span class="console__desc">${esc(desc)}</span></div>`;

// ---- op-builders: the exact RenderOps a reasoner emits, so no consumer hand-rolls provenance/commit ----

/** A human's message, committed (clean). Committed on the chat-log target also releases the composer
 *  trigger + stands the op-silence watchdog down (dispatcher), so a long turn that follows is safe. */
export const userMessageOp = (log: Surface, text: string): RenderOp =>
  ({ target: log, op: "append", provenance: "user", commit: "committed",
     html: chatBubble("you", "", chatBody(esc(text || "…"))) });

/** An empty AI bubble to stream into — grain (AI), pending until it settles. `who` overrides the label. */
export const aiBubbleOp = (log: Surface, surface: Surface, who?: string): RenderOp =>
  ({ target: log, op: "append", provenance: "ai", commit: "pending",
     html: chatBubble("ai", "grain", chatBody("", surface), who) });

/** Stream a token (or a whole chunk) into a bubble body; grain persists (AI speech). */
export const typeToken = (surface: Surface, text: string): RenderOp =>
  ({ target: surface, op: "type", text, provenance: "ai", commit: "pending" });

/** Settle a streamed bubble — caret off, committed (stays grain: AI provenance persists). */
export const settleOp = (surface: Surface): RenderOp =>
  ({ target: surface, op: "type", done: true, provenance: "ai", commit: "committed" });

/** Replace a bubble body (status / progress / a final non-streamed line). Keep the same `surface` so
 *  later ops still land. `trusted` markup (e.g. a progress bar) may be passed as-is; text must be esc'd. */
export const replaceBodyOp = (surface: Surface, inner: string, commit: "pending" | "committed"): RenderOp =>
  ({ target: surface, op: "replace", provenance: "ai", commit, html: chatBody(inner, surface) });

/** Narrate a step to the console takeover feed (the `console` push-surface by default). */
export const narrateOp = (verb: string, desc: string, surface: Surface = PUSH_SURFACES.console): RenderOp =>
  ({ target: surface, op: "append", provenance: "ai", commit: "committed", html: narrationLine(verb, desc) });

/** Show the AI AS ACTOR on a surface: dim the page, light the target, optionally pulse it like a
 *  click. `active:false` releases. Driven by AI provenance (AI-INTERFACE §5c). */
export const spotlightOp = (target: Surface, opts: { active: boolean; click?: boolean } = { active: true }): RenderOp =>
  ({ target, op: "spotlight", active: opts.active, click: opts.click, provenance: "ai", commit: opts.active ? "pending" : "committed" });
