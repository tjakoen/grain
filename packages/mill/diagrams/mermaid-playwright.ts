// mill/diagrams/mermaid-playwright.ts — the heavy DiagramRenderer: mermaid, rendered in a
// real browser, post-processed so the SVG follows GRAIN's theme tokens.
//
// This is the ONLY file in MILL that touches playwright or mermaid, and it imports both
// dynamically. Nothing here loads unless a consumer explicitly builds this renderer, which
// is what keeps `@tjakoen/mill` dependency-free for everyone who does not want diagrams.
// A consumer that does want them installs `playwright` and `mermaid` itself.
//
// ---- Why sentinels ----------------------------------------------------------
// Mermaid bakes literal colors into its SVG output; there is no hook for emitting a CSS
// variable. So mermaid is initialized with a palette of unique, meaningless hex values, and
// those exact values are substituted for `var(--color-…)` references afterwards. Because an
// inline SVG inherits custom properties from the document, ONE cached SVG then re-colors
// across every theme and color scheme with no re-render. That is the whole trick, and it is
// why the cache can be committed.
import { createHash } from "node:crypto";
import type { DiagramRenderer } from "./prepare.ts";

/**
 * Folded into the disk-cache key by the consumer. Bump the revision suffix whenever the
 * sentinel map below changes: committed SVGs carry the substitution that produced them, so
 * a changed map has to invalidate them.
 */
export const MERMAID_VERSION_TAG = "mermaid-11-sentinels-1";

// The sentinel palette. Values are deliberately near-black and otherwise meaningless: they
// exist only to be found and replaced. Each maps a mermaid themeVariable to the GRAIN token
// that should drive it. Every variable we care about is set EXPLICITLY — mermaid derives
// unset variables by lightening or darkening others, and a derived color will not match a
// sentinel, so it would survive into the output as a baked hex.
interface Sentinel { hex: string; replacement: string; }

const SENTINELS: Record<string, Sentinel> = {
  background:          { hex: "#000001", replacement: "transparent" },
  primaryColor:        { hex: "#000002", replacement: "var(--color-surface)" },
  primaryTextColor:    { hex: "#000003", replacement: "var(--color-fg)" },
  primaryBorderColor:  { hex: "#000004", replacement: "var(--color-line)" },
  lineColor:           { hex: "#000005", replacement: "var(--color-muted)" },
  secondaryColor:      { hex: "#000006", replacement: "var(--color-accent-soft)" },
  tertiaryColor:       { hex: "#000007", replacement: "var(--color-bg)" },
  edgeLabelBackground: { hex: "#000008", replacement: "var(--color-bg)" },
  clusterBkg:          { hex: "#000009", replacement: "var(--color-bg)" },
  clusterBorder:       { hex: "#00000a", replacement: "var(--color-line)" },
  textColor:           { hex: "#00000b", replacement: "var(--color-fg)" },
  mainBkg:             { hex: "#000002", replacement: "var(--color-surface)" },
  nodeBorder:          { hex: "#000004", replacement: "var(--color-line)" },
  nodeTextColor:       { hex: "#00000b", replacement: "var(--color-fg)" },
  titleColor:          { hex: "#00000b", replacement: "var(--color-fg)" },
  secondaryTextColor:  { hex: "#00000b", replacement: "var(--color-fg)" },
  tertiaryTextColor:   { hex: "#00000b", replacement: "var(--color-fg)" },
  secondaryBorderColor:{ hex: "#00000a", replacement: "var(--color-line)" },
  tertiaryBorderColor: { hex: "#00000a", replacement: "var(--color-line)" },
  // Arrowheads are worth calling out: mermaid derives arrowheadColor by INVERTING the
  // background, so a near-black background sentinel produced near-white arrowheads that no
  // sentinel could match. Setting it explicitly is what keeps arrows visible on light paper.
  arrowheadColor:      { hex: "#00000c", replacement: "var(--color-muted)" },
};

// Literal colors mermaid emits that are known not to matter, and why. Checked against real
// output so the leftover warning stays a signal: a warning that always fires is one nobody
// reads, and the point of it is to catch a NEW baked color the sentinel map has not learned.
const INERT_LITERALS = new Set([
  "#000",                      // .katex path — only reachable by diagrams using math
  "#000000",                   // feDropShadow flood-color, emitted at 6% opacity
  "rgba(185,185,185,1)",       // drop-shadow for the "neo" look, which we do not select
]);

const FONT_SENTINEL = "MILLFONT";
const FONT_REPLACEMENT = "var(--font-smooth, Georgia, 'Times New Roman', serif)";

/** The themeVariables object handed to mermaid.initialize. */
export const themeVariables = (): Record<string, string> => {
  const vars: Record<string, string> = { fontFamily: FONT_SENTINEL };
  for (const [name, s] of Object.entries(SENTINELS)) vars[name] = s.hex;
  return vars;
};

