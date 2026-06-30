// /app/ai/interaction-layer.test.ts — the one door: validation, single-writer, push.
import { test, expect } from "bun:test";
import { createInteractionLayer } from "./interaction-layer.ts";
import { makeStubReasoner } from "./reasoner.ts";
import type { Intent, RenderOp, OpChannel } from "./contract.ts";

// An OpChannel double that records what got pushed and to whom (GRAIN's only port).
function fakeStream() {
  const pushed: Array<{ session: string; event: string; data: unknown }> = [];
  const stream: OpChannel = {
    push: (session, event, data) => { pushed.push({ session, event, data }); },
  };
  return { stream, pushed };
}

function makeLayer(opts: { failRate?: number } = {}) {
  const archived: string[] = [];
  const { stream, pushed } = fakeStream();
  const layer = createInteractionLayer({
    reasoner: makeStubReasoner({ failRate: opts.failRate ?? 0, thinkMs: 0 }),
    stream,
    archiveItem: async (id) => { archived.push(id); },
    renderSurface: async (s) => `<article data-surface="${s}" data-commit="committed">ok</article>`,
  });
  return { layer, archived, pushed };
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
