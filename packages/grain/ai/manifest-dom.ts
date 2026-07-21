// grain/ai/manifest-dom.ts — the manifest, HARVESTED FROM THE LIVE DOM (client-side).
//
// The server builds a manifest from component state (ai/manifest.ts + accepts.ts, harvested
// from .html at rest). This is the SAME projection, but read off the rendered page in the
// browser: walk every [data-surface], derive each one's kind + accepted verbs, and hand back
// the identical Manifest shape. It's the honest answer to "what can the AI do on THIS page,
// right now" (AI-INTERFACE §4) — and, because it reads the DOM, it works on a static host with
// no /ai/manifest route. It powers the terminal's `context` command and x-ray mode.
//
// CLIENT-SAFE (ARCHITECTURE §19.2): imports only the pure contract + manifest builder — no
// server-only modules, no secrets. The DOM is reached through a MINIMAL STRUCTURAL interface
// (DomEl/DomRoot below), not the global `lib.dom` types, so this compiles without pulling DOM
// globals into the server build AND the derivation logic is unit-testable with plain objects.

import { ACTIONS, isAction, actionsForKind, surfaceKind, type ActionName, type SurfaceKind } from "./contract.ts";
import { buildManifest, type Manifest, type ManifestTarget } from "./manifest.ts";

// ── the sliver of the DOM this module touches (structural, not lib.dom) ───────────────────────
export interface DomEl {
  getAttribute(name: string): string | null;
  textContent: string | null;   // read to harvest a surface's current READABLE state (data-read opt-in)
}
export interface DomRoot {
  querySelectorAll(selectors: string): Iterable<DomEl>;
}
/** A document, structurally: a root to walk plus the screen name off <body data-screen>. */
export interface DomDoc extends DomRoot {
  body: DomEl | null;
}

const KNOWN_KINDS = new Set<string>(Object.values(ACTIONS).flatMap((a) => a.accepts));
const isKind = (s: string): s is SurfaceKind => KNOWN_KINDS.has(s);

/** A surface's kind + whether it's push-only (a display feed no verb targets). The kind is the
 *  explicit data-kind, else the address prefix ("item" of "item:ITM-1", or a bare "chat-log")
 *  when that names a real SurfaceKind. Anything else (console, plan, …) is push-only. */
export function deriveKind(surface: string, dataKind: string | null): { kind: string; pushOnly: boolean } {
  if (dataKind && dataKind.trim()) return { kind: dataKind.trim(), pushOnly: !isKind(dataKind.trim()) };
  const prefix = surfaceKind(surface);   // "item:ITM-1" → "item"; "chat-log" → "chat-log"
  if (isKind(prefix)) return { kind: prefix, pushOnly: false };
  return { kind: surface, pushOnly: true };
}

/** The verbs valid on a target: its declared data-accepts (∩ the registry, so a stray verb is
 *  dropped), else — for a registered kind with no explicit list — the registry inversion. */
export function deriveAccepts(kind: string, dataAccepts: string | null): ActionName[] {
  if (dataAccepts && dataAccepts.trim()) {
    return dataAccepts.trim().split(/\s+/).filter(isAction);
  }
  return isKind(kind) ? actionsForKind(kind) : [];
}

/** The one-line x-ray label for a target: "kind · verb verb", or "kind · push-only". */
export function targetLabel(t: ManifestTarget & { pushOnly?: boolean }): string {
  const verbs = t.accepts.length ? t.accepts.join(" ") : (t.pushOnly ? "push-only" : "—");
  return `${t.kind} · ${verbs}`;
}

export interface DomManifestTarget extends ManifestTarget {
  pushOnly: boolean;
}

// ── readable in-view state: the MCP "resources" analog ─────────────────────────────────────────
// `targets`/`actions` say what a reasoner can ADDRESS and INVOKE; they don't say what a surface
// currently CONTAINS. `data-read` closes that gap: a surface OPTS IN to exposing its live text —
// exactly as `data-accepts` opts a target into a verb (AI-INTERFACE §4). The framework harvests
// it, never authors it, so it stays app-agnostic (grain never knows the content, only that it was
// flagged) and prompt-economic (only marked surfaces, each capped — not the whole DOM dumped in).

/** One surface's current readable state — the manifest's MCP-resource analog: `id` is its address
 *  (the uri), `kind` its surface kind, `text` its live, collapsed, capped textContent. */
export interface ReadableSurface {
  id: string;
  kind: string;
  text: string;
}

/** Per-surface character cap on harvested text — keeps the observe prompt tight; a marked surface
 *  is meant to expose a line or a short body, not a whole document. Truncation is signalled with "…". */
export const READABLE_CAP = 400;

/** Collapse a surface's textContent to one prompt-safe line: trim, squeeze whitespace runs (incl.
 *  newlines) to single spaces, and cap length with a trailing "…" so a reader knows it was clipped. */
export function collapseReadable(raw: string | null): string {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  return text.length > READABLE_CAP ? text.slice(0, READABLE_CAP - 1).trimEnd() + "…" : text;
}

