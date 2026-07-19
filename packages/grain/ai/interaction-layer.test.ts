// /app/ai/interaction-layer.test.ts — the one door: validation, single-writer, push.
import { test, expect } from "bun:test";
import { createInteractionLayer } from "./interaction-layer.ts";
import { makeStubReasoner } from "./reasoner.ts";
import type { Reasoner, ReasonTools } from "./reasoner.ts";
import type { Intent, RenderOp, OpChannel, LogSink, LogEntry } from "./contract.ts";

// An OpChannel double that records what got pushed and to whom (GRAIN's only port).
function fakeStream() {
  const pushed: Array<{ session: string; event: string; data: unknown }> = [];
  const stream: OpChannel = {
    push: (session, event, data) => { pushed.push({ session, event, data }); },
  };
  return { stream, pushed };
}

// A LogSink double: captures every recorded door crossing (the interaction timeline port).
function fakeLog() {
  const entries: LogEntry[] = [];
  const sink: LogSink = { record: (e) => { entries.push(e); } };
  return { sink, entries };
}

function makeLayer(opts: { failRate?: number } = {}) {
  const archived: string[] = [];
  const { stream, pushed } = fakeStream();
  const { sink, entries } = fakeLog();
  const layer = createInteractionLayer({
    reasoner: makeStubReasoner({ failRate: opts.failRate ?? 0, thinkMs: 0 }),
    stream,
    archiveItem: async (id) => { archived.push(id); },
    renderSurface: async (s) => `<article data-surface="${s}" data-commit="committed">ok</article>`,
    logSink: sink,
  });
  return { layer, archived, pushed, entries };
}

const intent = (over: Partial<Intent> = {}): Intent => ({
  source: "user", session: "sess-1", screen: "loop",
  surface: "item:ITM-1", action: "item.archive", payload: {}, ...over,
});

const ops = (pushed: Array<{ data: unknown }>) => pushed.map((p) => p.data as RenderOp);

test("valid intent: single writer commits, then pushes a committed replace op", async () => {
  const { layer, archived, pushed } = makeLayer();
  const decision = await layer.handleIntent(intent());

  expect(decision.ok).toBe(true);
  expect(archived).toEqual(["ITM-1"]);            // the write happened, through the scoped tool
  expect(pushed[0]?.session).toBe("sess-1");      // pushed to the originating session
  const op = ops(pushed)[0]!;
  expect(op.op).toBe("replace");
  expect(op.provenance).toBe("ai");
  expect(op.commit).toBe("committed");            // grade = commit state
});

test("unknown action is rejected at the door — no write, a flash op", async () => {
  const { layer, archived, pushed } = makeLayer();
  const decision = await layer.handleIntent(intent({ action: "bogus.verb" as Intent["action"] }));

  expect(decision.ok).toBe(false);
  expect(archived).toEqual([]);
  expect(ops(pushed)[0]!.op).toBe("flash");
});

test("surface kind that doesn't accept the action is rejected", async () => {
  const { layer, archived, pushed } = makeLayer();
  const decision = await layer.handleIntent(intent({ surface: "item-list" }));

  expect(decision.ok).toBe(false);
  expect(archived).toEqual([]);
  expect(ops(pushed)[0]!.op).toBe("flash");
});

test("failed write rolls back: a flash op, no committed replace", async () => {
  const { layer, pushed } = makeLayer({ failRate: 1 });
  const decision = await layer.handleIntent(intent());

  expect(decision.ok).toBe(false);
  expect(ops(pushed)[0]!.op).toBe("flash");
});

test("demo.run plays an AI-acting sequence: spotlight on … then off, with typed text between", async () => {
  const { layer, pushed } = makeLayer();
  const decision = await layer.handleIntent(intent({ surface: "screen", action: "demo.run" }));

  expect(decision.ok).toBe(true);
  const all = ops(pushed);
  const spots = all.filter((o) => o.op === "spotlight");
  expect(spots[0]!.active).toBe(true);                       // raises the backdrop
  expect(spots[spots.length - 1]!.active).toBe(false);       // and releases at the end
  expect(all.some((o) => o.op === "type" && o.text)).toBe(true);   // it writes while acting
});

