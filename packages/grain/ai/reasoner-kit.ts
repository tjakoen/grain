// grain/ai/reasoner-kit.ts — reusable building blocks for ANY reasoner (the built-in stub OR a
// consumer's real cloud/local model). Before this, the chat markup + op shapes lived as closures
// INSIDE makeStubReasoner, so a consumer writing its own reasoner had to COPY them — a silent-drift
// trap (grain's own hard-won lessons #3/#5: a contract that fails silently). The kit makes those
// primitives first-class and EXPORTED; the stub dogfoods them (reasoner.ts), so the kit and the
// shipped behaviour can never diverge. CLIENT-SAFE (§19.2): pure, no DOM, relative import only.

import type { RenderOp, Surface } from "./contract.ts";
import { PUSH_SURFACES, isSafeNavigateHref } from "./contract.ts";
// Re-exported so a consumer building on the kit finds settle-time markdown rendering right next
// to the op-builders it pairs with, without a second import path to remember. Canonical home +
// tests: ./markdown.ts (kept separate so this file stays about OP shapes, not text rendering).
export { renderMarkdown } from "./markdown.ts";

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

/** An animated "typing" indicator for a chat bubble that's thinking but hasn't streamed a token yet
 *  (model load, retrieval) — so a pending bubble is NEVER a blank rectangle. Three pulsing dots,
 *  announced to assistive tech as "Thinking". Pair with a `pending` grade (thinkingOp below). */
export const thinkingDots = (): string =>
  `<span class="chat-thinking" role="status" aria-label="Thinking"><span></span><span></span><span></span></span>`;

/** A row of choice buttons the human picks from. It IS an actionable chat dialog (`chat-message__
 *  actions` + `.btn` — reused, not reinvented: same clean-affordance grade treatment + online-gating
 *  the chat-message component already ships), marked `data-choices` so the dispatcher resolves it
 *  pick-once. Each button is a normal chat.send trigger through the ONE door (data-action/-target),
 *  carrying its own answer as data-payload-text (the static-payload primitive fireTrigger reads).
 *  Values default to the label; text is escaped at this single writer. */
export const choiceGroup = (log: Surface, choices: { label: string; value?: string }[]): string =>
  `<div class="chat-message__actions" data-choices>` +
  choices.map((c) =>
    `<button type="button" class="btn chat-choice" data-action="chat.send" data-target="${esc(log)}"` +
    ` data-payload-text="${esc(c.value ?? c.label)}">${esc(c.label)}</button>`).join("") +
  `</div>`;

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

/** Navigate the browser to `href` — a same-origin, root-relative path only (contract.ts's
 *  `isSafeNavigateHref`). Throws on an unsafe href RIGHT HERE, at the point a reasoner composes
 *  the op, rather than letting a bad value travel all the way to the dispatcher and fail silently
 *  there (CLAUDE.md lesson #3/#5: a contract must not fail silently) — the dispatcher's own guard
 *  is defense-in-depth against a tampered wire payload, not the first line of defense. `commit` is
 *  "committed": navigation is terminal for this page, there's nothing left to settle. */
export const navigateOp = (target: Surface, href: string): RenderOp => {
  if (!isSafeNavigateHref(href))
    throw new Error(`navigateOp: unsafe href ${JSON.stringify(href)} — must be a same-origin, root-relative path`);
  return { target, op: "navigate", href, provenance: "ai", commit: "committed" };
};

/** Replace a bubble body with the animated "thinking" dots, pending — the AI is working but hasn't a
 *  token to show yet. Reuses replaceBodyOp so the caret/settle lifecycle is identical to any stream. */
export const thinkingOp = (surface: Surface): RenderOp => replaceBodyOp(surface, thinkingDots(), "pending");

/** The AI asks the human to pick: an AI (grain) chat bubble with an optional prompt + a row of choice
 *  buttons appended to the chat `log`. `commit: "committed"` — the AI's TURN is done (it asked); the
 *  buttons are the human's control now, and each raises a fresh chat.send with its value when clicked
 *  (the dispatcher resolves the group on pick). `who` overrides the bubble label. */
export const choicesOp = (log: Surface, prompt: string, choices: { label: string; value?: string }[], who?: string): RenderOp =>
  ({ target: log, op: "choices", provenance: "ai", commit: "committed", prompt, choices,
     // omit the body span entirely when there's no prompt (e.g. the model already spoke the question
     // in its own bubble) — an empty body would render as a stray blank line above the buttons.
     html: chatBubble("ai", "grain", (prompt ? chatBody(esc(prompt)) : "") + choiceGroup(log, choices), who) });
