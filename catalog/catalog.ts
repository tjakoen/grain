// grain/catalog/catalog.ts — GRAIN's self-documenting "component catalog" (Storybook-style).
// Each component is documented by `<name>.md` (the Human view); an optional
// `<name>.ai.md` adds the AI view. A per-component Human/AI toggle swaps which view
// renders (not just its styling) — that toggle IS grain's grade-as-signal vocabulary,
// which is why the catalog lives in grain, not the substrate. The sidebar groups
// components by atomic-design layer (the directory under components/) as collapsible
// dropdowns, with a live search filter. Dependency-free: a tiny line parser, no
// markdown library, no CDN. It reads the filesystem directly (like ai/accepts.ts) and
// imports nothing from batch — the composition root passes the page-nav routes in.
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

interface Panel { label: string; code: string; }
interface Group { label: string; panels: Panel[]; }
interface Doc { name: string; slug: string; intro: string; groups: Group[]; }
interface Component { layer: string; slug: string; name: string; human: Doc; ai: Doc | null; }

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// escapes quotes too: esc() is interpolated into ATTRIBUTE contexts (e.g. data-name="…"),
// not just text, so a component name / route containing " must not be able to break out.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// minimal inline markdown for prose: `code`, **bold**, *italic*, [text](url).
// Escapes first, then injects safe tags — author-controlled docs only.
const inline = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]*|#[^)]*)\)/g, '<a href="$2">$1</a>');

// atomic-design layers render in this order; unknown dirs fall to the end.
const LAYER_ORDER = ["atoms", "molecules", "organisms"];
const rank = (layer: string) => { const i = LAYER_ORDER.indexOf(layer); return i < 0 ? 99 : i; };

// minimal markdown: # title, ## group, ### panel, ```html fences, plain prose.
function parseDoc(md: string): Doc {
  const lines = md.split("\n");
  const doc: Doc = { name: "Untitled", slug: "untitled", intro: "", groups: [] };
  let group: Group | null = null;
  let pendingLabel = "";
  const intro: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# ")) { doc.name = line.slice(2).trim(); doc.slug = slugify(doc.name); i++; continue; }
    if (line.startsWith("## ")) { group = { label: line.slice(3).trim(), panels: [] }; doc.groups.push(group); pendingLabel = ""; i++; continue; }
    if (line.startsWith("### ")) { pendingLabel = line.slice(4).trim(); i++; continue; }
    if (line.startsWith("```html")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { body.push(lines[i]); i++; }
      i++; // skip closing fence
      if (!group) { group = { label: "", panels: [] }; doc.groups.push(group); }
      group.panels.push({ label: pendingLabel, code: body.join("\n").trim() });
      continue;
    }
    if (!group && line.trim()) intro.push(line.trim());
    i++;
  }
  doc.intro = intro.join(" ");
  return doc;
}

// `inject` mirrors makePageServer's seams: the catalog builds its own page shell (it isn't a
// pages/ file), so the composition root passes the SAME global assets here — headEnd for
// render-blocking bootstraps (theme pre-set), bodyEnd for deferred islands (palette, theming
// controls). Without it the catalog drifts from every other page (e.g. ignores the saved theme).
export interface CatalogInject { headEnd?: string; bodyEnd?: string; }

