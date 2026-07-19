// mill/serve.ts — piece 3: the live content route (MILL's BATCH hosting adapter).
//
// A self-contained factory: createMillRoutes(deps) returns a pathname handler
// `(pathname) => Promise<Response | null>` — null when the path belongs to no collection,
// so the composition root can try MILL first and fall through. Transport-generic on
// purpose (no Bun.serve types): any host that can hand it a pathname can mount it.
//
// The pipeline per request (live render — the static export just freezes this output):
//   read .md → renderGrainDocument (grade-guarded) → collection chrome (full page)
//   → compose (BATCH's renderPage, injected) so component tags in the chrome AND the
//   escape-hatch `<b-…>` tags written in the Markdown get composed at request time.
//
// MILL may import batch/grain (it is the layer above), but `compose` stays an injected
// port so this module needs no file-layout knowledge of the host and tests run without it.
//
// HOW TO MOUNT (the composition root, portfolio/server.ts — keep it to a few lines):
//   const serveContent = createPortfolioContentRoutes(renderPage, GLOBAL_ASSETS);  // portfolio/content.ts
//   // …inside fetch(), before servePortfolio:
//   const fromContent = await serveContent(pathname);
//   if (fromContent) return fromContent;
import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Frontmatter } from "./core/types.ts";
import { parseFrontmatter } from "./core/frontmatter.ts";
import { escapeHtml } from "./core/engine.ts";
import { assertHumanGrade } from "./core/grade.ts";
import { renderGrainDocument, type GrainAdapterOptions } from "./adapters/grain/grain-adapter.ts";

// ---- the content-source port -------------------------------------------------
// Where the .md files come from. `dirSource` (a folder) covers the consumer's own
// content; `packageDocsSource` resolves a folder OUT OF AN INSTALLED PACKAGE
// (e.g. @tjakoen/grain/docs) so layer docs are never read via a hardcoded sibling
// path and never copied — same code in the monorepo and after the split.
export interface ContentSource {
  /** list the available slugs */
  list(): Promise<string[]>;
  /** raw Markdown for a slug, or null if it doesn't exist */
  read(slug: string): Promise<string | null>;
}

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;            // no slashes, no leading dot — traversal-safe
const slugOf = (file: string) => basename(file, ".md").toLowerCase();

/** A folder of .md files. Slug = filename minus .md, lowercased (GRAIN.md → grain). */
export function dirSource(dir: string): ContentSource {
  const files = async (): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    for (const f of (await readdir(dir)).filter(f => f.endsWith(".md")).sort())
      out.set(slugOf(f), f);                             // case-colliding names: last one wins
    return out;
  };
  return {
    list: async () => [...(await files()).keys()],
    read: async (slug) => {
      const file = (await files()).get(slug.toLowerCase());
      if (!file) return null;
      return readFile(join(dir, file), "utf8");
    },
  };
}

/**
 * A docs folder inside an INSTALLED package, located via `import.meta.resolve` on an
 * anchor file (e.g. "@tjakoen/grain/docs/GRAIN.md"). Bun verifies the anchor exists, so a
 * missing/renamed package fails loudly at wiring time, not with an empty page. NEVER
 * replace this with a `../grain/docs` relative path — that breaks on the repo split
 * (see ../SPLIT-PLAN.md § "Layer docs travel inside the package").
 */
export function packageDocsSource(anchor: string): ContentSource {
  return dirSource(dirname(fileURLToPath(import.meta.resolve(anchor))));
}

// ---- collections ---------------------------------------------------------------
// The page chrome is consumer-owned (the portfolio wraps content in its BREAD shell);
// MILL ships a minimal standalone default so the routes work out of the box.
export interface PageInput {
  kind: "index" | "entry";
  title: string;
  description: string;
  /** the rendered, grade-checked article HTML */
  body: string;
  collection: MillCollection;
  /** the entry's frontmatter (entry pages only) */
  frontmatter?: Frontmatter;
  /** the entry's slug (entry pages only) — lets a chrome link its raw `${prefix}/${slug}.md` twin */
  slug?: string;
}
export type PageChrome = (input: PageInput) => string;