const rgbForm = (hex: string): RegExp => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return new RegExp(`rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*(?:,\\s*[\\d.]+\\s*)?\\)`, "gi");
};

/**
 * Replace every sentinel with its token reference. Mermaid emits colors in both hex and
 * `rgb()` form depending on where they land (attribute, inline style, or its scoped
 * stylesheet), so both are matched.
 *
 * Returns the leftovers as well: any color that survives is one mermaid derived rather than
 * took from the palette, and it will NOT follow the theme. Surfacing them is how the
 * sentinel map grows against real diagrams instead of by guesswork.
 */
export function substituteSentinels(svg: string): { svg: string; leftover: string[] } {
  let out = svg;

  for (const { hex, replacement } of Object.values(SENTINELS)) {
    out = out.replace(new RegExp(hex, "gi"), replacement);
    out = out.replace(rgbForm(hex), replacement);
  }
  out = out.split(FONT_SENTINEL).join(FONT_REPLACEMENT);

  // Anything still literal, minus the known-inert set. `#fff` shorthand counts; `var(…)` does not.
  const leftover = [...new Set(
    (out.match(/#[0-9a-f]{3,8}\b|rgba?\([\d\s.,%]+\)/gi) ?? []).map(c => c.toLowerCase()),
  )].filter(c => !INERT_LITERALS.has(c.replace(/\s+/g, "")));

  return { svg: out, leftover };
}

/** A content-addressed, therefore cache-stable, element id for the rendered diagram. */
const diagramId = (source: string): string =>
  `mill-d-${createHash("sha1").update(source).digest("hex").slice(0, 8)}`;

/**
 * Build the mermaid renderer. The browser is a lazy singleton that lives for the process:
 * a dev server renders every diagram it needs through one chromium, and a run that never
 * hits a cache miss never launches one at all.
 *
 * If playwright or chromium is unavailable — CI, a fresh clone, a contributor who skipped
 * the browser download — the failure is logged ONCE and every later call returns null
 * immediately. Pages still serve, with code blocks where the diagrams would be.
 */
export function createMermaidRenderer(): DiagramRenderer & { close(): Promise<void> } {
  type Page = { evaluate: (fn: string) => Promise<unknown> };
  type Browser = { close(): Promise<void> };

  let ready: Promise<Page | null> | null = null;
  let browser: Browser | null = null;
  let disabled = false;

  const boot = async (): Promise<Page | null> => {
    try {
      const { chromium } = await import("playwright");
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      const mermaidPath = require.resolve("mermaid/dist/mermaid.min.js");

      const launched = await chromium.launch();
      browser = launched as unknown as Browser;
      const page = await launched.newPage();
      await page.setContent("<!DOCTYPE html><html><body></body></html>");
      await page.addScriptTag({ path: mermaidPath });          // UMD build → window.mermaid
      await page.evaluate(
        ([vars]: [Record<string, string>]) => {
          // securityLevel "strict" keeps mermaid's own sanitizer on: the SVG is spliced into
          // our pages unescaped, so untrusted markup must never survive a render.
          (window as unknown as { mermaid: { initialize(c: unknown): void } }).mermaid.initialize({
            startOnLoad: false, theme: "base", securityLevel: "strict", themeVariables: vars,
          });
        },
        [themeVariables()] as [Record<string, string>],
      );
      return page as unknown as Page;
    } catch (err) {
      disabled = true;
      console.warn(
        "[mill] mermaid renderer unavailable (playwright or chromium missing); " +
        "diagrams will render as code blocks.", err,
      );
      return null;
    }
  };

  const render: DiagramRenderer = async (lang, source) => {
    if (disabled || lang.toLowerCase() !== "mermaid") return null;

    ready ??= boot();
    const page = await ready;
    if (!page) return null;

    try {
      const raw = await (page as unknown as {
        evaluate(fn: (a: [string, string]) => Promise<string>, arg: [string, string]): Promise<string>;
      }).evaluate(
        async ([id, text]) => {
          const m = (window as unknown as {
            mermaid: { render(id: string, text: string): Promise<{ svg: string }> };
          }).mermaid;
          return (await m.render(id, text)).svg;
        },
        [diagramId(source), source],
      );

      const { svg, leftover } = substituteSentinels(raw);
      if (leftover.length) {
        console.warn(
          `[mill] diagram kept ${leftover.length} literal color(s) that will not follow the theme: ` +
          `${leftover.join(", ")} — add the matching mermaid themeVariable to SENTINELS.`,
        );
      }
      return svg;
    } catch {
      return null;                                   // invalid mermaid source → code block
    }
  };

  return Object.assign(render, {
    close: async () => {
      if (browser) { await browser.close(); browser = null; }
      ready = null;
    },
  });
}
