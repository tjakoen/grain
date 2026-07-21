// grain/ai/client-door.ts — THE DOOR, IN THE BROWSER (ARCHITECTURE §19.3, opt-in). The same
// createInteractionLayer the server wires, composed for a client with no backend: the SSE OpChannel
// becomes a LOOPBACK (ops hand straight to the dispatcher's applyOp), POST /intent becomes a direct
// call. Same vocabulary, same validation, same single writer — a static host runs the full loop.
//
// CLIENT-SAFE (§19.2): this module and everything it imports must stay pure — relative imports only
// (the module server refuses bare imports), no secrets, no server-required behavior. Its reasoner is
// the stub; its write capabilities are inert, so only the service-free demo scenarios (e.g. the
// /grain screen's demo.run + chat.send) are honest here. Anything needing real state keeps the
// server door — selecting the transport is the page/composition root's choice, not grain's.

import { createInteractionLayer, type InteractionLayer } from "./interaction-layer.ts";
import { makeStubReasoner, type StubOptions, type Reasoner } from "./reasoner.ts";
import { createStreamLogSink } from "./timeline-log.ts";
import { manifestForReasoner, type DomDoc } from "./manifest-dom.ts";
import { OP_EVENT, type OpChannel, type RenderOp } from "./contract.ts";

export interface ClientDoorOptions extends StubOptions {
  /** Swap the reasoner (e.g. a consumer's scripted scenario, or later a local model). It must be
   *  client-safe like everything else here. Default: GRAIN's stub. This is the same seam the
   *  server door has — the model arrives into a contract, on either transport. */
  reasoner?: Reasoner;
}

/** The client door is a plain InteractionLayer PLUS an observe() step — the "read the result" half
 *  of an in-browser act → observe → decide loop. Because ops loop back synchronously into the DOM,
 *  by the time handleIntent resolves the page reflects the change; observe() re-harvests the LIVE
 *  DOM manifest so a driving reasoner sees the new state without a server round-trip. */
export interface ClientDoor extends InteractionLayer {
  /** Re-harvest the live-DOM manifest as prompt-ready text (the same shape `manifestForReasoner`
   *  emits). The document is a PARAMETER, not the global — so this module needs no DOM lib and
   *  stays client-safe on the shared build (like `manifest-dom.ts`). In the browser, pass
   *  `document`; in a test, a structural `DomDoc` fake. */
  observe(doc: DomDoc): string;
}

/** Wire the door for the browser: ops loop back synchronously into the given renderer (the
 *  dispatcher's applyOp). Returns a ClientDoor — the same InteractionLayer the server exposes (so
 *  the dispatcher treats both transports identically) plus observe() for an agentic driver. */
export function createClientDoor(applyOp: (op: RenderOp) => void, opts: ClientDoorOptions = {}): ClientDoor {
  const { reasoner, ...reasonerOpts } = opts;
  const loopback: OpChannel = {
    push: (_session, event, data) => { if (event === OP_EVENT) applyOp(data as RenderOp); },
  };
  const layer = createInteractionLayer({
    reasoner: reasoner ?? makeStubReasoner(reasonerOpts),
    stream: loopback,
    logSink: createStreamLogSink(loopback),   // the timeline works on the client transport too (§5g)
    // Inert capabilities: no storage exists client-side. The service-free scenarios never call
    // these; if a future scenario does, renderSurface's empty string renders nothing rather than
    // faking committed state — the honest failure mode for a demo transport.
    archiveItem: async () => {},
    renderSurface: async () => "",
  });
  return { ...layer, observe: (doc) => manifestForReasoner(doc) };
}