export interface MillCollection {
  /** route prefix, no trailing slash: "/notes" serves the index, "/notes/:slug" the entries */
  prefix: string;
  /** index page heading */
  title: string;
  /** index page lede + fallback meta description */
  description?: string;
  source: ContentSource;
  /** consumer block/layout/link overrides, passed to the GRAIN adapter */
  adapter?: GrainAdapterOptions;
  /** `content-index` listing variant (grain: attribute, not a page override) — e.g. "log" */
  indexVariant?: string;
  /** when set, each index item gets `data-surface="${prefix}:${slug}"` — makes an entry a real
   *  spotlight target (e.g. an AI read-through demo can address it), opt-in per collection */
  itemSurfacePrefix?: string;
  /** page chrome for this collection (falls back to deps.chrome, then the built-in default) */
  chrome?: PageChrome;
  /** serve an index listing at `prefix` (default true) */
  index?: boolean;
}

export interface MillServeDeps {
  collections: MillCollection[];
  /**
   * BATCH's renderPage, injected at the composition root: expands component tags in the
   * chrome (e.g. <portfolio-frame />) and any escape-hatch <b-…> tags from the Markdown.
   * Omitted in tests / non-BATCH hosts → the chrome's HTML ships as written.
   */
  compose?: (html: string) => Promise<string>;
  /** default chrome for collections that don't bring their own */
  chrome?: PageChrome;
}