test("say.stream emits type tokens over SSE and settles with a committed done op", async () => {
  const { layer, pushed } = makeLayer();
  const decision = await layer.handleIntent(intent({ surface: "say-stream", action: "say.stream" }));

  expect(decision.ok).toBe(true);
  const typeOps = ops(pushed).filter((o) => o.op === "type");
  expect(typeOps.length).toBeGreaterThan(1);                 // streamed token by token
  expect(typeOps.some((o) => typeof o.text === "string")).toBe(true);
  const last = typeOps[typeOps.length - 1]!;
  expect(last.done).toBe(true);
  expect(last.commit).toBe("committed");                     // grain settles to clean
});

// --- the interaction TIMELINE: every crossing recorded at the one door (§5g) -----
test("logs both halves of a valid crossing: the user's request, then the AI's response", async () => {
  const { layer, entries } = makeLayer();
  await layer.handleIntent(intent());

  const req = entries.find((e) => e.kind === "intent")!;
  const res = entries.find((e) => e.kind === "response")!;
  expect(req.source).toBe("user");                 // the human raised it
  expect(req.action).toBe("item.archive");
  expect(req.session).toBe("sess-1");
  expect(res.source).toBe("ai");                   // the AI authored the render
  expect(res.ok).toBe(true);
  expect(res.ops).toBeGreaterThan(0);              // it emitted render ops
});

test("a rejected request is logged as a system response (failed, no ops from the AI)", async () => {
  const { layer, entries } = makeLayer();
  await layer.handleIntent(intent({ action: "bogus.verb" as Intent["action"] }));

  const res = entries.find((e) => e.kind === "response")!;
  expect(res.source).toBe("system");               // the door refused — not the AI
  expect(res.ok).toBe(false);
});

test("an AI-sourced intent is recorded with ai provenance (both operators, one format)", async () => {
  const { layer, entries } = makeLayer();
  await layer.handleIntent(intent({ source: "ai" }));

  expect(entries.find((e) => e.kind === "intent")!.source).toBe("ai");
});

test("the door runs fine with no logSink wired (observability is optional)", async () => {
  const archived: string[] = [];
  const layer = createInteractionLayer({
    reasoner: makeStubReasoner({ thinkMs: 0 }), stream: fakeStream().stream,
    archiveItem: async (id) => { archived.push(id); }, renderSurface: async () => "",
  });
  const decision = await layer.handleIntent(intent());
  expect(decision.ok).toBe(true);                  // no throw, no requirement on the sink
});

// --- stop control is keyed PER TURN (not per session) ---------------------------
// A long turn that yields between steps and reports whether it saw the stop.
function longTurn(onEnd: (cancelled: boolean) => void): Reasoner {
  return {
    async decide(i, tools: ReasonTools) {
      if (i.action === "demo.run") {
        for (let n = 0; n < 12; n++) { await tools.delay(0); if (tools.cancelled()) { onEnd(true); return { ok: true, ops: [] }; } }
        onEnd(false);
      }
      return { ok: true, ops: [] };
    },
  };
}
const layerWith = (reasoner: Reasoner) =>
  createInteractionLayer({ reasoner, stream: fakeStream().stream, archiveItem: async () => {}, renderSurface: async () => "" });

test("desk.stop halts the running turn (it polls cancelled and hands back)", async () => {
  let cancelled = false;
  const layer = layerWith(longTurn((c) => { cancelled = c; }));
  const running = layer.handleIntent(intent({ surface: "screen", action: "demo.run" }));
  await layer.handleIntent(intent({ surface: "screen", action: "desk.stop" }));
  await running;
  expect(cancelled).toBe(true);
});

test("a concurrent chat mid-run does NOT clear the running turn's stop (per-turn keying)", async () => {
  let cancelled = false;
  const layer = layerWith(longTurn((c) => { cancelled = c; }));
  const running = layer.handleIntent(intent({ surface: "screen", action: "demo.run" }));   // the AI starts working
  await layer.handleIntent(intent({ surface: "screen", action: "desk.stop" }));            // user asks it to stop
  await layer.handleIntent(intent({ surface: "chat-log", action: "chat.send", payload: { text: "hi" } })); // …then chats
  await running;
  expect(cancelled).toBe(true);   // the run still saw the stop despite the concurrent chat
});
