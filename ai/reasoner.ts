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

      // --- demo.run: play a scripted AI-acting sequence so the user can WATCH the desk
      //     drive the UI. The spotlight follows what it touches; the backdrop stays up
      //     across the whole turn, then releases (AI-INTERFACE §5c). ---
      if (intent.action === "demo.run") {
        const handBack: Decision = { ok: true, ops: [], reply: "Stopped — handed back to you." };
        // graceful stop: hand back cleanly if asked — never a force-kill (PROJECT-PLAN §9).
        const stopped = (): boolean => { if (!tools.cancelled()) return false; spot("screen", false); return true; };

        // Same rhythm at every step: moveTo (spotlight + SETTLE) → act → HOLD → move on.
        // 1) land on the button, settle, then click — the click visibly causes the answer.
        await moveTo("say-button");
        spot("say-button", true, true);            // click (pulse) once it's settled
        await beat(SETTLE_MS);
        if (stopped()) return handBack;
        await moveTo("say-stream");                // move to the answer, settle
        await stream("say-stream", "On it — checking your week. Thursday 09:00–11:00 is clear.");
        await beat(HOLD_MS);
        if (stopped()) return handBack;

        // 2) use the INPUT like a human would: compose IN the field, then "submit"
        await moveTo("say-input");
        await stream("say-input", "Move my deep-work block to Thursday", false);
        await beat(HOLD_MS);
        tools.emit({ target: "say-input", op: "type", done: true, provenance: "ai", commit: "committed" });  // Enter → clears it
        if (stopped()) return handBack;

        // 3) …which lands the noted line in the text under it
        await moveTo("say-line");
        await stream("say-line", "Noted: deep-work moved to Thursday, 09:00–11:00.");
        await beat(HOLD_MS);
        spot("screen", false);                     // hand back to you
        return { ok: true, ops: [], reply: "(demo) the desk acted, then handed back." };
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
