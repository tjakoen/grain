// /app/ai/reasoner.ts — the reasoner boundary (the PROJECT-PLAN §10c `Model` seam)
// plus a stub standing in for the real cloud/local model during frontend work.
//
// The reasoner is the SINGLE WRITER: it decides, then writes + renders through
// SCOPED TOOLS (its action vocabulary). Swapping the stub for a real model later is
// an implementation change behind this interface — not a rewrite. The stub is
// PLUMBING, never faked judgment (MVP §"Build Order").

import type { Intent, Decision, Surface, RenderOp } from "./contract.ts";
import { ACTIONS, PUSH_SURFACES, surfaceId } from "./contract.ts";

// Escape untrusted text before it goes into an emitted HTML fragment. Canned demo strings
// are trusted; chat carries USER input, so it must be escaped at the single writer.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The scoped capabilities the reasoner is allowed to use — its tool surface. The
// real reasoner reaches storage through least-privilege tools exactly like this.
export interface ReasonTools {
  archiveItem(id: string): Promise<void>;
  /** Render the COMMITTED (clean) HTML for a surface, after a write. */
  renderSurface(surface: Surface): Promise<string>;
  /** Push a render op NOW (mid-decision) — used to stream tokens as they're made. */
  emit(op: RenderOp): void;
  /** True if the user asked the AI to stop — checked between steps for a graceful halt. */
  cancelled(): boolean;
  /** Co-operative delay so the heavy path / thinking-state is exercised. */
  delay(ms: number): Promise<void>;
}

export interface Reasoner {
  decide(intent: Intent, tools: ReasonTools): Promise<Decision>;
}

// One calm, deliberate rhythm for ALL AI motion — same beats everywhere so the flow
// reads consistently (e-ink implies stillness, not a teletype burst).
const TYPE_MS = 32;     // per character while typing
const BACK_MS = 16;     // per character while ERASING — quicker than typing, reads as scrubbing
const SETTLE_MS = 700;  // after the spotlight lands on a surface, before it acts (≥ the focus glide, --ai-focus-move)
const HOLD_MS = 650;    // after an action finishes, before attention moves on

export interface StubOptions {
  /** 0 = always commit; 1 = always fail (exercises rollback). */
  failRate?: number;
  /** ms the stub "thinks" before acting; 0 in tests. */
  thinkMs?: number;
}

