// grain/catalog/catalog.ts — GRAIN's self-documenting "component catalog" (Storybook-style).
// Each component is documented by `<name>.md` (the Human view); an optional
// `<name>.ai.md` adds the AI view. A per-component Human/AI toggle swaps which view
// renders (not just its styling) — that toggle IS grain's grade-as-signal vocabulary,
// which is why the catalog lives in grain, not the substrate. The sidebar groups
// components by atomic-design layer (the directory under components/) as collapsible
// dropdowns, with a live search filter. Dependency-free: a tiny line parser, no
// markdown library, no CDN. It reads the filesystem directly (like ai/accepts.ts) and
// imports nothing from batch — the composition root passes the page-nav routes in.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface Panel { label: string; code: string; flat?: boolean; }
// `prose` is the paragraphs written under a `## ` heading. They used to be dropped on the floor
// while the heading was still emitted, so a section explaining a caller rule rendered as a heading
// with nothing beneath it — worse than losing the text, because it reads as broken rather than
// absent. Both intro and group prose are PARAGRAPHS rather than one joined string: joining them was
// what turned four paragraphs of a component doc into a single wall.
interface Group { label: string; prose: string[]; panels: Panel[]; }
// A control is one input on a doc's playground, declared in a ```controls fence (one per line):
//   select <attr> [@ <selector>] = a | b | c     a "-" option removes the attribute
//   toggle <attr> [@ <selector>] [= <value>]      present or absent; value defaults to empty
//   text <selector> = <default text>              edits that element's text
// The shape copies Ladle's and Storybook's small fixed set of control kinds (plans/catalog-explorer.md).
export interface Control { kind: "select" | "toggle" | "text"; name: string; selector: string; options: string[]; value: string; }
interface Doc { name: string; slug: string; intro: string[]; groups: Group[]; controls: Control[]; a11y: string[]; }
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
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]*|#[^)]*)\)/g, '<a href="$2">$1</a>')
  // A link the rule above did NOT take is a RELATIVE one, and the commonest by far is a sibling
  // doc: [Radio](../b-radio/b-radio.md). It cannot become an anchor, because a .md path on disk is
  // not a route this site serves and doc-links.test.ts exists to stop docs inventing routes. But
  // leaving it whole printed the raw markdown mid-sentence in every doc that referenced a sibling.
  // Keep the text, drop the target: the reader gets a name, and the file keeps a link that works
  // wherever the markdown is read directly.
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

// atomic-design layers render in this order; unknown dirs fall to the end.
const LAYER_ORDER = ["atoms", "molecules", "organisms", "dashboards"];
const rank = (layer: string) => { const i = LAYER_ORDER.indexOf(layer); return i < 0 ? 99 : i; };

/** Parse one line of a ```controls fence, or return null when it is not one. */
export function parseControl(line: string): Control | null {
  const m = line.trim().match(/^(select|toggle|text)\s+(\S+)(?:\s+@\s+([^=]+?))?\s*(?:=\s*(.*))?$/);
  if (!m) return null;
  const kind = m[1] as Control["kind"];
  const rest = (m[4] ?? "").trim();
  if (kind === "text") return { kind, name: m[2], selector: m[2], options: [], value: rest };
  const options = kind === "select" ? rest.split("|").map((o) => o.trim()).filter(Boolean) : [];
  if (kind === "select" && !options.length) return null;
  return { kind, name: m[2], selector: (m[3] ?? "").trim(), options, value: kind === "select" ? options[0] : rest };
}

