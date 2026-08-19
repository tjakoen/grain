// mill/diagrams/prepare.test.ts — the diagram pre-pass and the code-override composition.
// Everything here runs against a FAKE DiagramRenderer: no browser, no mermaid, no network.
import { test, expect } from "bun:test";
import { prepareDiagrams, withDiagrams, diagramKey, DIAGRAM_LANGS } from "./prepare.ts";
import type { DiagramRenderer } from "./prepare.ts";
import { renderGrainDocument } from "../adapters/grain/grain-adapter.ts";

const fake: DiagramRenderer = async (lang, source) => `<svg data-lang="${lang}" data-len="${source.length}"></svg>`;

const doc = (body: string) => `---\ntitle: T\n---\n\n${body}\n`;

test("finds every mermaid fence and renders each once", async () => {
  const calls: string[] = [];
  const counting: DiagramRenderer = async (lang, source) => { calls.push(source); return "<svg/>"; };

  const svgs = await prepareDiagrams(doc([
    "```mermaid", "graph TD; A-->B;", "```", "",
    "```mermaid", "graph TD; C-->D;", "```", "",
    "```mermaid", "graph TD; A-->B;", "```",       // a repeat: rendered once, found twice
  ].join("\n")), counting);

  expect(calls).toEqual(["graph TD; A-->B;", "graph TD; C-->D;"]);
  expect(svgs.size).toBe(2);
  expect(svgs.get(diagramKey("mermaid", "graph TD; A-->B;"))).toBe("<svg/>");
});

test("ignores fences the renderer does not handle", async () => {
  const svgs = await prepareDiagrams(doc([
    "```ts", "const x = 1;", "```", "",
    "```", "no language at all", "```", "",
    "```mermaid", "graph TD; A-->B;", "```",
  ].join("\n")), fake);

  expect(svgs.size).toBe(1);
  expect([...svgs.keys()]).toEqual([diagramKey("mermaid", "graph TD; A-->B;")]);
});

test("the handled language set is overridable", async () => {
  const body = doc(["```dot", "digraph {}", "```"].join("\n"));

  expect((await prepareDiagrams(body, fake)).size).toBe(0);
  expect((await prepareDiagrams(body, fake, ["dot"])).size).toBe(1);
  expect(DIAGRAM_LANGS).toEqual(["mermaid"]);
});

test("a renderer that returns null or throws yields no entry, never an error", async () => {
  const body = doc(["```mermaid", "not a diagram", "```"].join("\n"));

  expect((await prepareDiagrams(body, async () => null)).size).toBe(0);
  expect((await prepareDiagrams(body, async () => { throw new Error("boom"); })).size).toBe(0);
});

test("frontmatter is stripped before parsing, so its rules are not fences", async () => {
  const svgs = await prepareDiagrams(
    "---\ntitle: T\nsummary: >\n  a folded scalar\n---\n\n```mermaid\ngraph TD; A-->B;\n```\n",
    fake,
  );
  expect(svgs.size).toBe(1);
});

// ---- withDiagrams -----------------------------------------------------------

test("a prepared diagram renders as a figure, not a code block", () => {
  const raw = doc(["```mermaid", "graph TD; A-->B;", "```"].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "graph TD; A-->B;"), "<svg data-fake></svg>"]]);

  const html = renderGrainDocument(raw, withDiagrams(undefined, svgs)).html;

  expect(html).toContain(`<figure class="figure" data-variant="diagram"><svg data-fake></svg></figure>`);
  expect(html).not.toContain(`data-lang="mermaid"`);
});

test("an unprepared fence falls back to the default code block", () => {
  const raw = doc(["```mermaid", "graph TD; A-->B;", "```", "", "```ts", "const x = 1;", "```"].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "something else entirely"), "<svg/>"]]);

  const html = renderGrainDocument(raw, withDiagrams(undefined, svgs)).html;

  expect(html).toContain(`<pre class="code-block" data-lang="mermaid">`);
  expect(html).toContain(`<pre class="code-block" data-lang="ts">`);
  expect(html).not.toContain("<figure");
});

test("a consumer's own code override survives, and still wins for non-diagrams", () => {
  const raw = doc(["```mermaid", "graph TD; A-->B;", "```", "", "```ts", "const x = 1;", "```"].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "graph TD; A-->B;"), "<svg data-fake></svg>"]]);
  const consumer = { blockOverrides: { code: (n: { lang: string }) => `[consumer:${n.lang}]` } };

  const html = renderGrainDocument(raw, withDiagrams(consumer, svgs)).html;

  expect(html).toContain(`data-variant="diagram"`);   // the diagram is still swapped in
  expect(html).toContain("[consumer:ts]");            // the consumer keeps everything else
  expect(html).not.toContain("[consumer:mermaid]");
});

test("no prepared diagrams leaves the adapter untouched", () => {
  const consumer = { headingSurfaces: true };
  expect(withDiagrams(consumer, new Map())).toBe(consumer);
  expect(withDiagrams(consumer, undefined)).toBe(consumer);
  expect(withDiagrams(undefined, new Map())).toBeUndefined();
});

test("a rendered diagram does not trip the grade guardrail", () => {
  const raw = doc(["```mermaid", "graph TD; A-->B;", "```"].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "graph TD; A-->B;"), `<svg><g class="node"></g></svg>`]]);

  // renderGrainDocument runs assertHumanGrade internally — this throwing is the failure.
  expect(() => renderGrainDocument(raw, withDiagrams(undefined, svgs))).not.toThrow();
});
