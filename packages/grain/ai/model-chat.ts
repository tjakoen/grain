// grain/ai/model-chat.ts — a `Model` adapter for any OpenAI-CHAT-SHAPED engine (the WebLLM transport).
//
// makeModelReasoner (model-reasoner.ts) talks to a `Model` PORT (model.ts): one method, `complete`.
// The real transport the human chose is WebLLM — an in-browser model over WebGPU — whose engine
// (`@mlc-ai/web-llm`'s MLCEngine) exposes an OpenAI-compatible `chat.completions.create`. Rather than
// depend on that heavy, browser-specific SDK, grain adapts a MINIMAL STRUCTURAL slice of it (ChatEngine
// below): the COMPOSITION ROOT installs `@mlc-ai/web-llm`, builds the engine, and hands it in — grain
// stays lean + dependency-light, and the SAME adapter serves any OpenAI-chat-shaped engine (a hosted
// API, a proxy, a test fake), not only WebLLM. That's the flexibility the whole seam is for: one
// reasoning core, one port, many engines; the transport is the root's choice (§19.3, like OpenChannel).
//
// CLIENT-SAFE (§19.2): pure, relative imports only, no SDK import, no DOM, no secrets. Unit-tested with
// a fake engine — no browser, no WebGPU, no model download.

import { SYSTEM_PREAMBLE } from "./model.ts";
import type { Model } from "./model.ts";

// ── the sliver of an OpenAI-chat engine this adapter touches (structural, not the SDK) ────────────
export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  /** Ask the engine to constrain output to a JSON object — WebLLM + OpenAI both honour this, and it
   *  sharply raises the odds `parseModelMove` gets clean JSON (fewer prose wrappers to strip). */
  response_format?: { type: "json_object" };
}
export interface ChatCompletion { choices: { message: { content: string | null } }[] }
export interface ChatEngine {
  chat: { completions: { create(req: ChatCompletionRequest): Promise<ChatCompletion> } };
}

export interface ChatModelOptions {
  /** Low by default: choosing a move from a fixed vocabulary wants determinism, not creativity. */
  temperature?: number;
  /** Request JSON-object output (default true). Set false only for an engine that rejects the flag. */
  jsonMode?: boolean;
}

/** Adapt an OpenAI-chat-shaped `engine` into grain's `Model` port. The reasoner core hands `complete`
 *  one composed prompt (buildReasonerPrompt: preamble + manifest + message + output contract); this
 *  splits the leading system preamble into a `system` message (where a chat model expects its
 *  instructions) and sends the rest as the `user` turn, then returns the assistant's raw text for the
 *  core to parse + validate. The split is best-effort: if the marker isn't found the whole prompt goes
 *  as the user turn — correctness never depends on the split, only prompt hygiene. */
export function makeChatModel(engine: ChatEngine, opts: ChatModelOptions = {}): Model {
  const temperature = opts.temperature ?? 0.2;
  const jsonMode = opts.jsonMode ?? true;

  return {
    async complete(prompt: string): Promise<string> {
      const messages = splitPrompt(prompt);
      const req: ChatCompletionRequest = { messages, temperature };
      if (jsonMode) req.response_format = { type: "json_object" };
      const res = await engine.chat.completions.create(req);
      return res.choices[0]?.message?.content ?? "";
    },
  };
}

/** Split a composed reasoner prompt into system + user messages. The preamble (the one-door rules)
 *  belongs in the `system` role; everything after it (the manifest, the human's message, the output
 *  contract) is the `user` turn. Falls back to one user message if the prompt doesn't lead with the
 *  known preamble, so an evolving prompt format can never break the adapter — correctness depends only
 *  on the full prompt reaching the model, never on the split succeeding. */
export function splitPrompt(prompt: string): ChatMessage[] {
  if (!prompt.startsWith(SYSTEM_PREAMBLE)) return [{ role: "user", content: prompt }];
  const user = prompt.slice(SYSTEM_PREAMBLE.length).trim();
  return [{ role: "system", content: SYSTEM_PREAMBLE }, { role: "user", content: user }];
}

// ── the STREAMING variant of the chat transport ───────────────────────────────────────────────────
// makeChatModel above is the REASONER's transport: one composed prompt, one whole-text completion, then
// parse + validate — streaming buys the strict-JSON core nothing. A conversational surface (the
// portfolio's "desk") is the opposite: it streams the human-facing reply token by token and must be
// able to STOP mid-generation (the visitor hits stop; a weak model spins into a repetition loop). That
// lives HERE, beside the non-streaming adapter, because it is the SAME OpenAI-chat engine — only the
// `create` shape (stream:true → an async-iterable of deltas) and an `interruptGenerate` differ. Grain
// owns the plumbing; the loop-guard / accumulation / UI stay in the composing reasoner. This is NOT the
// `Model` port — a streamed chat reply is the composing reasoner's concern, never the validated-move
// core's (see model.ts, the port's doc comment).

/** One streamed chunk — the sliver of an OpenAI stream delta we consume (content only). */
export interface ChatStreamChunk { choices?: Array<{ delta?: { content?: string } }> }

/** Sampling knobs for a streamed completion (all optional — the composing reasoner tunes them; a weak
 *  model in particular wants penalties or it loops). Grain-cased; mapped to the engine's snake_case in
 *  the request below so callers never touch the wire shape. */
export interface ChatStreamOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/** The streaming `create` request, in the engine's own (OpenAI) shape. Built by `streamChat`, not by
 *  callers — kept exported only so a fake engine in a test can type the request it captures. */
export interface ChatStreamRequest {
  messages: ChatMessage[];
  stream: true;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/** A STREAMING OpenAI-chat engine: `create` resolves to an async-iterable of content deltas, and
 *  generation can be interrupted early. WebLLM's MLCEngine satisfies this exactly (`interruptGenerate`);
 *  a hosted API would map `interruptGenerate` to aborting the underlying fetch. Structural, like
 *  `ChatEngine` — grain depends on the SHAPE, never the SDK (§19.2/§19.3). */
export interface StreamingChatEngine {
  chat: { completions: { create(req: ChatStreamRequest): Promise<AsyncIterable<ChatStreamChunk>> } };
  interruptGenerate(): void;
}

/** Stream a chat completion as CONTENT-only token deltas. The caller drives the async-iterable and
 *  decides when to stop: BREAKING the `for await` early (a stop button, a loop-guard) unwinds this
 *  generator's `finally`, which calls `interruptGenerate` — so the caller never touches the engine to
 *  halt it, it just stops iterating. Empty deltas are skipped, so a consumer only ever sees real text.
 *  Pure plumbing: accumulation, the repetition loop-guard, and the UI belong to the composing reasoner,
 *  not here. */
export async function* streamChat(
  engine: StreamingChatEngine,
  messages: ChatMessage[],
  opts: ChatStreamOptions = {},
): AsyncIterable<string> {
  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    top_p: opts.topP,
    frequency_penalty: opts.frequencyPenalty,
    presence_penalty: opts.presencePenalty,
  });
  let finished = false;
  try {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
    finished = true;
  } finally {
    // Only interrupt on an EARLY exit (a break/throw before the stream ran dry). Interrupting after a
    // natural finish is a harmless no-op on WebLLM, but a hosted transport might treat a late abort as
    // an error, so we stay precise. `try/catch` because interruptGenerate can throw if the engine has
    // already torn the generation down.
    if (!finished) { try { engine.interruptGenerate(); } catch { /* already stopped */ } }
  }
}
