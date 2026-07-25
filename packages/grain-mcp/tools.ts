// grain-mcp/tools.ts — the pure tool layer: a loaded static export + the four read-only MCP tools
// server.ts exposes over it. Nothing here touches the filesystem or a socket — `loadExport` takes the
// export's files ALREADY READ (cli.ts's job, so this stays testable with plain strings), and every
// tool is a pure `(export, input) → result` function server.ts can call straight out of `tools/call`.
//
// The four tools are the MCP analogs of what a grain app already exposes to an in-browser AI (the
// manifest, the action registry, move validation) — this package just answers the SAME questions from
// OUTSIDE the browser, over a static export, for a coding agent instead of a page's own reasoner:
//   grain_pages          — what routes does this export have, and what's each one titled
//   grain_manifest        — what's operable on ONE route (domManifest, rendered both ways)
//   grain_actions          — the whole verb vocabulary (contract.ts's ACTIONS registry), MCP-annotated
//   grain_validate_move    — would THIS move be legal on THIS route (validateMove, read-only — it
//                            never touches the export; a "would it work" check, not a driver)
// All four are read-only by construction: they inspect a route's harvested manifest and the pure
// contract; none of them can mutate anything (there's no live app behind a static export to mutate).

import { ACTIONS, isAction, type ActionName } from "@tjakoen/grain/ai/contract.ts";
import { domManifest, manifestToText } from "@tjakoen/grain/ai/manifest-dom.ts";
import { validateMove, validTargetsFor, type ModelMove } from "@tjakoen/grain/ai/model.ts";
import { parsePage } from "./harvest.ts";

