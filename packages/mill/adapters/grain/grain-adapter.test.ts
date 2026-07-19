// mill/adapters/grain/grain-adapter.test.ts — the reference BATCH+GRAIN adapter.
import { test, expect } from "bun:test";
import { createGrainAdapter, renderGrainDocument } from "./grain-adapter.ts";
import { renderDocument } from "../../core/engine.ts";
import { findGrainViolation } from "../../core/grade.ts";
import type { LayoutFn } from "../../core/types.ts";

test("emits GRAIN-classed semantic HTML, not data-bound component tags", () => {
  const { html } = renderGrainDocument(`# Title\n\nA paragraph.\n\n- one\n- two`);
  expect(html).toContain("<h1");
  expect(html).toContain("<p>A paragraph.</p>");
  expect(html).toContain(`<ul class="list">`);
  expect(html).toContain(`<li class="list__item">one</li>`);
  // no data-bound atom tags that BATCH would clobber
  expect(html).not.toContain("<b-text");
  expect(html).not.toContain("<b-list");
});

test("code fence → .code-block with a language tag; text is escaped", () => {
  const { html } = renderGrainDocument("```ts\nconst x = 1 < 2 && a > b;\n```");
  expect(html).toContain(`<pre class="code-block" data-lang="ts">`);
  expect(html).toContain("1 &lt; 2 &amp;&amp; a &gt; b");
});

test("blockquote → .callout, standalone image → .figure with caption", () => {
  const q = renderGrainDocument("> remember this").html;
  expect(q).toContain(`<blockquote class="callout">remember this</blockquote>`);
  const f = renderGrainDocument("![The desk](/img/desk.png)").html;
  expect(f).toContain(`<figure class="figure">`);
  expect(f).toContain(`<img src="/img/desk.png" alt="The desk">`);
  expect(f).toContain(`<figcaption class="figure__caption">The desk</figcaption>`);
});

test("inline code → .code-inline; links resolve note:slug", () => {
  const { html } = renderGrainDocument("see `bun run check` and [notes](note:ten-times-zero)");
  expect(html).toContain(`<code class="code-inline">bun run check</code>`);
  expect(html).toContain(`<a href="/notes/ten-times-zero">notes</a>`);
});

test("frontmatter drives the note masthead: date, title, tags → badges", () => {
  const { html } = renderGrainDocument(`---\ntitle: On AI\ndate: 2026-07-03\ntags: [ai, design]\n---\nbody`);
  expect(html).toContain(`<h1 class="masthead">On AI</h1>`);
  expect(html).toContain(`<p class="eyebrow">2026-07-03</p>`);
  expect(html).toContain(`<span class="badge" data-status="active">ai</span>`);
});

test("grade guardrail: output is clean/human — never grain, never data-commit", () => {
  const { html } = renderGrainDocument(`# Human writing\n\n> a note\n\n- item`);
  expect(findGrainViolation(html)).toBeNull();
  expect(html).toContain(`data-grade="smooth"`);   // positive human-grade assertion
});

test("renderGrainDocument THROWS if a layout tries to grain the output", () => {
  const grainLayout: LayoutFn = ({ body }) => `<article data-grade="grain">${body}</article>`;
  expect(() => renderGrainDocument(`text`, { layouts: { "": grainLayout } })).toThrow(/grade guardrail/);
});

test("guardrail does NOT false-positive on grade markers inside a code sample", () => {
  // MILL renders the GRAIN docs, whose code fences document these attributes verbatim.
  const md = "Docs example:\n\n```html\n<b-badge data-commit=\"pending\" data-grade=\"grain\">x</b-badge>\n```";
  expect(() => renderGrainDocument(md)).not.toThrow();
  const { html } = renderGrainDocument(md);
  expect(html).toContain("data-commit=&quot;pending&quot;");   // escaped → inert
});

test("escape hatch: a raw component tag passes through for BATCH to compose", () => {
  const { html } = renderDocument(
    `Intro paragraph.\n\n<b-badge data-status="active">Live</b-badge>`,
    createGrainAdapter(),
  );
  expect(html).toContain(`<b-badge data-status="active">Live</b-badge>`);
});

test("hostile prose is escaped (no injection through text)", () => {
  const { html } = renderGrainDocument(`A <script>alert(1)</script> attempt`);
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
});

test("consumer type → layout registry is honoured", () => {
  const talk: LayoutFn = ({ title, body }) => `<section class="talk"><h1>${title}</h1>${body}</section>`;
  const { html } = renderGrainDocument(`---\ntype: talk\ntitle: A Talk\n---\ncontent`, { layouts: { talk } });
  expect(html).toContain(`<section class="talk">`);
  expect(html).toContain(`<h1>A Talk</h1>`);
});

test("table renders as .table inside a .table-scroll wrapper (th/td split)", () => {
  const { html } = renderGrainDocument("| a | b |\n|---|---|\n| c | d |");
  expect(html).toContain(`<div class="table-scroll"><table class="table">`);
  expect(html).toContain("<thead><tr><th>a</th><th>b</th></tr></thead>");
  expect(html).toContain("<tbody><tr><td>c</td><td>d</td></tr></tbody>");
});
