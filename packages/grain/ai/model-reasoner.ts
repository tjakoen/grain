// grain/ai/model-reasoner.ts — a REAL reasoner built on the transport-agnostic core (model.ts).
//
// The stub (reasoner.ts) is scripted choreography; this is the M★ shape: on a natural-language turn it
// reads the LIVE manifest, asks a `Model` to pick ONE move in the vocabulary, VALIDATES that move
// against the contract + the on-screen surfaces (model.ts), then executes it through the SAME kit
// op-builders the stub dogfoods (reasoner-kit.ts) — so a real model and the stub emit byte-identical
// markup. Any `Model` plugs in (local WebLLM, a cloud API, a test fake): the reasoner is
// transport-agnostic, exactly as the human asked ("grain needs to be flexible").
//
// The manifest is supplied by a PROVIDER the composition root injects — in the browser
// `() => domManifest(document)`, on a server the built manifest — so grain stays DOM-free and the
// transport/wiring stays the root's choice (the same principle as the OpChannel + client-door seams).
//
// CLIENT-SAFE (§19.2): pure imports (the core, the kit, the contract), no DOM, no secrets.

import type { Intent, Decision, RenderOp } from "./contract.ts";
import { surfaceId } from "./contract.ts";
import type { Reasoner, ReasonTools } from "./reasoner.ts";
import type { Manifest } from "./manifest.ts";
import { manifestToText } from "./manifest-dom.ts";
import { buildReasonerPrompt, parseModelMove, validateMove, type Model, type ValidatedMove } from "./model.ts";
import {
  esc, userMessageOp, aiBubbleOp, typeToken, settleOp, replaceBodyOp,
  noteAppendOp, noteReplaceOp, navigateOp,
} from "./reasoner-kit.ts";

export interface ModelReasonerOptions {
  /** The model the reasoner asks to decide — any transport (local, cloud, fake) behind the port. */
  model: Model;
  /** Read the CURRENT live manifest. The composition root supplies this (browser: domManifest(document);
   *  server: the built manifest) so grain stays DOM-free + transport-agnostic. Called per turn, so the
   *  model always reasons over what's on screen RIGHT NOW — including inView.readable state. */
  manifest: () => Manifest;
  /** Per-character cadence (ms) for the visible reply stream. 0 (default) streams instantly — used in
   *  tests; a UI passes a small value so the reply types out like the stub's. */
  thinkMs?: number;
}

const TYPE_MS = 24;   // per-character while typing the reply out (only applied when thinkMs > 0)

/** Build a Reasoner that decides via a `Model`. A natural-language turn (chat.send / say.set with text)
 *  goes to the model; any other verb is a control the human already chose, so it's executed directly
 *  (still validated against the contract). Reply-shaped verbs the model can't structurally act on
 *  (demo.run, say.stream) fall through to a spoken reply. */
export function makeModelReasoner(opts: ModelReasonerOptions): Reasoner {
  const { model, manifest } = opts;
  const thinkMs = opts.thinkMs ?? 0;
  let seq = 0;   // unique id per streamed AI chat bubble

  /** Stream text into a surface one code point at a time (kit ops), then settle it clean. */
  async function stream(surface: string, text: string, tools: ReasonTools): Promise<void> {
    for (const ch of [...text]) {
      if (tools.cancelled()) break;
      if (thinkMs > 0) await tools.delay(TYPE_MS);
      tools.emit(typeToken(surface, ch));
    }
    tools.emit(settleOp(surface));
  }

  /** Execute a VALIDATED move: perform its structural effect (if any) through the kit, then stream the
   *  human-facing reply into `replyTarget` (a chat bubble body, or the reflection line). `navigate` is
   *  emitted LAST — it's terminal for the page, so the reply is seen first. */
  async function execute(move: ValidatedMove, tools: ReasonTools, replyTarget: string | null): Promise<Decision> {
    const structural: RenderOp[] = [];
    let terminal: RenderOp | null = null;

    switch (move.action) {
      case "note.append":  structural.push(noteAppendOp(String(move.payload.text), "ai")); break;
      case "note.replace": structural.push(noteReplaceOp(String(move.payload.text), "ai")); break;
      case "navigate":     terminal = navigateOp(move.target, String(move.payload.href)); break;
      case "item.archive": {
        await tools.archiveItem(surfaceId(move.target));
        structural.push({ target: move.target, op: "replace", html: await tools.renderSurface(move.target),
          provenance: "ai", commit: "committed" });
        break;
      }
      // action null (reply-only) or a reply-shaped verb: the effect IS the reply, streamed below.
      default: break;
    }

    for (const op of structural) tools.emit(op);
    if (replyTarget) {
      if (move.reply) await stream(replyTarget, move.reply, tools);
      else tools.emit(settleOp(replyTarget));   // never leave an opened bubble blank
    }
    if (terminal) tools.emit(terminal);

    return { ok: true, ops: [], reply: move.reply };   // ops all emitted inline (streaming pattern)
  }

  /** The agentic entry: a human message → the model picks + we execute one move. */
  async function decideFromMessage(intent: Intent, tools: ReasonTools, message: string): Promise<Decision> {
    const m = manifest();

    // chat.send shows the human's message, then opens an AI bubble to stream the reply into. say.set
    // writes straight back into the reflection surface it targeted (no chat bubble).
    let replyTarget: string;
    let bubble = false;
    if (intent.action === "chat.send") {
      tools.emit(userMessageOp(intent.surface, message));
      replyTarget = `chat-msg:${++seq}`;
      tools.emit(aiBubbleOp(intent.surface, replyTarget));
      bubble = true;
    } else {
      replyTarget = intent.surface;
    }

    const fail = (human: string, reason: string): Decision => {
      // don't leave an opened bubble blank — replace its body with the message; else flash the surface.
      const op: RenderOp = bubble
        ? replaceBodyOp(replyTarget, esc(human), "committed")
        : { target: intent.surface, op: "flash", message: human, provenance: "system", commit: "committed" };
      return { ok: false, reason, ops: [op] };
    };

    let raw: string;
    try { raw = await model.complete(buildReasonerPrompt(manifestToText(m), message)); }
    catch (e) { return fail("The model didn't respond — try again.", `model.complete threw: ${String(e)}`); }

    const parsed = parseModelMove(raw);
    if (!parsed.ok) return fail("I couldn't read that decision.", parsed.reason);
    const valid = validateMove(parsed.move, m);
    if (!valid.ok) return fail("I couldn't do that here.", valid.reason);

    return execute(valid.move, tools, replyTarget);
  }

  return {
    async decide(intent: Intent, tools: ReasonTools): Promise<Decision> {
      const message = String(intent.payload?.text ?? "").trim();

      if ((intent.action === "chat.send" || intent.action === "say.set") && message)
        return decideFromMessage(intent, tools, message);

      // A direct verb the human already chose (a control click). No model judgment needed — validate
      // the intent as a move against the live manifest, then execute it. (The door already checked the
      // verb exists + the surface KIND accepts it; validateMove adds target + payload checks.)
      const m = manifest();
      const valid = validateMove({ action: intent.action, target: intent.surface, payload: intent.payload }, m);
      if (!valid.ok)
        return { ok: false, reason: valid.reason,
          ops: [{ target: intent.surface, op: "flash", message: "Can't do that here.", provenance: "system", commit: "committed" }] };
      return execute(valid.move, tools, null);
    },
  };
}
