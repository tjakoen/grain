// proof/routes.ts — PROOF as a MOUNTABLE LAYER (the pivot, 2026-07-08). A transport-generic
// pathname handler `(pathname) => Promise<Response|null>`, mirroring MILL's createMillRoutes:
// null = "not my route, fall through", so a host (PANTRY, or the portfolio) mounts it under a
// prefix and tries it before its own pages. The page shell is INJECTED (`chrome`) so the host
// owns the <head>/asset links — standalone PANTRY links the grain stylesheets; a BATCH host wraps
// the board in its own frame. The board never writes: it's a window over the files (the design law).
import { renderGrainDocument } from "../mill/adapters/grain/grain-adapter.ts";
import { escapeHtml } from "../mill/core/engine.ts";
import { loadPlans, type LastModified } from "./loader.ts";
import { buildIndex } from "./core/index.ts";
import { renderBoardBody, renderPlanHeader } from "./board.ts";

const SLUG = /^[a-z0-9][a-z0-9._-]*$/;   // plan id shape — traversal-safe

// A plan file leads with its own `# Title`, and PROOF renders the frontmatter facts in its own
// chrome, so MILL's default note masthead would double the heading. This body-only layout renders
// just the body; the grade guardrail still runs (data-grade="smooth" — plan prose is human/clean).
const bodyOnlyLayout = ({ body }: { body: string }) => `<article class="note" data-grade="smooth">${body}</article>`;

export interface ProofRoutesDeps {
  /** the plans folder (absolute or cwd-relative) */
  plansDir: string;
  /** mount prefix, no trailing slash: "" serves the board at "/", "/proof" mounts under /proof */
  prefix?: string;
  /** wrap a rendered body into a full page — the host owns the <head>/asset links */
  chrome: (title: string, body: string) => string | Promise<string>;
  /** git-age lookup (injectable for tests); default reads git, degrades to fs mtime */
  lastModified?: LastModified;
  /** when set, the board route appends a module script tag pointing at the live-board client
   *  (piece 3, board-live.js) — opt-in so a static/non-live host is unaffected */
  liveScriptSrc?: string;
}

export type ProofRequestHandler = (pathname: string) => Promise<Response | null>;

const htmlResponse = async (bodyPromise: string | Promise<string>) =>
  new Response(await bodyPromise, { headers: { "Content-Type": "text/html; charset=utf-8" } });

export function createProofRoutes(deps: ProofRoutesDeps): ProofRequestHandler {
  const prefix = deps.prefix ?? "";

  // Map an incoming pathname to the route RELATIVE to the prefix, or null when it isn't ours.
  const relOf = (path: string): string | null => {
    if (prefix === "") return path;
    if (path === prefix) return "/";
    if (path.startsWith(prefix + "/")) return path.slice(prefix.length);
    return null;
  };

  return async (pathname: string): Promise<Response | null> => {
    const path = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    const rel = relOf(path);
    if (rel === null) return null;

    const { plans, duplicates } = await loadPlans(deps.plansDir, deps.lastModified);

    // the derived index (the machine "tasks.json") — generated, never hand-maintained
    if (rel === "/plans.json")
      return Response.json(buildIndex(plans.map((lp) => lp.plan), new Date().toISOString()));

    // the board
    if (rel === "/" || rel === "") {
      const liveScript = deps.liveScriptSrc
        ? `\n<script type="module" src="${escapeHtml(deps.liveScriptSrc)}"></script>`
        : "";
      const body = renderBoardBody(plans, duplicates) + liveScript;
      return htmlResponse(deps.chrome("Plans", body));
    }

    // a card's detail: the plan body rendered through MILL (body-only layout)
    if (rel.startsWith("/plan/")) {
      const id = rel.slice("/plan/".length);
      if (!SLUG.test(id)) return null;
      const lp = plans.find((p) => p.plan.id === id);
      if (!lp) return null;
      const doc = renderGrainDocument(lp.raw, { defaultLayout: bodyOnlyLayout });   // grade guardrail runs inside MILL
      const body = `<a class="proof-back" href="${escapeHtml(prefix || "/")}">← all plans</a>
${renderPlanHeader(lp)}
${doc.html}`;
      return htmlResponse(deps.chrome(lp.plan.title, body));
    }

    return null;   // an unknown subpath under the prefix — let the host fall through
  };
}
