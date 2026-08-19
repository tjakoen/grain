// mill/diagrams/label.test.ts — the accessible name: where it is read from, and what it does
// to the SVG root. The rule being pinned is FIGURES: role="img" plus an aria-label that
// narrates the flow in words, because the label is the accessible figure.
import { describe, expect, test } from "bun:test";
import { applyAccessibleName, parseDiagramMeta } from "./label.ts";

// A stand-in for what mermaid actually hands back: a graphics-document role and a machine
// string for a role description, and no accessible name anywhere.
const MERMAID_ROOT =
  '<svg id="mill-d-abc123" width="200" height="100" role="graphics-document" ' +
  'aria-roledescription="flowchart-v2" viewBox="0 0 200 100"><g></g></svg>';

describe("parseDiagramMeta", () => {
  test("reads a double-quoted label", () => {
    expect(parseDiagramMeta('label="Request in, page out"').label).toBe("Request in, page out");
  });

  test("reads a single-quoted label, so a sentence may hold an apostrophe", () => {
    expect(parseDiagramMeta("label='MILL’s renderer runs first'").label)
      .toBe("MILL’s renderer runs first");
  });

  test("an absent tail is no label", () => {
    expect(parseDiagramMeta(undefined).label).toBeNull();
    expect(parseDiagramMeta("").label).toBeNull();
  });

  test("an empty or whitespace label counts as no label", () => {
    expect(parseDiagramMeta('label=""').label).toBeNull();
    expect(parseDiagramMeta('label="   "').label).toBeNull();
  });

  test("an unknown key is reported rather than silently swallowed", () => {
    const meta = parseDiagramMeta('caption="the obvious thing to type"');
    expect(meta.label).toBeNull();
    expect(meta.unknownKeys).toEqual(["caption"]);
  });

  test("a known label alongside an unknown key still counts, and still reports", () => {
    const meta = parseDiagramMeta('title="x" label="A then B"');
    expect(meta.label).toBe("A then B");
    expect(meta.unknownKeys).toEqual(["title"]);
  });
});

describe("applyAccessibleName", () => {
  test("sets role img and the author's sentence as the accessible name", () => {
    const out = applyAccessibleName(MERMAID_ROOT, "BATCH serves it, GRAIN dresses it");
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="BATCH serves it, GRAIN dresses it"');
  });

  test("drops the graphics-document role rather than leaving two", () => {
    const out = applyAccessibleName(MERMAID_ROOT, "A to B");
    expect(out).not.toContain("graphics-document");
    expect(out.match(/role=/g)).toHaveLength(1);
  });

  test("drops aria-roledescription, which would be announced instead of image", () => {
    expect(applyAccessibleName(MERMAID_ROOT, "A to B")).not.toContain("aria-roledescription");
  });

  test("drops aria-labelledby, which would out-rank the label and discard it silently", () => {
    const withIdRef = '<svg role="graphics-document" aria-labelledby="t1"><title id="t1">chart</title></svg>';
    const out = applyAccessibleName(withIdRef, "The real sentence");
    expect(out).not.toContain("aria-labelledby");
    expect(out).toContain('aria-label="The real sentence"');
  });

  test("keeps aria-describedby, which sits alongside a name rather than replacing it", () => {
    const withDesc = '<svg role="graphics-document" aria-describedby="d1"><desc id="d1">longer</desc></svg>';
    expect(applyAccessibleName(withDesc, "A to B")).toContain('aria-describedby="d1"');
  });

  test("escapes the label so a quote cannot break out of the attribute", () => {
    const out = applyAccessibleName(MERMAID_ROOT, 'He said "go" & <left>');
    expect(out).toContain('aria-label="He said &quot;go&quot; &amp; &lt;left&gt;"');
    expect(out).not.toContain('aria-label="He said "go"');
  });

  test("leaves every other root attribute alone", () => {
    const out = applyAccessibleName(MERMAID_ROOT, "A to B");
    expect(out).toContain('id="mill-d-abc123"');
    expect(out).toContain('viewBox="0 0 200 100"');
    expect(out).toContain("<g></g></svg>");
  });

  test("touches only the first svg tag, so a nested one keeps what the renderer gave it", () => {
    const nested = '<svg role="graphics-document"><svg role="presentation"></svg></svg>';
    const out = applyAccessibleName(nested, "outer only");
    expect(out).toContain('role="presentation"');
    expect(out.match(/aria-label=/g)).toHaveLength(1);
  });

  test("markup that is not an SVG comes back untouched", () => {
    expect(applyAccessibleName("<div>not a picture</div>", "x")).toBe("<div>not a picture</div>");
  });
});
