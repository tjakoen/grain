// grain/ai/reasoner.test.ts — UNIT: the stub reasoner (the single writer) in isolation.
// We hand it a fake ReasonTools that records every emitted RenderOp + write, with zero
// delays, and assert the decision logic + the op stream it produces. No HTTP, no DOM.
import { test, expect } from "bun:test";
import { makeStubReasoner } from "./reasoner.ts";
import type { ReasonTools } from "./reasoner.ts";
import type { Intent, RenderOp } from "./contract.ts";

function fakeTools(over: Partial<ReasonTools> = {}) {
  const emitted: RenderOp[] = [];
  const archived: string[] = [];
  const tools: ReasonTools = {
    archiveItem: async (id) => { archived.push(id); },
    renderSurface: async (s) => `<x data-surface="${s}" data-commit="committed">ok</x>`,
    emit: (op) => { emitted.push(op); },
    cancelled: () => false,
    delay: async () => {},
    ...over,
  };
  return { tools, emitted, archived };
}

const intent = (over: Partial<Intent> = {}): Intent => ({
  source: "user", session: "s1", screen: "loop",
  surface: "item:ITM-1", action: "item.archive", payload: {}, ...over,
});

const reasoner = makeStubReasoner({ thinkMs: 0 });
const spots = (ops: RenderOp[]) => ops.filter((o) => o.op === "spotlight");

test("item.archive: writes through the scoped tool, returns a committed replace", async () => {
  const { tools, archived } = fakeTools();
  const d = await reasoner.decide(intent(), tools);
  expect(d.ok).toBe(true);
  expect(archived).toEqual(["ITM-1"]);                 // the write happened via the injected capability
  expect(d.ops[0]?.op).toBe("replace");
  expect(d.ops[0]?.commit).toBe("committed");
});

test("item.archive failure rolls back: ok:false + a flash op", async () => {
  const failing = makeStubReasoner({ thinkMs: 0, failRate: 1 });
  const { tools, archived } = fakeTools();
  const d = await failing.decide(intent(), tools);
  expect(d.ok).toBe(false);
  expect(archived).toEqual([]);                        // no write committed
  expect(d.ops[0]?.op).toBe("flash");
});

test("say.stream: brackets with spotlight on→off and streams type tokens that settle committed", async () => {
  const { tools, emitted } = fakeTools();
  await reasoner.decide(intent({ surface: "say-stream", action: "say.stream", payload: {} }), tools);
  const types = emitted.filter((o) => o.op === "type");
  expect(types.length).toBeGreaterThan(1);
  expect(types.at(-1)?.commit).toBe("committed");      // grain settles committed
  expect(spots(emitted)[0]?.active).toBe(true);
  expect(spots(emitted).at(-1)?.active).toBe(false);   // spotlight released when done
});

test("say.set: brackets with spotlight on→off and streams type tokens that settle committed", async () => {
  const { tools, emitted } = fakeTools();
  await reasoner.decide(intent({ surface: "reflection", action: "say.set", payload: { text: "hi" } }), tools);
  const types = emitted.filter((o) => o.op === "type");
  expect(types.length).toBeGreaterThan(1);
  expect(types.at(-1)?.commit).toBe("committed");      // grain settles to clean
  expect(spots(emitted)[0]?.active).toBe(true);
  expect(spots(emitted).at(-1)?.active).toBe(false);
});

test("demo.run: appends a 3-item list, erases (back), archives for real, commits clean, clicks, then releases", async () => {
  const { tools, emitted, archived } = fakeTools();
  const d = await reasoner.decide(intent({ surface: "screen", action: "demo.run" }), tools);
  expect(d.ok).toBe(true);
  expect(emitted.filter((o) => o.op === "append" && o.target === "plan")).toHaveLength(3); // 3 bullets
  expect(emitted.some((o) => o.target === "console" && o.op === "append")).toBe(true);     // narrated its steps to the console
  expect(emitted.some((o) => o.op === "type" && (o.back ?? 0) > 0)).toBe(true);           // backspaces (overwrite)
  expect(archived).toContain("ITM-demo-1");                                                // the archive step WRITES for real through the service
  expect(emitted.some((o) => o.op === "replace" && o.target === "item:ITM-demo-1" && o.commit === "committed")).toBe(true); // …then renders the committed card
  expect(emitted.filter((o) => o.op === "replace" && o.commit === "committed").length)   // list items + archived card + badge
    .toBeGreaterThanOrEqual(4);
  expect(spots(emitted).some((o) => o.click)).toBe(true);                                 // clicks the commit button
  expect(spots(emitted)[0]?.active).toBe(true);
  expect(spots(emitted).at(-1)?.active).toBe(false);                                      // hands back at the end
});