/** Walk every surface that OPTED IN with `data-read` and harvest its current readable state. Filters
 *  on the attribute (not just the selector) so it's correct even against a structural fake root; skips
 *  a marked-but-empty surface (no text = nothing to read). Document order → deterministic. */
export function harvestReadable(root: DomRoot): ReadableSurface[] {
  const out: ReadableSurface[] = [];
  for (const el of root.querySelectorAll("[data-surface]")) {
    if (el.getAttribute("data-read") === null) continue;   // opt-in only
    const surface = el.getAttribute("data-surface");
    if (!surface) continue;
    const text = collapseReadable(el.textContent);
    if (!text) continue;
    const { kind } = deriveKind(surface, el.getAttribute("data-kind"));
    out.push({ id: surface, kind, text });
  }
  return out;
}

/** Walk every [data-surface] under `root` and derive its manifest target. */
export function harvestTargets(root: DomRoot): DomManifestTarget[] {
  const out: DomManifestTarget[] = [];
  for (const el of root.querySelectorAll("[data-surface]")) {
    const surface = el.getAttribute("data-surface");
    if (!surface) continue;
    const { kind, pushOnly } = deriveKind(surface, el.getAttribute("data-kind"));
    const accepts = deriveAccepts(kind, el.getAttribute("data-accepts"));
    out.push({ id: surface, kind, accepts, pushOnly });
  }
  return out;
}

/** Build the full client-side manifest for a document: the same shape the server emits, noted
 *  as a live-DOM projection so a reader knows where it came from. */
export function domManifest(doc: DomDoc): Manifest {
  const screen = doc.body?.getAttribute("data-screen") ?? "";
  const targets = harvestTargets(doc);
  const readable = harvestReadable(doc);   // current text of every data-read surface (MCP-resources analog)
  const m = buildManifest(screen, targets, { surfaces: targets.map((t) => t.id), readable });
  m.note = "Client-side projection of the LIVE DOM: every [data-surface] on this page, its kind, " +
           "the verbs the registry allows on it, and — for any surface that opted in with data-read — " +
           "its current readable state in inView.readable. Same shape as the server manifest (AI-INTERFACE §4).";
  return m;
}

/** A compact, deterministic, PLAIN-TEXT rendering of `domManifest()` — meant to be dropped
 *  straight into an LLM system/user prompt so a consumer reasoner (a real model) decides what to
 *  click/navigate from the REAL, live affordances on screen, instead of a hardcoded address list
 *  that can silently drift from the UI (the same anti-drift promise `domManifest` already makes —
 *  this is just its prose form). Built ON `domManifest`, not a second harvest: one truth, two
 *  shapes (JSON for code, text for a prompt). Deterministic: the same DOM in always yields the
 *  same string out — target order follows `harvestTargets`' DOM walk (document order), never a
 *  Set/Map/Object whose iteration order could vary across engines. Pure — no DOM writes, no I/O. */
export function manifestForReasoner(doc: DomDoc): string {
  const m = domManifest(doc);
  const lines: string[] = [`screen: ${m.screen || "(none)"}`];

  // The MOVE SET: every verb the vocabulary offers, with the payload shape a reasoner needs to
  // CALL it (field*:type — "*" = required) and a one-line description of what it does. Without
  // this a model sees which verbs a target accepts (below) but has to guess the payload — the gap
  // this section closes (AI-INTERFACE §1b). Order follows the ACTIONS registry (buildManifest).
  lines.push(`actions: (${m.actions.length})`);
  for (const a of m.actions) {
    const fields = Object.entries(a.payload)
      .map(([name, f]) => `${name}${f.required ? "*" : ""}:${f.type}${f.note ? ` (${f.note})` : ""}`);
    const args = fields.length ? fields.join(", ") : "no args";
    // behaviour hints (read-only / destructive / idempotent) so the reasoner chooses + retries safely
    const flags = Object.entries(a.hints).filter(([, v]) => v).map(([k]) => k);
    const hints = flags.length ? ` {${flags.join(", ")}}` : "";
    lines.push(`- ${a.name} [${a.depth}] (${args}) — ${a.description}${hints}`);
  }

  if (!m.targets.length) {
    lines.push("targets: (none — this page declares no [data-surface] elements)");
    return lines.join("\n");
  }
  lines.push(`targets: (${m.targets.length})`);
  for (const t of m.targets) {
    const verbs = t.accepts.length ? t.accepts.join(", ") : "(no verb currently targets this)";
    lines.push(`- ${t.id} [${t.kind}] -> ${verbs}`);
  }

  // IN VIEW: the current readable STATE of every surface that opted in with data-read (the MCP
  // "resources" analog). Emitted ONLY when something is readable — a page with no marked surface
  // yields the exact same string as before, so the block never adds noise where there's no state.
  // This is the "read the result" half of the observe loop: after acting, the reasoner sees not
  // just what it can do next but what the surfaces now SAY.
  const readable = (m.inView.readable as ReadableSurface[] | undefined) ?? [];
  if (readable.length) {
    lines.push(`in view: (${readable.length})`);
    for (const r of readable) lines.push(`- ${r.id} [${r.kind}] "${r.text}"`);
  }
  return lines.join("\n");
}
