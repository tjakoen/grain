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
  const m = buildManifest(screen, targets, { surfaces: targets.map((t) => t.id) });
  m.note = "Client-side projection of the LIVE DOM: every [data-surface] on this page, its kind, " +
           "and the verbs the registry allows on it. Same shape as the server manifest (AI-INTERFACE §4).";
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
  if (!m.targets.length) {
    lines.push("targets: (none — this page declares no [data-surface] elements)");
    return lines.join("\n");
  }
  lines.push(`targets: (${m.targets.length})`);
  for (const t of m.targets) {
    const verbs = t.accepts.length ? t.accepts.join(", ") : "(no verb currently targets this)";
    lines.push(`- ${t.id} [${t.kind}] -> ${verbs}`);
  }
  return lines.join("\n");
}
