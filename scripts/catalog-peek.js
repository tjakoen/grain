// grain/scripts/catalog-peek.js — a DEMO-only island: a Catalog sidebar in the reference app
// that bridges usage → specimen. On a hovering pointer, hovering a component in the demo REVEALS
// that component's entry in the embedded /catalog (one at a time, cross-fading — no scrolling).
//
// It EMBEDS /catalog in an <iframe> and maps each rendered CSS class to its catalog section slug
// (the .md title slug — stable for grain's components). The catalog exposes a "single" mode
// (data-peek-single + .is-peek-active, driven here via window.__catSetActive). The reveal mechanic
// is POINTER-ONLY: on touch/coarse devices the sidebar shows the full, scrollable catalog instead.
// Only runs where the panel exists.
(() => {
  "use strict";
  const panel = document.querySelector(".catalog-peek");
  const demo = document.querySelector("[data-peek-root]");   // the site's content root (chrome sits outside it)
  if (!panel || !demo) return;
  const frame = panel.querySelector(".catalog-peek__frame");
  // the hover-to-reveal mechanic only makes sense with a hovering pointer (desktop mouse) —
  // on touch it would be undrivable, so there we leave the full scrollable catalog.
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // rendered CSS class → catalog slug. A hand-maintained BRIDGE (the rendered class often differs
  // from the slug: "icon-btn" → "icon-button", "field" → "input"), so keep it in sync when a
  // component's class or title changes. A drift test (catalog-peek.test.ts) fails if a slug here
  // stops matching a real component. Innermost match wins (hover the glyph → Icon; the row → Nav item).
  const MAP = {
    "action-badge": "action-badge", "icon-btn": "icon-button", "nav-item": "nav-item",
    "tab-bar": "tab-bar", "side-rail": "side-rail", "app-shell": "app-shell",
    "chat-message": "chat-message", "field": "input", "badge": "badge",
    "kbd": "keyboard-hint", "list": "list", "tab": "tab", "btn": "button",
    "icon": "icon", "t": "typography",
  };

  const isOpen = () => panel.getAttribute("data-open") === "true";
  const setOpen = (v) => {
    panel.setAttribute("data-open", v ? "true" : "false");
    if (v && !frame.getAttribute("src")) frame.setAttribute("src", "/catalog");   // lazy-load the catalog
  };
  // [data-peek] hooks: "open" forces open, "close" forces closed, "toggle" (default) flips.
  for (const t of document.querySelectorAll("[data-peek]")) {
    const mode = t.getAttribute("data-peek");
    t.addEventListener("click", () => setOpen(mode === "open" ? true : mode === "close" ? false : !isOpen()));
  }
  panel.querySelector(".catalog-peek__close")?.addEventListener("click", () => setOpen(false));

  // once the embedded catalog loads, put it in "single" mode (show one entry at a time) and
  // default to the first entry so the sidebar isn't blank before the first hover. Pointer-only:
  // on touch we skip single mode and leave the full scrollable catalog.
  frame.addEventListener("load", () => {
    if (!canHover) return;
    try {
      const doc = frame.contentDocument;
      const cat = doc && doc.querySelector(".cat");
      if (!cat) return;
      cat.setAttribute("data-peek-single", "");
      // honour a hover that happened before load finished, else default to the first entry
      if (last && doc.getElementById(last)) showInFrame(last);
      else if (!doc.querySelector(".cat-doc.is-peek-active")) doc.querySelector(".cat-doc")?.classList.add("is-peek-active");
    } catch { /* cross-origin / not ready — ignore */ }
  });

  let last = null, showTimer = 0;
  // Reveal one entry (cross-fading), debounced so sweeping the pointer doesn't strobe the fade.
  function showInFrame(slug) {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
      try {
        const win = frame.contentWindow, doc = frame.contentDocument;
        if (win && typeof win.__catSetActive === "function") { win.__catSetActive(slug); return; }
        // fallback before the catalog's own script has attached
        const target = doc && doc.getElementById(slug);
        if (target && !target.classList.contains("is-peek-active")) {
          doc.querySelectorAll(".cat-doc.is-peek-active").forEach((d) => d.classList.remove("is-peek-active"));
          target.classList.add("is-peek-active");
        }
      } catch { /* iframe not ready / cross-origin — ignore */ }
    }, 70);
  }

  function peek(slug) {
    if (slug === last) return;
    last = slug;
    panel.setAttribute("data-peek-slug", slug);   // observable state (e2e + reference)
    showInFrame(slug);   // reveal-one: the sidebar shows just this entry, cross-fading — no scrolling
  }

  demo.addEventListener("mouseover", (e) => {
    if (!canHover || !isOpen()) return;
    let el = e.target;
    while (el && el !== demo) {
      if (el.classList) for (const cls in MAP) if (el.classList.contains(cls)) { peek(MAP[cls]); return; }
      el = el.parentElement;
    }
    // No component under the pointer → HOLD the current reveal (don't switch on prose/gaps). This
    // lets you move the pointer across the page to the sidebar and scroll the revealed entry
    // without it changing out from under you.
  });
})();
