// mill/adapters/grain/date-rail.ts: turn a rendered note body into GRAIN's date-rail markup.
// Opt-in per note with frontmatter `layout: timeline`. Each H2 that opens with a date marker,
// written `## Aug 18 · Then it had to keep score`, becomes one rail section whose date sits in
// the left column. The marker stays plain Markdown, so the same file still reads sensibly in any
// other renderer, where the date simply shows as part of the heading.
//
// It works on the rendered HTML rather than the AST because the layout is where MILL hands the
// body over, and an H2 always starts a block: code fences escape `<`, so a literal `<h2` inside
// one can never be mistaken for a heading.
import { slugifyHeading } from "../../core/slug.ts";

// A date marker is a short run of text before a spaced middle dot. Twenty-four characters is
// enough for "Sep 17, 2026" or "Week 3" and short enough that a heading which merely contains a
// middle dot later in its text is not mistaken for one.
const MARKER = /^([^<·]{1,24}?)\s+·\s+([\s\S]+)$/;

const textOf = (html: string) => html.replace(/<[^>]*>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function section(chunk: string): string {
  const m = chunk.match(/^<h2([^>]*)>([\s\S]*?)<\/h2>/);
  if (!m) return chunk;
  const [whole, attrs, inner] = m;
  const marker = inner.match(MARKER);
  let date = "";
  let heading = whole;
  if (marker) {
    date = marker[1].trim();
    const rest = marker[2];
    // Re-slug from the heading text alone, so the anchor does not change when a date is added,
    // corrected or removed. Every other attribute (a data-surface marker, say) is kept as it was.
    const slug = slugifyHeading(textOf(rest));
    const kept = attrs.replace(/\s*id="[^"]*"/, "");
    heading = `<h2${slug ? ` id="${slug}"` : ""}${kept}>${rest}</h2>`;
  }
  const rail = date ? `<p class="date-rail__date"><time>${date}</time></p>` : `<p class="date-rail__date" aria-hidden="true"></p>`;
  return `<section class="date-rail__section">${rail}<div class="date-rail__body">${heading}${chunk.slice(whole.length)}</div></section>`;
}

/** Wrap a rendered body in the date rail. Content before the first H2 stays above the rail. */
export function dateRailBody(body: string): string {
  const parts = body.split(/(?=<h2[\s>])/);
  const lead = parts[0].startsWith("<h2") ? "" : parts.shift() ?? "";
  if (!parts.length) return body;
  return `${lead}<div class="date-rail">${parts.map(section).join("")}</div>`;
}

/** True when the note opted in with `layout: timeline`. */
export const wantsDateRail = (frontmatter: Record<string, unknown>) => frontmatter.layout === "timeline";
