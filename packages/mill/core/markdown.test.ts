// mill/core/markdown.test.ts — the hand-rolled block + inline parser.
import { test, expect } from "bun:test";
import { parseMarkdown, parseInline, inlineText } from "./markdown.ts";

test("headings carry level and inline children", () => {
  const [h] = parseMarkdown("## A *title*");
  expect(h.type).toBe("heading");
  if (h.type === "heading") {
    expect(h.level).toBe(2);
    expect(inlineText(h.children)).toBe("A title");
  }
});

test("soft-wrapped paragraph lines join with a space", () => {
  const [p] = parseMarkdown("one\ntwo\nthree");
  expect(p.type).toBe("paragraph");
  if (p.type === "paragraph") expect(inlineText(p.children)).toBe("one two three");
});

test("unordered vs ordered lists", () => {
  const [ul] = parseMarkdown("- a\n- b");
  const [ol] = parseMarkdown("1. a\n2. b");
  expect(ul.type).toBe("list");
  expect(ol.type).toBe("list");
  if (ul.type === "list") { expect(ul.ordered).toBe(false); expect(ul.items).toHaveLength(2); }
  if (ol.type === "list") { expect(ol.ordered).toBe(true); expect(ol.items).toHaveLength(2); }
});

test("a soft-wrapped list item keeps its continuation line", () => {
  const nodes = parseMarkdown("- **Scope cap** — the area a run may touch. Growth past it is an ask-trigger, not\n  a judgment call the run makes alone.");
  expect(nodes.map(n => n.type)).toEqual(["list"]);
  if (nodes[0].type === "list") {
    expect(nodes[0].items).toHaveLength(1);
    expect(inlineText(nodes[0].items[0]))
      .toBe("Scope cap — the area a run may touch. Growth past it is an ask-trigger, not a judgment call the run makes alone.");
  }
});

test("a continuation line stops at the next item", () => {
  const [list] = parseMarkdown("- one\n  wrapped\n- two");
  expect(list.type).toBe("list");
  if (list.type === "list") {
    expect(list.items).toHaveLength(2);
    expect(inlineText(list.items[0])).toBe("one wrapped");
    expect(inlineText(list.items[1])).toBe("two");
  }
});

test("a continuation line stops at a blank line", () => {
  const nodes = parseMarkdown("- one\n  wrapped\n\nprose after");
  expect(nodes.map(n => n.type)).toEqual(["list", "paragraph"]);
  if (nodes[0].type === "list") expect(inlineText(nodes[0].items[0])).toBe("one wrapped");
  if (nodes[1].type === "paragraph") expect(inlineText(nodes[1].children)).toBe("prose after");
});

test("a nested list stays flat — the subset does not nest, and does not half-nest", () => {
  const [list] = parseMarkdown("- one\n  - inner\n- two");
  expect(list.type).toBe("list");
  if (list.type === "list") {
    expect(list.items).toHaveLength(3);
    expect(list.items.map(inlineText)).toEqual(["one", "inner", "two"]);
  }
});

test("fenced code keeps text verbatim and captures the language", () => {
  const [code] = parseMarkdown("```ts\nconst x = 1 < 2;\n```");
  expect(code.type).toBe("code");
  if (code.type === "code") {
    expect(code.lang).toBe("ts");
    expect(code.value).toBe("const x = 1 < 2;");
  }
});

test("a fence with no tail carries no meta at all", () => {
  const [code] = parseMarkdown("```ts\nconst x = 1;\n```");
  expect(code.type).toBe("code");
  if (code.type === "code") expect(code.meta).toBeUndefined();
});

test("a fence tail is captured as meta, leaving the language alone", () => {
  const [code] = parseMarkdown('```mermaid label="A flows to B"\ngraph TD; A-->B;\n```');
  expect(code.type).toBe("code");
  if (code.type === "code") {
    expect(code.lang).toBe("mermaid");
    expect(code.meta).toBe('label="A flows to B"');
    expect(code.value).toBe("graph TD; A-->B;");
  }
});

