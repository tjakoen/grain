// /app/ai/reasoner.ts — the reasoner boundary (the PROJECT-PLAN §10c `Model` seam)
// plus a stub standing in for the real cloud/local model during frontend work.
//
// The reasoner is the SINGLE WRITER: it decides, then writes + renders through
// SCOPED TOOLS (its action vocabulary). Swapping the stub for a real model later is
// an implementation change behind this interface — not a rewrite. The stub is
// PLUMBING, never faked judgment (MVP §"Build Order").

import type { Intent, Decision, Surface, RenderOp } from "./contract.ts";
import { ACTIONS, surfaceId } from "./contract.ts";

// The scoped capabilities the reasoner is allowed to use — its tool surface. The
// real reasoner reaches storage through least-privilege tools exactly like this.
export interface ReasonTools {
  archiveItem(id: string): Promise<void>;
  /** Render the COMMITTED (clean) HTML for a surface, after a write. */
  renderSurface(surface: Surface): Promise<string>;
  /** Push a render op NOW (mid-decision) — used to stream tokens as they're made. */
  emit(op: RenderOp): void;
  /** True if the user asked the desk to stop — checked between steps for a graceful halt. */
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
const SETTLE_MS = 480;  // after the spotlight lands on a surface, before it acts (≥ the dim's fade-in)
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

  return {
    async decide(intent: Intent, tools: ReasonTools): Promise<Decision> {
      const def = ACTIONS[intent.action];

      const beat = (ms: number) => tools.delay(thinkMs > 0 ? ms : 0);

      // Spotlight the surface the AI is touching — the "desk is acting" treatment.
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

      // --- say.stream: button → the AI types a reflection. Spotlit: a human clicked, but
      //     the AI is the one writing, so show where it acts (grade = AI as actor, §5c). ---
      if (intent.action === "say.stream") {
        await moveTo(intent.surface);
        const d = await stream(intent.surface, "On it — checking your week. You have room on Thursday.");
        await beat(HOLD_MS);
        spot(intent.surface, false);
        return d;
      }

      // --- say.set: input → the AI writes back the line it noted from your text ---
      if (intent.action === "say.set") {
        const text = String(intent.payload.text ?? "").trim();
        await moveTo(intent.surface);
        const d = await stream(intent.surface, text ? `Noted: ${text}` : "Nothing to note.");
        await beat(HOLD_MS);
        spot(intent.surface, false);
        return d;
      }

      // --- demo.run: a useful end-to-end scenario the user can WATCH — the desk drafts a
      //     Thursday plan as a bullet LIST, then REVISES one specific item (backspacing it,
      //     retyping) to show targeted editing. The spotlight follows what it touches; the
      //     backdrop stays up across the turn, then releases (AI-INTERFACE §5c).
      //     Re-runnable: it drives demo surfaces with render ops and mutates no storage. ---
      if (intent.action === "demo.run") {
        const handBack: Decision = { ok: true, ops: [], reply: "Stopped — handed back to you." };
        // graceful stop: hand back cleanly if asked — never a force-kill (PROJECT-PLAN §9).
        const stopped = (): boolean => { if (!tools.cancelled()) return false; spot("screen", false); return true; };

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
          tools.emit({ target: "plan", op: "append", html: liHtml(n, ""), provenance: "ai", commit: "pending" });
          await commitText(`plan-item:${n}`, text, liHtml(n, text));
        };
        // REVISE an already-written surface: backspace the old text one char at a time
        // (the desk thinking again), then type the replacement and settle it clean.
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

        // 1) compose the request in the input like a human would, then "submit"
        await moveTo("ask-input");
        await stream("ask-input", "Plan my Thursday", false);
        await beat(HOLD_MS);
        tools.emit({ target: "ask-input", op: "type", done: true, provenance: "ai", commit: "committed" });  // Enter → clears it
        if (stopped()) return handBack;

        // 2) reflect — the desk SPEAKING, so it stays grain
        await moveTo("reflection");
        await stream("reflection", "Thursday's light — 09:00–11:00 is free. Here's a plan…");
        await beat(HOLD_MS);
        if (stopped()) return handBack;

        // 3) write the plan as a bullet list — each item commits to clean
        await addBullet(1, "Deep-work block — 09:00–11:00");
        if (stopped()) return handBack;
        await addBullet(2, "Clear the inbox");
        if (stopped()) return handBack;
        await addBullet(3, "Review architecture doc");
        if (stopped()) return handBack;

        // 4) revise just the 3rd item — backspace it, retype (targeted edit + flexibility)
        await overwrite("plan-item:3", "Review architecture doc", "Review doc — done, archived",
          liHtml(3, "Review doc — done, archived"));
        if (stopped()) return handBack;

        // 5) triage today's task CARDS — spotlight each (it goes grain), flip its b-badge,
        //    settle clean. Drives loop-card + item-card + badge, all AI-driven.
        const badge = (n: number, status: string, label: string) =>
          `<span class="badge" data-status="${status}" data-surface="task-badge:${n}">${label}</span>`;
        await moveTo("task:1");                     // the finished one → archive it
        tools.emit({ target: "task-badge:1", op: "replace", html: badge(1, "archived", "archived"), provenance: "ai", commit: "committed" });
        await beat(HOLD_MS);
        if (stopped()) return handBack;
        await moveTo("task:2");                     // the deep-work one → schedule it
        tools.emit({ target: "task-badge:2", op: "replace", html: badge(2, "active", "Thu 09:00"), provenance: "ai", commit: "committed" });
        await beat(HOLD_MS);
        if (stopped()) return handBack;

        // 6) press Commit to finalise — a button the desk CLICKS (pulse), like a human (b-button)
        await moveTo("commit-btn", true);
        await beat(SETTLE_MS);
        if (stopped()) return handBack;

        // 7) summarise — speech again (grain) — then hand back
        await moveTo("summary");
        await stream("summary", "Plan's set — deep-work at nine, one already done. Two to go.");
        await beat(HOLD_MS);
        spot("screen", false);                     // hand back to you
        return { ok: true, ops: [], reply: "(demo) the desk planned, triaged, committed, then handed back." };
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
