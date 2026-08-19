// mill/diagrams/label.ts — the accessible name a rendered diagram must carry, and where it
// comes from.
//
// ---- Why a diagram needs a label at all ----------------------------------------
// A generated diagram is a picture, and a picture with no accessible name is decorative: a
// screen reader skips it, and so does anything else reading the page as text. The estate's
// figure standard is blunt about the remedy, and it is the same remedy for both audiences:
// role="img" plus an aria-label that narrates the whole flow in words. The label IS the
// accessible figure. Mermaid does not supply one. It emits role="graphics-document" and an
// aria-roledescription of "flowchart-v2", which names the drawing's genre and says nothing
// about what the drawing says.
//
// So MILL asks the author for it, in the fence, next to the diagram:
//
//     ```mermaid label="BATCH serves the request, GRAIN dresses it, MILL renders the Markdown"
//     flowchart LR
//     ...
//     ```
//
// ---- Why the label is not part of the renderer port ---------------------------
// `DiagramRenderer` is `(lang, source) => Promise<string | null>` and it stays that way. Three
// reasons, in order of how much they would hurt:
//
//   1. The label is not an input to drawing. It describes the picture; it does not change a
//      single pixel of it. A renderer's job is source in, picture out.
//   2. Renderers are implemented by consumers. Putting the label in the signature would break
//      every existing one and then oblige each author to re-implement the same aria wrapping,
//      which is exactly the kind of duplicated rule that drifts apart. MILL owns the <figure>
//      wrapper, so MILL owns the accessible name: one place, one rule, every renderer.
//   3. The disk cache keys on what goes through the port. If the label went through it, fixing
//      a typo in a sentence would invalidate the cached SVG and send an unchanged picture back
//      through chromium. Keeping the label out means prose is free to edit with no browser.
//
// The label is therefore applied AFTER the cache, when the figure is wrapped, which is also
// the answer to whether CACHE_VERSION had to move. It did not. See cache.ts.
import { escapeHtml } from "../core/engine.ts";

/** What a fence's info-string tail turned out to be holding. */
export interface DiagramMeta {
  /** The accessible name, or null when the fence did not give one. */
  label: string | null;
  /** Keys that were spelled correctly enough to parse but that MILL does not know. */
  unknownKeys: string[];
}

// key="value" or key='value'. There is no escape syntax inside a quoted value on purpose: a
// label is a sentence of prose, and a sentence that needs an escaped quote is better written
// with the other quote character. Both are accepted for exactly that reason.
const PAIR = /([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * Read a fence's info-string tail. Only `label` means anything today; anything else is
 * reported back so a near miss is loud rather than silently unlabelled. That matters more
 * than it looks: `caption="…"` is the obvious thing to type, and without this it would parse
 * cleanly, set nothing, and leave the diagram exactly as unnamed as writing no tail at all.
 */
export function parseDiagramMeta(meta: string | undefined): DiagramMeta {
  if (!meta) return { label: null, unknownKeys: [] };

  let label: string | null = null;
  const unknownKeys: string[] = [];

  for (const match of meta.matchAll(PAIR)) {
    const key = match[1].toLowerCase();
    const value = (match[2] ?? match[3] ?? "").trim();
    if (key === "label") {
      if (value) label = value;                 // an empty label is no label
    } else {
      unknownKeys.push(match[1]);
    }
  }

  return { label, unknownKeys };
}

// The attributes that would out-rank or muddy the name we are about to set. aria-labelledby
// wins over aria-label in the accessibility tree, so leaving one behind would silently discard
// the author's sentence. aria-roledescription would have a screen reader announce the literal
// string "flowchart-v2" where it should be announcing "image". aria-describedby is left alone:
// a description sits alongside a name rather than replacing it.
const OUTRANKING = /\s(?:aria-labelledby|aria-roledescription|aria-label|role)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const ROOT_SVG = /<svg\b[^>]*>/i;

/**
 * Give a rendered SVG the accessible name its author wrote, by rewriting the root element to
 * role="img" with that name. Only the FIRST svg tag is touched, so a nested one keeps whatever
 * the renderer gave it.
 *
 * Markup that is not an SVG at all comes back untouched. A renderer is free to return whatever
 * it likes, and quietly handing back the original beats mangling something we do not recognize.
 */
export function applyAccessibleName(svg: string, label: string): string {
  const match = svg.match(ROOT_SVG);
  if (!match) return svg;

  const rewritten = match[0]
    .replace(OUTRANKING, "")
    .replace(/\/?>$/, close => ` role="img" aria-label="${escapeHtml(label)}"${close}`);

  return svg.replace(ROOT_SVG, () => rewritten);
}
