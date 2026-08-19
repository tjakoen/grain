// mill/diagrams/prepare.test.ts — the diagram pre-pass and the code-override composition.
// Everything here runs against a FAKE DiagramRenderer: no browser, no mermaid, no network.
//
// Every mermaid fence below carries a label, because since 0.4.0 one without a label is
// refused rather than rendered. The refusal itself is pinned at the foot of this file.
import { test, expect } from "bun:test";
import { prepareDiagrams, withDiagrams, diagramKey, DIAGRAM_LANGS } from "./prepare.ts";
import type { DiagramRenderer } from "./prepare.ts";
import { renderGrainDocument } from "../adapters/grain/grain-adapter.ts";

const fake: DiagramRenderer = async (lang, source) => `<svg data-lang="${lang}" data-len="${source.length}"></svg>`;

const doc = (body: string) => `---\ntitle: T\n---\n\n${body}\n`;

/** The info-string tail an author writes. Kept short here; real ones narrate the whole flow. */
const L = 'label="A flows to B"';

test("finds every mermaid fence and renders each once", async () => {
  const calls: string[] = [];
  const counting: DiagramRenderer = async (lang, source) => { calls.push(source); return "<svg/>"; };

  const svgs = await prepareDiagrams(doc([
    "```mermaid " + L, "graph TD; A-->B;", "```", "",
    "```mermaid " + L, "graph TD; C-->D;", "```", "",
    "```mermaid " + L, "graph TD; A-->B;", "```",   // a repeat: rendered once, found twice
  ].join("\n")), counting);

  expect(calls).toEqual(["graph TD; A-->B;", "graph TD; C-->D;"]);
  expect(svgs.size).toBe(2);
  expect(svgs.get(diagramKey("mermaid", "graph TD; A-->B;"))).toBe("<svg/>");
});

test("ignores fences the renderer does not handle", async () => {
  const svgs = await prepareDiagrams(doc([
    "```ts", "const x = 1;", "```", "",
    "```", "no language at all", "```", "",
    "```mermaid " + L, "graph TD; A-->B;", "```",
  ].join("\n")), fake);

  expect(svgs.size).toBe(1);
  expect([...svgs.keys()]).toEqual([diagramKey("mermaid", "graph TD; A-->B;")]);
});

test("the handled language set is overridable", async () => {
  const body = doc(["```dot " + L, "digraph {}", "```"].join("\n"));

  expect((await prepareDiagrams(body, fake)).size).toBe(0);
  expect((await prepareDiagrams(body, fake, ["dot"])).size).toBe(1);
  expect(DIAGRAM_LANGS).toEqual(["mermaid"]);
});

test("a renderer that returns null or throws yields no entry, never an error", async () => {
  const body = doc(["```mermaid " + L, "not a diagram", "```"].join("\n"));

  expect((await prepareDiagrams(body, async () => null)).size).toBe(0);
  expect((await prepareDiagrams(body, async () => { throw new Error("boom"); })).size).toBe(0);
});

test("frontmatter is stripped before parsing, so its rules are not fences", async () => {
  const svgs = await prepareDiagrams(
    "---\ntitle: T\nsummary: >\n  a folded scalar\n---\n\n```mermaid " + L + "\ngraph TD; A-->B;\n```\n",
    fake,
  );
  expect(svgs.size).toBe(1);
});

// ---- withDiagrams -----------------------------------------------------------

test("a prepared diagram renders as a figure, not a code block", () => {
  const raw = doc(["```mermaid " + L, "graph TD; A-->B;", "```"].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "graph TD; A-->B;"), "<svg data-fake></svg>"]]);

  const html = renderGrainDocument(raw, withDiagrams(undefined, svgs)).html;

  expect(html).toContain(`<figure class="figure" data-variant="diagram">`);
  expect(html).toContain("<svg data-fake");
  expect(html).not.toContain(`data-lang="mermaid"`);
});

test("an unprepared fence falls back to the default code block", () => {
  const raw = doc(["```mermaid " + L, "graph TD; A-->B;", "```", "", "```ts", "const x = 1;", "```"].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "something else entirely"), "<svg/>"]]);

  const html = renderGrainDocument(raw, withDiagrams(undefined, svgs)).html;

  expect(html).toContain(`<pre class="code-block" data-lang="mermaid">`);
  expect(html).toContain(`<pre class="code-block" data-lang="ts">`);
  expect(html).not.toContain("<figure");
});

