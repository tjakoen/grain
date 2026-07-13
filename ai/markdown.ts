// grain/ai/markdown.ts — a SMALL, SELF-CONTAINED, sanitizing markdown renderer for AI chat text.
//
// The dispatcher streams assistant text as `textContent` while it's in flight (safe by
// construction — no HTML can be injected mid-stream, scripts/ai-dispatch.js's `applyType`). Once a
// message SETTLES, the dispatcher re-renders that same accumulated plain text through THIS
// renderer so `**bold**`, `` `code` ``, and links read as formatting instead of literal asterisks —
// without ever setting innerHTML from unsanitized text. It works by escaping every character
// FIRST, then building ONLY the tags on its allowlist around the escaped text — so raw
// `<script>` or any other HTML present in the source text is always inert: the only markup that
// can ever appear in the output is markup THIS function wrote.
//
// Allowlist: *em*/_em_, **strong**, `code`, [text](/relative-path) (same-origin only — the exact
// `isSafeNavigateHref` rule contract.ts's `navigate` op uses; an unsafe href renders as plain
// text, never becomes a link), simple "- "/"* " lists, and paragraphs. Nothing else. No external
// dependency — grain ships no runtime deps (CLAUDE.md).
//
// scripts/ai-dispatch.js carries an INTENTIONAL, near-identical copy of this renderer (browser-
// native, no cross-module import of ai/*.ts into the "ONE accepted bit of client JS" — see that
// file's header) — markdown.test.ts drift-guards the two copies' regex rules against each other so
// they can't silently diverge (CLAUDE.md lesson #5). This module is the canonical, unit-tested,
// importable-by-any-consumer form — "exposed from the kit" via reasoner-kit.ts's re-export.

import { isSafeNavigateHref } from "./contract.ts";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Inline rules, applied IN ORDER to an already-escaped line: code spans first (so em/strong never
// look inside a code span), then links, then strong (**) before em (*) so "**x**" isn't read as
// two adjacent em's.
const CODE_RE = /`([^`]+)`/g;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const STRONG_RE = /\*\*([^*]+)\*\*/g;
const EM_RE = /(?:\*([^*]+)\*|_([^_]+)_)/g;
const LIST_ITEM_RE = /^[-*]\s+/;
const BLOCK_SPLIT_RE = /\n{2,}/;
// Placeholder delimiter for pulled-out code spans (below) — \x00 can't occur in real chat text
// (it was already esc()'d as ordinary text upstream), so it never collides.
const CODE_PLACEHOLDER_RE = /\x00(\d+)\x00/g;

function inline(escaped: string): string {
  // Code spans are pulled OUT first and swapped for a \x00-delimited placeholder, so their literal
  // contents (which may themselves contain *, _, [, ], (, )) can never be re-interpreted by the
  // rules below — they're spliced back in verbatim at the very end, untouched by strong/em/links.
  const codeSpans: string[] = [];
  let out = escaped.replace(CODE_RE, (_m, code) => {
    codeSpans.push(`<code>${code}</code>`);
    return `\x00${codeSpans.length - 1}\x00`;
  });
  out = out.replace(LINK_RE, (_m, text, href) => (isSafeNavigateHref(href) ? `<a href="${href}">${text}</a>` : text));
  out = out.replace(STRONG_RE, (_m, t) => `<strong>${t}</strong>`);
  out = out.replace(EM_RE, (_m, a, b) => `<em>${a ?? b}</em>`);
  out = out.replace(CODE_PLACEHOLDER_RE, (_m, i) => codeSpans[Number(i)]);
  return out;
}

/** Render plain assistant text as sanitized HTML: paragraphs + simple "- "/"* " lists, with
 *  inline emphasis/code/links inside each line. Deterministic, pure, no DOM — the caller (the
 *  dispatcher) owns writing the result into the page. */
export function renderMarkdown(text: string): string {
  const blocks = text.split(BLOCK_SPLIT_RE);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (!lines.length) continue;
    if (lines.every((l) => LIST_ITEM_RE.test(l))) {
      const items = lines.map((l) => `<li>${inline(esc(l.replace(LIST_ITEM_RE, "")))}</li>`).join("");
      out.push(`<ul>${items}</ul>`);
    } else {
      out.push(`<p>${lines.map((l) => inline(esc(l))).join("<br>")}</p>`);
    }
  }
  return out.join("");
}
