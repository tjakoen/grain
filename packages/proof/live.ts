// proof/live.ts — piece 3: push the board over SSE so it updates live, without a refresh, when a
// plan file changes on disk. A `fs.watch` on plansDir debounces bursts (an editor save is often
// several fs events) into ONE rebuild, then BROADCASTS the fresh board body to every open tab —
// deliberately broadcast, not a per-session push: the board is a single shared read-only view of
// the files (there's no per-user state), so every viewer should see the same rebuild at once. That
// differs from an AI reply (which targets the one session that asked); this is closer to "the
// file changed under everyone".
//
// `proof-board` is a PROOF-owned surface name (matches the `data-surface="proof-board"` wrapper
// `renderBoardBody` emits, board.ts). It is deliberately NOT added to grain's `PUSH_SURFACES`
// (ai/contract.ts) — that registry is grain's own push-only vocabulary, and grain must never
// depend on proof (wrong layer direction, CONVENTIONS §1). PROOF depends on grain's `RenderOp`
// wire shape + `OP_EVENT` name — the dependency runs one way only.
import { watch } from "node:fs";
import { OP_EVENT, type RenderOp } from "@tjakoen/grain/ai/contract.ts";
import { loadPlans, type LastModified } from "./loader.ts";
import { renderBoardBody } from "./board.ts";

// The substrate port this needs: broadcast a named event to every open SSE session. batch's
// `Stream` (batch/http/stream.ts, `createStream()`) satisfies this structurally — no import of
// the concrete type, same pattern as grain's `OpChannel`.
export interface BoardChannel {
  broadcast(event: string, data: unknown): void;
}

export interface WatchPlansOptions {
  /** the plans folder this board is watching (same dir passed to createProofRoutes/loadPlans) */
  plansDir: string;
  /** where the rebuilt board is broadcast */
  channel: BoardChannel;
  /** git-age lookup (injectable for tests); default reads git, degrades to fs mtime */
  lastModified?: LastModified;
  /** Report an unavailable watch or failed refresh; defaults to a visible server error. */
  onError?: (error: unknown) => void;
  /** Watch adapter for deterministic lifecycle tests; native filesystem events are the default. */
  watch?: (dir: string, onChange: () => void) => { close(): void; on?(event: "error", listener: (error: unknown) => void): unknown };
}

const DEBOUNCE_MS = 100;

// Rebuilds run one at a time. Shutdown closes the watch immediately, suppresses late output,
// and resolves only after the current refresh finishes, so callers can safely remove its files.
export function watchPlans(opts: WatchPlansOptions): { stop(): Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let requested = false;
  let active: Promise<void> | null = null;
  const report = (error: unknown) => {
    try { (opts.onError ?? ((err) => console.error("[proof/live]", err)))(error); }
    catch (reportError) { console.error("[proof/live] error reporting failed", reportError, error); }
  };

  async function drain(): Promise<void> {
    while (requested) {
      if (stopped) return;
      requested = false;
      try {
        const { plans, duplicates } = await loadPlans(opts.plansDir, opts.lastModified);
        if (stopped) return;
        const renderOp: RenderOp = {
          target: "proof-board", op: "replace", html: renderBoardBody(plans, duplicates),
          provenance: "system", commit: "committed",
        };
        opts.channel.broadcast(OP_EVENT, renderOp);
      } catch (error) { report(error); }
    }
  }

  function changed() {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (stopped) return;
      requested = true;
      if (!active) active = drain().finally(() => { active = null; });
    }, DEBOUNCE_MS);
  }

  let watcher: { close(): void; on?(event: "error", listener: (error: unknown) => void): unknown } | null = null;
  try {
    watcher = opts.watch
      ? opts.watch(opts.plansDir, changed)
      : watch(opts.plansDir, { recursive: true }, changed);
    watcher.on?.("error", report);
  } catch (error) { report(error); }

  return {
    async stop() {
      stopped = true;
      requested = false;
      if (timer) { clearTimeout(timer); timer = null; }
      watcher?.close();
      await active;
    },
  };
}
