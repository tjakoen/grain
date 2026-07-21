// grain/ai/model-reasoner.test.ts — UNIT: the real reasoner, driven by a FAKE model + recording tools.
// No browser, no network: a fake `Model` returns canned JSON, a recording `ReasonTools` captures every
// emitted op, and we assert the reasoner turns a natural-language turn into the right validated ops —
// and rejects illegal model output cleanly. This is the M★ seam proven end-to-end minus the transport.
import { test, expect } from "bun:test";
import { makeModelReasoner } from "./model-reasoner.ts";
import type { Model } from "./model.ts";
import { buildManifest, type Manifest, type ManifestTarget } from "./manifest.ts";
import type { ReasonTools } from "./reasoner.ts";
import type { Intent, RenderOp } from "./contract.ts";

const targets: ManifestTarget[] = [
  { id: "notepad", kind: "notepad", accepts: ["note.append", "note.replace"] },
  { id: "chat-log", kind: "chat-log", accepts: ["chat.send"] },
  { id: "item:ITM-1", kind: "item", accepts: ["item.archive"] },
];
const manifest = (): Manifest => buildManifest("loop", targets, { surfaces: targets.map((t) => t.id), readable: [] });

// A recording tools double: captures emitted ops + records archive calls; delay/cancel are inert.
function recordingTools() {
  const ops: RenderOp[] = [];
  const archived: string[] = [];
  const tools: ReasonTools = {
    emit: (op) => { ops.push(op); },
    archiveItem: async (id) => { archived.push(id); },
    renderSurface: async (s) => `<clean surface="${s}"/>`,
    cancelled: () => false,
    delay: async () => {},
  };
  return { tools, ops, archived };
}

const model = (raw: string): Model => ({ complete: async () => raw });
const intent = (over: Partial<Intent>): Intent =>
  ({ source: "user", session: "s1", screen: "loop", surface: "chat-log", action: "chat.send", payload: {}, ...over });

const kinds = (ops: RenderOp[]) => ops.map((o) => o.op);
const targetsOf = (ops: RenderOp[]) => ops.map((o) => o.target);

test("chat.send → model picks note.append: user bubble + AI bubble + the note op + streamed reply", async () => {
  const r = makeModelReasoner({ model: model('{"action":"note.append","target":"notepad","payload":{"text":"buy milk"},"reply":"Added that."}'), manifest });
  const { tools, ops } = recordingTools();
  const d = await r.decide(intent({ action: "chat.send", surface: "chat-log", payload: { text: "note: buy milk" } }), tools);

  expect(d.ok).toBe(true);
  // 1) the human's message bubble, 2) an empty AI bubble, 3) the note.append op, then the streamed reply
  expect(kinds(ops).slice(0, 2)).toEqual(["append", "append"]);          // user + AI bubbles
  const note = ops.find((o) => o.target === "notepad-body");
  expect(note).toMatchObject({ op: "append", provenance: "ai", commit: "committed" });
  // the reply streamed into the AI bubble, then settled
  const typed = ops.filter((o) => o.op === "type" && o.text).map((o) => o.text).join("");
  expect(typed).toBe("Added that.");
  expect(ops.some((o) => o.op === "type" && o.done)).toBe(true);          // settled clean
});

test("chat.send → reply-only move (action null): no structural op, just the streamed reply", async () => {
  const r = makeModelReasoner({ model: model('{"action":null,"reply":"I am here — what would you like to plan?"}'), manifest });
  const { tools, ops } = recordingTools();
  const d = await r.decide(intent({ payload: { text: "hi" } }), tools);

  expect(d.ok).toBe(true);
  expect(ops.some((o) => o.target === "notepad-body")).toBe(false);      // no structural effect
  const typed = ops.filter((o) => o.op === "type" && o.text).map((o) => o.text).join("");
  expect(typed).toBe("I am here — what would you like to plan?");
});

test("chat.send → item.archive: performs the scoped write + emits the committed fragment", async () => {
  const r = makeModelReasoner({ model: model('{"action":"item.archive","target":"item:ITM-1","reply":"Archived."}'), manifest });
  const { tools, ops, archived } = recordingTools();
  const d = await r.decide(intent({ payload: { text: "archive ITM-1" } }), tools);

  expect(d.ok).toBe(true);
  expect(archived).toEqual(["ITM-1"]);                                    // the real write happened through the tool
  expect(ops.some((o) => o.target === "item:ITM-1" && o.op === "replace" && o.commit === "committed")).toBe(true);
});

