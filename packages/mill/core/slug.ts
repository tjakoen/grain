// mill/core/slug.ts — THE one heading-slug algorithm, exported so every consumer shares it.
//
// The default grain-adapter stamps `id="{slug}"` on rendered ##/### headings; a consumer
// building a retrieval corpus or a table of contents must tag its entries with the SAME slug,
// or a deep link's `#fragment` points at an id that doesn't exist on the page. One exported
// function, imported by both sides, is what keeps that impossible — never fork it.
// (Upstreamed from tjakoen.github.io's src/ai/slug.ts, the reference implementation.)

/** Turn a heading's plain text into a URL-safe, lowercase, dash-separated slug. Empty or
 *  symbol-only input (e.g. "!!!", "") yields "". Deterministic and order-preserving: same
 *  input always produces the same slug, which is the whole point of sharing it. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // strip everything but letters, digits, whitespace, dashes
    .trim()
    .replace(/\s+/g, "-")           // whitespace runs → single dash
    .replace(/-+/g, "-")            // collapse dash runs (adjacent to stripped punctuation)
    .replace(/^-+|-+$/g, "");       // trim leading/trailing dashes
}