// The first word of an info string is the language, always, so a tail cannot be written
// without one. That is inherent rather than a bug: there is nothing in the text to tell the
// two cases apart, and a diagram fence names its language anyway.
test("the first word of an info string is the language, even when it looks like a tail", () => {
  const [code] = parseMarkdown('``` label="x"\nbody\n```');
  expect(code.type).toBe("code");
  if (code.type === "code") expect(code.lang).toBe('label="x"');
});

// Before the tail was captured, the $-anchored fence pattern meant ANY text after the language
// stopped the line being a fence, and the body leaked out as prose. This is that regression.
test("a fence with a tail still opens a fence, so its body never leaks into prose", () => {
  const nodes = parseMarkdown('```mermaid label="A flows to B"\n# not a heading\n```');
  expect(nodes).toHaveLength(1);
  expect(nodes[0].type).toBe("code");
});

test("a strikethrough line is not mistaken for a fence", () => {
  const nodes = parseMarkdown("~~~word~~~");
  expect(nodes[0].type).toBe("paragraph");
});

test("markdown inside a code fence is NOT parsed", () => {
  const [code] = parseMarkdown("```\n# not a heading\n- not a list\n```");
  expect(code.type).toBe("code");
  if (code.type === "code") expect(code.value).toBe("# not a heading\n- not a list");
});

test("blockquote gathers consecutive lines", () => {
  const [q] = parseMarkdown("> one\n> two");
  expect(q.type).toBe("blockquote");
  if (q.type === "blockquote") expect(inlineText(q.children)).toBe("one two");
});

test("a standalone image is a block image (→ figure)", () => {
  const [img] = parseMarkdown("![alt text](/a.png)");
  expect(img.type).toBe("image");
  if (img.type === "image") { expect(img.alt).toBe("alt text"); expect(img.src).toBe("/a.png"); }
});

test("thematic break", () => {
  const [hr] = parseMarkdown("---");
  expect(hr.type).toBe("thematicBreak");
});

test("a line opening a tag is raw HTML passthrough (escape hatch)", () => {
  const [html] = parseMarkdown("<b-badge data-status=\"active\">Live</b-badge>");
  expect(html.type).toBe("html");
  if (html.type === "html") expect(html.value).toBe('<b-badge data-status="active">Live</b-badge>');
});

test("inline: strong beats em, code, link, image", () => {
  const nodes = parseInline("**bold** and *em* and `x` and [t](/u) and ![a](/i)");
  const types = nodes.map(n => n.type);
  expect(types).toContain("strong");
  expect(types).toContain("em");
  expect(types).toContain("codeSpan");
  expect(types).toContain("link");
  expect(types).toContain("image");
});

test("underscores are NOT emphasis (snake_case is safe)", () => {
  const nodes = parseInline("call some_long_name here");
  expect(nodes).toHaveLength(1);
  expect(nodes[0].type).toBe("text");
});

test("link children are parsed recursively", () => {
  const nodes = parseInline("[a **bold** link](/u)");
  expect(nodes[0].type).toBe("link");
  if (nodes[0].type === "link") {
    expect(nodes[0].href).toBe("/u");
    expect(nodes[0].children.some(c => c.type === "strong")).toBe(true);
  }
});

test("table: header + separator + rows → a table node", () => {
  const nodes = parseMarkdown("| You change… | …also update |\n|---|---|\n| a verb | `contract.ts` |\n| a surface | tests |");
  expect(nodes).toHaveLength(1);
  expect(nodes[0].type).toBe("table");
  if (nodes[0].type === "table") {
    expect(nodes[0].header).toHaveLength(2);
    expect(nodes[0].rows).toHaveLength(2);
    expect(nodes[0].rows[0][1][0].type).toBe("codeSpan");
  }
});

test("table: a pipe-led line with NO separator stays a paragraph (no stall)", () => {
  const nodes = parseMarkdown("| just a stray pipe line\nmore prose");
  expect(nodes.map(n => n.type)).toEqual(["paragraph"]);
});

test("table ends a paragraph (a new block starts)", () => {
  const nodes = parseMarkdown("prose before\n| h |\n|---|\n| c |");
  expect(nodes.map(n => n.type)).toEqual(["paragraph", "table"]);
});
