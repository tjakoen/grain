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
import { watch, type FSWatcher } from "node:fs";
import { OP_EVENT, type RenderOp } from "../grain/ai/contract.ts";
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
}

const DEBOUNCE_MS = 100;

// Watch `plansDir` and broadcast a fresh `proof-board` replace on every settled change. Returns
// `{ stop }` so a caller (serveProof's boot, a test) can close the watcher and clear any pending
// debounce timer — never leaves a dangling fs watch or timer behind.
export function watchPlans(opts: WatchPlansOptions): { stop(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function rebuildAndBroadcast() {
    const { plans, duplicates } = await loadPlans(opts.plansDir, opts.lastModified);
    const renderOp: RenderOp = {
      target: "proof-board",
      op: "replace",
      html: renderBoardBody(plans, duplicates),
      provenance: "system",
      commit: "committed",
    };
    opts.channel.broadcast(OP_EVENT, renderOp);
  }

  let watcher: FSWatcher | null = null;
  try {
    // `recursive: true` — a plan is a flat file in plansDir today, but a future subfolder (or an
    // editor's atomic-save-via-rename) still lands inside plansDir, so recursive is the safe default.
    watcher = watch(opts.plansDir, { recursive: true }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void rebuildAndBroadcast();
      }, DEBOUNCE_MS);
    });
  } catch {
    // no plans/ folder yet, or fs.watch unsupported on this platform/fs — degrade to "no live
    // updates" rather than crash the boot. The board still renders; it just isn't live.
  }

  return {
    stop() {
      if (timer) clearTimeout(timer);
      watcher?.close();
    },
  };
}
