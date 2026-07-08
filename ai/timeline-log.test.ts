// grain/ai/timeline-log.test.ts — the LogSink that renders crossings into the live timeline.
import { test, expect } from "bun:test";
import { createStreamLogSink, timelineEntryHtml } from "./timeline-log.ts";
import { OP_EVENT, PUSH_SURFACES } from "./contract.ts";
import type { OpChannel, RenderOp, LogEntry } from "./contract.ts";

function fakeStream() {
  const pushed: Array<{ session: string; event: string; data: unknown }> = [];
  const stream: OpChannel = { push: (session, event, data) => { pushed.push({ session, event, data }); } };
  return { stream, pushed };
}

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  session: "sess-1", source: "user", kind: "intent",
  screen: "grain", surface: "item:ITM-1", action: "item.archive", ok: true, ops: 0, ...over,
});

test("records a `log` op at the timeline surface, on the entry's session, colour-coded by provenance", () => {
  const { stream, pushed } = fakeStream();
  const sink = createStreamLogSink(stream);
  sink.record(entry({ source: "ai", kind: "response", ops: 2 }));

  expect(pushed).toHaveLength(1);
  expect(pushed[0]!.session).toBe("sess-1");
  expect(pushed[0]!.event).toBe(OP_EVENT);
  const op = pushed[0]!.data as RenderOp;
  expect(op.op).toBe("log");
  expect(op.target).toBe(PUSH_SURFACES.timeline);
  expect(op.provenance).toBe("ai");                // the client colours the entry off this
  expect(op.commit).toBe("committed");             // a log line is a fact, never optimistic
  expect(op.html).toContain('data-provenance="ai"');
});

test("entry markup carries provenance, kind, and a monotonic seq; escapes untrusted surface text", () => {
  const html = timelineEntryHtml(entry({ surface: 'item:<img src=x>"' }), 7);
  expect(html).toContain('data-kind="intent"');
  expect(html).toContain('data-seq="7"');
  expect(html).not.toContain("<img");             // surface text is escaped, never injected
  expect(html).toContain("&lt;img");
});

test("a failed crossing is marked so the component can strike it through", () => {
  const html = timelineEntryHtml(entry({ kind: "response", ok: false, ops: 1 }), 1);
  expect(html).toContain('data-ok="false"');
  expect(html).toContain("✗");
});

test("seq increments across records (newest is highest)", () => {
  const { stream, pushed } = fakeStream();
  const sink = createStreamLogSink(stream);
  sink.record(entry());
  sink.record(entry());
  expect((pushed[0]!.data as RenderOp).html).toContain('data-seq="1"');
  expect((pushed[1]!.data as RenderOp).html).toContain('data-seq="2"');
});
