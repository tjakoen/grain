// mill/diagrams/mermaid-playwright.test.ts — the sentinel substitution (pure, always runs)
// and one real render (needs playwright + chromium, skipped when they are absent).
import { test, expect } from "bun:test";
import { substituteSentinels, themeVariables, MERMAID_VERSION_TAG, createMermaidRenderer } from "./mermaid-playwright.ts";

test("every sentinel is a distinct-looking hex and fontFamily is set", () => {
  const vars = themeVariables();
  expect(vars.fontFamily).toBe("MILLFONT");
  expect(vars.background).toMatch(/^#0{5}[0-9a-f]$/);
  // arrowheadColor must be explicit: mermaid derives it by inverting the background, so an
  // unset one lands outside the palette entirely (the bug this pins down).
  expect(vars.arrowheadColor).toBeDefined();
});

test("substitutes hex sentinels, case-insensitively", () => {
  const { svg } = substituteSentinels(`<rect fill="#000002" stroke="#000004"/><text fill="#00000B"/>`);
  expect(svg).toBe(`<rect fill="var(--color-surface)" stroke="var(--color-line)"/><text fill="var(--color-fg)"/>`);
});

test("substitutes the rgb() and rgba() forms mermaid emits in its scoped stylesheet", () => {
  const { svg } = substituteSentinels(`a{fill:rgb(0,0,2);}b{stroke:rgba( 0 , 0 , 5 , 1 );}`);
  expect(svg).toBe(`a{fill:var(--color-surface);}b{stroke:var(--color-muted);}`);
});

test("substitutes the font sentinel with a token that keeps a serif fallback", () => {
  const { svg } = substituteSentinels(`<style>x{font-family:MILLFONT;}</style>`);
  expect(svg).toContain("var(--font-smooth,");
  expect(svg).not.toContain("MILLFONT");
});

test("reports a color the sentinel map has not learned", () => {
  const { leftover } = substituteSentinels(`<rect fill="#000002"/><circle fill="#ff00aa"/>`);
  expect(leftover).toEqual(["#ff00aa"]);
});

test("stays quiet about the literals mermaid emits that cannot be seen", () => {
  // Real output from mermaid 11: a katex fill, a 6%-opacity shadow, and rules for a look we
  // never select. Reporting these would make the warning fire on every diagram.
  const { leftover } = substituteSentinels(
    `<path fill="#000"/><feDropShadow flood-color="#000000"/><g style="filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1))"/>`,
  );
  expect(leftover).toEqual([]);
});

test("the version tag is exported so the cache key can follow the substitution", () => {
  expect(MERMAID_VERSION_TAG).toContain("mermaid");
});

// ---- the real thing ---------------------------------------------------------
// Skipped rather than failed where chromium is absent: a machine without a browser is a
// supported case (it reads the committed cache), so this must not gate `bun test`.
const browserAvailable = await (async () => {
  try { await import("playwright"); return true; } catch { return false; }
})();

test.skipIf(!browserAvailable)("renders a real diagram to theme-following SVG", async () => {
  const render = createMermaidRenderer();
  try {
    const svg = await render("mermaid", "graph TD;\n  A[One] --> B[Two];");
    expect(svg).not.toBeNull();
    expect(svg).toContain("<svg");
    expect(svg).toContain("var(--color-");
    expect(svg).toContain("var(--font-smooth");
    expect(svg).not.toContain("#000002");                 // no sentinel survived
    expect(svg).toContain("mill-d-");                     // content-addressed, cache-stable id

    // The same source twice must produce byte-identical output, or the committed cache
    // would churn on every run.
    expect(await render("mermaid", "graph TD;\n  A[One] --> B[Two];")).toBe(svg!);
  } finally {
    await render.close();
  }
}, 60_000);

test.skipIf(!browserAvailable)("invalid source and non-mermaid fences degrade to null", async () => {
  const render = createMermaidRenderer();
  try {
    expect(await render("ts", "const x = 1;")).toBeNull();
    expect(await render("mermaid", "this is not a diagram at all {{{")).toBeNull();
  } finally {
    await render.close();
  }
}, 60_000);