test("demo.run on the /grain screen: narrates to the terminal, drives the /grain surfaces, hands back", async () => {
  const { tools, emitted } = fakeTools();
  const d = await reasoner.decide(intent({ surface: "screen", action: "demo.run", screen: "grain" }), tools);
  expect(d.ok).toBe(true);
  // narrates each step to the console feed (the /grain terminal) so a run is legible, never "stuck"
  expect(emitted.some((o) => o.target === "console" && o.op === "append")).toBe(true);
  // drives the /grain surface addresses — NOT the /loop scenario's
  const targets = new Set(emitted.map((o) => o.target));
  expect(targets.has("grain-ask")).toBe(true);
  expect(targets.has("chat-log:grain")).toBe(true);        // the surface's OWN chat (distinct from the shell's)
  expect(targets.has("grain-task-badge")).toBe(true);
  expect(targets.has("plan")).toBe(false);                 // the loop scenario's surface — must not fire here
  // the AI reply bubble is grain and stays grain (provenance persists)
  expect(emitted.find((o) => o.op === "append" && o.target === "chat-log:grain")?.html).toContain('data-grade="grain"');
  // hands back at the end: the LAST spotlight releases the screen (so the veil always drops)
  const s = spots(emitted);
  expect(s.at(-1)?.target).toBe("screen");
  expect(s.at(-1)?.active).toBe(false);
});

test("demo.run on the /notes screen: reads the newest notes, writes the notes-digest, releases", async () => {
  const { tools, emitted } = fakeTools();
  const d = await reasoner.decide(intent({ surface: "screen", action: "demo.run", screen: "notes" }), tools);
  expect(d.ok).toBe(true);
  // narrates each note read to the console feed (legible, never "stuck")
  expect(emitted.filter((o) => o.target === "console" && o.op === "append").length).toBeGreaterThanOrEqual(3);
  // travels the real note surfaces MILL addresses (mill/serve.ts itemSurfacePrefix)
  const targets = new Set(emitted.map((o) => o.target));
  expect(targets.has("note:feels-like-an-app")).toBe(true);
  expect(targets.has("note:the-browser-grew-up")).toBe(true);
  expect(targets.has("note:how-i-turned-github-into-a-classroom")).toBe(true);
  // the digest streams into notes-digest and stays grain (AI-authored text stays grain)
  const types = emitted.filter((o) => o.op === "type" && o.target === "notes-digest");
  expect(types.length).toBeGreaterThan(1);
  // natural completion also releases the spotlight — not just the stop path (grain CLAUDE.md lesson 7)
  const s = spots(emitted);
  expect(s.at(-1)?.target).toBe("screen");
  expect(s.at(-1)?.active).toBe(false);
});

test("demo.run on the /notes screen halts gracefully when cancelled: still releases, no throw", async () => {
  const { tools, emitted } = fakeTools({ cancelled: () => true });
  const d = await reasoner.decide(intent({ surface: "screen", action: "demo.run", screen: "notes" }), tools);
  expect(d.ok).toBe(true);
  expect(spots(emitted).at(-1)?.active).toBe(false);
});

test("demo.run halts gracefully when cancelled: still releases the spotlight, no throw", async () => {
  const { tools, emitted } = fakeTools({ cancelled: () => true });
  const d = await reasoner.decide(intent({ surface: "screen", action: "demo.run" }), tools);
  expect(d.ok).toBe(true);
  expect(spots(emitted).at(-1)?.active).toBe(false);   // graceful hand-back even on stop
});

test("chat.send: your message settles clean, the AI's reply streams into a grain bubble", async () => {
  const { tools, emitted } = fakeTools();
  const d = await reasoner.decide(intent({ surface: "chat-log", action: "chat.send", payload: { text: "plan my day" } }), tools);
  expect(d.ok).toBe(true);
  const appends = emitted.filter((o) => o.op === "append");
  expect(appends).toHaveLength(2);                            // your bubble + the AI's (empty) bubble
  expect(appends[0]?.provenance).toBe("user");
  expect(appends[0]?.commit).toBe("committed");              // your words settle clean
  expect(appends[0]?.html).toContain("plan my day");
  expect(appends[1]?.provenance).toBe("ai");
  expect(appends[1]?.html).toContain('data-grade="grain"');  // the AI's bubble is grain
  const types = emitted.filter((o) => o.op === "type");
  expect(types.length).toBeGreaterThan(1);                   // the reply streams char by char
  expect(types.at(-1)?.done).toBe(true);                     // and finishes
});

test("chat.send escapes user input (no HTML injection at the single writer)", async () => {
  const { tools, emitted } = fakeTools();
  await reasoner.decide(intent({ surface: "chat-log", action: "chat.send", payload: { text: "<img src=x onerror=alert(1)>" } }), tools);
  const you = emitted.find((o) => o.op === "append" && o.provenance === "user");
  expect(you?.html).not.toContain("<img");
  expect(you?.html).toContain("&lt;img");
});
