// grain/ai/model-chat.test.ts — UNIT: the OpenAI-chat engine adapter (the WebLLM transport), with a
// FAKE engine. No SDK, no WebGPU, no download: a structural fake records the request it receives and
// returns canned content, proving the adapter builds a correct chat request + returns the raw text the
// reasoner core parses.
import { test, expect } from "bun:test";
import {
  makeChatModel, splitPrompt, streamChat,
  type ChatEngine, type ChatCompletionRequest,
  type StreamingChatEngine, type ChatStreamRequest, type ChatStreamChunk,
} from "./model-chat.ts";
import { buildReasonerPrompt, SYSTEM_PREAMBLE } from "./model.ts";

// A structural fake: captures the last request, returns a fixed completion.
function fakeEngine(content: string | null) {
  let last: ChatCompletionRequest | null = null;
  const engine: ChatEngine = {
    chat: { completions: { create: async (req) => { last = req; return { choices: [{ message: { content } }] }; } } },
  };
  return { engine, req: () => last };
}

test("makeChatModel: returns the assistant content verbatim for the core to parse", async () => {
  const { engine } = fakeEngine('{"action":null,"reply":"hi"}');
  const model = makeChatModel(engine);
  expect(await model.complete("some prompt")).toBe('{"action":null,"reply":"hi"}');
});

test("makeChatModel: null content degrades to empty string (no crash)", async () => {
  const { engine } = fakeEngine(null);
  expect(await makeChatModel(engine).complete("p")).toBe("");
});

test("makeChatModel: requests JSON mode + low temperature by default", async () => {
  const { engine, req } = fakeEngine("{}");
  await makeChatModel(engine).complete("p");
  expect(req()!.response_format).toEqual({ type: "json_object" });
  expect(req()!.temperature).toBe(0.2);
});

test("makeChatModel: jsonMode:false omits response_format (for engines that reject it)", async () => {
  const { engine, req } = fakeEngine("{}");
  await makeChatModel(engine, { jsonMode: false, temperature: 0 }).complete("p");
  expect(req()!.response_format).toBeUndefined();
  expect(req()!.temperature).toBe(0);
});

test("makeChatModel: a real composed prompt is split into system + user messages", async () => {
  const { engine, req } = fakeEngine("{}");
  const prompt = buildReasonerPrompt("MANIFEST-TEXT", "note the milk");
  await makeChatModel(engine).complete(prompt);
  const msgs = req()!.messages;
  expect(msgs).toHaveLength(2);
  expect(msgs[0].role).toBe("system");
  expect(msgs[0].content).toBe(SYSTEM_PREAMBLE);            // the one-door rules land in system
  expect(msgs[1].role).toBe("user");
  expect(msgs[1].content).toContain("MANIFEST-TEXT");       // the manifest + message + contract in user
  expect(msgs[1].content).toContain("note the milk");
  expect(msgs[1].content).not.toContain(SYSTEM_PREAMBLE);   // not duplicated
});

test("splitPrompt: an unknown prompt shape falls back to a single user message", () => {
  const msgs = splitPrompt("no preamble here");
  expect(msgs).toEqual([{ role: "user", content: "no preamble here" }]);
});

test("splitPrompt: leads with the preamble → clean system/user split", () => {
  const msgs = splitPrompt(SYSTEM_PREAMBLE + "\n\nrest of the prompt");
  expect(msgs[0]).toEqual({ role: "system", content: SYSTEM_PREAMBLE });
  expect(msgs[1]).toEqual({ role: "user", content: "rest of the prompt" });
});

// ── the streaming transport (streamChat) ──────────────────────────────────────────────────────────
// A structural fake STREAMING engine: yields the given content deltas as chunks (interleaving an empty
// delta to prove they're skipped), records the request it got, and counts interrupt calls.
function fakeStreamEngine(deltas: string[]) {
  let last: ChatStreamRequest | null = null;
  let interrupts = 0;
  let drained = false;                                   // did the consumer read every chunk?
  const engine: StreamingChatEngine = {
    chat: { completions: { create: async (req) => {
      last = req;
      async function* gen(): AsyncIterable<ChatStreamChunk> {
        for (const d of deltas) {
          yield { choices: [{ delta: { content: "" } }] };   // empty → must be skipped
          yield { choices: [{ delta: { content: d } }] };
        }
        drained = true;
      }
      return gen();
    } } },
    interruptGenerate() { interrupts++; },
  };
  return { engine, req: () => last, interrupts: () => interrupts, drained: () => drained };
}

test("streamChat: yields content deltas in order and skips empty ones", async () => {
  const { engine } = fakeStreamEngine(["Hel", "lo", " world"]);
  const out: string[] = [];
  for await (const d of streamChat(engine, [{ role: "user", content: "hi" }])) out.push(d);
  expect(out).toEqual(["Hel", "lo", " world"]);
  expect(out.join("")).toBe("Hello world");
});

test("streamChat: a natural finish does NOT interrupt the engine", async () => {
  const { engine, interrupts } = fakeStreamEngine(["a", "b"]);
  for await (const _ of streamChat(engine, [{ role: "user", content: "hi" }])) { /* drain */ }
  expect(interrupts()).toBe(0);
});

test("streamChat: breaking early interrupts generation (finally → interruptGenerate)", async () => {
  const { engine, interrupts, drained } = fakeStreamEngine(["one", "two", "three", "four"]);
  const out: string[] = [];
  for await (const d of streamChat(engine, [{ role: "user", content: "hi" }])) {
    out.push(d);
    if (out.length === 2) break;                         // a stop button / loop-guard
  }
  expect(out).toEqual(["one", "two"]);
  expect(interrupts()).toBe(1);                          // stopped mid-stream
  expect(drained()).toBe(false);                         // and never read to the end
});

test("streamChat: maps grain-cased opts to the engine's snake_case request", async () => {
  const { engine, req } = fakeStreamEngine(["x"]);
  for await (const _ of streamChat(engine, [{ role: "user", content: "hi" }], {
    maxTokens: 220, temperature: 0.5, topP: 0.9, frequencyPenalty: 0.6, presencePenalty: 0.4,
  })) { /* drain */ }
  expect(req()).toMatchObject({
    stream: true, max_tokens: 220, temperature: 0.5, top_p: 0.9,
    frequency_penalty: 0.6, presence_penalty: 0.4,
  });
});