// `pages` is a plain thunk returning the page-nav routes (the composition root wires it to its
// sitemap) — the catalog stays decoupled from the substrate's Sitemap type, importing nothing
// from batch. Called at html()-render time, re-read on refresh().
export function createCatalog(componentsDir: string | string[], pages?: () => string[], inject: CatalogInject = {}) {
  let cache: string | null = null;
  let comps: Component[] | null = null;

  function findMd(dir: string, out: string[]) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) findMd(full, out);
      else if (e.name.endsWith(".md")) out.push(full);
    }
  }

  // Discover components per layer, pairing <name>.md (human) with <name>.ai.md (ai).
  async function discover(): Promise<Component[]> {
    const comps: Component[] = [];
    // one or many component roots (e.g. grain/components + project/components); each
    // contributes its atomic layers, merged by layer below.
    const layerDirs: Array<{ layer: string; dir: string }> = [];
    for (const root of ([] as string[]).concat(componentsDir))
      for (const e of readdirSync(root, { withFileTypes: true }))
        if (e.isDirectory()) layerDirs.push({ layer: e.name, dir: join(root, e.name) });
    for (const { layer, dir } of layerDirs) {
      const mds: string[] = [];
      findMd(dir, mds);
      const byBase = new Map<string, { human?: string; ai?: string }>();
      for (const p of mds) {
        const file = p.split(/[\\/]/).pop() ?? "";
        const isAi = file.endsWith(".ai.md");
        const base = file.replace(/\.ai\.md$/, "").replace(/\.md$/, "");
        const slot = byBase.get(base) ?? {};
        if (isAi) slot.ai = p; else slot.human = p;
        byBase.set(base, slot);
      }
      for (const slot of byBase.values()) {
        if (!slot.human) continue;   // a component must have a human doc as its base
        const human = parseDoc(readFileSync(slot.human, "utf8"));
        const ai = slot.ai ? parseDoc(readFileSync(slot.ai, "utf8")) : null;
        comps.push({ layer, slug: human.slug, name: human.name, human, ai });
      }
    }
    comps.sort((a, b) => (rank(a.layer) - rank(b.layer)) || a.name.localeCompare(b.name));
    return comps;
  }

  const getComps = async (): Promise<Component[]> => (comps ??= await discover());

  // A doc's example may show a document-level tag (<body class="app-window-backdrop">, e.g.
  // app-window.md's parent contract) for the copy/paste snippet's sake. HTML has no way to
  // sandbox a SECOND <body>/<html>/<head> — the parser merges its attributes onto the real
  // document's, so injecting it raw into .panel__live would leak the class onto the whole
  // catalog page. Swap those three tags to <div> for the LIVE render only; the escaped
  // <pre><code> copy below stays byte-for-byte accurate.
  function liveSafe(code: string): string {
    return code.replace(/<(\/?)(body|html|head)(\s|>)/gi, "<$1div$3");
  }

  function renderPanel(p: Panel): string {
    // live = author-controlled design-system markup (not user data) → inject raw
    return `<figure class="panel">
      ${p.label ? `<figcaption class="panel__label">${esc(p.label)}</figcaption>` : ""}
      <div class="panel__live">${liveSafe(p.code)}</div>
      <div class="panel__src">
        <button class="panel__copy" type="button">Copy</button>
        <pre><code>${esc(p.code)}</code></pre>
      </div>
    </figure>`;
  }

  const renderGroups = (groups: Group[]) => groups.map(g => `
    ${g.label ? `<h3 class="cat-group">${esc(g.label)}</h3>` : ""}
    <div class="panel-grid">${g.panels.map(renderPanel).join("")}</div>`).join("");

  const renderView = (doc: Doc, view: "smooth" | "grain") => `<div class="cat-doc__view" data-view="${view}">
    ${doc.intro ? `<p class="cat-intro">${inline(doc.intro)}</p>` : ""}
    ${renderGroups(doc.groups)}
  </div>`;

  function renderDoc(c: Component): string {
    const ai = c.ai ?? c.human;   // no .ai.md → AI view re-uses the human panels, grain-flipped
    return `<section class="cat-doc" id="${c.slug}" data-grade="smooth" data-layer="${c.layer}">
      <header class="cat-doc__head">
        <div class="cat-doc__title">
          <p class="cat-doc__eyebrow">${esc(cap(c.layer))}</p>
          <h2>${esc(c.name)}</h2>
        </div>
        <div class="grade-toggle" role="group" aria-label="Interaction mode for ${esc(c.name)}">
          <button type="button" class="grade-toggle__btn is-on" data-grade-set="smooth">Human</button>
          <button type="button" class="grade-toggle__btn" data-grade-set="grain">AI</button>
        </div>
      </header>
      ${renderView(c.human, "smooth")}
      ${renderView(ai, "grain")}
    </section>`;
  }

  // a flat list of components for external indexes (e.g. global search)
  async function entries(): Promise<Array<{ name: string; slug: string; layer: string }>> {
    return (await getComps()).map((c) => ({ name: c.name, slug: c.slug, layer: c.layer }));
  }

  async function html(): Promise<string> {
    if (cache != null) return cache;
    const list = await getComps();

    const byLayer = new Map<string, Component[]>();
    for (const c of list) { if (!byLayer.has(c.layer)) byLayer.set(c.layer, []); byLayer.get(c.layer)!.push(c); }
    const navGroups = [...byLayer.entries()].map(([layer, list]) => `
      <details class="cat-nav__group" open>
        <summary>${esc(cap(layer))}</summary>
        ${list.map(c => `<a href="#${c.slug}" data-name="${esc(c.name.toLowerCase())}">${esc(c.name)}</a>`).join("")}
      </details>`).join("");

    const pageNav = (pages?.() ?? []).map(p => `<a href="${p}">${esc(p)}</a>`).join("");
    const main = list.length ? list.map(renderDoc).join("") : `<p>No <code>.md</code> docs found under the components dir.</p>`;

    cache = page(pageNav, navGroups, main, inject);
    return cache;
  }

  function refresh() { cache = null; comps = null; }
  return { html, entries, refresh };
}

