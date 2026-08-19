// mill/diagrams/prepare.ts — the diagram PORT and the async pre-pass that feeds it.
//
// MILL's block handlers are synchronous by design (the core walks the AST and returns a
// string); diagram rendering is asynchronous (it drives a browser). The two are reconciled
// by rendering diagrams BEFORE the document render: `prepareDiagrams` parses the raw
// Markdown, finds the code blocks a renderer handles, awaits their SVG, and returns a
// lookup. `withDiagrams` then composes a synchronous `code` override that reads from it.
//
// The double parse (once here, once in renderGrainDocument) is accepted: the parser is a
// tiny hand-rolled subset and content files are small.
//
// This module is zero-dependency and never touches a browser — the heavy renderer lives
// behind the DiagramRenderer port in mermaid-playwright.ts, so a consumer that supplies no
// renderer pays nothing and MILL's core stays dependency-free.
import type { BlockHandlers } from "../core/types.ts";
import { parseFrontmatter } from "../core/frontmatter.ts";
import { parseMarkdown } from "../core/markdown.ts";
import { grainCodeBlock, type GrainAdapterOptions } from "../adapters/grain/grain-adapter.ts";

/**
 * Render diagram source to SVG markup, or null when it cannot (unsupported language,
 * invalid source, no browser available). A renderer NEVER throws: a diagram that will not
 * render must degrade to the ordinary code block, not take the page down with it.
 */
export type DiagramRenderer = (lang: string, source: string) => Promise<string | null>;

/** The fence languages treated as diagrams by default. */
export const DIAGRAM_LANGS: readonly string[] = ["mermaid"];

/**
 * The lookup key for a prepared diagram. Qualified by language as well as source so two
 * blocks that happen to share text across languages cannot collide — a `ts` block whose
 * body matched a mermaid block would otherwise render as that diagram.
 */
export const diagramKey = (lang: string, source: string): string => `${lang.toLowerCase()}\0${source}`;

/**
 * Parse raw Markdown, collect the code blocks whose language the renderer handles, and
 * await their SVG. Returns a key → SVG lookup holding only the diagrams that rendered;
 * a failure is simply absent, and the caller falls back to a code block.
 *
 * Renders run sequentially on purpose: the mermaid renderer drives a single browser page,
 * and concurrent evaluations on one page interleave. Content files hold a handful of
 * diagrams, so the ordering costs nothing worth reclaiming.
 */
export async function prepareDiagrams(
  raw: string,
  render: DiagramRenderer,
  langs: readonly string[] = DIAGRAM_LANGS,
): Promise<Map<string, string>> {
  const handled = new Set(langs.map(l => l.toLowerCase()));
  const svgs = new Map<string, string>();

  const nodes = parseMarkdown(parseFrontmatter(raw).body);
  for (const node of nodes) {
    if (node.type !== "code") continue;
    const lang = node.lang.toLowerCase();
    if (!handled.has(lang)) continue;

    const key = diagramKey(lang, node.value);
    if (svgs.has(key)) continue;                  // the same diagram twice renders once

    let svg: string | null = null;
    try {
      svg = await render(lang, node.value);
    } catch {
      svg = null;                                 // a throwing renderer is still a fallback
    }
    if (svg) svgs.set(key, svg);
  }

  return svgs;
}

/**
 * Compose a `code` block override that swaps a prepared diagram in for its fence. Anything
 * without a prepared SVG — a different language, a diagram that failed — delegates to the
 * consumer's own `code` override if it has one, and otherwise to the GRAIN default. That
 * ordering matters: wrapping must not silently discard a consumer's code handler.
 *
 * The SVG is spliced in unescaped, which is what makes it a figure rather than a listing.
 * It is safe because the renderer is the only source of it and mermaid runs with its strict
 * security level; a renderer that returns untrusted markup would be the thing to fix.
 */
export function withDiagrams(
  adapter: GrainAdapterOptions | undefined,
  svgs: Map<string, string> | undefined,
): GrainAdapterOptions | undefined {
  if (!svgs || svgs.size === 0) return adapter;

  const previous = adapter?.blockOverrides?.code ?? grainCodeBlock;
  const code: BlockHandlers["code"] = (node, ctx) => {
    const svg = svgs.get(diagramKey(node.lang, node.value));
    if (!svg) return previous(node, ctx);
    return `<figure class="figure" data-variant="diagram">${svg}</figure>`;
  };

  return { ...adapter, blockOverrides: { ...adapter?.blockOverrides, code } };
}
