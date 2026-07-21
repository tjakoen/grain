// /app/ai/interaction-layer.ts — THE ONE DOOR (the single internal AI interaction
// layer; MVP §"One interface, one path"). Every Intent — from a human click or an
// AI decision — enters here, is validated against the closed vocabulary, handed to
// the reasoner (the single writer), and the resulting RenderOps are PUSHED back to
// the originating session over SSE. Nothing reaches the DOM by any other path.

import type { Reasoner, ReasonTools } from "./reasoner.ts";
import type { Intent, Decision, Surface, OpChannel, LogSink, Provenance } from "./contract.ts";
import { ACTIONS, isAction, surfaceKind, actionsForKind, OP_EVENT, STOP_ACTION } from "./contract.ts";

export interface LayerDeps {
  reasoner: Reasoner;
  stream: OpChannel;   // the push port — GRAIN depends on this, not on BATCH's SSE hub
  archiveItem: (id: string) => Promise<void>;       // the scoped write capability
  renderSurface: (surface: Surface) => Promise<string>;   // committed HTML for a surface
  logSink?: LogSink;   // OPTIONAL: record every door crossing (the interaction timeline, §5g)
}

export interface InteractionLayer {
  /** Handle one intent end-to-end; ops are pushed over `stream`. Returns the
   *  decision so callers/tests can inspect it (routes fire-and-forget). */
  handleIntent(intent: Intent): Promise<Decision>;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createInteractionLayer(deps: LayerDeps): InteractionLayer {
  const { reasoner, stream, archiveItem, renderSurface, logSink } = deps;

  // Record one door crossing on the LOG PORT (if wired). Both the incoming REQUEST (kind
  // "intent", provenance = who raised it) and the outgoing DECISION (kind "response",
  // provenance = who authored the render — ai on success, system on a rejection/rollback)
  // are logged, so the timeline reads as request → response, source-tagged and identical
  // for a human click or an AI decision (AI-INTERFACE §5g).
  const logIntent = (intent: Intent) => logSink?.record({
    session: intent.session, source: intent.source, kind: "intent",
    screen: intent.screen, surface: intent.surface, action: intent.action, ok: true, ops: 0,
  });
  // opCount = every RenderOp this crossing produced: the reasoner's mid-decision `emit`s (streamed
  // tokens/appends) PLUS the ops in the returned decision. The streaming verbs return ops:[] and emit
  // inline, so counting decision.ops alone would read a chat or demo as "0 ops" — hence both.
  const logResponse = (intent: Intent, decision: Decision, opCount = decision.ops.length) => {
    if (!logSink) return;
    const source: Provenance = decision.ops.some((o) => o.provenance === "ai") ? "ai"
      : decision.ok ? "ai" : "system";
    logSink.record({
      session: intent.session, source, kind: "response",
      screen: intent.screen, surface: intent.surface, action: intent.action,
      ok: decision.ok, ops: opCount,
    });
  };

  const reject = (intent: Intent, reason: string, message: string): Decision => ({
    ok: false,
    reason,
    ops: [{ target: intent.surface, op: "flash", message, provenance: "system", commit: "committed" }],
  });

  // Stop is keyed PER TURN, not per session. Each turn (one reasoner run) gets a unique id;
  // the reasoner polls cancelled() for ITS id and halts at a clean boundary. `desk.stop` flags
  // every turn currently running for the session. This way a concurrent intent (e.g. a chat sent
  // mid-run) can never clear another running turn's stop flag (never a force-kill; §"Rollback"/§9).
  let turnSeq = 0;
  const activeTurns = new Map<string, Set<number>>();   // session → its running turn ids
  const stoppedTurns = new Set<number>();               // turn ids asked to stop

  async function handleIntent(intent: Intent): Promise<Decision> {
    logIntent(intent);   // record the crossing the moment it enters the one door (both operators, uniformly)

    // `desk.stop` is a CONTROL signal: it never reaches the reasoner. It flags every turn
    // running for this session; each running decision notices and hands back cleanly.
    if (intent.action === STOP_ACTION) {
      for (const id of activeTurns.get(intent.session) ?? []) stoppedTurns.add(id);
      const stop: Decision = { ok: true, ops: [], reply: "Asked the AI to stop." };
      logResponse(intent, stop);
      return stop;
    }

    const turn = ++turnSeq;
    const running = activeTurns.get(intent.session) ?? new Set<number>();
    running.add(turn); activeTurns.set(intent.session, running);

    let emitted = 0;   // RenderOps the reasoner streams mid-decision (the timeline counts these too)
    let decision: Decision;
    try {
      // "See if it's possible with the interfaces given" (MVP step 5): a lookup. A rejection ECHOES
      // the moves that WOULD work — the valid verbs the vocabulary offers (unknown action) or the
      // verbs this surface actually accepts (wrong surface) — so a reasoner reading the Decision can
      // self-correct on its next turn instead of dead-ending on a bare "no" (AI-INTERFACE §0, the
      // "surface has physics" direction). The `reason` is the machine-facing trace the model reads;
      // the `flash` message stays short and human-facing.
      if (!isAction(intent.action)) {
        const known = Object.keys(ACTIONS).join(", ");
        decision = reject(intent, `unknown action: ${intent.action}; known verbs: ${known}`,
          "That action isn't available.");
      } else if (!ACTIONS[intent.action].accepts.includes(surfaceKind(intent.surface))) {
        const valid = actionsForKind(surfaceKind(intent.surface));
        const accepts = valid.length ? `${intent.surface} accepts: ${valid.join(", ")}` : `${intent.surface} accepts no verbs`;
        decision = reject(intent, `surface ${intent.surface} rejects ${intent.action}; ${accepts}`,
          valid.length ? `Can't do that here — this surface takes: ${valid.join(", ")}.` : "Can't do that here.");
      } else {
        const tools: ReasonTools = {
          archiveItem: (id) => archiveItem(id),
          renderSurface: (s) => renderSurface(s),
          emit: (op) => { emitted++; stream.push(intent.session, OP_EVENT, op); },   // stream tokens mid-decision
          cancelled: () => stoppedTurns.has(turn),                   // per-turn — no cross-turn clobber
          delay,
        };
        decision = await reasoner.decide(intent, tools);
      }
    } catch (e) {
      console.error("[interaction-layer]", e);
      decision = reject(intent, "internal error", "Something went wrong.");
    } finally {
      running.delete(turn);
      if (running.size === 0) activeTurns.delete(intent.session);
      stoppedTurns.delete(turn);
    }

    // When the AI itself is the actor (not a human click), bracket the ops with a
    // spotlight so the user can SEE the AI acting (AI-INTERFACE §5c). The demo
    // sequence emits its own spotlights; this covers real AI/worker-initiated intents.
    const aiActing = intent.source === "ai" && decision.ops.length > 0;
    if (aiActing) stream.push(intent.session, OP_EVENT,
      { target: intent.surface, op: "spotlight", active: true, provenance: "ai", commit: "pending" });

    // Push every op back to the session that raised the intent (MVP step 8).
    for (const op of decision.ops) stream.push(intent.session, OP_EVENT, op);

    if (aiActing) stream.push(intent.session, OP_EVENT,
      { target: intent.surface, op: "spotlight", active: false, provenance: "ai", commit: "committed" });

    logResponse(intent, decision, emitted + decision.ops.length);   // record the outcome — the response half of the crossing
    return decision;
  }

  return { handleIntent };
}
