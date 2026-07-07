// grain/ai/vocab-reference.ts — a GENERATED reference for the AI vocabulary contract
// (docs/AI-INTERFACE.md), for the developer-docs `/reference` route (../../DEV-DOCS.md
// step 5). This renders the REAL registries at request time — never a hand-copied
// table — so the reference can't drift from `contract.ts` the way prose easily does.
//
// What's genuinely reflectable at runtime vs. what isn't:
//   - ActionName + ACTIONS: real runtime values — read directly, zero copy.
//   - SurfaceKind: not a runtime value (a type alias), but every kind IN USE is
//     recoverable as the union of every action's `accepts` — derived, not copied.
//   - RenderOpKind + the HTTP endpoints: pure type aliases / literal strings with no
//     backing runtime array anywhere in the codebase. Hardcoded below, but GUARDED —
//     see vocab-reference.test.ts, which greps contract.ts / ai-routes.ts's source so
//     a mismatch fails a test instead of silently drifting.
import { ACTIONS, type SurfaceKind } from "./contract.ts";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Kept here (not derivable) — guarded by vocab-reference.test.ts against contract.ts's
// `RenderOpKind` union.
export const RENDER_OP_KINDS: readonly { kind: string; means: string }[] = [
  { kind: "replace", means: "swap the target's HTML — the confirmed/committed fragment" },
  { kind: "append", means: "add HTML to the end of the target (a chat log, a plan list, the console)" },
  { kind: "remove", means: "delete the target element" },
  { kind: "flash", means: "a transient note; also rolls back an optimistic pending state" },
  { kind: "type", means: "stream one text token into the target, or (done) settle it" },
  { kind: "spotlight", means: "show the AI as actor — dim everything, light (and optionally pulse) the target" },
];

// The one door's HTTP surface (AI-INTERFACE.md) — guarded by vocab-reference.test.ts
// against the literal path strings in tjakoen.github.io/routes/ai-routes.ts.
export const ENDPOINTS: readonly { method: string; path: string; means: string }[] = [
  { method: "POST", path: "/intent", means: "the one door — every human/AI interaction enters here" },
  { method: "GET", path: "/stream", means: "the per-session SSE channel render ops are pushed back over" },
  { method: "GET", path: "/ai/manifest", means: "the machine-readable index of what's operable right now" },
];

// Every SurfaceKind currently reachable by at least one verb — derived from the real
// ACTIONS registry, not hand-listed (a kind no verb accepts wouldn't show; today every
// declared SurfaceKind accepts at least one verb, so this reconstructs the full set).
function surfaceKindsInUse(): SurfaceKind[] {
  const kinds = new Set<SurfaceKind>();
  for (const a of Object.values(ACTIONS)) for (const k of a.accepts) kinds.add(k);
  return [...kinds].sort();
}

async function readTokenSlots(variablesCssPath: string): Promise<{ name: string; value: string }[]> {
  const css = await Bun.file(variablesCssPath).text();
  const root = css.match(/:root\s*{([^}]*)}/s)?.[1] ?? "";
  const out: { name: string; value: string }[] = [];
  for (const m of root.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.push({ name: m[1], value: m[2].trim() });
  return out;
}

const table = (head: string[], rows: string[][]) =>
  `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` +
  `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

/** The reference page's BODY content (no page shell — the composition root wraps it). */
export async function buildVocabReference(variablesCssPath: string): Promise<string> {
  const actionRows = Object.values(ACTIONS)
    .map((a) => [`<code>${esc(a.name)}</code>`, esc(a.depth), a.accepts.map((k) => `<code>${esc(k)}</code>`).join(", ")]);
  const kindRows = surfaceKindsInUse().map((k) => [`<code>${esc(k)}</code>`]);
  const opRows = RENDER_OP_KINDS.map((o) => [`<code>${esc(o.kind)}</code>`, esc(o.means)]);
  const endpointRows = ENDPOINTS.map((e) => [`<code>${esc(e.method)} ${esc(e.path)}</code>`, esc(e.means)]);
  const tokens = await readTokenSlots(variablesCssPath);
  const tokenRows = tokens.map((t) => [`<code>${esc(t.name)}</code>`, `<code>${esc(t.value)}</code>`]);

  return `
    <div class="section-head"><span>Actions</span></div>
    <p class="muted">Generated from <code>grain/ai/contract.ts</code>'s <code>ACTIONS</code> registry — the single source of truth.</p>
    ${table(["verb", "depth", "accepts (surface kinds)"], actionRows)}

    <div class="section-head"><span>Surface kinds</span></div>
    <p class="muted">Every kind at least one verb above accepts.</p>
    ${table(["kind"], kindRows)}

    <div class="section-head"><span>Render ops</span></div>
    <p class="muted">The effect kinds the client dispatcher applies (see <a href="/grain/docs/ai-interface">AI-INTERFACE.md</a>).</p>
    ${table(["op", "means"], opRows)}

    <div class="section-head"><span>The one door</span></div>
    <p class="muted">The HTTP surface every human/AI interaction enters through.</p>
    ${table(["endpoint", "means"], endpointRows)}

    <div class="section-head"><span>Token slots</span></div>
    <p class="muted">Every custom property GRAIN's default theme sets on <code>:root</code> — override these to re-skin (see <a href="/grain/docs/re-skin-via-tokens">RE-SKIN-VIA-TOKENS.md</a>), never a component's own CSS.</p>
    ${table(["token", "default value"], tokenRows)}
  `;
}
