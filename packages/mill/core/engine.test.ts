// mill/core/engine.test.ts — the framework-agnostic engine, driven by a FAKE adapter.
// Proves the core hardcodes no target: a trivial adapter fully controls the output.
import { test, expect } from "bun:test";
import { renderDocument } from "./engine.ts";
import type { RenderAdapter, BlockHandlers, InlineHandlers } from "./types.ts";

// A minimal non-GRAIN adapter (bracket notation) — if the core leaked GRAIN, this would fail.
const block: BlockHandlers = {
  heading: (n, ctx) => `[h${n.level}:${ctx.renderInline(n.children)}]`,
  paragraph: (n, ctx) => `[p:${ctx.renderInline(n.children)}]`,
  list: (n, ctx) => `[list:${n.items.map(i => ctx.renderInline(i)).join(",")}]`,
  code: (n) => `[code:${n.value}]`,
  blockquote: (n, ctx) => `[quote:${ctx.renderInline(n.children)}]`,
  image: (n) => `[img:${n.src}]`,
  thematicBreak: () => `[hr]`,
  table: (n, ctx) => `[table:${[n.header, ...n.rows].map(r => r.map(c => ctx.renderInline(c)).join("|")).join(";")}]`,
  html: (n) => `[html:${n.value}]`,
};
const inline: InlineHandlers = {
  text: (n) => n.value,
  strong: (n, ctx) => `*${ctx.renderInline(n.children)}*`,
  em: (n, ctx) => `_${ctx.renderInline(n.children)}_`,
  codeSpan: (n) => `\`${n.value}\``,
  link: (n, ctx) => `${ctx.renderInline(n.children)}(${n.href})`,
  image: (n) => `!${n.src}`,
};
const fake: RenderAdapter = {
  block, inline,
  layout: ({ type, title, body }) => `<${type || "doc"} title="${title}">${body}</${type || "doc"}>`,
};

test("frontmatter → layout, body → node handlers", () => {
  const { html, type, title, frontmatter } = renderDocument(
    `---\ntype: note\ntitle: Hi\n---\n# Head\n\nsome **text**`, fake,
  );
  expect(type).toBe("note");
  expect(title).toBe("Hi");
  expect(frontmatter.type).toBe("note");
  expect(html).toBe(`<note title="Hi">[h1:Head][p:some *text*]</note>`);
});

test("title falls back to the first heading when frontmatter has none", () => {
  const { title } = renderDocument(`# The First Heading\n\nbody`, fake);
  expect(title).toBe("The First Heading");
});

test("a heading-derived title is dropped from the rendered body (no duplicate title)", () => {
  const { title, html, ast } = renderDocument(`# Only Heading\n\nbody`, fake);
  expect(title).toBe("Only Heading");
  expect(html).toBe(`<doc title="Only Heading">[p:body]</doc>`);   // heading not re-rendered
  expect(ast.map(n => n.type)).toEqual(["heading", "paragraph"]);  // …but the ast stays whole
});

test("a frontmatter title leaves the body H1 in place", () => {
  const { html } = renderDocument(`---\ntitle: Set\n---\n# Head\n\nbody`, fake);
  expect(html).toBe(`<doc title="Set">[h1:Head][p:body]</doc>`);
});

test("the ast is returned for downstream use (TOC / RAG)", () => {
  const { ast } = renderDocument(`# A\n\n- one\n- two`, fake);
  expect(ast.map(n => n.type)).toEqual(["heading", "list"]);
});

test("bracket-notation adapter proves no GRAIN is baked into the core", () => {
  const { html } = renderDocument(`> a quote`, fake);
  expect(html).toBe(`<doc title="">[quote:a quote]</doc>`);
});
