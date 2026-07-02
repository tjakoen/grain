// grain/scripts/catalog-peek.js — a DEMO-only island: a slide-in Catalog sidebar in the
// reference app that bridges usage → specimen. Hovering a component in the demo scrolls the
// embedded /catalog to that component's entry and highlights what you're pointing at.
//
// Contained entirely in grain + the demo, with NO catalog change: it EMBEDS /catalog
// (unchanged) in an <iframe> and maps each rendered CSS class to its catalog section slug
// (the .md title slug — stable for grain's components). Only runs where the panel exists.
(() => {
  "use strict";
  const panel = document.querySelector(".catalog-peek");
  const demo = document.querySelector("[data-peek-root]");   // the site's content root (chrome sits outside it)
  if (!panel || !demo) return;
  const frame = panel.querySelector(".catalog-peek__frame");

  // rendered class → catalog slug. Innermost match wins (hover the glyph → Icon; the row → Nav item).
  const MAP = {
    "action-badge": "action-badge", "icon-btn": "icon-button", "nav-item": "nav-item",
    "tab-bar": "tab-bar", "side-rail": "side-rail", "app-shell": "app-shell",
    "field": "input", "badge": "badge", "kbd": "keyboard-hint", "list": "list",
    "tab": "tab", "btn": "button", "icon": "icon",
  };

  const isOpen = () => panel.getAttribute("data-open") === "true";
  const setOpen = (v) => {
    panel.setAttribute("data-open", v ? "true" : "false");
    if (v && !frame.getAttribute("src")) frame.setAttribute("src", "/catalog");   // lazy-load the catalog
    if (!v && hl) { hl.removeAttribute("data-peek-hl"); hl = null; }
  };
  for (const t of document.querySelectorAll('[data-peek="toggle"]')) t.addEventListener("click", () => setOpen(!isOpen()));
  panel.querySelector(".catalog-peek__close")?.addEventListener("click", () => setOpen(false));

  let last = null, hl = null;
  function peek(slug, el) {
    if (el !== hl) { if (hl) hl.removeAttribute("data-peek-hl"); hl = el; el.setAttribute("data-peek-hl", "true"); }
    if (slug === last) return;
    last = slug;
    panel.setAttribute("data-peek-slug", slug);   // observable state (e2e + reference)
    try { frame.contentDocument?.getElementById(slug)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
    catch { /* iframe not ready / cross-origin — ignore */ }
  }

  demo.addEventListener("mouseover", (e) => {
    if (!isOpen()) return;
    let el = e.target;
    while (el && el !== demo) {
      if (el.classList) for (const cls in MAP) if (el.classList.contains(cls)) { peek(MAP[cls], el); return; }
      el = el.parentElement;
    }
  });
})();
