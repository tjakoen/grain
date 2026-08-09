// grain-mcp/harvest.ts — pure static-HTML → DomDoc adapter (ZERO-DEP).
//
// grain/ai/manifest-dom.ts derives a page's manifest off a MINIMAL structural DOM interface
// (DomEl/DomRoot/DomDoc — getAttribute, textContent, querySelectorAll, body), not a real browser
// DOM (manifest-dom.ts:19-29). That's exactly the shape a static HTML string can satisfy without a
// browser or an npm HTML parser: this module hand-rolls a tiny, single-pass HTML tokenizer that
// builds just enough of a tree to answer those calls — over the ONE selector manifest-dom.ts is ever
// known to ask for, `"[data-surface]"` (verified against the source: harvestTargets + harvestReadable
// both query it and nothing else). `querySelectorAll` THROWS on any other selector string, on
// purpose — if manifest-dom.ts ever starts querying something new, this adapter should fail loudly
// at the call site instead of silently harvesting nothing (the same "drift is loud" instinct as
// deriveAccepts dropping a stray verb, contract.ts).
//
// GOTCHA, verified against the real export (tjakoen.github.io/dist/mail/index.html): every mail row
// carries an authoring COMMENT documenting the row's data-binding contract, and that comment's PROSE
// literally contains the text `data-surface="item:mail-<id>"` — an unresolved placeholder, not a real
// attribute (grep confirms all ten occurrences of that exact string sit inside `<!-- … -->` blocks,
// never inside a live tag). A regex/tag scanner that doesn't respect comment boundaries would
// "discover" a bogus surface off that documentation prose. The fix: comments are stripped in their
// own pass BEFORE tag scanning ever starts, so their text is never visible to the tokenizer at all —
// no separate "does this look like a placeholder" heuristic needed for THIS case.
//
// One more defensive check rides along for belt-and-suspenders: any harvested `data-surface` value
// that still contains "<" or ">" (an unresolved placeholder that somehow ended up outside a comment,
// in some export this adapter hasn't seen yet) is dropped. What this module deliberately does NOT
// treat as a junk signal on its own: the mere presence of a `data-bind-*` attribute. On the real
// export, EVERY resolved, legitimate mail row carries `data-bind-href` / `data-bind-data-folder` /
// `data-bind-data-surface` alongside its real `data-surface="item:mail-welcome"` (etc.) — `data-bind-*`
// marks "a client island may rewrite this attribute later", which is true of shipped rows just as
// much as of a hypothetical hydration template. Treating it as disqualifying would silently drop
// every real mail item — the opposite of this module's job. So the ONLY junk signal that survives
// contact with the real data is the angle-bracket check.

import type { DomDoc, DomEl } from "@tjakoen/grain/ai/manifest-dom.ts";

// ── the one selector this adapter is known to need to support (manifest-dom.ts's whole surface) ────
const SUPPORTED_SELECTOR = "[data-surface]";

// ── void elements: no closing tag, so they can never enclose text/children (HTML Standard §13.1.2) ──
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);

// ── entity decoding: just the handful a server-rendered export actually emits, plus numeric refs ────
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

function decodeEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const codePoint = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
        ? String.fromCodePoint(codePoint)
        : whole;
    }
    return Object.hasOwn(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : whole;
  });
}

// ── the tokenizer: turn an HTML string into a flat run of tag/text tokens ───────────────────────────
interface RawTag { closing: boolean; name: string; attrs: Record<string, string>; selfClosing: boolean }
type Token = { kind: "tag"; tag: RawTag } | { kind: "text"; text: string };

// A tag never legitimately contains a bare ">" inside an attribute value in this codebase's
// server-rendered markup (attribute values are always quoted, and quoted values here never embed a
// literal ">"), so a plain "everything between < and >" match is enough — no need for a full
// attribute-aware state machine just to find tag boundaries.
const TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s+[^<>]*)?\/?>/g;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseTag(raw: string): RawTag {
  const closing = raw.startsWith("</");
  const selfClosing = !closing && /\/\s*>$/.test(raw);
  const inner = raw.slice(closing ? 2 : 1, raw.length - (selfClosing ? 2 : 1));
  const nameMatch = inner.match(/^[a-zA-Z][a-zA-Z0-9-]*/);
  const name = (nameMatch?.[0] ?? "").toLowerCase();
  const rest = inner.slice(nameMatch?.[0].length ?? 0);
  const attrs: Record<string, string> = {};
  for (const m of rest.matchAll(ATTR_RE)) {
    const attrName = m[1].toLowerCase();
    // a valueless boolean attribute (e.g. bare `data-read`) present with no "=" → "" (matches the
    // real DOM: Element.getAttribute returns "" for a present-but-valueless attribute, not null).
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    attrs[attrName] = decodeEntities(value);
  }
  return { closing, name, attrs, selfClosing };
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  for (const m of html.matchAll(TAG_RE)) {
    const idx = m.index ?? 0;
    if (idx > cursor) tokens.push({ kind: "text", text: decodeEntities(html.slice(cursor, idx)) });
    tokens.push({ kind: "tag", tag: parseTag(m[0]) });
    cursor = idx + m[0].length;
  }
  if (cursor < html.length) tokens.push({ kind: "text", text: decodeEntities(html.slice(cursor)) });
  return tokens;
}

