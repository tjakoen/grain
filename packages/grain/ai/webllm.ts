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
interface GpuAdapterLike { limits?: { maxBufferSize?: number } }
interface GpuAdapterSource { requestAdapter(): Promise<GpuAdapterLike | null> }
interface ProbeNavigator { gpu?: GpuAdapterSource; deviceMemory?: number; hardwareConcurrency?: number }
const nav = (): ProbeNavigator | undefined =>
  (globalThis as unknown as { navigator?: ProbeNavigator }).navigator;

/** What a WebGPU/memory probe reports about this device — enough for a caller to both GATE (can a
 *  model run at all?) and TIER (which size fits?). `deviceMemory` is coarse (GB, capped at 8) and
 *  Chrome-only — Firefox/Safari omit it, so `undefined` means "unknown", never "small". A tiering
 *  caller combines these: `deviceMemory` where present, else `cores` + `maxBufferSize`. */
export interface DeviceCapability {
  /** A WebGPU adapter is present (the hard requirement — no adapter, no model). */
  webgpu: boolean;
  /** `navigator.deviceMemory` when the browser reports it, else undefined. */
  deviceMemory?: number;
  /** `navigator.hardwareConcurrency` (logical cores) — a device-class signal that survives where
   *  deviceMemory is absent: Safari omits deviceMemory but reports cores (a Mac is 8+, an iPhone ~6). */
  cores?: number;
  /** The WebGPU adapter's `maxBufferSize` limit in bytes — a GPU-capacity signal for TIERING. NOTE:
   *  Safari CAPS this (~1GB even on an Apple-Silicon Mac that Chrome reports at 4GB), so a raw
   *  threshold separates device classes only where a browser reports it truthfully; on Safari pair it
   *  with `cores`. Undefined when there's no adapter or the browser doesn't expose the limit. */
  maxBufferSize?: number;
}

/** Probe the device once and report its raw capability. Any throw degrades to `webgpu: false` (a caller
 *  degrades honestly rather than hang). This is the single probe; `webgpuAvailable` and `canRunModel`
 *  are thin readings of it, and a tiering caller maps the fields to a model choice itself. */
export async function probeDevice(): Promise<DeviceCapability> {
  const n = nav();
  const deviceMemory = typeof n?.deviceMemory === "number" ? n.deviceMemory : undefined;
  const cores = typeof n?.hardwareConcurrency === "number" ? n.hardwareConcurrency : undefined;
  if (!n || !n.gpu || typeof n.gpu.requestAdapter !== "function") return { webgpu: false, deviceMemory, cores };
  try {
    const adapter = await n.gpu.requestAdapter();
    const maxBufferSize = typeof adapter?.limits?.maxBufferSize === "number" ? adapter.limits.maxBufferSize : undefined;
    return { webgpu: Boolean(adapter), deviceMemory, cores, maxBufferSize };
  } catch {
    return { webgpu: false, deviceMemory, cores };
  }
}

/** Would ANY local WebLLM model load here? WebGPU present AND not a known-tiny device — a `deviceMemory`
 *  under 4 (when reported) is an almost-certain OOM even for the smallest model. Pure over a probe, so a
 *  caller can reuse one `probeDevice()` result for both this gate and its own size tiering. */
export function canRunModel(cap: DeviceCapability): boolean {
  if (typeof cap.deviceMemory === "number" && cap.deviceMemory < 4) return false;
  return cap.webgpu;
}

/** Can this browser run a local WebLLM model? The gate above applied to a fresh probe — kept as the
 *  one-call convenience the up-front UX check uses. Any throw counts as unavailable. */
export async function webgpuAvailable(): Promise<boolean> {
  return canRunModel(await probeDevice());
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
