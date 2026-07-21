// grain/ai/webllm.ts — grain's ONE WebGPU/CDN transport edge: load an in-browser model (WebLLM over
// WebGPU) as a `StreamingChatEngine` (model-chat.ts). This is the concrete transport a composition root
// picks; it is NOT imported by the reasoning core (model.ts) — the core stays pure + DOM-free, and this
// module is the single place that touches `navigator.gpu` and the CDN. That mirrors the OpChannel
// substrate PORT (contract.ts §19.3): one engine shape, many loaders; the root chooses.
//
// CLIENT-SAFE (ARCHITECTURE §19.2): no BARE npm import (the module server refuses those) — WebLLM is
// pulled from a pinned https URL via dynamic import, so there is NO package.json entry and no bundling.
// The URL is held in a variable so tsc treats the import as `any` (it can't resolve a URL specifier)
// rather than failing to type it. The engine's published types are never imported either — grain
// depends on the STRUCTURAL `StreamingChatEngine`, so there is no `@mlc-ai/web-llm` devDependency.
//
// WHAT'S PARAMETERIZED: the model id, the CDN pin, and the context window all come from the caller —
// grain owns the machinery, the app owns the model choice. Weights (hundreds of MB) come from the model
// host's CDN on first use and are cached by the browser's Cache API; a second visit skips the download.
// GitHub Pages can't send COOP/COEP, so this is WebGPU-only (no SharedArrayBuffer path) — exactly the
// gate `webgpuAvailable` enforces up front.

import type { StreamingChatEngine } from "./model-chat.ts";

// A recent, widely-mirrored esm.run pin. Overridable per call — a root that wants a different version
// (or a self-hosted mirror) passes `webllmUrl`; pinned by default so a CDN-side change can't silently
// alter behaviour.
const DEFAULT_WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm@0.2.79";
const DEFAULT_CONTEXT_WINDOW = 2048;

/** Model-load progress, normalized from WebLLM's initProgressCallback. */
export interface EngineProgress {
  progress: number;   // 0..1
  text: string;       // the engine's human-readable status ("Fetching param cache…")
}

export interface LoadEngineOptions {
  /** The model id to load (e.g. "Qwen2.5-0.5B-Instruct-q4f16_1-MLC"). The app's choice, not grain's. */
  modelId: string;
  /** Progress ticks during the one-time weight download — drive a progress bar with these. */
  onProgress?: (p: EngineProgress) => void;
  /** Override the pinned CDN url (a different version, or a self-hosted mirror). */
  webllmUrl?: string;
  /** The engine's context window in tokens (default 2048 — a small model wants a small window). */
  contextWindow?: number;
}

// Narrow shims for the browser globals we probe — grain's tsc has no DOM lib (bun-types only), so we
// reach them through a typed view of globalThis rather than pulling the whole DOM in.
interface GpuAdapterSource { requestAdapter(): Promise<unknown> }
interface ProbeNavigator { gpu?: GpuAdapterSource; deviceMemory?: number }
const nav = (): ProbeNavigator | undefined =>
  (globalThis as unknown as { navigator?: ProbeNavigator }).navigator;

/** Can this browser run a local WebLLM model? WebGPU is required; a known-low `deviceMemory` (when the
 *  browser reports it — Firefox/Safari don't, so absence never blocks) rules out an almost-certain OOM
 *  up front. Any throw counts as unavailable, so a caller can degrade honestly rather than hang. */
export async function webgpuAvailable(): Promise<boolean> {
  const n = nav();
  if (!n || !n.gpu || typeof n.gpu.requestAdapter !== "function") return false;
  if (typeof n.deviceMemory === "number" && n.deviceMemory < 4) return false;
  try {
    return Boolean(await n.gpu.requestAdapter());
  } catch {
    return false;
  }
}

// The sliver of WebLLM's module surface we call — structural, so there's no SDK import. `CreateMLCEngine`
// builds and warms an engine; the result is asserted to `StreamingChatEngine` (model-chat.ts).
interface WebLLMModule {
  CreateMLCEngine(
    modelId: string,
    opts: { initProgressCallback: (r: { progress?: number; text?: string }) => void },
    config: { context_window_size: number },
  ): Promise<unknown>;
}

/** Load and warm a WebLLM engine, reporting download progress, as a `StreamingChatEngine` ready for
 *  `streamChat` (model-chat.ts). Dynamic-imports WebLLM from the pinned URL (held in a variable so tsc
 *  yields `Promise<any>` rather than trying to resolve a URL specifier). Throws on any failure — the
 *  caller degrades (e.g. an offline notice), grain never swallows it. */
export async function loadEngine(opts: LoadEngineOptions): Promise<StreamingChatEngine> {
  const url = opts.webllmUrl ?? DEFAULT_WEBLLM_URL;   // non-literal → tsc treats the import as `any`
  const webllm = (await import(url)) as WebLLMModule;
  const engine = await webllm.CreateMLCEngine(
    opts.modelId,
    { initProgressCallback: (r) => opts.onProgress?.({ progress: r.progress ?? 0, text: r.text ?? "" }) },
    { context_window_size: opts.contextWindow ?? DEFAULT_CONTEXT_WINDOW },
  );
  return engine as StreamingChatEngine;
}
