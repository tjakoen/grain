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
import { applyAccessibleName, parseDiagramMeta } from "./label.ts";

/**
 * Render diagram source to SVG markup, or null when it cannot (unsupported language,
 * invalid source, no browser available). A renderer NEVER throws: a diagram that will not
 * render must degrade to the ordinary code block, not take the page down with it.
 *
 * The accessible name is deliberately NOT here. It describes the picture rather than drawing
 * it, MILL owns the wrapper it lands on, and keeping it out of the port keeps it out of the
 * disk-cache key. See label.ts for the argument in full.
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

// A diagram with no accessible name is the exact defect this module exists to prevent, so it
// is refused rather than rendered, and it degrades down the path a failed render already
// takes: an ordinary code block. That refusal is deliberately visible on the PAGE. Raw mermaid
// source sitting where a picture should be is a thing nobody ships by accident, where a
// console warning alone scrolls past in a dev server and the page still looks finished.
//
// Refusing rather than throwing is the other half of the choice. MILL is a live server, not a
// batch compiler, and an author halfway through writing a fence has to be able to load the
// page they are editing. Taking the route down would also break the subsystem's one standing
// promise, that a diagram which will not render must never take the page with it.
const refuse = (lang: string, source: string, reason: string): void => {
  const opening = source.split("\n").map(l => l.trim()).find(Boolean) ?? "(empty)";
  console.warn(
    `[mill] a ${lang} diagram ${reason} and will render as a code block instead. ` +
    'Add label="…" to the fence, saying in words what the diagram shows, ' +
    "node by node, including any loop and any exit. " +
    `Diagram begins: ${opening.slice(0, 60)}`,
  );
};

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

    // Checked BEFORE the key lookup and before the render, so an unnamed diagram never costs
    // a browser launch for a picture that is going to be refused anyway.
    const { label, unknownKeys } = parseDiagramMeta(node.meta);
    if (unknownKeys.length) {
      console.warn(
        `[mill] ignoring unknown diagram fence key(s): ${unknownKeys.join(", ")}. ` +
        "The accessible name is spelled label.",
      );
    }
    if (!label) { refuse(lang, node.value, "has no accessible name"); continue; }

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

    // Re-read the label here rather than trusting the map. The lookup is keyed by language and
    // source, so two fences holding the same diagram share one entry while keeping their own
    // sentences, and a consumer that built the map itself still cannot get an unnamed figure
    // onto a page through this door.
    const { label } = parseDiagramMeta(node.meta);
    if (!label) return previous(node, ctx);

    return `<figure class="figure" data-variant="diagram">${applyAccessibleName(svg, label)}</figure>`;
  };

  return { ...adapter, blockOverrides: { ...adapter?.blockOverrides, code } };
}