test("a consumer's own code override survives, and still wins for non-diagrams", () => {
  const raw = doc(["```mermaid " + L, "graph TD; A-->B;", "```", "", "```ts", "const x = 1;", "```"].join("\n"));
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
  const raw = doc(["```mermaid " + L, "graph TD; A-->B;", "```"].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "graph TD; A-->B;"), `<svg><g class="node"></g></svg>`]]);

  // renderGrainDocument runs assertHumanGrade internally — this throwing is the failure.
  expect(() => renderGrainDocument(raw, withDiagrams(undefined, svgs))).not.toThrow();
});

// ---- the accessible name ----------------------------------------------------

test("the wrapped figure carries role img and the author's sentence", () => {
  const label = "BATCH serves the request, GRAIN dresses it, MILL renders the Markdown";
  const raw = doc([`\`\`\`mermaid label="${label}"`, "graph TD; A-->B;", "```"].join("\n"));
  const svgs = new Map([[
    diagramKey("mermaid", "graph TD; A-->B;"),
    '<svg role="graphics-document" aria-roledescription="flowchart-v2"></svg>',
  ]]);

  const html = renderGrainDocument(raw, withDiagrams(undefined, svgs)).html;

  expect(html).toContain('role="img"');
  expect(html).toContain(`aria-label="${label}"`);
  expect(html).not.toContain("graphics-document");
  expect(html).not.toContain("aria-roledescription");
});

test("two fences sharing one diagram keep their own separate labels", () => {
  const raw = doc([
    '```mermaid label="Read as the request path"', "graph TD; A-->B;", "```", "",
    '```mermaid label="Read again as the deploy path"', "graph TD; A-->B;", "```",
  ].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "graph TD; A-->B;"), "<svg></svg>"]]);

  const html = renderGrainDocument(raw, withDiagrams(undefined, svgs)).html;

  expect(html).toContain('aria-label="Read as the request path"');
  expect(html).toContain('aria-label="Read again as the deploy path"');
});

// ---- the unlabelled fence is refused, loudly and visibly --------------------

test("an unlabelled fence is never sent to the renderer", async () => {
  const calls: string[] = [];
  const counting: DiagramRenderer = async (_lang, source) => { calls.push(source); return "<svg/>"; };

  const svgs = await prepareDiagrams(
    doc(["```mermaid", "graph TD; A-->B;", "```"].join("\n")),
    counting,
  );

  expect(calls).toEqual([]);      // no browser launched for a picture that would be refused
  expect(svgs.size).toBe(0);
});

test("an unlabelled fence renders as a visible code block, not a figure", () => {
  const raw = doc(["```mermaid", "graph TD; A-->B;", "```"].join("\n"));
  // The map holds the diagram anyway, so this pins withDiagrams' own refusal rather than
  // the pre-pass simply having skipped it.
  const svgs = new Map([[diagramKey("mermaid", "graph TD; A-->B;"), "<svg data-fake></svg>"]]);

  const html = renderGrainDocument(raw, withDiagrams(undefined, svgs)).html;

  expect(html).toContain(`<pre class="code-block" data-lang="mermaid">`);
  expect(html).toContain("graph TD; A--&gt;B;");   // the source is on the page, where it shows
  expect(html).not.toContain("<figure");
});

test("an unlabelled fence warns, naming the attribute to add", async () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.join(" ")); };
  try {
    await prepareDiagrams(doc(["```mermaid", "graph TD; A-->B;", "```"].join("\n")), fake);
  } finally {
    console.warn = original;
  }

  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('label="…"');
  expect(warnings[0]).toContain("graph TD; A-->B;");
});

test("caption is a near miss, so it is refused AND named", async () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.join(" ")); };
  try {
    await prepareDiagrams(
      doc(['```mermaid caption="the obvious thing to type"', "graph TD; A-->B;", "```"].join("\n")),
      fake,
    );
  } finally {
    console.warn = original;
  }

  expect(warnings.some(w => w.includes("caption"))).toBe(true);
  expect(warnings.some(w => w.includes("spelled label"))).toBe(true);
});

test("an unlabelled diagram never reaches a page, whatever the renderer returned", () => {
  const raw = doc(["```mermaid", "graph TD; A-->B;", "```"].join("\n"));
  const svgs = new Map([[diagramKey("mermaid", "graph TD; A-->B;"), "<svg></svg>"]]);

  const html = renderGrainDocument(raw, withDiagrams(undefined, svgs)).html;

  expect(html).not.toContain("<svg");
  expect(html).not.toContain("aria-label");
});
