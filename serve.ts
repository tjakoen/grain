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
import { boardPage } from "./board.ts";
import { createProofRoutes } from "./routes.ts";

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
export function createProofHandler(opts: ProofServeOptions) {
  const grainRoot = opts.grainRoot ?? GRAIN_ROOT;
  const serveStyles = makeStatic(bunRuntime, join(grainRoot, "styles"));
  const componentCss = createStyleBundle(bunRuntime, join(grainRoot, "components"));
  // the board + plan + index routes, at the root (prefix ""), wrapped in the standalone chrome
  const routes = createProofRoutes({
    plansDir: opts.plansDir,
    chrome: (title, body) => boardPage(`${title} · PROOF`, body, STYLESHEETS),
  });

  return async (req: Request): Promise<Response> => {
    const path = new URL(req.url).pathname;

    // --- assets the standalone host must serve itself ---
    if (path.startsWith("/styles/")) return serveStyles(path.slice("/styles".length));
    if (path === "/components.css")
      return new Response(await componentCss.css(), { headers: { "Content-Type": "text/css" } });
    if (path === "/proof.css")
      return new Response(await bunRuntime.readFile(join(MODULE_DIR, "board.css")), { headers: { "Content-Type": "text/css" } });

    // --- the board (delegated to the mountable handler) ---
    return (await routes(path)) ?? new Response("Not found", { status: 404 });
  };
}

// Boot the board on a port. Returns Bun's server so a caller (the CLI, a test) can close it.
export function serveProof(opts: ProofServeOptions & { port?: number }) {
  const handler = createProofHandler(opts);
  return Bun.serve({ port: opts.port ?? 4321, fetch: handler });
}
