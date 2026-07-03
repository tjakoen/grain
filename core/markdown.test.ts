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

test("fenced code keeps text verbatim and captures the language", () => {
  const [code] = parseMarkdown("```ts\nconst x = 1 < 2;\n```");
  expect(code.type).toBe("code");
  if (code.type === "code") {
    expect(code.lang).toBe("ts");
    expect(code.value).toBe("const x = 1 < 2;");
  }
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