// minimal markdown: # title, ## group, ### panel, ```html fences, plain prose.
// A fence tagged ```html flat renders as SOURCE ONLY, with no live panel. That escape hatch
// exists for markup a catalog panel cannot honestly host: a component that sizes itself from
// the viewport, or one that goes position: fixed, takes over the whole catalog page rather than
// demonstrating itself inside its box. Default stays live — flat is the exception a doc asks for.
function parseDoc(md: string): Doc {
  const lines = md.split("\n");
  const doc: Doc = { name: "Untitled", slug: "untitled", intro: [], groups: [], controls: [], a11y: [] };
  let group: Group | null = null;
  let pendingLabel = "";
  const intro: string[] = [];
  let i = 0;

  /** Collect prose into the open group, or into the intro when none is open. A BLANK line ends the
   *  paragraph; consecutive non-blank lines are one paragraph re-joined, because these files are
   *  hard-wrapped and a wrap is not a paragraph break. */
  const pushProse = (line: string) => {
    const into = group ? group.prose : intro;
    const text = line.trim();
    if (!text) { if (into.length && into[into.length - 1] !== "") into.push(""); return; }
    if (!into.length || into[into.length - 1] === "") into.push(text);
    else into[into.length - 1] += ` ${text}`;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# ")) { doc.name = line.slice(2).trim(); doc.slug = slugify(doc.name); i++; continue; }
    if (line.startsWith("## ")) { group = { label: line.slice(3).trim(), prose: [], panels: [] }; doc.groups.push(group); pendingLabel = ""; i++; continue; }
    if (line.startsWith("### ")) { pendingLabel = line.slice(4).trim(); i++; continue; }
    if (line.startsWith("```html")) {
      const flat = /\bflat\b/.test(line.slice(7));
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { body.push(lines[i]); i++; }
      i++; // skip closing fence
      if (!group) { group = { label: "", prose: [], panels: [] }; doc.groups.push(group); }
      group.panels.push({ label: pendingLabel, code: body.join("\n").trim(), flat });
      continue;
    }
    if (line.startsWith("```controls")) {
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { const c = parseControl(lines[i]); if (c) doc.controls.push(c); i++; }
      i++;
      continue;
    }
    // Any OTHER fence (```json, a bare ```) is skipped whole rather than read as prose. Falling
    // through used to sweep a spec block's braces into the surrounding paragraph, which is how raw
    // JSON ended up mid-sentence in two shipped intros.
    if (line.startsWith("```")) {
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) i++;
      i++;
      continue;
    }
    pushProse(line);
    i++;
  }
  doc.intro = intro.filter(Boolean);
  for (const g of doc.groups) g.prose = g.prose.filter(Boolean);
  // An Accessibility section renders as its own labelled block beside the preview, not as one more
  // group of panels, so it is lifted out here. Its panels, if a doc gave it any, stay as a group.
  const a11y = doc.groups.findIndex((g) => /^accessibility$/i.test(g.label));
  if (a11y >= 0) {
    doc.a11y = doc.groups[a11y].prose;
    if (doc.groups[a11y].panels.length) doc.groups[a11y].prose = [];
    else doc.groups.splice(a11y, 1);
  }
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
    return `<figure class="panel"${p.flat ? " data-flat" : ""}>
      ${p.label ? `<figcaption class="panel__label">${esc(p.label)}</figcaption>` : ""}
      ${p.flat ? `<p class="panel__flat">Source only — this one owns the whole window, so a panel cannot host it. Open a real one.</p>` : `<div class="panel__live">${liveSafe(p.code)}</div>`}
      <div class="panel__src">
        <button class="panel__copy" type="button">Copy</button>
        <pre tabindex="0"><code>${esc(p.code)}</code></pre>
      </div>
    </figure>`;
  }

  const paras = (cls: string, ps: string[]) => ps.map((p) => `<p class="${cls}">${inline(p)}</p>`).join("");

  const renderGroups = (groups: Group[]) => groups.map(g => `
    ${g.label ? `<h3 class="cat-group">${esc(g.label)}</h3>` : ""}
    ${paras("cat-note", g.prose)}
    ${g.panels.length ? `<div class="panel-grid">${g.panels.map(renderPanel).join("")}</div>` : ""}`).join("");

  const renderControl = (slug: string, c: Control, n: number): string => {
    const id = `ctl-${slug}-${n}`;
    const data = `data-kind="${c.kind}" data-name="${esc(c.name)}" data-selector="${esc(c.selector)}"`;
    const label = c.kind === "text" ? `Text of ${c.selector}` : c.selector ? `${c.name} on ${c.selector}` : c.name;
    if (c.kind === "select") return `<div class="cat-ctl"><label for="${id}">${esc(label)}</label>
      <select id="${id}" class="cat-ctl__input" ${data}>${c.options.map((o) => `<option value="${esc(o)}">${o === "-" ? "none" : esc(o)}</option>`).join("")}</select></div>`;
    if (c.kind === "toggle") return `<div class="cat-ctl cat-ctl--toggle"><input id="${id}" type="checkbox" class="cat-ctl__input" ${data} data-value="${esc(c.value)}"><label for="${id}">${esc(label)}</label></div>`;
    return `<div class="cat-ctl"><label for="${id}">${esc(label)}</label><input id="${id}" type="text" class="cat-ctl__input" ${data} value="${esc(c.value)}"></div>`;
  };

  // The playground: the doc's first live example, a form of its controls, a width switch and the
  // source regenerated from the live markup by the page script, so what you copy is what you see.
  function renderPlayground(slug: string, doc: Doc): string {
    const first = doc.groups.flatMap((g) => g.panels).find((p) => !p.flat);
    if (!doc.controls.length || !first) return "";
    return `<section class="cat-play" aria-label="Playground for ${esc(doc.name)}" data-play>
      <div class="cat-play__stage">
        <div class="cat-play__widths" role="group" aria-label="Preview width">
          ${["Full", "Tablet", "Phone"].map((w, n) => `<button type="button" class="cat-play__width" data-width="${w.toLowerCase()}" aria-pressed="${n === 0}">${w}</button>`).join("")}
        </div>
        <div class="cat-play__frame" data-width="full" tabindex="0" role="region" aria-label="Preview of ${esc(doc.name)}"><div class="cat-play__live panel__live">${liveSafe(first.code)}</div></div>
      </div>
      <form class="cat-play__controls" aria-label="Controls" onsubmit="return false">
        <h3 class="cat-play__heading">Controls</h3>
        ${doc.controls.map((c, n) => renderControl(slug, c, n)).join("")}
      </form>
      <div class="panel__src cat-play__src">
        <button class="panel__copy" type="button">Copy</button>
        <pre tabindex="0" aria-label="Source for the current controls"><code>${esc(first.code)}</code></pre>
      </div>
    </section>`;
  }

  const renderA11y = (doc: Doc) => doc.a11y.length ? `<aside class="cat-a11y" aria-label="Accessibility notes for ${esc(doc.name)}">
      <h3 class="cat-a11y__heading">Accessibility</h3>${paras("cat-note", doc.a11y)}</aside>` : "";

  const renderView = (doc: Doc, view: "smooth" | "grain", slug = doc.slug) => `<div class="cat-doc__view" data-view="${view}">
    ${paras("cat-intro", doc.intro)}
    ${view === "smooth" ? renderPlayground(slug, doc) : ""}
    ${renderA11y(doc)}
    ${renderGroups(doc.groups)}
  </div>`;

  function renderDoc(c: Component): string {
    const ai = c.ai ?? c.human;   // no .ai.md → AI view re-uses the human panels, grain-flipped
    // data-surface addresses the entry so a tour, a lamp or the reasoner can point AT one
    // component rather than at "the catalog". The id stays for plain anchor links.
    return `<section class="cat-doc" id="${c.slug}" data-surface="catalog:${esc(c.slug)}" data-grade="smooth" data-layer="${c.layer}">
      <header class="cat-doc__head">
        <div class="cat-doc__title">
          <h2>${esc(c.name)}</h2>
          <p class="cat-doc__layer">${esc(cap(c.layer))}</p>
        </div>
        <div class="grade-toggle" role="group" aria-label="Interaction mode for ${esc(c.name)}">
          <button type="button" class="grade-toggle__btn is-on" data-grade-set="smooth">Human</button>
          <button type="button" class="grade-toggle__btn" data-grade-set="grain">AI</button>
        </div>
      </header>
      ${renderView(c.human, "smooth", c.slug)}
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
        <summary>${esc(cap(layer))} <span class="cat-nav__count">${list.length}</span></summary>
        ${list.map(c => `<a href="#${c.slug}" data-name="${esc(c.name.toLowerCase())}" data-text="${esc(c.human.intro.join(" ").toLowerCase().slice(0, 400))}">${esc(c.name)}</a>`).join("")}
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
  .cat { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; background: var(--color-bg); }
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
  .cat-nav__heading { font-size: var(--text-sm); font-weight: var(--font-weight-semibold);
    color: var(--ink); margin: var(--space-4) 0 var(--space-1); }
  .cat-nav__group { margin-bottom: var(--space-2); }
  .cat-nav__group > summary { cursor: pointer; list-style: none; padding: var(--space-1) 0;
    font-size: var(--text-sm); font-weight: var(--font-weight-semibold); color: var(--ink); }
  .cat-nav__count { font-weight: var(--font-weight-regular); color: var(--color-muted); }
  .cat-nav__group > summary::-webkit-details-marker { display: none; }
  .cat-nav__group > summary::before { content: "▸ "; }
  .cat-nav__group[open] > summary::before { content: "▾ "; }
  .cat-nav a { display: block; color: var(--color-muted); text-decoration: none; padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm); border-inline-start: 2px solid transparent; }
  .cat-nav a:hover { color: var(--ink); text-decoration: underline; }
  .cat-nav a[aria-current="true"] { color: var(--ink); border-inline-start-color: var(--ink); background: var(--paper-2); }
  .cat :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  .cat-skip { position: absolute; inset-inline-start: var(--space-2); inset-block-start: -10rem; z-index: 50;
    padding: var(--space-2) var(--space-3); background: var(--paper); color: var(--ink); border: var(--border); border-radius: var(--radius-sm); }
  .cat-skip:focus { inset-block-start: var(--space-2); }
  .cat-search__wrap { position: relative; }
  .cat-search__key { position: absolute; inset-inline-end: var(--space-2); inset-block-start: var(--space-1);
    font-size: var(--text-xs); color: var(--color-muted); pointer-events: none; }
  .cat-search__status { font-size: var(--text-xs); color: var(--color-muted); margin: calc(-1 * var(--space-3)) 0 var(--space-3); min-block-size: 1.2em; }
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
  .cat-doc__layer { font-size: var(--text-sm); color: var(--color-muted); margin: var(--space-1) 0 0; }
  .cat-doc__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4);
    flex-wrap: wrap; padding-bottom: var(--space-3); margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--color-line); }   /* masthead rhythm: title block → hairline → body */
  .grade-toggle { display: inline-flex; border: 1px solid var(--ink); border-radius: var(--radius-sm); overflow: hidden; }
  .grade-toggle__btn { font-family: var(--font-smooth); font-size: var(--text-sm); padding: var(--space-1) var(--space-3); cursor: pointer;
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
  /* Intro paragraphs sit close together and the LAST one opens the gap before the first group, so a
     three-paragraph intro reads as three paragraphs rather than as one block with a hole after it. */
  .cat-intro { color: var(--color-muted); margin: 0 0 var(--space-3); }
  .cat-intro:last-of-type { margin-bottom: var(--space-6); }
  /* Prose written under a section heading: the caller rules, the limits, the why. Same voice as the
     intro, and measure-capped so it does not read as one column with the panels below it. */
  .cat-note { color: var(--color-muted); margin: 0 0 var(--space-3); max-inline-size: 68ch; }
  .cat-intro code, .cat-note code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.88em;
    background: var(--paper-2); padding: 0 0.3em; border-radius: 2px; color: var(--ink); }
  .cat-intro strong, .cat-note strong { color: var(--ink); font-weight: var(--font-weight-semibold); }
  .cat-intro a, .cat-note a { color: var(--ink); }
  .cat-group { font-size: var(--text-base); font-weight: var(--font-weight-semibold);
    color: var(--ink); margin: var(--space-6) 0 var(--space-3); }
  /* Playground: preview, controls and live source. Two columns when there is room, one when not. */
  .cat-play { display: grid; gap: 0; grid-template-columns: minmax(0, 1fr) minmax(12rem, 16rem); margin: 0 0 var(--space-6);
    border: var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--color-surface); }
  .cat-play__stage { display: grid; align-content: start; gap: var(--space-2); padding: var(--space-3); min-inline-size: 0; }
  .cat-play__widths { display: inline-flex; gap: var(--space-1); justify-self: start; }
  .cat-play__width { font: inherit; font-size: var(--text-xs); padding: var(--space-1) var(--space-2); cursor: pointer;
    border: var(--border); border-radius: var(--radius-sm); background: transparent; color: var(--ink); }
  .cat-play__width[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .cat-play__frame { inline-size: 100%; margin-inline: auto; border: 1px dashed var(--color-line); border-radius: var(--radius-sm); overflow: auto; }
  .cat-play__frame[data-width="tablet"] { max-inline-size: 48rem; }
  .cat-play__frame[data-width="phone"] { max-inline-size: 23.5rem; }
  .cat-play__live { display: block; }
  .cat-play__controls { display: grid; align-content: start; gap: var(--space-3); padding: var(--space-3) var(--space-4);
    border-inline-start: var(--border); font-size: var(--text-sm); }
  .cat-play__heading { margin: 0; font-size: var(--text-sm); font-weight: var(--font-weight-semibold); }
  .cat-ctl { display: grid; gap: var(--space-1); }
  .cat-ctl label { color: var(--color-muted); }
  .cat-ctl--toggle { grid-template-columns: auto 1fr; align-items: center; gap: var(--space-2); }
  .cat-ctl__input { font: inherit; color: var(--ink); background: var(--color-bg); border: 1px solid var(--ink);
    border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); min-inline-size: 0; }
  .cat-ctl--toggle .cat-ctl__input { inline-size: 1.1rem; block-size: 1.1rem; padding: 0; accent-color: var(--ink); }
  .cat-play__src { grid-column: 1 / -1; }
  .cat-a11y { margin: 0 0 var(--space-6); padding: var(--space-3) var(--space-4); border-inline-start: 3px solid var(--ink);
    background: var(--paper-2); border-radius: var(--radius-sm); }
  .cat-a11y__heading { margin: 0 0 var(--space-2); font-size: var(--text-base); font-weight: var(--font-weight-semibold); color: var(--ink); }
  .cat-a11y .cat-note { color: var(--ink); }
  .cat-a11y .cat-note:last-child { margin-bottom: 0; }
  @media (max-width: 760px) { .cat-play { grid-template-columns: minmax(0, 1fr); }
    .cat-play__controls { border-inline-start: 0; border-block-start: var(--border); } }
  .panel-grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  /* Dashboards lay themselves out by their own width, so their panels take the whole row and the
     live area stops centring: a centred flex box shrank a dashboard to the width of its widest word. */
  .cat-doc[data-layer="dashboards"] .panel-grid { grid-template-columns: minmax(0, 1fr); }
  .cat-doc[data-layer="dashboards"] .panel__live { display: block; }
  .panel { margin: 0; border: 1px solid var(--color-line); border-radius: var(--radius-md);
    overflow: hidden; background: var(--color-surface); }
  .panel__label { font-size: var(--text-sm); font-weight: var(--font-weight-medium); color: var(--color-muted);
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-line); }
  .panel__live { padding: var(--space-6); display: flex; align-items: center; justify-content: center; background: var(--color-bg); }
  .panel__flat { margin: 0; padding: var(--space-4) var(--space-6); background: var(--color-bg);
    font-size: var(--text-xs); color: var(--color-muted); text-align: center; }
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
    .cat { grid-template-columns: minmax(0, 1fr); }
    .cat-navtoggle { display: inline-flex; align-items: center; position: sticky; top: 0; z-index: 30;
      width: 100%; box-sizing: border-box; padding: var(--space-3) var(--space-4);
      border: 0; border-bottom: 1px solid var(--color-line); background: var(--paper); color: var(--ink);
      font-family: var(--font-smooth); font-size: var(--text-sm); font-weight: var(--font-weight-semibold); cursor: pointer; }
    .cat-nav { position: fixed; inset: 0; z-index: 40; width: 100%; height: 100dvh;
      background: var(--paper);   /* opaque: a full-screen drawer OVER the main, not see-through */
      transform: translateX(-100%); transition: transform 0.25s ease; overscroll-behavior: contain; }
    .cat[data-nav="open"] .cat-nav { transform: none; }   /* full-screen takeover */
    .cat-nav__close { display: inline-flex; align-items: center; background: transparent; border: 0;
      padding: 0 0 var(--space-3); font-family: var(--font-smooth); font-size: var(--text-sm); color: var(--color-muted); cursor: pointer; }
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
  <a class="cat-skip" href="#cat-main">Skip to components</a>
  <div class="cat" data-nav="closed">
    <button class="cat-navtoggle" type="button" aria-controls="cat-nav" aria-expanded="false">☰&nbsp;&nbsp;Catalog</button>
    <aside class="cat-nav" id="cat-nav">
      <!-- a clear way back (the component nav below isn't an obvious exit); hidden when embedded
           in a peek sidebar iframe, where the host provides its own close/expand controls. -->
      <a class="cat-back" href="/">←&nbsp;&nbsp;Back</a>
      <button class="cat-nav__close" type="button" aria-label="Close menu">✕&nbsp;&nbsp;Close</button>
      <h1>Catalog</h1>
      <p class="cat-nav__auto">Auto-generated by GRAIN from each component's <code>.md</code> doc — not hand-authored.</p>
      <div class="cat-search__wrap">
        <input class="cat-search" type="search" placeholder="Search components" aria-label="Search components" aria-keyshortcuts="/" aria-describedby="cat-search-status">
        <kbd class="cat-search__key" aria-hidden="true">/</kbd>
      </div>
      <p class="cat-search__status" id="cat-search-status" role="status" aria-live="polite"></p>
      <p class="cat-nav__heading">Pages</p>
      ${pageNav}
      <p class="cat-nav__heading">Components</p>
      ${navGroups}
    </aside>
    <main class="cat-main" id="cat-main" tabindex="-1">
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

    // sidebar search: name and opening prose; hide empty groups; announce the count; "/" opens it,
    // Escape clears it. Arrow keys move through the visible sidebar links.
    const search = document.querySelector(".cat-search");
    const status = document.getElementById("cat-search-status");
    const filter = () => {
      const q = search.value.trim().toLowerCase();
      let hits = 0;
      document.querySelectorAll(".cat-nav__group").forEach((group) => {
        let any = false;
        group.querySelectorAll("a").forEach((a) => {
          const hit = !q || (a.dataset.name || "").includes(q) || (a.dataset.text || "").includes(q);
          a.style.display = hit ? "" : "none";
          if (hit) { any = true; hits++; }
        });
        group.style.display = any ? "" : "none";
        if (q) group.open = true;
      });
      if (status) status.textContent = !q ? "" : hits ? hits + (hits === 1 ? " component matches" : " components match") : "No component matches \u201c" + search.value.trim() + "\u201d";
    };
    if (search) {
      search.addEventListener("input", filter);
      search.addEventListener("keydown", (e) => { if (e.key === "Escape" && search.value) { search.value = ""; filter(); e.stopPropagation(); } });
      document.addEventListener("keydown", (e) => {
        const t = e.target;
        const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
        if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setNav(true); search.focus(); }
      });
    }
    const navEl = document.querySelector(".cat-nav");
    navEl && navEl.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const links = [...navEl.querySelectorAll(".cat-nav__group a")].filter((a) => a.offsetParent !== null);
      if (!links.length) return;
      const i = links.indexOf(document.activeElement);
      if (i < 0 && document.activeElement !== search) return;
      e.preventDefault();
      const next = e.key === "ArrowDown" ? Math.min(i + 1, links.length - 1) : Math.max(i - 1, 0);
      links[next].focus();
    });

    // mark the component in view in the sidebar (aria-current), so the reader knows where they are
    if ("IntersectionObserver" in window) {
      const navLinks = new Map([...document.querySelectorAll(".cat-nav__group a")].map((a) => [a.getAttribute("href").slice(1), a]));
      const io = new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) {
          navLinks.forEach((a) => a.removeAttribute("aria-current"));
          navLinks.get(en.target.id)?.setAttribute("aria-current", "true");
        }
      }, { rootMargin: "-20% 0px -70% 0px" });
      document.querySelectorAll(".cat-doc").forEach((d) => io.observe(d));
    }

    // playground: each control rewrites the preview's root (or a selector inside it), then the
    // source panel is regenerated from the live markup, so the copied code matches the preview.
    document.querySelectorAll("[data-play]").forEach((play) => {
      const live = play.querySelector(".cat-play__live");
      const code = play.querySelector(".cat-play__src code");
      const root = live.firstElementChild;
      const sync = () => { code.textContent = root ? root.outerHTML : ""; };
      play.querySelectorAll(".cat-ctl__input").forEach((input) => {
        const apply = () => {
          const sel = input.dataset.selector;
          const kind = input.dataset.kind;
          if (kind === "text") { const el = live.querySelector(sel); if (el) el.textContent = input.value; return sync(); }
          const el = sel ? live.querySelector(sel) : root;
          if (!el) return;
          if (kind === "select") { input.value === "-" ? el.removeAttribute(input.dataset.name) : el.setAttribute(input.dataset.name, input.value); }
          else input.checked ? el.setAttribute(input.dataset.name, input.dataset.value || "") : el.removeAttribute(input.dataset.name);
          sync();
        };
        input.addEventListener(input.type === "text" ? "input" : "change", apply);
      });
      play.querySelectorAll(".cat-play__width").forEach((b) => b.addEventListener("click", () => {
        play.querySelector(".cat-play__frame").dataset.width = b.dataset.width;
        play.querySelectorAll(".cat-play__width").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      }));
    });
  </script>
  ${inject.bodyEnd ?? ""}
</body>
</html>`;
}
