// mill/core/markdown.ts — a tiny hand-rolled Markdown parser (blocks + inline) → MillNode[].
// Zero runtime deps by design (batch's bar; catalog.ts already hand-rolls a line parser). It
// is a documented SUBSET, not CommonMark: headings, paragraphs, ordered/unordered lists,
// fenced code, blockquotes, standalone images, thematic breaks, and a raw-HTML/component
// passthrough (the escape hatch). Inline: **strong**, *em*, `code`, [link](url), ![img](url).
import type { MillNode, InlineNode } from "./types.ts";

// ---- block-level line shapes ------------------------------------------------
const HR         = /^ {0,3}([-*_])(?: *\1){2,} *$/;      // ---, ***, ___ (3+)
const HEADING    = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;   // # … ###### (trailing # stripped)
const FENCE      = /^ {0,3}(```+|~~~+)\s*([^\s`~]*)\s*$/;// ``` or ~~~ with optional lang
const LIST_ITEM  = /^\s*([-*+]|\d+[.)])\s+(.*)$/;        // -, *, +, or 1. / 1)
const BLOCKQUOTE = /^ {0,3}> ?(.*)$/;
const HTML_LINE  = /^ {0,3}</;                           // a line that opens a tag → passthrough
const IMAGE_ONLY = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;       // a paragraph that is only an image

const startsBlock = (line: string) =>
  HR.test(line) || HEADING.test(line) || FENCE.test(line) ||
  BLOCKQUOTE.test(line) || LIST_ITEM.test(line) || HTML_LINE.test(line);

export function parseMarkdown(md: string): MillNode[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const nodes: MillNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }

    // fenced code — collect verbatim until the closing fence of the same kind
    const fence = line.match(FENCE);
    if (fence) {
      const close = fence[1][0] === "`" ? /^ {0,3}```+\s*$/ : /^ {0,3}~~~+\s*$/;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;                                              // consume the closing fence (if present)
      nodes.push({ type: "code", lang: fence[2] ?? "", value: buf.join("\n") });
      continue;
    }

    if (HR.test(line)) { nodes.push({ type: "thematicBreak" }); i++; continue; }

    const heading = line.match(HEADING);
    if (heading) {
      nodes.push({ type: "heading", level: heading[1].length, children: parseInline(heading[2]) });
      i++; continue;
    }

    // blockquote — gather consecutive `>` lines into one aside
    if (BLOCKQUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && BLOCKQUOTE.test(lines[i])) { buf.push(lines[i].match(BLOCKQUOTE)![1]); i++; }
      nodes.push({ type: "blockquote", children: parseInline(buf.join(" ").trim()) });
      continue;
    }

    // list — gather consecutive items sharing ordered-ness
    const li = line.match(LIST_ITEM);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const m = lines[i].match(LIST_ITEM);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        items.push(parseInline(m[2]));
        i++;
      }
      nodes.push({ type: "list", ordered, items });
      continue;
    }

    // raw HTML / component passthrough (the escape hatch) — until a blank line
    if (HTML_LINE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") { buf.push(lines[i]); i++; }
      nodes.push({ type: "html", value: buf.join("\n") });
      continue;
    }

    // paragraph — soft-wrapped lines joined with a space, until a blank line or a new block
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) { buf.push(lines[i]); i++; }
    const text = buf.join(" ").trim();
    const img = text.match(IMAGE_ONLY);
    if (img) nodes.push({ type: "image", alt: img[1], src: img[2] });
    else nodes.push({ type: "paragraph", children: parseInline(text) });
  }

  return nodes;
}

// ---- inline ----------------------------------------------------------------
// Leftmost match wins; strong is listed before em so `**x**` beats `*x*`. Emphasis is
// asterisk-only (underscore dropped → snake_case is safe). Link/strong/em recurse; code
// spans and images do not. Escaping is the adapter's job (at render), not the parser's.
const INLINE_RE =
  /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([\s\S]+?)\*\*|\*([^*\n]+?)\*/;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = text;
  let m: RegExpMatchArray | null;

  while ((m = rest.match(INLINE_RE)) !== null) {
    const idx = m.index ?? 0;
    if (idx > 0) nodes.push({ type: "text", value: rest.slice(0, idx) });

    if (m[2] !== undefined)      nodes.push({ type: "image", alt: m[1] ?? "", src: m[2] });
    else if (m[4] !== undefined) nodes.push({ type: "link", href: m[4], children: parseInline(m[3]) });
    else if (m[5] !== undefined) nodes.push({ type: "codeSpan", value: m[5] });
    else if (m[6] !== undefined) nodes.push({ type: "strong", children: parseInline(m[6]) });
    else if (m[7] !== undefined) nodes.push({ type: "em", children: parseInline(m[7]) });

    rest = rest.slice(idx + m[0].length);
  }
  if (rest) nodes.push({ type: "text", value: rest });
  return nodes;
}

// Flatten inline nodes to plain text (for titles, slugs, RAG chunking).
export function inlineText(nodes: InlineNode[]): string {
  return nodes.map(n => {
    switch (n.type) {
      case "text":     return n.value;
      case "codeSpan": return n.value;
      case "image":    return n.alt;
      default:         return inlineText(n.children);
    }
  }).join("");
}