// ── the tree: just enough structure to answer getAttribute/textContent/querySelectorAll ─────────────
interface VNode { tag: string; attrs: Record<string, string>; children: (VNode | string)[] }

function buildTree(tokens: Token[]): VNode {
  const root: VNode = { tag: "#root", attrs: {}, children: [] };
  const stack: VNode[] = [root];
  for (const t of tokens) {
    const top = stack[stack.length - 1]!;
    if (t.kind === "text") {
      if (t.text) top.children.push(t.text);
      continue;
    }
    if (t.tag.closing) {
      // Close back to the nearest matching ancestor. A stray/unmatched closer (malformed markup)
      // is tolerated, not fatal — this harvester's job is to read what's there, not to validate it.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.tag === t.tag.name) { stack.length = i; break; }
      }
      continue;
    }
    const node: VNode = { tag: t.tag.name, attrs: t.tag.attrs, children: [] };
    top.children.push(node);
    if (!t.tag.selfClosing && !VOID_ELEMENTS.has(t.tag.name)) stack.push(node);
  }
  return root;
}

function textOf(node: VNode | string): string {
  return typeof node === "string" ? node : node.children.map(textOf).join("");
}

function findFirst(node: VNode, tag: string): VNode | null {
  for (const child of node.children) {
    if (typeof child === "string") continue;
    if (child.tag === tag) return child;
    const found = findFirst(child, tag);
    if (found) return found;
  }
  return null;
}

/** Is this `[data-surface]` element real, or junk (an unresolved template placeholder)? The only
 *  signal that survives contact with the real export (see the module comment): the surface's own
 *  value still carrying "<" or ">". */
function isJunkSurface(attrs: Record<string, string>): boolean {
  const surface = attrs["data-surface"] ?? "";
  return surface.includes("<") || surface.includes(">");
}

function collectDataSurfaceElements(root: VNode): VNode[] {
  const out: VNode[] = [];
  const walk = (n: VNode) => {
    for (const child of n.children) {
      if (typeof child === "string") continue;
      if (Object.hasOwn(child.attrs, "data-surface") && !isJunkSurface(child.attrs)) out.push(child);
      walk(child);   // document order, depth-first — same order a real querySelectorAll returns
    }
  };
  walk(root);
  return out;
}

function wrapEl(node: VNode): DomEl {
  return {
    getAttribute(name: string): string | null {
      const key = name.toLowerCase();
      return Object.hasOwn(node.attrs, key) ? node.attrs[key]! : null;
    },
    get textContent(): string { return textOf(node); },
  };
}

// ── the public adapter ──────────────────────────────────────────────────────────────────────────
export interface ParsedPage {
  /** The page's `<title>` text, decoded + trimmed; "" if the page has none. */
  title: string;
  /** The structural DomDoc manifest-dom.ts's `domManifest`/`manifestForReasoner` accept directly. */
  doc: DomDoc;
}

/** Parse one exported HTML page into the structural `DomDoc` grain's pure manifest builder expects.
 *  Pure: no I/O, just string → tree → the three calls manifest-dom.ts makes. Comments are stripped
 *  FIRST (before any tag scanning), and `<script>`/`<style>` bodies are dropped wholesale (their raw
 *  JS/CSS content routinely contains unbalanced "<"/">" that would otherwise confuse the tag
 *  boundary scan, and neither ever legitimately carries a `[data-surface]` in this codebase). */
export function parsePage(html: string): ParsedPage {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const noScriptsStyles = noComments.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

  const root = buildTree(tokenize(noScriptsStyles));
  const titleNode = findFirst(root, "title");
  const title = titleNode ? textOf(titleNode).replace(/\s+/g, " ").trim() : "";

  const bodyNode = findFirst(root, "body");
  const surfaceEls = collectDataSurfaceElements(root);

  const doc: DomDoc = {
    body: bodyNode ? wrapEl(bodyNode) : null,
    querySelectorAll(selectors: string): Iterable<DomEl> {
      if (selectors !== SUPPORTED_SELECTOR) {
        throw new Error(
          `grain-mcp harvest: unsupported selector ${JSON.stringify(selectors)} — this adapter only ` +
          `supports ${JSON.stringify(SUPPORTED_SELECTOR)} (the only selector grain/ai/manifest-dom.ts ` +
          `is known to query). If manifest-dom.ts started querying something new, this adapter needs updating.`
        );
      }
      return surfaceEls.map(wrapEl);
    },
  };
  return { title, doc };
}
