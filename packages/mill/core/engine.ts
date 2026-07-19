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

// Derive the masthead title. `headingIndex` is the ast index of the heading the title was
// taken from (or -1 when the title came from frontmatter / no heading exists), so the caller
// can drop that node from the rendered body and avoid showing the title twice.
function deriveTitle(fm: Frontmatter, ast: MillNode[]): { title: string; headingIndex: number } {
  if (typeof fm.title === "string" && fm.title.trim()) return { title: fm.title.trim(), headingIndex: -1 };
  const headingIndex = ast.findIndex(n => n.type === "heading");
  if (headingIndex === -1) return { title: "", headingIndex: -1 };
  const h = ast[headingIndex] as Extract<MillNode, { type: "heading" }>;
  return { title: inlineText(h.children), headingIndex };
}

// Render one Markdown document through an adapter. The result carries the rendered `html`
// plus the parsed pieces a consumer needs (frontmatter for meta/OG, ast for TOC/RAG).
export function renderDocument(raw: string, adapter: RenderAdapter): RenderResult {
  const { data: frontmatter, body } = parseFrontmatter(raw);
  const ast = parseMarkdown(body);
  const ctx = makeContext(adapter);
  const { title, headingIndex } = deriveTitle(frontmatter, ast);
  // When the title was lifted from the first heading, keep it out of the rendered body so the
  // masthead + body don't repeat it. The returned `ast` stays whole (TOC / RAG consumers).
  const bodyAst = headingIndex >= 0 ? ast.filter((_, i) => i !== headingIndex) : ast;
  const bodyHtml = ctx.renderBlocks(bodyAst);
  const type = typeof frontmatter.type === "string" ? frontmatter.type : "";
  const html = adapter.layout({ type, title, frontmatter, body: bodyHtml, ctx });
  return { html, frontmatter, ast, title, type };
}
