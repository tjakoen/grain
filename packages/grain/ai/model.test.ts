// grain/ai/model.test.ts — UNIT: the transport-agnostic reasoning core (the M★ seam).
// Every piece is a pure function, so the whole brain is exercised with no browser + no network: a
// fake `Model` (canned completion) proves the prompt→parse→validate pipeline turns a model's raw
// output into a safe, contract-legal move — and REJECTS anything the vocabulary doesn't allow.
import { test, expect } from "bun:test";
import { buildReasonerPrompt, parseModelMove, validateMove, validTargetsFor, type Model } from "./model.ts";
import { buildManifest, type Manifest } from "./manifest.ts";
import type { ManifestTarget } from "./manifest.ts";

const targets: ManifestTarget[] = [
  { id: "notepad", kind: "notepad", accepts: ["note.append", "note.replace"] },
  { id: "chat-log", kind: "chat-log", accepts: ["chat.send"] },
  { id: "item:ITM-1", kind: "item", accepts: ["item.archive"] },
];
const manifest: Manifest = buildManifest("loop", targets, { surfaces: targets.map((t) => t.id), readable: [] });

// ── the Model port is satisfiable by a trivial fake — no SDK, no network ──────────────────────────
test("Model port: a fake completion satisfies the boundary", async () => {
  const fake: Model = { complete: async () => '{"action":null,"reply":"hi"}' };
  expect(await fake.complete("anything")).toContain("reply");
});

// ── buildReasonerPrompt ───────────────────────────────────────────────────────────────────────
test("buildReasonerPrompt: deterministic, embeds the manifest + message + output contract", () => {
  const p1 = buildReasonerPrompt("MANIFEST-TEXT", "plan my thursday");
  const p2 = buildReasonerPrompt("MANIFEST-TEXT", "plan my thursday");
  expect(p1).toBe(p2);                                  // deterministic
  expect(p1).toContain("MANIFEST-TEXT");
  expect(p1).toContain("plan my thursday");
  expect(p1).toContain("ONLY a JSON object");           // the output contract
  expect(p1).toContain("ONE move");                     // the one-door rule
});

test("buildReasonerPrompt: blank message falls back to 'decide from what's in view'", () => {
  expect(buildReasonerPrompt("M", "   ")).toContain("decide from what's in view");
});

// ── parseModelMove ──────────────────────────────────────────────────────────────────────────────
test("parseModelMove: clean JSON parses", () => {
  const r = parseModelMove('{"action":"note.append","target":"notepad","payload":{"text":"hi"}}');
  expect(r).toEqual({ ok: true, move: { action: "note.append", target: "notepad", payload: { text: "hi" } } });
});

test("parseModelMove: pulls JSON out of prose + code fences", () => {
  const raw = 'Sure! Here is my move:\n```json\n{"action":"chat.send","target":"chat-log","payload":{"text":"yo"}}\n```\nHope that helps.';
  const r = parseModelMove(raw);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.move.action).toBe("chat.send");
});

test("parseModelMove: a brace inside a string doesn't break balance matching", () => {
  const r = parseModelMove('{"action":null,"reply":"use {curly} braces"}');
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.move.reply).toBe("use {curly} braces");
});

test("parseModelMove: no JSON / malformed JSON → informative failure", () => {
  expect(parseModelMove("I refuse to answer")).toEqual({ ok: false, reason: "model returned no JSON object" });
  expect(parseModelMove('{"action": oops}')).toMatchObject({ ok: false });
});

test("parseModelMove: a JSON array is rejected (must be an object)", () => {
  expect(parseModelMove('[1,2,3]')).toMatchObject({ ok: false });
});

// ── validateMove: the safety boundary ─────────────────────────────────────────────────────────
test("validateMove: a legal act move passes, payload kept", () => {
  const r = validateMove({ action: "note.append", target: "notepad", payload: { text: "buy milk" } }, manifest);
  expect(r).toEqual({ ok: true, move: { action: "note.append", target: "notepad", payload: { text: "buy milk" }, reply: undefined } });
});

