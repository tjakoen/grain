// grain/scripts/drawer.js — the drawer organism's behavior: open, close, and the modal
// obligations that come with covering the page.
//
// A drawer is a MODAL overlay, and the three things that make one usable are the three every
// hand-rolled implementation skips: focus goes INTO it on open, Tab stays inside while it's up,
// and focus comes BACK to the control that opened it on close. Ship those here so no consumer has
// to remember them — the drawer that scrolls a form under a scrim while the page behind it still
// takes Tab is the failure mode this file exists to prevent.
//
// The visible state is the plain `hidden` attribute, so a server can render an open drawer and a
// page with no JS renders a closed one (never an overlay stranded across the screen). Delegated
// off document, so markup swapped in later — a fragment loaded into the body, a re-rendered
// list — is wired with no re-init. Pure UI chrome: it knows nothing about the AI door.
//
// OPT-IN markup:
//   <button data-drawer-open="my-drawer">New</button>       // value = the drawer's id
//   <aside class="drawer" id="my-drawer" data-drawer hidden>
//     <div class="drawer__backdrop" data-drawer-close></div>
//     <div class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="my-drawer-t">
//       <header class="drawer__head"><h2 id="my-drawer-t">New</h2>
//         <button class="icon-btn" data-drawer-close aria-label="Close">✕</button></header>
//       <div class="drawer__body">…</div>
//     </div>
//   </aside>
// A `data-drawer-open` with no value opens the page's only `[data-drawer]`.
(() => {
  "use strict";
  if (window.grain && window.grain.drawer) return;   // idempotent

  // what can hold focus inside the panel — the Tab cycle's endpoints come from this list
  const FOCUSABLE = [
    "a[href]", "button:not([disabled])", "input:not([disabled])", "select:not([disabled])",
    "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  let openEl = null;      // the drawer currently up (only ever one)
  let opener = null;      // the control that opened it, to hand focus back to
  let inerted = [];       // the body children we made inert, to undo exactly

  const panelOf = (d) => d.querySelector(".drawer__panel") || d;
  const focusables = (d) => [...panelOf(d).querySelectorAll(FOCUSABLE)]
    .filter((el) => el.offsetParent !== null || el === document.activeElement);

  const find = (id) => (id ? document.getElementById(id) : document.querySelector("[data-drawer]"));

  function open(target, from) {
    const d = typeof target === "string" ? find(target) : target;
    if (!d || d === openEl) return null;
    if (openEl) close();                       // never stack drawers
    openEl = d;
    opener = from || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    d.removeAttribute("hidden");

    // everything else on the page stops taking focus, pointer events and AT attention. `inert`
    // is one attribute that does all three — the aria-hidden + tabindex dance it replaces was
    // always partial (it never stopped a click reaching what it hid).
    inerted = [...document.body.children].filter((c) => c !== d && !c.hasAttribute("inert"));
    for (const c of inerted) c.setAttribute("inert", "");

    // focus the first real control, else the panel itself (a body of prose still needs to
    // receive Escape and be where the screen reader lands).
    const first = focusables(d)[0];
    if (first) first.focus();
    else {
      const p = panelOf(d);
      if (!p.hasAttribute("tabindex")) p.setAttribute("tabindex", "-1");
      p.focus();
    }
    d.dispatchEvent(new CustomEvent("grain:drawer-open", { bubbles: true }));
    return d;
  }

  function close() {
    const d = openEl;
    if (!d) return null;
    openEl = null;
    d.setAttribute("hidden", "");
    for (const c of inerted) c.removeAttribute("inert");
    inerted = [];
    // hand focus back to whatever opened it — losing it to <body> drops a keyboard user at the
    // top of the page with no idea where they were.
    if (opener && opener.isConnected) opener.focus();
    opener = null;
    d.dispatchEvent(new CustomEvent("grain:drawer-close", { bubbles: true }));
    return d;
  }

  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const closer = t.closest("[data-drawer-close]");
    if (closer) { e.preventDefault(); close(); return; }
    const btn = t.closest("[data-drawer-open]");
    if (btn) { e.preventDefault(); open(btn.getAttribute("data-drawer-open"), btn); }
  });

  document.addEventListener("keydown", (e) => {
    if (!openEl) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    // the trap: wrap at the ends rather than letting Tab walk out behind the scrim. `inert` above
    // already blocks the page, but the browser chrome/address bar is still in the cycle without
    // this, and Shift+Tab off the first control would leave the panel entirely.
    const items = focusables(openEl);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  });

  window.grain = window.grain || {};
  window.grain.drawer = { open, close, current: () => openEl };
})();
