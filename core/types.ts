// mill/core/types.ts — the MILL AST + the render-adapter PORT (the framework-agnostic seam).
// The core walks these node types and calls an adapter's handlers; it hardcodes no target.

// ---- Frontmatter ------------------------------------------------------------
// A tiny YAML-ish subset: scalars and string lists (see frontmatter.ts). Enough for
// title / type / date / tags / description; nested maps are out of scope this round.
export type FrontmatterValue = string | string[];
export type Frontmatter = Record<string, FrontmatterValue>;

// ---- Block AST --------------------------------------------------------------
// The closed set of block constructs MILL understands. `html` is the escape hatch:
// a raw block (starting with a tag) passes through untouched so authors can drop
// component tags (`<b-…>`) into Markdown and let the host framework compose them.
export type MillNode =
  | { type: "heading"; level: number; children: InlineNode[] }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }
  | { type: "code"; lang: string; value: string }
  | { type: "blockquote"; children: InlineNode[] }
  | { type: "image"; src: string; alt: string }
  | { type: "thematicBreak" }
  | { type: "html"; value: string };

// ---- Inline AST -------------------------------------------------------------
// Emphasis is asterisk-only (`*`/`**`) — underscore emphasis is deliberately dropped
// so snake_case in technical prose never turns into stray <em> (see markdown.ts).
export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "codeSpan"; value: string }
  | { type: "link"; href: string; children: InlineNode[] }
  | { type: "image"; src: string; alt: string };

// ---- The render adapter (the port) ------------------------------------------
// An adapter is a total node→output map plus a layout lookup. Every node type has a
// handler (a missing type is a compile error in every adapter — drift protection),
// so a non-GRAIN adapter (React / Vue / plain HTML) is a matter of supplying the map.
// Handlers receive a RenderContext that lets them recurse (renderInline / renderBlocks)
// without knowing the core's internals — the mdast→hast handler pattern.
export interface RenderContext {
  /** render an array of inline nodes to output */
  renderInline(nodes: InlineNode[]): string;
  /** render an array of block nodes to output */
  renderBlocks(nodes: MillNode[]): string;
  /** escape raw text for the target (adapter-supplied; defaults to HTML escaping) */
  escape(text: string): string;
  /** resolve an internal link/asset href (e.g. `note:slug`) to a URL */
  resolveLink(href: string): string;
}

type NodeOfType<T extends MillNode["type"]> = Extract<MillNode, { type: T }>;
type InlineOfType<T extends InlineNode["type"]> = Extract<InlineNode, { type: T }>;

export type BlockHandler<T extends MillNode["type"]> = (node: NodeOfType<T>, ctx: RenderContext) => string;
export type InlineHandler<T extends InlineNode["type"]> = (node: InlineOfType<T>, ctx: RenderContext) => string;

// Total maps: one handler per node type. Adding a node type breaks every adapter that
// doesn't handle it — the exhaustiveness that keeps adapters honest.
export type BlockHandlers = { [T in MillNode["type"]]: BlockHandler<T> };
export type InlineHandlers = { [T in InlineNode["type"]]: InlineHandler<T> };

// The document → layout mapping: `type` (from frontmatter) selects a layout; the
// rendered body + frontmatter become its inputs. `ctx` is provided so a layout can
// render inline content of its own (e.g. a title) through the same handlers.
export interface LayoutInput {
  type: string;
  title: string;
  frontmatter: Frontmatter;
  body: string;
  ctx: RenderContext;
}
export type LayoutFn = (input: LayoutInput) => string;

export interface RenderAdapter {
  block: BlockHandlers;
  inline: InlineHandlers;
  layout: LayoutFn;
  /** optional: escape text for the target (default = HTML escape) */
  escape?: (text: string) => string;
  /** optional: resolve internal links (default = identity) */
  resolveLink?: (href: string) => string;
}

// The engine's output: the rendered document plus the parsed pieces a consumer needs
// (frontmatter for meta/OG/JSON-LD, ast for a table-of-contents / RAG chunking, etc.).
export interface RenderResult {
  html: string;
  frontmatter: Frontmatter;
  ast: MillNode[];
  title: string;
  type: string;
}