// the catalog shell — links the real design-system CSS so examples render for real
function page(pageNav: string, navGroups: string, main: string, inject: CatalogInject = {}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Component Catalog</title>${inject.headEnd ?? ""}
<link rel="stylesheet" href="/styles/variables.css">
<link rel="stylesheet" href="/styles/global.css">
<link rel="stylesheet" href="/styles/grain.css">
<link rel="stylesheet" href="/components.css">
<style>
  /* semantic tokens so the catalog follows BOTH theme axes (scheme + flavor) — the same
     data-color-scheme/data-theme the render-blocking theme-boot inject applies from storage,
     so an embedded catalog matches its host. */
  body { margin: 0; background: var(--color-bg); color: var(--color-fg); }
  .cat { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; background: var(--color-bg); }
  .cat-nav { position: sticky; top: 0; align-self: start; height: 100vh; overflow: auto;
    padding: var(--space-6) var(--space-4); border-right: 1px solid var(--color-line); }
  .cat-back { display: inline-flex; align-items: center; margin-bottom: var(--space-4);
    font-size: var(--text-sm); color: var(--color-muted); text-decoration: none; }
  .cat-back:hover { color: var(--ink); text-decoration: underline; }
  .cat-nav h1 { font-size: var(--text-lg); margin: 0 0 var(--space-3); }
  .cat-nav__auto { font-size: var(--text-xs); color: var(--color-muted); margin: 0 0 var(--space-4); }
  .cat-search { width: 100%; box-sizing: border-box; margin-bottom: var(--space-4);
    padding: var(--space-1) var(--space-2); font-family: var(--font-smooth); font-size: var(--text-sm);
    color: var(--ink); background: transparent; border: 1px solid var(--ink); border-radius: var(--radius-sm); }
  .cat-search::placeholder { color: var(--ink-faint); }
  .cat-nav__heading { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--color-muted); margin: var(--space-4) 0 var(--space-1); }
  .cat-nav__group { margin-bottom: var(--space-2); }
  .cat-nav__group > summary { cursor: pointer; list-style: none; padding: var(--space-1) 0;
    font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-muted); }
  .cat-nav__group > summary::-webkit-details-marker { display: none; }
  .cat-nav__group > summary::before { content: "▸ "; }
  .cat-nav__group[open] > summary::before { content: "▾ "; }
  .cat-nav a { display: block; color: var(--color-muted); text-decoration: none; padding: var(--space-1) 0; }
  .cat-nav a:hover { color: var(--ink); text-decoration: underline; }
  .cat-main { padding: var(--space-8); max-width: 900px; }
  /* each component reads as a bounded CARD (hairline + generous padding), not bare text loose on
     the page — a doc with no live panels (a CSS-only pattern component, prose-only) used to read
     as an unstyled wall between two anonymous headings; the border gives every entry the same
     footing regardless of how much it renders. No background of its own (stays page-toned) so
     .panel's --color-surface stays the one lifted tone inside it — this system has no third tier. */
  .cat-doc {
    margin-bottom: var(--space-8); scroll-margin-top: var(--space-4);
    padding: var(--space-6); border: 1px solid var(--color-line); border-radius: var(--radius-md);
  }
  .cat-doc h2 { font-size: var(--text-2xl); margin: 0; }
  .cat-doc__eyebrow { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--color-muted); margin: 0 0 var(--space-1); }
  .cat-doc__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4);
    flex-wrap: wrap; padding-bottom: var(--space-3); margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-line); }   /* masthead rhythm: title block → hairline → body */
  .grade-toggle { display: inline-flex; border: 1px solid var(--ink); border-radius: var(--radius-sm); overflow: hidden; }
  .grade-toggle__btn { font-family: var(--font-smooth); font-size: var(--text-xs); text-transform: uppercase;
    letter-spacing: 0.08em; padding: var(--space-1) var(--space-3); cursor: pointer;
    background: transparent; color: var(--ink); border: 0; }
  .grade-toggle__btn.is-on { background: var(--ink); color: var(--paper); }
  /* Human/AI: show exactly one view, chosen by the section's data-grade */
  .cat-doc__view[data-view="grain"] { display: none; }
  .cat-doc[data-grade="grain"] .cat-doc__view[data-view="smooth"] { display: none; }
  .cat-doc[data-grade="grain"] .cat-doc__view[data-view="grain"] { display: block; }
  /* the toggle re-grades only the rendered component PREVIEWS — never the catalog's
     own chrome (titles, prose, labels, code). Neutralise the section-wide grain that
     the global [data-grade] rule would cascade, then re-apply grain to .panel__live. */
  .cat-doc[data-grade="grain"] { --type-font: var(--font-smooth); }
  .cat-doc__view[data-view="grain"] .panel__live { --type-font: var(--font-grain); }
  .cat-intro { color: var(--color-muted); margin: 0 0 var(--space-6); }
  .cat-intro code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.88em;
    background: var(--paper-2); padding: 0 0.3em; border-radius: 2px; color: var(--ink); }
  .cat-intro strong { color: var(--ink); font-weight: var(--font-weight-semibold); }
  .cat-intro a { color: var(--ink); }
  .cat-group { font-size: var(--text-sm); text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--color-muted); margin: var(--space-6) 0 var(--space-3); }
  .panel-grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .panel { margin: 0; border: 1px solid var(--color-line); border-radius: var(--radius-md);
    overflow: hidden; background: var(--color-surface); }
  .panel__label { font-size: var(--text-xs); font-weight: var(--font-weight-semibold);
    text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-line); }
  .panel__live { padding: var(--space-6); display: flex; align-items: center; justify-content: center; background: var(--color-bg); }
  .panel__src { position: relative; border-top: 1px solid var(--color-line); }
  .panel__src pre { margin: 0; padding: var(--space-3); overflow-x: auto;
    font-size: var(--text-xs); line-height: var(--leading-normal); background: var(--ink); color: var(--paper); }
  .panel__copy { position: absolute; top: var(--space-2); right: var(--space-2);
    font-size: var(--text-xs); padding: var(--space-1) var(--space-2); cursor: pointer;
    border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-fg); }
  .panel__copy.copied { border-color: var(--ink); }

  /* the nav toggle + close are wide-screen-hidden; the two-column layout needs neither */
  .cat-navtoggle, .cat-nav__close { display: none; }

  /* Narrow (e.g. embedded in a sidebar iframe, or a real phone): there's no room for a
     persistent 240px menu, so the nav COLLAPSES by default and opens FULL-WIDTH over the
     main — the small-screen drawer pattern. The narrow catalog-peek sidebar inherits this. */
  @media (max-width: 640px) {
    .cat { grid-template-columns: 1fr; }
    .cat-navtoggle { display: inline-flex; align-items: center; position: sticky; top: 0; z-index: 30;
      width: 100%; box-sizing: border-box; padding: var(--space-3) var(--space-4);
      border: 0; border-bottom: 1px solid var(--color-line); background: var(--paper); color: var(--ink);
      font-family: var(--font-smooth); font-size: var(--text-sm); text-transform: uppercase;
      letter-spacing: 0.06em; cursor: pointer; }
    .cat-nav { position: fixed; inset: 0; z-index: 40; width: 100%; height: 100dvh;
      background: var(--paper);   /* opaque: a full-screen drawer OVER the main, not see-through */
      transform: translateX(-100%); transition: transform 0.25s ease; overscroll-behavior: contain; }
    .cat[data-nav="open"] .cat-nav { transform: none; }   /* full-screen takeover */
    .cat-nav__close { display: inline-flex; align-items: center; background: transparent; border: 0;
      padding: 0 0 var(--space-3); font-family: var(--font-smooth); font-size: var(--text-sm);
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-muted); cursor: pointer; }
    .cat-main { padding: var(--space-6); overscroll-behavior: contain; }
  }
  @media (prefers-reduced-motion: reduce) { .cat-nav { transition: none; } }

  /* Peek "single" mode: a host that embeds the catalog as a one-at-a-time browser (e.g. the
     /grain sidebar) sets data-peek-single on .cat and toggles .is-peek-active on ONE entry —
     hovering a component elsewhere just swaps which entry shows. Only the active entry renders,
     fading in; nothing scrolls across the long list (no far-scroll thrash). */
  .cat[data-peek-single] .cat-doc { display: none; }
  .cat[data-peek-single] .cat-doc.is-peek-active { display: block;
    animation: cat-peek-fade 0.55s cubic-bezier(0.22, 1, 0.36, 1); }   /* gentle: slow, eased, slight rise */
  @keyframes cat-peek-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  /* single mode is host-driven (hover / Full page) — the host's own header names it, so hide the
     catalog's redundant "☰ Catalog" toggle bar (no stacked double "Catalog"). */
  .cat[data-peek-single] .cat-navtoggle { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .cat[data-peek-single] .cat-doc.is-peek-active { animation: none; }
  }
