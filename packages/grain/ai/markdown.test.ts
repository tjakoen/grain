// grain/ai/markdown.test.ts — the settle-time sanitizing markdown renderer. Pins the allowlist
// (emphasis/code/links/lists/paragraphs) AND the security properties that make it safe to feed
// unsanitized AI/user text through: raw HTML is always inert, an unsafe href never becomes a link.
import { test, expect } from "bun:test";
import { renderMarkdown } from "./markdown.ts";

test("strong and em render", () => {
  expect(renderMarkdown("hello **world**")).toContain("<strong>world</strong>");
  expect(renderMarkdown("hello *world*")).toContain("<em>world</em>");
  expect(renderMarkdown("hello _world_")).toContain("<em>world</em>");
});

test("inline code renders", () => {
  expect(renderMarkdown("run `bun test`")).toContain("<code>bun test</code>");
});

test("a same-origin relative link renders as an anchor", () => {
  const html = renderMarkdown("see [the docs](/grain/docs/ai-interface)");
  expect(html).toContain('<a href="/grain/docs/ai-interface">the docs</a>');
});

test("an unsafe href (javascript:) does NOT become an anchor — text survives, href is dropped", () => {
  const html = renderMarkdown("click [here](javascript:alert(1))");
  expect(html).not.toContain("<a ");
  expect(html).not.toContain("javascript:");
  expect(html).toContain("here");
});

test("an external href does NOT become an anchor", () => {
  const html = renderMarkdown("go [away](https://evil.example/steal)");
  expect(html).not.toContain("<a ");
  expect(html).not.toContain("evil.example");
});

test("a protocol-relative href does NOT become an anchor", () => {
  const html = renderMarkdown("[x](//evil.example)");
  expect(html).not.toContain("<a ");
});

test("raw <script>/HTML in the source text is INERT — escaped, never re-parsed as markup", () => {
  const html = renderMarkdown('<script>alert(1)</script> and <img src=x onerror=alert(1)>');
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img");
});

test("a simple list renders as <ul><li>", () => {
  const html = renderMarkdown("- one\n- two\n- three");
  expect(html).toBe("<ul><li>one</li><li>two</li><li>three</li></ul>");
});

test("a bare paragraph wraps in <p>, multiple paragraphs are separate blocks", () => {
  const html = renderMarkdown("first paragraph\n\nsecond paragraph");
  expect(html).toBe("<p>first paragraph</p><p>second paragraph</p>");
});

test("single newlines within a paragraph become <br>, not separate paragraphs", () => {
  expect(renderMarkdown("line one\nline two")).toBe("<p>line one<br>line two</p>");
});

test("code spans are not further mangled by em/strong inside them", () => {
  expect(renderMarkdown("`*not em*`")).toBe("<p><code>*not em*</code></p>");
});

test("empty input renders nothing", () => {
  expect(renderMarkdown("")).toBe("");
});