test("chat.send → navigate is emitted LAST (terminal), after the reply", async () => {
  // navigate applies to a "screen" surface — the manifest must advertise one.
  const navTargets: ManifestTarget[] = [...targets, { id: "screen", kind: "screen", accepts: ["navigate"] }];
  const navManifest = (): Manifest => buildManifest("loop", navTargets, { surfaces: [], readable: [] });
  const r = makeModelReasoner({ model: model('{"action":"navigate","target":"screen","payload":{"href":"/notes"},"reply":"Taking you there."}'), manifest: navManifest });
  const { tools, ops } = recordingTools();
  await r.decide(intent({ payload: { text: "go to notes" } }), tools);

  const navIdx = ops.findIndex((o) => o.op === "navigate");
  const lastType = ops.map((o) => o.op).lastIndexOf("type");
  expect(navIdx).toBeGreaterThan(-1);
  expect(navIdx).toBeGreaterThan(lastType);                              // reply streamed before we leave the page
  expect(ops[navIdx]).toMatchObject({ href: "/notes" });
});

test("hallucinated verb → the opened AI bubble is replaced with an error, not left blank", async () => {
  const r = makeModelReasoner({ model: model('{"action":"task.nuke","target":"notepad"}'), manifest });
  const { tools, ops } = recordingTools();
  const d = await r.decide(intent({ payload: { text: "nuke it" } }), tools);

  expect(d.ok).toBe(false);
  expect(d.reason).toContain("unknown verb");
  // an AI bubble WAS opened (emitted), and the failure replaces its body (returned in decision.ops,
  // which the door pushes) — so no dangling empty bubble is left on screen.
  expect(ops.some((o) => o.op === "append" && o.provenance === "ai")).toBe(true);   // the bubble opened
  expect(d.ops.some((o) => o.op === "replace" && o.commit === "committed")).toBe(true);   // then got filled
});

test("unafforded target → rejected, reason echoes the valid targets (self-correction)", async () => {
  const r = makeModelReasoner({ model: model('{"action":"chat.send","target":"notepad","payload":{"text":"x"}}'), manifest });
  const { tools } = recordingTools();
  const d = await r.decide(intent({ payload: { text: "say hi in the notepad" } }), tools);
  expect(d.ok).toBe(false);
  expect(d.reason).toContain("does not accept chat.send");
});

test("malformed model output → clean rejection, no throw", async () => {
  const r = makeModelReasoner({ model: model("I refuse"), manifest });
  const { tools } = recordingTools();
  const d = await r.decide(intent({ payload: { text: "do a thing" } }), tools);
  expect(d.ok).toBe(false);
  expect(d.reason).toContain("no JSON");
});

test("model.complete throwing → graceful failure, not a crash", async () => {
  const boom: Model = { complete: async () => { throw new Error("network down"); } };
  const r = makeModelReasoner({ model: boom, manifest });
  const { tools } = recordingTools();
  const d = await r.decide(intent({ payload: { text: "hello" } }), tools);
  expect(d.ok).toBe(false);
  expect(d.reason).toContain("network down");
});

test("say.set → the reply streams straight into the reflection surface (no chat bubble)", async () => {
  const reflTargets: ManifestTarget[] = [{ id: "reflection", kind: "reflection", accepts: ["say.set"] }];
  const reflManifest = (): Manifest => buildManifest("loop", reflTargets, { surfaces: ["reflection"], readable: [] });
  const r = makeModelReasoner({ model: model('{"action":"say.set","target":"reflection","payload":{"text":"noted"},"reply":"Noted: clear Thursday."}'), manifest: reflManifest });
  const { tools, ops } = recordingTools();
  const d = await r.decide(intent({ action: "say.set", surface: "reflection", payload: { text: "clear thursday" } }), tools);

  expect(d.ok).toBe(true);
  expect(targetsOf(ops.filter((o) => o.op === "type"))).toEqual(new Array([...("Noted: clear Thursday.")].length + 1).fill("reflection"));
  expect(ops.every((o) => o.target === "reflection")).toBe(true);       // no chat-log bubble machinery
});

test("direct verb (control click, no message) → executed without consulting the model", async () => {
  let called = false;
  const spy: Model = { complete: async () => { called = true; return "{}"; } };
  const r = makeModelReasoner({ model: spy, manifest });
  const { tools, archived } = recordingTools();
  const d = await r.decide(intent({ action: "item.archive", surface: "item:ITM-1", payload: {} }), tools);

  expect(d.ok).toBe(true);
  expect(called).toBe(false);                                           // the human already decided — no model turn
  expect(archived).toEqual(["ITM-1"]);
});
