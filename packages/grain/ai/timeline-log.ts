// grain/ai/timeline-log.ts — the interaction TIMELINE, made visible (AI-INTERFACE §5g).
//
// A LogSink implementation that turns each recorded door crossing (contract.ts LogEntry) into a
// `log` RenderOp pushed to the `timeline` surface, so the unified human-and-AI log renders live.
// It depends only on the OpChannel port — like any other push surface, it reaches the client the
// same way render ops do. Another product on GRAIN would wire this exactly as the console is wired;
// nothing product-specific lives here. (The audit-journal / observability sink is a SEPARATE LogSink
// impl — the door records to whichever one the composition root wires.)

import type { LogSink, LogEntry, OpChannel, RenderOp } from "./contract.ts";
import { PUSH_SURFACES, OP_EVENT } from "./contract.ts";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The one-line entry markup — the `timeline` component's row (its CSS colours + grades it by
// [data-provenance]). Built server-side, like the reasoner builds its console__line / chat-message
// fragments (BATCH: the server owns rendering; the client stays dumb).
export function timelineEntryHtml(entry: LogEntry, seq: number): string {
  const mark = entry.kind === "response" ? (entry.ok ? "✓" : "✗") : "→";
  const detail = entry.kind === "response"
    ? `${entry.ops} op${entry.ops === 1 ? "" : "s"}`
    : esc(entry.surface);
  return (
    `<li class="timeline__entry" data-provenance="${entry.source}" data-kind="${entry.kind}"` +
      (entry.ok ? "" : ` data-ok="false"`) + ` data-seq="${seq}">` +
      `<span class="timeline__who">${entry.source}</span>` +
      `<span class="timeline__mark" aria-hidden="true">${mark}</span>` +
      `<span class="timeline__verb">${esc(entry.action)}</span>` +
      `<span class="timeline__detail">${detail}</span>` +
    `</li>`
  );
}

/** Wire a LogSink that renders each crossing into the live interaction timeline over `stream`. */
export function createStreamLogSink(stream: OpChannel): LogSink {
  let seq = 0;
  return {
    record(entry: LogEntry): void {
      const op: RenderOp = {
        target: PUSH_SURFACES.timeline,
        op: "log",
        html: timelineEntryHtml(entry, ++seq),
        provenance: entry.source,      // color-code the entry by who authored the crossing
        commit: "committed",           // a log line is a fact, never optimistic
      };
      stream.push(entry.session, OP_EVENT, op);
    },
  };
}
