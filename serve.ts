// proof/serve.ts — piece 2: the board server. A self-contained factory that boots its OWN tiny
// BATCH+GRAIN server, so PROOF works in ANY project (Python, Rust, whatever) — the consumer's
// stack is irrelevant; PROOF ships the substrate. It reads the consumer's `plans/` folder (from
// their cwd) and its OWN assets relative to this module (so `bunx proof` resolves grain no matter
// where it runs). The board never writes: it's a window over the files (see PLAN.md, the design law).
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { bunRuntime } from "../batch/platform/bun-runtime.ts";
import { makeStatic } from "../batch/http/static.ts";
import { createStyleBundle } from "../batch/assets/style-bundle.ts";
import { renderGrainDocument } from "../mill/adapters/grain/grain-adapter.ts";
import { escapeHtml } from "../mill/core/engine.ts";
import { loadPlans } from "./loader.ts";
import { buildIndex } from "./core/index.ts";
import { renderBoard, renderPlanHeader, boardPage } from "./board.ts";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
// GRAIN lives beside PROOF in the monorepo; on the split this becomes the @tjakoen/grain package
// dir (import.meta.resolve), never a literal sibling path — same pattern as MILL's layer docs.
const GRAIN_ROOT = join(MODULE_DIR, "..", "grain");

const STYLESHEETS = ["/styles/variables.css", "/styles/global.css", "/styles/grain.css", "/components.css", "/proof.css"];
const SLUG = /^[a-z0-9][a-z0-9._-]*$/;   // plan id shape — traversal-safe

// A plan file leads with its own `# Title` heading, and PROOF renders the frontmatter facts in its
// own chrome — so MILL's default note masthead (which re-emits the title from frontmatter) would
// double the heading. This body-only layout renders just the body; the grade guardrail still runs
// (data-grade="smooth" preserved — plan prose is human/clean, only the AI grains).
const bodyOnlyLayout = ({ body }: { body: string }) => `<article class="note" data-grade="smooth">${body}</article>`;

export interface ProofServeOptions {
  /** the consumer's plans folder (absolute or cwd-relative) */
  plansDir: string;
  /** override GRAIN's location (defaults to the sibling package) */
  grainRoot?: string;
}

const htmlResponse = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });

// The request handler, separated from Bun.serve so it can be exercised in tests without a socket.
export function createProofHandler(opts: ProofServeOptions) {
  const grainRoot = opts.grainRoot ?? GRAIN_ROOT;
  const serveStyles = makeStatic(bunRuntime, join(grainRoot, "styles"));
  const componentCss = createStyleBundle(bunRuntime, join(grainRoot, "components"));

  return async (req: Request): Promise<Response> => {
    const path = new URL(req.url).pathname;

    // --- assets ---
    if (path.startsWith("/styles/")) return serveStyles(path.slice("/styles".length));
    if (path === "/components.css")
      return new Response(await componentCss.css(), { headers: { "Content-Type": "text/css" } });
    if (path === "/proof.css")
      return new Response(await bunRuntime.readFile(join(MODULE_DIR, "board.css")), { headers: { "Content-Type": "text/css" } });

    const { plans, duplicates } = await loadPlans(opts.plansDir);

    // --- the derived index (the machine "tasks.json") ---
    if (path === "/plans.json")
      return Response.json(buildIndex(plans.map((lp) => lp.plan), new Date().toISOString()));

    // --- the board ---
    if (path === "/") {
      const dupNote = duplicates.length
        ? `<p class="proof-card__flag">⚠ duplicate plan id(s): ${escapeHtml(duplicates.join(", "))}</p>`
        : "";
      const body = `<header>
  <h1 class="proof-masthead">Plans</h1>
  <p class="proof-lede">${plans.length} plan${plans.length === 1 ? "" : "s"} in ${escapeHtml(opts.plansDir)}. The files are the source of truth; this board is a window.</p>
  ${dupNote}
</header>
${renderBoard(plans)}`;
      return htmlResponse(boardPage("Plans · PROOF", body, STYLESHEETS));
    }

    // --- a card's detail: the plan body rendered through MILL ---
    if (path.startsWith("/plan/")) {
      const id = path.slice("/plan/".length);
      if (!SLUG.test(id)) return new Response("Not found", { status: 404 });
      const lp = plans.find((p) => p.plan.id === id);
      if (!lp) return new Response("Not found", { status: 404 });
      // MILL renders the plan body, whose first heading IS the title — so the chrome shows the
      // back-link + the frontmatter facts, then hands the whole body (title included) to MILL.
      const doc = renderGrainDocument(lp.raw, { defaultLayout: bodyOnlyLayout });   // grade guardrail runs inside MILL
      const body = `<a class="proof-back" href="/">← all plans</a>
${renderPlanHeader(lp)}
${doc.html}`;
      return htmlResponse(boardPage(`${lp.plan.title} · PROOF`, body, STYLESHEETS));
    }

    return new Response("Not found", { status: 404 });
  };
}

// Boot the board on a port. Returns Bun's server so a caller (the CLI, a test) can close it.
export function serveProof(opts: ProofServeOptions & { port?: number }) {
  const handler = createProofHandler(opts);
  return Bun.serve({ port: opts.port ?? 4321, fetch: handler });
}
