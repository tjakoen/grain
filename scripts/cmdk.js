// /frontend/scripts/cmdk.js — global command palette (Spotlight / Notion ⌘K style).
//
// Self-contained: one <script> tag drops it onto any page. Injects its own styles +
// overlay, binds ⌘K / Ctrl+K, fetches /search.json once, filters, and navigates.
// Monochrome e-ink look via the page's design tokens. Today it indexes pages +
// components; the seam to add tasks/knowledge — and to let a result EMIT an intent
// through the one door (palette as another action-vocabulary client) — is marked below.
(() => {
  "use strict";
  let data = null, items = [], sel = 0, root, input, list;

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const isOpen = () => root && root.classList.contains("is-open");

  function styles() {
    const css = `
.cmdk { position: fixed; inset: 0; z-index: 10000; display: none; }
.cmdk.is-open { display: block; }
.cmdk__backdrop { position: absolute; inset: 0; background: rgba(28,27,23,.35); }
.cmdk__sheet { position: relative; max-width: 560px; margin: 12vh auto 0; background: var(--paper, #E2E0D8);
  border: 1px solid var(--ink, #1C1B17); border-radius: var(--radius-md, 4px); overflow: hidden;
  font-family: var(--font-smooth, "Times New Roman", serif); color: var(--ink, #1C1B17); }
.cmdk__input { width: 100%; box-sizing: border-box; border: 0; border-bottom: 1px solid var(--ink, #1C1B17);
  background: transparent; padding: .85rem 1rem; font-family: inherit; font-size: 1.1rem; color: inherit; outline: none; }
.cmdk__input::placeholder { color: var(--ink-faint, #ABA89F); }
.cmdk__list { list-style: none; margin: 0; padding: .25rem; max-height: 52vh; overflow: auto; }
.cmdk__item { display: flex; align-items: baseline; gap: .6rem; padding: .5rem .75rem; border-radius: 2px; cursor: pointer; }
.cmdk__item.is-sel { background: var(--ink, #1C1B17); color: var(--paper, #E2E0D8); }
.cmdk__sub { color: var(--ink-muted, #6E6C64); font-size: .85em; }
.cmdk__item.is-sel .cmdk__sub { color: var(--paper, #E2E0D8); }
.cmdk__kind { margin-left: auto; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-faint, #ABA89F); }
.cmdk__item.is-sel .cmdk__kind { color: var(--paper, #E2E0D8); }
.cmdk__empty { padding: .75rem 1rem; color: var(--ink-muted, #6E6C64); }
.cmdk__hint { padding: .5rem 1rem; border-top: 1px solid var(--line-soft, rgba(28,27,23,.14));
  font-size: .7rem; color: var(--ink-muted, #6E6C64); text-transform: uppercase; letter-spacing: .06em; }`;
    const el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
  }

  function build() {
    root = document.createElement("div");
    root.className = "cmdk";
    root.innerHTML = `
      <div class="cmdk__backdrop"></div>
      <div class="cmdk__sheet" role="dialog" aria-modal="true" aria-label="Search">
        <input class="cmdk__input" type="text" placeholder="Search pages and components…" aria-label="Search">
        <ul class="cmdk__list" role="listbox"></ul>
        <div class="cmdk__hint">↑↓ navigate · ↵ open · esc close</div>
      </div>`;
    document.body.appendChild(root);
    input = root.querySelector(".cmdk__input");
    list = root.querySelector(".cmdk__list");
    root.querySelector(".cmdk__backdrop").addEventListener("click", close);
    input.addEventListener("input", render);
    input.addEventListener("keydown", onKey);
    list.addEventListener("click", (e) => { const li = e.target.closest(".cmdk__item"); if (li) { sel = +li.dataset.i; activate(); } });
    list.addEventListener("mousemove", (e) => { const li = e.target.closest(".cmdk__item"); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; paint(); } });
  }

  async function load() {
    if (data) return;
    try { data = await (await fetch("/search.json")).json(); }
    catch { data = { pages: [], components: [] }; }
  }

  const corpus = () => [
    ...(data.pages || []).map((p) => ({ ...p, kind: "Page" })),
    ...(data.components || []).map((c) => ({ ...c, kind: "Component" })),
    // SEAM: tasks/knowledge entries, and "command" entries that emit an intent
    // through /intent (palette = another client of the one door) — AI-INTERFACE §6.
  ];

  function paint() {
    [...list.children].forEach((el, i) => el.classList && el.classList.toggle("is-sel", i === sel));
    if (list.children[sel]) list.children[sel].scrollIntoView({ block: "nearest" });
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    items = corpus().filter((e) => !q || (e.title + " " + (e.subtitle || "")).toLowerCase().includes(q)).slice(0, 30);
    sel = 0;
    list.innerHTML = items.length
      ? items.map((e, i) => `<li class="cmdk__item${i === 0 ? " is-sel" : ""}" role="option" data-i="${i}">
          <span class="cmdk__title">${esc(e.title)}</span>
          ${e.subtitle ? `<span class="cmdk__sub">${esc(e.subtitle)}</span>` : ""}
          <span class="cmdk__kind">${esc(e.kind)}</span></li>`).join("")
      : `<li class="cmdk__empty">No matches</li>`;
  }

  function move(d) { if (!items.length) return; sel = (sel + d + items.length) % items.length; paint(); }
  function activate() { const e = items[sel]; if (e && e.url) location.assign(e.url); }

  function onKey(ev) {
    if (ev.key === "ArrowDown") { ev.preventDefault(); move(1); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); move(-1); }
    else if (ev.key === "Enter") { ev.preventDefault(); activate(); }
    else if (ev.key === "Escape") { ev.preventDefault(); close(); }
  }

  function open() { root.classList.add("is-open"); input.value = ""; load().then(render); input.focus(); }
  function close() { root.classList.remove("is-open"); }

  function init() {
    styles(); build();
    document.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") { ev.preventDefault(); isOpen() ? close() : open(); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