const defaultChrome: PageChrome = ({ title, description, body }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  <link rel="stylesheet" href="/styles/variables.css">
  <link rel="stylesheet" href="/styles/global.css">
  <link rel="stylesheet" href="/styles/grain.css">
  <link rel="stylesheet" href="/components.css">
</head>
<body><main class="board">${body}</main></body>
</html>`;

// ---- the index listing -----------------------------------------------------------
// Built from frontmatter only (no body render). Sorted newest-first by `date`
// (ISO strings compare lexically), undated entries last, then by slug.
interface IndexEntry { slug: string; fm: Frontmatter; }

const fmStr = (fm: Frontmatter, k: string): string => typeof fm[k] === "string" ? fm[k] as string : "";

function indexArticle(c: MillCollection, entries: IndexEntry[]): string {
  const items = entries.map(({ slug, fm }) => {
    const title = fmStr(fm, "title") || slug;
    // date + readingTime as SEPARATE spans (not one joined string) — the "log" variant (Idea 2,
    // NOTES-PAGE-PLAN.md) puts the date alone in a fixed-width gutter; a joined "date · Nmin"
    // string overflowed that gutter and painted over the title. Each collection's CSS decides
    // how to lay the two spans out; the default listing still reads them inline.
    const date = fmStr(fm, "date");
    const readingTime = fmStr(fm, "readingTime");
    const dateHtml = date ? `<span class="content-index__date">${escapeHtml(date)}</span>` : "";
    const readHtml = readingTime ? `<span class="content-index__readtime">${escapeHtml(readingTime)}</span>` : "";
    const summary = fmStr(fm, "summary") || fmStr(fm, "subtitle") || fmStr(fm, "description");
    const tags = Array.isArray(fm.tags) ? fm.tags : [];
    const itemSurface = c.itemSurfacePrefix ? ` data-surface="${escapeHtml(`${c.itemSurfacePrefix}:${slug}`)}"` : "";
    return `<li class="content-index__item"${itemSurface}>
      ${dateHtml || readHtml ? `<p class="content-index__meta">${dateHtml}${readHtml}</p>` : ""}
      <h2 class="content-index__title"><a href="${escapeHtml(`${c.prefix}/${slug}`)}">${escapeHtml(title)}</a></h2>
      ${summary ? `<p class="content-index__summary">${escapeHtml(summary)}</p>` : ""}
      ${tags.length ? `<div class="note__tags">${tags.map(t => `<span class="badge" data-status="active">${escapeHtml(t)}</span>`).join(" ")}</div>` : ""}
    </li>`;
  }).join("\n");
  const lede = c.description ? `<p class="note__lede">${escapeHtml(c.description)}</p>` : "";
  // same positive human-grade assertion as rendered documents: this is human content, listed.
  const variant = c.indexVariant ? ` data-variant="${escapeHtml(c.indexVariant)}"` : "";
  return `<article class="note" data-grade="smooth">
  <header class="note__head"><h1 class="masthead">${escapeHtml(c.title)}</h1>${lede}<hr class="rule"></header>
  <ul class="content-index"${variant}>${items}</ul>
</article>`;
}

function byDateDesc(a: IndexEntry, b: IndexEntry): number {
  const da = fmStr(a.fm, "date"), db = fmStr(b.fm, "date");
  if (da !== db) return da === "" ? 1 : db === "" ? -1 : db.localeCompare(da);
  return a.slug.localeCompare(b.slug);
}

// ---- the routes ---------------------------------------------------------------------
export type MillRequestHandler = (pathname: string) => Promise<Response | null>;

/**
 * Every route a set of collections serves, enumerated: the index (`prefix`, unless
 * `index: false`) plus one `${prefix}/${slug}` per entry. The single source consumers
 * use to feed a sitemap or a static-export allowlist — MILL routes are content pages
 * and MUST export (ARCHITECTURE §18); deriving them here keeps new entries automatic.
 */
export async function listMillRoutes(collections: MillCollection[]): Promise<string[]> {
  const out: string[] = [];
  for (const c of collections) {
    if (c.index ?? true) out.push(c.prefix);
    // only slugs the router will actually serve (SLUG-safe) — a nonconforming filename must
    // not reach a sitemap/export list it would 404 from
    for (const slug of await c.source.list())
      if (SLUG.test(slug)) out.push(`${c.prefix}/${slug}`);
  }
  return out.sort();
}

/**
 * Every entry's RAW `.md` twin (`${prefix}/${slug}.md`) — the honest-source route (the site is
 * its own source tree). A data route, not a page: it serves bytes, not HTML, so a caller feeds
 * this into an export's `dataRoutes` (literal-path, extension-aware), never `pages` (which wraps
 * fetched bodies as `index.html`).
 */
export async function listMillRawRoutes(collections: MillCollection[]): Promise<string[]> {
  const out: string[] = [];
  for (const c of collections)
    for (const slug of await c.source.list())
      if (SLUG.test(slug)) out.push(`${c.prefix}/${slug}.md`);
  return out.sort();
}

const html = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });

export function createMillRoutes(deps: MillServeDeps): MillRequestHandler {
  const compose = deps.compose ?? (async (h: string) => h);

  return async (pathname: string): Promise<Response | null> => {
    const path = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

    for (const c of deps.collections) {
      const chrome = c.chrome ?? deps.chrome ?? defaultChrome;

      if (path === c.prefix && (c.index ?? true)) {
        const slugs = await c.source.list();
        const entries: IndexEntry[] = [];
        for (const slug of slugs) {
          const raw = await c.source.read(slug);
          if (raw !== null) entries.push({ slug, fm: parseFrontmatter(raw).data });
        }
        entries.sort(byDateDesc);
        const body = indexArticle(c, entries);
        assertHumanGrade(body);
        const page = chrome({
          kind: "index", title: c.title, description: c.description ?? "", body, collection: c,
        });
        return html(await compose(page));
      }

      if (path.startsWith(c.prefix + "/")) {
        const rawPath = path.slice(c.prefix.length + 1);

        // the honest-source route: `${prefix}/${slug}.md` — the literal bytes, no chrome. A
        // data route (not a page), so a caller freezes it via `listMillRawRoutes` → dataRoutes.
        if (rawPath.endsWith(".md")) {
          const slug = rawPath.slice(0, -3);
          if (!SLUG.test(slug)) return new Response("Not found", { status: 404 });
          const raw = await c.source.read(slug);
          if (raw === null) return new Response("Not found", { status: 404 });
          return new Response(raw, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }

        const slug = rawPath;
        if (!SLUG.test(slug)) return new Response("Not found", { status: 404 });
        const raw = await c.source.read(slug);
        if (raw === null) return new Response("Not found", { status: 404 });
        const doc = renderGrainDocument(raw, c.adapter);   // grade guardrail runs inside
        const description = fmStr(doc.frontmatter, "summary")
          || fmStr(doc.frontmatter, "subtitle")
          || fmStr(doc.frontmatter, "description")
          || c.description || "";
        const page = chrome({
          kind: "entry", title: doc.title || slug, description, body: doc.html,
          collection: c, frontmatter: doc.frontmatter, slug,
        });
        return html(await compose(page));
      }
    }
    return null;                                          // not a MILL route — fall through
  };
}
