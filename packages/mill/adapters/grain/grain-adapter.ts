// mill/adapters/grain/grain-adapter.ts — the reference render adapter: emit BATCH+GRAIN.
//
// It produces FINAL semantic HTML carrying GRAIN classes (`.list`, `.badge`, `.code-block`,
// `.figure`, `.callout`) — NOT data-bound component tags. Reason: BATCH's createRenderer
// REPLACES a registered component tag's children with its own template, so emitting
// `<b-text>literal prose</b-text>` would discard the prose. Bare `<p>/<h*>/<a>/<li>` are
// already styled by grain's global.css + grain.css; the three content components ship their
// own CSS. The `html` node is the escape hatch: raw `<b-…>` tags in the Markdown pass
// through untouched, and BATCH composes THOSE at request time (they ARE data-bound).
//
// This module imports nothing from grain/ or batch/ — the coupling is a name/CSS-class
// contract (strings), the cleanest possible seam. Live-route mounting + createRenderer
// wiring arrives with piece 3; this is a plain module.
//
// Grade guardrail (mill/PLAN.md): output is clean/human — never grain, never data-commit.
// The layout stamps `data-grade="smooth"` as a positive assertion; renderGrainDocument
// verifies it.
import type {
  RenderAdapter, BlockHandlers, InlineHandlers, LayoutFn, Frontmatter, RenderResult,
} from "../../core/types.ts";
import { renderDocument, escapeHtml } from "../../core/engine.ts";
import { assertHumanGrade } from "../../core/grade.ts";

const asArray = (v: Frontmatter[string] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

// internal `note:slug` → `/notes/slug`; everything else passes through. A consumer with a
// different content root overrides this via options (the slug/link-resolution open question).
function defaultResolveLink(href: string): string {
  if (href.startsWith("note:")) return "/notes/" + href.slice(5);
  return href;
}

// ---- block map (node → GRAIN tag) ------------------------------------------
const block: BlockHandlers = {
  heading: (n, ctx) => `<h${n.level}>${ctx.renderInline(n.children)}</h${n.level}>`,
  paragraph: (n, ctx) => `<p>${ctx.renderInline(n.children)}</p>`,
  list: (n, ctx) => {
    const tag = n.ordered ? "ol" : "ul";
    const variant = n.ordered ? ` data-variant="ordered"` : "";
    const items = n.items.map(it => `<li class="list__item">${ctx.renderInline(it)}</li>`).join("");
    return `<${tag} class="list"${variant}>${items}</${tag}>`;
  },
  code: (n, ctx) => {
    const lang = n.lang ? ` data-lang="${ctx.escape(n.lang)}"` : "";
    return `<pre class="code-block"${lang}><code>${ctx.escape(n.value)}</code></pre>`;
  },
  blockquote: (n, ctx) => `<blockquote class="callout">${ctx.renderInline(n.children)}</blockquote>`,
  image: (n, ctx) => {
    const cap = n.alt ? `<figcaption class="figure__caption">${ctx.escape(n.alt)}</figcaption>` : "";
    return `<figure class="figure"><img src="${ctx.escape(ctx.resolveLink(n.src))}" alt="${ctx.escape(n.alt)}">${cap}</figure>`;
  },
  thematicBreak: () => `<hr class="rule">`,
  table: (n, ctx) => {
    const cells = (row: typeof n.header, tag: "th" | "td") =>
      row.map(c => `<${tag}>${ctx.renderInline(c)}</${tag}>`).join("");
    const body = n.rows.map(r => `<tr>${cells(r, "td")}</tr>`).join("");
    return `<div class="table-scroll"><table class="table"><thead><tr>${cells(n.header, "th")}</tr></thead><tbody>${body}</tbody></table></div>`;
  },
  html: (n) => n.value,   // escape hatch: raw component tags → BATCH composes them
};

// ---- inline map ------------------------------------------------------------
const inline: InlineHandlers = {
  text: (n, ctx) => ctx.escape(n.value),
  strong: (n, ctx) => `<strong>${ctx.renderInline(n.children)}</strong>`,
  em: (n, ctx) => `<em>${ctx.renderInline(n.children)}</em>`,
  codeSpan: (n, ctx) => `<code class="code-inline">${ctx.escape(n.value)}</code>`,
  link: (n, ctx) => `<a href="${ctx.escape(ctx.resolveLink(n.href))}">${ctx.renderInline(n.children)}</a>`,
  image: (n, ctx) => `<img src="${ctx.escape(ctx.resolveLink(n.src))}" alt="${ctx.escape(n.alt)}">`,
};

// ---- layouts (document → GRAIN organism) -----------------------------------
// MILL ships a sensible default; the consumer supplies its `type → layout` registry (the
// "engine implemented by the consumer" model). Default = an editorial note masthead.
const defaultLayout: LayoutFn = ({ title, frontmatter, body }) => {
  const str = (k: string): string => typeof frontmatter[k] === "string" ? (frontmatter[k] as string) : "";
  const meta = [str("date"), str("readingTime")].filter(Boolean).map(escapeHtml).join(" · ");
  const eyebrow = meta ? `<p class="eyebrow">${meta}</p>` : "";
  const heading = title ? `<h1 class="masthead">${escapeHtml(title)}</h1>` : "";
  const lede = str("subtitle") ? `<p class="note__lede">${escapeHtml(str("subtitle"))}</p>` : "";
  const tags = asArray(frontmatter.tags);
  const badges = tags.length
    ? `<div class="note__tags">${tags.map(t => `<span class="badge" data-status="active">${escapeHtml(t)}</span>`).join(" ")}</div>`
    : "";
  const head = (eyebrow || heading || lede || badges)
    ? `<header class="note__head">${eyebrow}${heading}${lede}${badges}<hr class="rule"></header>` : "";
  // data-grade="smooth" = a positive human-grade assertion (the guardrail; only the AI grains).
  return `<article class="note" data-grade="smooth">${head}${body}</article>`;
};

export interface GrainAdapterOptions {
  /** consumer-owned `type → layout` registry (frontmatter `type` selects one) */
  layouts?: Record<string, LayoutFn>;
  /** fallback layout when `type` isn't in the registry (default = editorial note) */
  defaultLayout?: LayoutFn;
  /** override internal link/asset resolution (default = `note:slug` → `/notes/slug`) */
  resolveLink?: (href: string) => string;
  /** override individual block handlers (the consumer's block-map overrides) */
  blockOverrides?: Partial<BlockHandlers>;
  /** override individual inline handlers */
  inlineOverrides?: Partial<InlineHandlers>;
}

export function createGrainAdapter(options: GrainAdapterOptions = {}): RenderAdapter {
  const layouts = options.layouts ?? {};
  const fallback = options.defaultLayout ?? defaultLayout;
  return {
    block: { ...block, ...options.blockOverrides },
    inline: { ...inline, ...options.inlineOverrides },
    layout: (input) => (layouts[input.type] ?? fallback)(input),
    escape: escapeHtml,
    resolveLink: options.resolveLink ?? defaultResolveLink,
  };
}

// Convenience: render with the GRAIN adapter AND enforce the grade guardrail (throws if the
// output would read as AI-authored). Prefer this over renderDocument(raw, createGrainAdapter()).
export function renderGrainDocument(raw: string, options?: GrainAdapterOptions): RenderResult {
  const result = renderDocument(raw, createGrainAdapter(options));
  assertHumanGrade(result.html);
  return result;
}