test("validateMove: a reply-only move (action null) with text passes", () => {
  const r = validateMove({ action: null, reply: "I'm here — what next?" }, manifest);
  expect(r).toEqual({ ok: true, move: { action: null, target: "", payload: {}, reply: "I'm here — what next?" } });
});

test("validateMove: reply-only with no reply is rejected", () => {
  expect(validateMove({ action: null }, manifest)).toMatchObject({ ok: false });
});

test("validateMove: a hallucinated verb is rejected as unknown", () => {
  const r = validateMove({ action: "task.nuke", target: "notepad" }, manifest);
  expect(r).toMatchObject({ ok: false });
  if (!r.ok) expect(r.reason).toContain("unknown verb");
});

test("validateMove: an unafforded verb on a real surface echoes the valid targets", () => {
  const r = validateMove({ action: "chat.send", target: "notepad", payload: { text: "x" } }, manifest);
  expect(r).toMatchObject({ ok: false });
  if (!r.ok) {
    expect(r.reason).toContain("does not accept chat.send");
    expect(r.reason).toContain("chat-log");             // the surface that DOES accept it, echoed back
  }
});

test("validateMove: an unknown target is rejected", () => {
  const r = validateMove({ action: "note.append", target: "ghost", payload: { text: "x" } }, manifest);
  expect(r).toMatchObject({ ok: false });
  if (!r.ok) expect(r.reason).toContain("no surface");
});

test("validateMove: an acting verb with no target is rejected", () => {
  expect(validateMove({ action: "note.append", payload: { text: "x" } }, manifest)).toMatchObject({ ok: false });
});

test("validateMove: a missing required payload field is rejected", () => {
  const r = validateMove({ action: "note.append", target: "notepad", payload: {} }, manifest);
  expect(r).toMatchObject({ ok: false });
  if (!r.ok) expect(r.reason).toContain("missing required field");
});

test("validateMove: a wrong-typed payload field is rejected", () => {
  const r = validateMove({ action: "note.append", target: "notepad", payload: { text: 42 } }, manifest);
  expect(r).toMatchObject({ ok: false });
  if (!r.ok) expect(r.reason).toContain("must be string");
});

test("validateMove: extra payload fields are dropped, not fatal", () => {
  const r = validateMove({ action: "note.append", target: "notepad", payload: { text: "ok", evil: "drop me" } }, manifest);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.move.payload).toEqual({ text: "ok" });   // only the schema-declared field survives
});

test("validateMove: a no-arg verb needs no payload", () => {
  const r = validateMove({ action: "item.archive", target: "item:ITM-1" }, manifest);
  expect(r).toEqual({ ok: true, move: { action: "item.archive", target: "item:ITM-1", payload: {}, reply: undefined } });
});

test("validTargetsFor: lists every surface that accepts the verb", () => {
  expect(validTargetsFor("note.append", manifest)).toEqual(["notepad"]);
  expect(validTargetsFor("item.archive", manifest)).toEqual(["item:ITM-1"]);
});

// ── the pipeline end-to-end with a fake model ─────────────────────────────────────────────────
test("pipeline: fake model → parse → validate yields a safe move", async () => {
  const model: Model = {
    complete: async (prompt) => {
      expect(prompt).toContain("What's operable right now");   // the prompt carried the manifest
      return 'Thinking… {"action":"note.append","target":"notepad","payload":{"text":"remember the milk"}}';
    },
  };
  const raw = await model.complete(buildReasonerPrompt("MANIFEST", "note the milk"));
  const parsed = parseModelMove(raw);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  const valid = validateMove(parsed.move, manifest);
  expect(valid).toEqual({ ok: true, move: { action: "note.append", target: "notepad", payload: { text: "remember the milk" }, reply: undefined } });
});