</style>
</head>
<body>
  <div class="cat" data-nav="closed">
    <button class="cat-navtoggle" type="button" aria-controls="cat-nav" aria-expanded="false">☰&nbsp;&nbsp;Catalog</button>
    <aside class="cat-nav" id="cat-nav">
      <!-- a clear way back (the component nav below isn't an obvious exit); hidden when embedded
           in a peek sidebar iframe, where the host provides its own close/expand controls. -->
      <a class="cat-back" href="/">←&nbsp;&nbsp;Back</a>
      <button class="cat-nav__close" type="button" aria-label="Close menu">✕&nbsp;&nbsp;Close</button>
      <h1>Catalog</h1>
      <p class="cat-nav__auto">Auto-generated by GRAIN from each component's <code>.md</code> doc — not hand-authored.</p>
      <input class="cat-search" type="search" placeholder="Search components…" aria-label="Search components">
      <p class="cat-nav__heading">Pages</p>
      ${pageNav}
      <p class="cat-nav__heading">Components</p>
      ${navGroups}
    </aside>
    <main class="cat-main">
      ${main}
    </main>
  </div>
  <script>
    // copy a panel's source to the clipboard (no storage, no deps)
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".panel__copy");
      if (!btn) return;
      const code = btn.parentElement.querySelector("code").textContent;
      try { await navigator.clipboard.writeText(code); } catch {}
      btn.textContent = "Copied"; btn.classList.add("copied");
      setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1200);
    });

    // Human/AI toggle: set data-grade on the component's section → swaps the visible view.
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".grade-toggle__btn");
      if (!b) return;
      const doc = b.closest(".cat-doc");
      if (!doc) return;
      doc.setAttribute("data-grade", b.dataset.gradeSet);
      doc.querySelectorAll(".grade-toggle__btn").forEach((x) => x.classList.toggle("is-on", x === b));
    });

    // Back button: hidden when embedded in a peek sidebar (the host has its own controls).
    // On the full page, prefer real history-back (→ wherever you came from), else fall to href="/".
    const back = document.querySelector(".cat-back");
    if (back) {
      if (window.self !== window.top) back.style.display = "none";
      else back.addEventListener("click", (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } });
    }

    // narrow-mode nav drawer: the toggle opens the full-width menu; the close button and
    // selecting a component (or a page link) collapse it again. No-op on wide screens
    // (the toggle/close are display:none there, so these never fire).
    const cat = document.querySelector(".cat");
    const navToggle = document.querySelector(".cat-navtoggle");
    const setNav = (open) => {
      cat.setAttribute("data-nav", open ? "open" : "closed");
      navToggle && navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    navToggle && navToggle.addEventListener("click", () => setNav(cat.getAttribute("data-nav") !== "open"));
    document.querySelector(".cat-nav__close")?.addEventListener("click", () => setNav(false));
    // set which entry is shown in peek "single" mode (host or nav both use .is-peek-active)
    const setActive = (slug) => {
      const el = slug && document.getElementById(slug);
      if (!el) return;
      document.querySelectorAll(".cat-doc.is-peek-active").forEach((d) => d.classList.remove("is-peek-active"));
      el.classList.add("is-peek-active");
    };
    window.__catSetActive = setActive;   // host (peek sidebar) drives this on hover
    document.querySelectorAll(".cat-nav a").forEach((a) => a.addEventListener("click", () => {
      setNav(false);
      if (cat.getAttribute("data-peek-single") !== null) {
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#")) setActive(href.slice(1));   // component links; page links navigate normally
      }
    }));

    // sidebar search: filter component links; hide empty groups; open groups while searching.
    const search = document.querySelector(".cat-search");
    if (search) search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      document.querySelectorAll(".cat-nav__group").forEach((group) => {
        let any = false;
        group.querySelectorAll("a").forEach((a) => {
          const hit = !q || (a.dataset.name || "").includes(q);
          a.style.display = hit ? "" : "none";
          if (hit) any = true;
        });
        group.style.display = any ? "" : "none";
        if (q) group.open = true;
      });
    });
  </script>
  ${inject.bodyEnd ?? ""}
</body>
</html>`;
}
