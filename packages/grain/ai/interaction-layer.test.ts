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
  // the rejection ECHOES the vocabulary so a reasoner can pick a real verb next turn
  expect(decision.reason).toContain("known verbs");
  expect(decision.reason).toContain("item.archive");
});

test("surface kind that doesn't accept the action is rejected", async () => {
  const { layer, archived, pushed } = makeLayer();
  const decision = await layer.handleIntent(intent({ surface: "item-list" }));

  expect(decision.ok).toBe(false);
  expect(archived).toEqual([]);
  expect(ops(pushed)[0]!.op).toBe("flash");
});

test("a wrong-surface rejection echoes the verbs that surface DOES accept — self-correction", async () => {
  const { layer, pushed } = makeLayer();
  // item.archive on a reflection surface: rejected, and the door tells the reasoner reflection takes say.set
  const decision = await layer.handleIntent(intent({ surface: "reflection", action: "item.archive" }));

  expect(decision.ok).toBe(false);
  expect(decision.reason).toContain("say.set");          // the machine-facing trace names the valid move
  expect(ops(pushed)[0]!.message).toContain("say.set");  // and so does the human-facing flash
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

// --- note verbs at the door: kind validation + the AI-acting spotlight bracket ---------------
test("note.append on the notepad kind: validates, the reasoner writes an append to notepad-body", async () => {
  const { layer, pushed } = makeLayer();
  const d = await layer.handleIntent(intent({ source: "ai", surface: "notepad", action: "note.append", payload: { text: "hi" } }));
  expect(d.ok).toBe(true);
  const appended = ops(pushed).find((o) => o.op === "append" && o.target === "notepad-body");
  expect(appended).toBeTruthy();
});

test("note.append on a non-notepad surface: rejected by the closed vocabulary", async () => {
  const { layer } = makeLayer();
  const d = await layer.handleIntent(intent({ surface: "item:ITM-1", action: "note.append", payload: { text: "hi" } }));
  expect(d.ok).toBe(false);
  expect(d.ops[0]?.op).toBe("flash");
});

test("an AI note write is bracketed by a spotlight on the notepad surface (AI as actor)", async () => {
  const { layer, pushed } = makeLayer();
  await layer.handleIntent(intent({ source: "ai", surface: "notepad", action: "note.append", payload: { text: "hi" } }));
  const spots = ops(pushed).filter((o) => o.op === "spotlight" && o.target === "notepad");
  expect(spots.some((o) => o.active === true)).toBe(true);
  expect(spots.some((o) => o.active === false)).toBe(true);
});

// --- field.set at the door: kind validation, value validation, the fill op (plans/field-set-op.md) ---
test("field.set on a field kind: validates, the reasoner emits a committed ai fill op", async () => {
  const { layer, pushed } = makeLayer();
  const d = await layer.handleIntent(intent({ source: "ai", surface: "field:contact-message",
    action: "field.set", payload: { value: "Hi TJ — I want to talk about grain." } }));
  expect(d.ok).toBe(true);
  const fill = ops(pushed).find((o) => o.op === "fill");
  expect(fill).toMatchObject({ target: "field:contact-message",
    text: "Hi TJ — I want to talk about grain.", provenance: "ai", commit: "committed" });
});

test("field.set on a non-field surface: rejected with the accepts echo (closed vocabulary)", async () => {
  const { layer } = makeLayer();
  const d = await layer.handleIntent(intent({ surface: "item:ITM-1", action: "field.set", payload: { value: "hi" } }));
  expect(d.ok).toBe(false);
  expect(d.ops[0]?.op).toBe("flash");
  expect(d.reason).toContain("item:ITM-1 rejects field.set");
  expect(d.reason).toContain("item.archive");   // the verbs that surface DOES accept, echoed back
});

test("field.set with an oversized value: rejected, the reason echoes the constraint so a reasoner can shorten", async () => {
  const { layer, pushed } = makeLayer();
  const d = await layer.handleIntent(intent({ source: "ai", surface: "field:contact-message",
    action: "field.set", payload: { value: "x".repeat(2001) } }));
  expect(d.ok).toBe(false);
  expect(d.reason).toContain("field.set value rejected");
  expect(d.reason).toContain("2000");
  expect(ops(pushed).find((o) => o.op === "fill")).toBeUndefined();   // nothing reached the field
});

test("field.set with an empty or control-char value: rejected (never a silent blank fill)", async () => {
  const { layer } = makeLayer();
  const empty = await layer.handleIntent(intent({ source: "ai", surface: "field:contact-message",
    action: "field.set", payload: { value: "   " } }));
  expect(empty.ok).toBe(false);
  const ctrl = await layer.handleIntent(intent({ source: "ai", surface: "field:contact-message",
    action: "field.set", payload: { value: "bad\x00byte" } }));
  expect(ctrl.ok).toBe(false);
  expect(ctrl.reason).toContain("control characters");
});

test("an AI field.set is bracketed by a spotlight on the field surface (AI as actor)", async () => {
  const { layer, pushed } = makeLayer();
  await layer.handleIntent(intent({ source: "ai", surface: "field:contact-message",
    action: "field.set", payload: { value: "draft" } }));
  const spots = ops(pushed).filter((o) => o.op === "spotlight" && o.target === "field:contact-message");
  expect(spots.some((o) => o.active === true)).toBe(true);
  expect(spots.some((o) => o.active === false)).toBe(true);
});

// --- check.set at the door: kind validation, state validation, the tick op (plans/check-set-op.md) ---
test("check.set on a check kind: validates, the reasoner emits a committed ai tick op", async () => {
  const { layer, pushed } = makeLayer();
  const d = await layer.handleIntent(intent({ source: "ai", surface: "check:newsletter",
    action: "check.set", payload: { checked: true } }));
  expect(d.ok).toBe(true);
  const tick = ops(pushed).find((o) => o.op === "tick");
  expect(tick).toMatchObject({ target: "check:newsletter", checked: true, provenance: "ai", commit: "committed" });
});

// The two rejections below are the design, stated as behaviour rather than as a comment: neither
// verb can reach the other's control, so the manifest never promises a write that would land
// silently wrong. Deleting the two kinds and merging them would turn both of these green-to-red.
test("check.set on a FIELD surface: rejected with the accepts echo — a text field is not a tick box", async () => {
  const { layer } = makeLayer();
  const d = await layer.handleIntent(intent({ surface: "field:contact-message",
    action: "check.set", payload: { checked: true } }));
  expect(d.ok).toBe(false);
  expect(d.ops[0]?.op).toBe("flash");
  expect(d.reason).toContain("field:contact-message rejects check.set");
  expect(d.reason).toContain("field.set");   // the verb that surface DOES accept, echoed back
});

test("field.set on a CHECK surface: rejected the same way — the write that would have lied", async () => {
  const { layer } = makeLayer();
  const d = await layer.handleIntent(intent({ surface: "check:newsletter",
    action: "field.set", payload: { value: "yes" } }));
  expect(d.ok).toBe(false);
  expect(d.reason).toContain("check:newsletter rejects field.set");
  expect(d.reason).toContain("check.set");
});

test("check.set with a non-boolean: rejected, and nothing reaches the box", async () => {
  const { layer, pushed } = makeLayer();
  const d = await layer.handleIntent(intent({ source: "ai", surface: "check:newsletter",
    action: "check.set", payload: { checked: "false" } }));
  expect(d.ok).toBe(false);
  expect(d.reason).toContain("check.set checked rejected");
  expect(ops(pushed).find((o) => o.op === "tick")).toBeUndefined();
});

test("check.set clearing a box is a legal move at the door — the radio limit is the dispatcher's", async () => {
  const { layer, pushed } = makeLayer();
  const d = await layer.handleIntent(intent({ source: "ai", surface: "check:newsletter",
    action: "check.set", payload: { checked: false } }));
  expect(d.ok).toBe(true);
  expect(ops(pushed).find((o) => o.op === "tick")).toMatchObject({ checked: false });
});

test("an AI check.set is bracketed by a spotlight on the check surface (AI as actor)", async () => {
  const { layer, pushed } = makeLayer();
  await layer.handleIntent(intent({ source: "ai", surface: "check:newsletter",
    action: "check.set", payload: { checked: true } }));
  const spots = ops(pushed).filter((o) => o.op === "spotlight" && o.target === "check:newsletter");
  expect(spots.some((o) => o.active === true)).toBe(true);
  expect(spots.some((o) => o.active === false)).toBe(true);
});