export function makeStubReasoner(opts: StubOptions = {}): Reasoner {
  const failRate = opts.failRate ?? 0;
  const thinkMs = opts.thinkMs ?? 250;
  let chatSeq = 0;   // unique id per streamed AI chat bubble (DOM surface to type into)

  return {
    async decide(intent: Intent, tools: ReasonTools): Promise<Decision> {
      const def = ACTIONS[intent.action];

      const beat = (ms: number) => tools.delay(thinkMs > 0 ? ms : 0);

      // Spotlight the surface the AI is touching — the "AI is acting" treatment.
      // on = pending (in progress); off = committed (done → also releases the trigger).
      const spot = (target: string, active: boolean, click = false) =>
        tools.emit({ target, op: "spotlight", active, click, provenance: "ai", commit: active ? "pending" : "committed" });

      // Move attention to a surface, then let it SETTLE before acting — the one
      // consistent transition used everywhere (so no step feels faster than another).
      const moveTo = async (target: string, click = false) => { spot(target, true, click); await beat(SETTLE_MS); };

      // Type a line out, ONE CHARACTER at a time over SSE at a single steady cadence,
      // so every typing effect reads identically regardless of word length. Each char
      // arrives at grain with a caret; `done` settles it to clean (DESIGN-SYSTEM §3).
      // Shared by both text verbs so the input and the button feel the same.
      const stream = async (surface: string, line: string, done = true): Promise<Decision> => {
        for (const ch of [...line]) {                       // spread = per code point (handles "—")
          if (tools.cancelled()) break;                     // stop promptly at a clean boundary…
          await tools.delay(thinkMs > 0 ? TYPE_MS : 0);
          tools.emit({ target: surface, op: "type", text: ch, provenance: "ai", commit: "pending" });
        }
        if (done) tools.emit({ target: surface, op: "type", done: true, provenance: "ai", commit: "committed" });  // settle / submit
        return { ok: true, ops: [], reply: line };
      };

      // Narrate a step to the bottom console as an ACTION BADGE — the AI's verb vocabulary
      // (contract.ts) made visible. The shell surfaces this feed while it takes over.
      const narrate = (verb: string, desc: string) =>
        tools.emit({ target: PUSH_SURFACES.console, op: "append", provenance: "ai", commit: "committed",
          html: `<div class="console__line"><span class="action-badge">${verb}</span><span class="console__desc">${esc(desc)}</span></div>` });
      const clearConsole = () =>
        tools.emit({ target: PUSH_SURFACES.console, op: "replace", provenance: "ai", commit: "committed",
          html: `<div class="console__feed" data-surface="console"></div>` });

      // --- say.stream: button → the AI types a reflection. Spotlit: a human clicked, but
      //     the AI is the one writing, so show where it acts (grade = AI as actor, §5c). ---
      if (intent.action === "say.stream") {
        clearConsole(); narrate("reads", "checking your week");
        await moveTo(intent.surface);
        const d = await stream(intent.surface, "On it — checking your week. You have room on Thursday.");
        await beat(HOLD_MS);
        spot(intent.surface, false);
        return d;
      }

      // --- say.set: input → the AI writes back the line it noted from your text ---
      if (intent.action === "say.set") {
        const text = String(intent.payload.text ?? "").trim();
        clearConsole(); narrate(text ? "writes" : "reads", text ? "noting your request" : "listening");
        await moveTo(intent.surface);
        const d = await stream(intent.surface, text ? `Noted: ${text}` : "Nothing to note.");
        await beat(HOLD_MS);
        spot(intent.surface, false);
        return d;
      }

      // --- chat.send: the assistant conversation. Your message settles CLEAN (human), then
      //     the AI's reply STREAMS into a fresh bubble that stays GRAIN (AI). Same door,
      //     same ops — no chat-specific machinery. User text is escaped at the writer. ---
      if (intent.action === "chat.send") {
        const text = String(intent.payload.text ?? "").trim();
        const bubble = (role: string, grade: string, inner: string) =>
          `<div class="chat-message" data-role="${role}"${grade ? ` data-grade="${grade}"` : ""}>` +
          `<span class="chat-message__who">${role === "you" ? "You" : "Desk"}</span>${inner}</div>`;
        // append to the chat-log the intent TARGETED (the shell's "chat-log", or a page's own
        // "chat-log:<id>" — same kind), so multiple chat surfaces on a page don't collide.
        const log = intent.surface;
        // 1) your message — clean (human, committed)
        tools.emit({ target: log, op: "append", provenance: "user", commit: "committed",
          html: bubble("you", "", `<span class="chat-message__body">${esc(text || "…")}</span>`) });
        // 2) an empty AI bubble to stream into — grain (AI), pending until it settles
        const id = `chat-msg:${++chatSeq}`;
        tools.emit({ target: log, op: "append", provenance: "ai", commit: "pending",
          html: bubble("ai", "grain", `<span class="chat-message__body" data-surface="${id}"></span>`) });
        // 3) the AI thinks a beat, then types its reply into the bubble (grain persists)
        await beat(HOLD_MS);
        const reply = text ? `Noted — “${text}”. I'll fold that into your plan.` : "I'm here — what would you like to plan?";
        return stream(id, reply);
      }

      // --- demo.run: a useful end-to-end scenario the user can WATCH — the AI drafts a
      //     Thursday plan as a bullet LIST, then REVISES one specific item (backspacing it,
      //     retyping) to show targeted editing. The spotlight follows what it touches; the
      //     backdrop stays up across the turn, then releases (AI-INTERFACE §5c).
      //     Re-runnable: it drives demo surfaces with render ops and mutates no storage. ---
      if (intent.action === "demo.run") {
        const handBack: Decision = { ok: true, ops: [], reply: "Stopped — handed back to you." };
        // graceful stop: hand back cleanly if asked — never a force-kill (PROJECT-PLAN §9).
        const stopped = (): boolean => { if (!tools.cancelled()) return false; spot("screen", false); return true; };

        // --- /grain showcase scenario: the SAME door drives the showcase surface. This is the
        //     page whose whole claim is "no privileged AI→DOM back channel" — so its "Watch the
        //     AI act" demo goes through POST /intent → RenderOps over SSE, exactly like /loop, and
        //     targets the /grain composition's own surface addresses. (Stub-demo choreography; the
        //     live model at M★ reads the manifest instead of hard-coded surfaces.) ---
        if (intent.screen === "grain") {
          // Narrate every step to the terminal so a run is always LEGIBLE (never reads as "stuck").
          // The /grain page shows a console feed (data-surface="console") while acting.
          clearConsole();

          // 1) read the surface
          narrate("reads", "checking today's tasks");
          await moveTo("grain-rail");
          await beat(HOLD_MS);
          if (stopped()) return handBack;

          // 2) compose a request in the Ask field like a human, then "submit" (clears it)
          narrate("types", "composing “Plan Thursday…”");
          await moveTo("grain-ask");
          await stream("grain-ask", "Plan Thursday around the review", false);
          await beat(HOLD_MS);
          tools.emit({ target: "grain-ask", op: "type", done: true, provenance: "ai", commit: "committed" });
          if (stopped()) return handBack;

          // 3) reply into the surface's OWN chat (chat-log:grain — visible in the main pane during
          //    the takeover, since the shell assistant slides away). A fresh grain bubble.
          narrate("writes", "replying in the thread");
          await moveTo("chat-log:grain");
          tools.emit({ target: "chat-log:grain", op: "append", provenance: "ai", commit: "pending",
            html: `<div class="chat-message" data-role="ai" data-grade="grain"><span class="chat-message__who">GRAIN</span><span class="chat-message__body" data-surface="grain-reply"></span></div>` });
          await stream("grain-reply", "On it — three deep-work blocks, review at 2.");
          await beat(HOLD_MS);
          if (stopped()) return handBack;

          // 4) complete a task — a click that flips its badge to done (committed)
          narrate("commits", "completing “Draft the Q3 plan”");
          await moveTo("grain-task", true);
          tools.emit({ target: "grain-task-badge", op: "replace", provenance: "ai", commit: "committed",
            html: `<span class="badge" data-status="archived" data-surface="grain-task-badge">done</span>` });
          await beat(HOLD_MS);
          if (stopped()) return handBack;

          // 5) draft a follow-up task of its own — AI-authored, so it STAYS grain
          narrate("types", "drafting a follow-up");
          tools.emit({ target: "grain-tasks", op: "append", provenance: "ai", commit: "pending",
            html: `<li class="list__item" data-grade="grain" data-surface="grain-draft"></li>` });
          await moveTo("grain-draft");
          await stream("grain-draft", "Block 9–11am for deep work");
          await beat(HOLD_MS);

          // 6) hand back
          narrate("done", "handed back to you");
          spot("screen", false);
          return { ok: true, ops: [], reply: "(demo) the AI read, replied, completed a task, and drafted one — all through the door." };
        }

        // Write a committed VALUE into a surface: stream it in grain (you watch it type),
        // then settle to the CLEAN committed HTML. Speech stays grain; ground-truth data
        // settles clean — the same grain→clean an item.archive shows (AI-INTERFACE §5).
        const commitText = async (surface: string, grainLine: string, cleanHtml: string) => {
          await moveTo(surface);
          await stream(surface, grainLine, false);   // type in grain, no settle-to-grain
          await beat(HOLD_MS);
          tools.emit({ target: surface, op: "replace", html: cleanHtml, provenance: "ai", commit: "committed" });
        };
        // Append a bullet to the plan list, then write its text and settle it clean.
        const liHtml = (n: number, text: string) => `<li class="list__item" data-surface="plan-item:${n}">${text}</li>`;
        const addBullet = async (n: number, text: string) => {
          tools.emit({ target: PUSH_SURFACES.plan, op: "append", html: liHtml(n, ""), provenance: "ai", commit: "pending" });
          await commitText(`plan-item:${n}`, text, liHtml(n, text));
        };
        // REVISE an already-written surface: backspace the old text one char at a time
        // (the AI thinking again), then type the replacement and settle it clean.
        const overwrite = async (surface: string, oldText: string, newText: string, cleanHtml: string) => {
          await moveTo(surface);
          for (let i = 0; i < [...oldText].length; i++) {
            if (tools.cancelled()) break;
            await tools.delay(thinkMs > 0 ? BACK_MS : 0);   // erase faster than we type
            tools.emit({ target: surface, op: "type", back: 1, provenance: "ai", commit: "pending" });
          }
          await beat(220);                           // a pause on the empty line — "reconsidering"
          await stream(surface, newText, false);     // retype in grain
          await beat(HOLD_MS);
          tools.emit({ target: surface, op: "replace", html: cleanHtml, provenance: "ai", commit: "committed" });
        };

        clearConsole();
        narrate("reads", "checking what's in view — 3 tasks");

        // 1) compose the request in the input like a human would, then "submit"
        await moveTo(PUSH_SURFACES.askInput);
        narrate("types", 'composing "Plan my Thursday"');
        await stream(PUSH_SURFACES.askInput, "Plan my Thursday", false);
        await beat(HOLD_MS);
        tools.emit({ target: PUSH_SURFACES.askInput, op: "type", done: true, provenance: "ai", commit: "committed" });  // Enter → clears it
        if (stopped()) return handBack;

        // 2) reflect — the AI SPEAKING, so it stays grain
        await moveTo("reflection");
        narrate("writes", "reflecting on your week");
        await stream("reflection", "Thursday's light — 09:00–11:00 is free. Here's a plan…");
        await beat(HOLD_MS);
        if (stopped()) return handBack;

        // 3) write the plan as a bullet list — each item commits to clean
        narrate("writes", "drafting a 4-line plan");
        await addBullet(1, "Deep-work block — 09:00–11:00");
        if (stopped()) return handBack;
        await addBullet(2, "Clear the inbox");
        if (stopped()) return handBack;
        await addBullet(3, "Review architecture doc");
        if (stopped()) return handBack;

        // 4) revise just the 3rd item — backspace it, retype (targeted edit + flexibility)
        narrate("revises", "line 3 — deep-work done");
        await overwrite("plan-item:3", "Review architecture doc", "Review doc — done, archived",
          liHtml(3, "Review doc — done, archived"));
        if (stopped()) return handBack;

        // 5) triage today's task CARDS — spotlight each (it goes grain), flip its b-badge,
        //    settle clean. Drives the loop-card + the demo card + badge, all AI-driven.
        const badge = (surface: string, status: string, label: string) =>
          `<span class="badge" data-status="${status}" data-surface="${surface}">${label}</span>`;
        // archive the finished task — a REAL write through the scoped tool (not a cosmetic flip):
        // the AI mutates state via the service, then renders the COMMITTED card back over SSE.
        // Re-runnable: archiveItem is idempotent, so replaying re-archives the same demo fixture
        // (a harmless no-op write). The id is a demo fixture; the live model reads the manifest.
        const reviewSurface = "item:ITM-demo-1";
        narrate("clicks", "archiving “Review doc”");
        await moveTo(reviewSurface, true);         // the finished one → click to archive it
        await tools.archiveItem(surfaceId(reviewSurface));
        tools.emit({ target: reviewSurface, op: "replace", html: await tools.renderSurface(reviewSurface), provenance: "ai", commit: "committed" });
        await beat(HOLD_MS);
        if (stopped()) return handBack;
        narrate("clicks", "scheduling the deep-work block");
        await moveTo("item:ITM-demo-2");                     // the deep-work one → schedule it
        tools.emit({ target: PUSH_SURFACES.demoTaskBadge, op: "replace", html: badge(PUSH_SURFACES.demoTaskBadge, "active", "Thu 09:00"), provenance: "ai", commit: "committed" });
        await beat(HOLD_MS);
        if (stopped()) return handBack;

        // 6) press Commit to finalise — a button the AI CLICKS (pulse), like a human (b-button)
        narrate("commits", "committing the plan");
        await moveTo("commit-btn", true);
        await beat(SETTLE_MS);
        if (stopped()) return handBack;

        // 7) summarise — speech again (grain) — then hand back
        narrate("writes", "summarising");
        await moveTo(PUSH_SURFACES.summary);
        await stream(PUSH_SURFACES.summary, "Plan's set — deep-work at nine, one already done. Two to go.");
        await beat(HOLD_MS);
        spot("screen", false);                     // hand back to you
        return { ok: true, ops: [], reply: "(demo) the AI planned, triaged, committed, then handed back." };
      }

      // Even the light path takes a beat so the optimistic grain state is visible;
      // a real heavy path would push a "thinking" flash here first.
      await tools.delay(def.depth === "heavy" ? thinkMs * 3 : thinkMs);

      // Simulated refusal / failed write → rollback (MVP §"Rollback").
      const failed = failRate >= 1 || (failRate > 0 && Math.random() < failRate);
      if (failed) {
        return {
          ok: false,
          reason: "stub: simulated write failure",
          reply: "Couldn't complete that — left it as it was.",
          ops: [{
            target: intent.surface, op: "flash",
            message: "Couldn't archive — try again.",
            provenance: "system", commit: "committed",
          }],
        };
      }

      // item.archive: commit the write, then emit the confirmed (clean) fragment.
      const id = surfaceId(intent.surface);
      await tools.archiveItem(id);
      const html = await tools.renderSurface(intent.surface);
      return {
        ok: true,
        reply: "Archived.",
        ops: [{
          target: intent.surface, op: "replace", html,
          provenance: "ai", commit: "committed",
        }],
      };
    },
  };
}