// ── route derivation: mirrors the export's own directory layout ────────────────────────────────────
// A grain/batch export writes a page at either the export ROOT as "<name>.html", or as a directory's
// "index.html" (the usual case — every route in tjakoen.github.io/dist is index.html-shaped: `/mail`
// is `mail/index.html`, `/` is the root `index.html`). Both shapes are supported: an index.html's
// route is its DIRECTORY; any other *.html's route is its own path with the extension dropped.
export function deriveRoute(relPath: string): string {
  const posix = relPath.split("\\").join("/").replace(/^\.\//, "").replace(/^\/+/, "");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) return "/" + posix.slice(0, -"/index.html".length);
  if (posix.endsWith(".html")) return "/" + posix.slice(0, -".html".length);
  throw new Error(`grain-mcp: not an .html file: ${JSON.stringify(relPath)}`);
}

export interface ExportPage {
  route: string;
  relPath: string;
  title: string;
  html: string;
}

export interface GrainExport {
  pages: ExportPage[];
}

/** Build a `GrainExport` from an already-read map of `{relative .html path → file contents}` (cli.ts
 *  walks the export directory and reads the files; this function does no I/O, so it's testable with a
 *  plain object). Pages sort by route so every listing (grain_pages, an unknown-route rejection) is
 *  deterministic. */
export function loadExport(files: Record<string, string>): GrainExport {
  const pages = Object.entries(files).map(([relPath, html]) => ({
    route: deriveRoute(relPath),
    relPath,
    title: parsePage(html).title,
    html,
  }));
  pages.sort((a, b) => a.route.localeCompare(b.route));
  return { pages };
}

function findPage(exp: GrainExport, route: unknown): { ok: true; page: ExportPage } | { ok: false; reason: string } {
  if (typeof route !== "string" || !route) {
    return { ok: false, reason: `"route" must be a non-empty string` };
  }
  const page = exp.pages.find((p) => p.route === route);
  if (!page) {
    const known = exp.pages.map((p) => p.route).join(", ") || "(no pages in this export)";
    return { ok: false, reason: `unknown route ${JSON.stringify(route)} — known routes: ${known}` };
  }
  return { ok: true, page };
}

// ── the tool result shape server.ts renders into an MCP tools/call response ─────────────────────────
// `isError:true` is a TOOL-LEVEL failure (a bad route, an illegal move) — MCP's own idiom for "the
// call succeeded as a protocol operation but the answer is a rejection", distinct from a JSON-RPC
// error (a malformed call itself). `payload` is JSON-stringified into the single text content block.
export interface ToolResult { isError: boolean; payload: unknown }

const ok = (payload: unknown): ToolResult => ({ isError: false, payload });
const err = (payload: unknown): ToolResult => ({ isError: true, payload });

// ── tool 1: grain_pages — every route in the export, with its title ────────────────────────────────
export function grainPages(exp: GrainExport, _input: unknown): ToolResult {
  return ok({ pages: exp.pages.map((p) => ({ route: p.route, title: p.title })) });
}

// ── tool 2: grain_manifest — the harvested manifest for one route, JSON + prompt-text renderings ────
export function grainManifest(exp: GrainExport, input: unknown): ToolResult {
  const route = (input as { route?: unknown } | null)?.route;
  const found = findPage(exp, route);
  if (!found.ok) return err({ reason: found.reason });
  const { doc } = parsePage(found.page.html);
  const manifest = domManifest(doc);
  return ok({ route: found.page.route, title: found.page.title, manifest, text: manifestToText(manifest) });
}

// ── tool 3: grain_actions — the whole verb vocabulary, MCP-tool-annotation-shaped ───────────────────
export function grainActions(_exp: GrainExport, _input: unknown): ToolResult {
  const actions = Object.values(ACTIONS).map((a) => ({
    name: a.name,
    depth: a.depth,
    accepts: a.accepts,
    description: a.description,
    payload: a.payload,
    // MCP tool-annotation-style fields — the same three behaviour hints contract.ts's ActionHints
    // carries, renamed to their MCP counterparts so a client that already understands tool
    // annotations reads them without translation.
    annotations: {
      readOnlyHint: a.hints.readOnly === true,
      destructiveHint: a.hints.destructive === true,
      idempotentHint: a.hints.idempotent === true,
    },
  }));
  return ok({ actions });
}

// ── tool 4: grain_validate_move — would this move be legal on this route right now ──────────────────
interface ValidateMoveInput { route?: unknown; move?: unknown }

export function grainValidateMove(exp: GrainExport, input: unknown): ToolResult {
  const { route, move: rawMove } = (input as ValidateMoveInput | null) ?? {};
  const found = findPage(exp, route);
  if (!found.ok) return err({ reason: found.reason });

  if (typeof rawMove !== "object" || rawMove === null || Array.isArray(rawMove)) {
    return err({ reason: `"move" must be an object with at least an "action" field` });
  }
  const move = rawMove as ModelMove;

  const { doc } = parsePage(found.page.html);
  const manifest = domManifest(doc);
  const result = validateMove(move, manifest);

  if (result.ok) return ok({ route: found.page.route, move: result.move });

  // Echo validTargetsFor alongside the prose reason (which already names them inline) whenever the
  // move named a real verb — so a client can act on the structured list without re-parsing prose.
  const action = typeof move.action === "string" && isAction(move.action) ? (move.action as ActionName) : null;
  const validTargets = action ? validTargetsFor(action, manifest) : [];
  return err({ route: found.page.route, reason: result.reason, validTargets });
}

// ── the MCP tool registry: declaration (for tools/list) + handler (for tools/call) ──────────────────
export interface ToolDeclaration {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
  annotations: { readOnlyHint: true };   // all four grain-mcp tools are read-only, always
}

export interface ToolEntry {
  declaration: ToolDeclaration;
  handler: (exp: GrainExport, input: unknown) => ToolResult;
}

const readOnly = { readOnlyHint: true as const };

export const TOOLS: ToolEntry[] = [
  {
    declaration: {
      name: "grain_pages",
      description: "List every route in the loaded grain static export, with each page's <title>. " +
        "Call this FIRST to discover what routes exist before asking for a manifest.",
      inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
      annotations: readOnly,
    },
    handler: grainPages,
  },
  {
    declaration: {
      name: "grain_manifest",
      description: "Harvest the AI-interaction manifest for ONE route: every operable [data-surface] " +
        "target on that page, the verbs each accepts, and any data-read surface's current text. Call " +
        "this before grain_validate_move so you know which targets and verbs are actually legal there.",
      inputSchema: {
        type: "object",
        properties: { route: { type: "string", description: "A route from grain_pages, e.g. \"/mail\"" } },
        required: ["route"],
        additionalProperties: false,
      },
      annotations: readOnly,
    },
    handler: grainManifest,
  },
  {
    declaration: {
      name: "grain_actions",
      description: "List the whole grain verb vocabulary (the ACTIONS registry): every action's name, " +
        "the surface kinds it applies to, its payload schema, and its behaviour hints (read-only / " +
        "destructive / idempotent). Call this to learn HOW to call a verb before building a move.",
      inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
      annotations: readOnly,
    },
    handler: grainActions,
  },
  {
    declaration: {
      name: "grain_validate_move",
      description: "Check whether a proposed move (an action + a target surface + an optional " +
        "payload) would be LEGAL on a given route, without acting on anything — it harvests that " +
        "route's live manifest and runs grain's own validateMove against it. On rejection, the reason " +
        "names what's wrong and, for a known verb, which targets on the page WOULD accept it.",
      inputSchema: {
        type: "object",
        properties: {
          route: { type: "string", description: "A route from grain_pages, e.g. \"/mail\"" },
          move: {
            type: "object",
            description: "{ action: an ActionName from grain_actions, target: a surface id from " +
              "grain_manifest, payload?: the verb's fields }",
          },
        },
        required: ["route", "move"],
        additionalProperties: false,
      },
      annotations: readOnly,
    },
    handler: grainValidateMove,
  },
];
