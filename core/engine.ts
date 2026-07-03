// mill/core/engine.ts — the framework-agnostic core: frontmatter → AST → node→output map
// (via the adapter) → layout wrap. It hardcodes no target; every node goes through the
// adapter's handlers, and the layout is chosen by the adapter from frontmatter `type`.
import type {
  RenderAdapter, RenderContext, RenderResult, Frontmatter, MillNode, InlineNode,
} from "./types.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { parseMarkdown, inlineText } from "./markdown.ts";

// default text escaping for HTML targets; an adapter may override via `escape`.
export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function makeContext(adapter: RenderAdapter): RenderContext {
  const escape = adapter.escape ?? escapeHtml;
  const resolveLink = adapter.resolveLink ?? ((href: string) => href);

  const ctx: RenderContext = {
    escape,
    resolveLink,
    renderInline(nodes: InlineNode[]): string {
      return nodes.map(n => {
        const handler = adapter.inline[n.type] as (node: InlineNode, c: RenderContext) => string;
        if (!handler) throw new Error(`[mill] no inline handler for "${n.type}"`);
        return handler(n, ctx);
      }).join("");
    },
    renderBlocks(nodes: MillNode[]): string {
      return nodes.map(n => {
        const handler = adapter.block[n.type] as (node: MillNode, c: RenderContext) => string;
        if (!handler) throw new Error(`[mill] no block handler for "${n.type}"`);
        return handler(n, ctx);
      }).join("");
    },
  };
  return ctx;
}

function deriveTitle(fm: Frontmatter, ast: MillNode[]): string {
  if (typeof fm.title === "string" && fm.title.trim()) return fm.title.trim();
  const h = ast.find((n): n is Extract<MillNode, { type: "heading" }> => n.type === "heading");
  return h ? inlineText(h.children) : "";
}

// Render one Markdown document through an adapter. The result carries the rendered `html`
// plus the parsed pieces a consumer needs (frontmatter for meta/OG, ast for TOC/RAG).
export function renderDocument(raw: string, adapter: RenderAdapter): RenderResult {
  const { data: frontmatter, body } = parseFrontmatter(raw);
  const ast = parseMarkdown(body);
  const ctx = makeContext(adapter);
  const bodyHtml = ctx.renderBlocks(ast);
  const title = deriveTitle(frontmatter, ast);
  const type = typeof frontmatter.type === "string" ? frontmatter.type : "";
  const html = adapter.layout({ type, title, frontmatter, body: bodyHtml, ctx });
  return { html, frontmatter, ast, title, type };
}
