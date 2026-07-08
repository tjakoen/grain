// proof/serve.ts — the STANDALONE board server: a thin boot that wraps the mountable handler
// (createProofRoutes, routes.ts) with the assets + page shell a non-BATCH host has no way to
// provide. It boots its own tiny server so PROOF's board works in ANY project; a BATCH host
// (PANTRY, the portfolio) skips this and mounts createProofRoutes directly under a prefix.
//
// NOTE (2026-07-08 pivot): the routing logic now lives in routes.ts (PROOF = a mountable layer).
// This file owns only the standalone concerns — grain-asset routes + the default chrome + Bun.serve.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { bunRuntime } from "../batch/platform/bun-runtime.ts";
import { makeStatic } from "../batch/http/static.ts";
import { createStyleBundle } from "../batch/assets/style-bundle.ts";
import { createStream, type Stream } from "../batch/http/stream.ts";
import { boardPage } from "./board.ts";
import { createProofRoutes } from "./routes.ts";
import { watchPlans } from "./live.ts";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
// GRAIN lives beside PROOF in the monorepo; on the split this becomes the @tjakoen/grain package
// dir (import.meta.resolve), never a literal sibling path — same pattern as MILL's layer docs.
const GRAIN_ROOT = join(MODULE_DIR, "..", "grain");

// The standalone server links these; a BATCH host injects its own chrome instead (its shell
// already carries the grain stylesheets + component bundle).
const STYLESHEETS = ["/styles/variables.css", "/styles/global.css", "/styles/grain.css", "/components.css", "/proof.css"];

export interface ProofServeOptions {
  /** the consumer's plans folder (absolute or cwd-relative) */
  plansDir: string;
  /** override GRAIN's location (defaults to the sibling package) */
  grainRoot?: string;
}

// The request handler, separated from Bun.serve so it can be exercised in tests without a socket.
// `stream` is injectable (piece 3, live.ts) so `serveProof` can share the SAME hub with the file
// watcher it starts — a test that only wants the handler gets a private default instance instead.
export function createProofHandler(opts: ProofServeOptions, stream: Stream = createStream()) {
  const grainRoot = opts.grainRoot ?? GRAIN_ROOT;
  const serveStyles = makeStatic(bunRuntime, join(grainRoot, "styles"));
  const componentCss = createStyleBundle(bunRuntime, join(grainRoot, "components"));
  // the board + plan + index routes, at the root (prefix ""), wrapped in the standalone chrome
  const routes = createProofRoutes({
    plansDir: opts.plansDir,
    chrome: (title, body) => boardPage(`${title} · PROOF`, body, STYLESHEETS),
    liveScriptSrc: "/board-live.js",
  });

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    // --- assets the standalone host must serve itself ---
    if (path.startsWith("/styles/")) return serveStyles(path.slice("/styles".length));
    if (path === "/components.css")
      return new Response(await componentCss.css(), { headers: { "Content-Type": "text/css" } });
    if (path === "/proof.css")
      return new Response(await bunRuntime.readFile(join(MODULE_DIR, "board.css")), { headers: { "Content-Type": "text/css" } });
    if (path === "/board-live.js")
      return new Response(await bunRuntime.readFile(join(MODULE_DIR, "board-live.js")), { headers: { "Content-Type": "text/javascript" } });

    // --- the live channel (piece 3): the board's SSE subscribe endpoint ---
    if (path === "/stream") return stream.subscribe(url.searchParams.get("session") ?? "default");

    // --- the board (delegated to the mountable handler) ---
    return (await routes(path)) ?? new Response("Not found", { status: 404 });
  };
}

/** What `serveProof` hands back: Bun's server (for `.url`, direct `Bun.serve` access) plus a
 *  `stop` that also closes the piece-3 file watcher — call this one, not `server.stop()`
 *  directly, or the watcher outlives the server. */
export interface ProofServerHandle {
  server: ReturnType<typeof Bun.serve>;
  stop(): void;
}

// Boot the board on a port. One Stream instance is shared between the request handler (the
// `/stream` subscribe route) and the file watcher (piece 3) so a broadcast from a plans/ change
// reaches every tab that subscribed through this same server.
export function serveProof(opts: ProofServeOptions & { port?: number }): ProofServerHandle {
  const stream = createStream();
  const handler = createProofHandler(opts, stream);
  const server = Bun.serve({ port: opts.port ?? 4321, fetch: handler });
  const watcher = watchPlans({ plansDir: opts.plansDir, channel: stream });
  return {
    server,
    stop() {
      watcher.stop();
      server.stop();
    },
  };
}
