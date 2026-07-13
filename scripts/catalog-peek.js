// grain/scripts/catalog-peek.js — the sidebar-panel's CATALOG pane. Its BASE job runs on ANY page
// that has the pane: embed /catalog in the pane's <iframe> the first time it's shown, so "Catalog"
// is always a real, working reference browser — never an empty pane. Its ENHANCED job (this file's
// original scope) is grain's OWN reference app: bridging usage → specimen, where hovering a
// component in the demo REVEALS that component's entry in the embedded catalog (one at a time,
// cross-fading — no scrolling). That bridge needs a demo root ([data-peek-root]) to hover WITHIN,
// which only grain's own pages declare — everywhere else it's simply not there, and this file
// degrades to the base job with no crash and no empty pane. The pane itself is a sidebar-panel MODE
// (shell.js owns the Chat⇄Catalog switch); this island adds the catalog behaviours: [data-peek]
// open/close hooks, the lazy iframe load (base, unconditional), and the hover/tap bridge (enhanced,
// gated on the demo root existing).
//
// It maps each rendered CSS class to its catalog section slug (the .md title slug — stable for
// grain's components). The catalog exposes a "single" mode (data-peek-single + .is-peek-active,
// driven here via window.__catSetActive). The bridge adapts to the pointer: with a HOVERING
// pointer it's a hover-reveal in single mode (one entry at a time, cross-fading). On a COARSE
// pointer (touch, no hover) a finger can't hover, so the same usage→specimen link becomes a TAP:
// tapping a component opens the pane and scrolls that entry into view in the full, scrollable
// catalog (single mode stays off — a finger needs the surrounding list to scroll back through).
(() => {
  "use strict";
  const shell = document.querySelector(".app-shell");
  const pane = document.querySelector('.assistant__pane[data-pane="catalog"]');
  const frame = pane && pane.querySelector("iframe");
  // BASE requirement: the pane + its iframe. Without these there's nothing to embed the catalog
  // into at all, so there's genuinely nothing this island can do.
  if (!shell || !pane || !frame) return;
  // ENHANCED requirement, OPTIONAL: the demo root the hover/tap bridge reveals FROM. Every branch
  // below that touches `demo` is gated on this — every page without one still gets a fully working
  // catalog pane (this was previously an all-or-nothing early return that left non-grain pages with
  // a permanently empty pane).
  const demo = document.querySelector("[data-peek-root]");
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

  const isOpen = () => !pane.hidden;
  // open/close = switch the sidebar-panel's mode — REUSE the shell's one mechanic (click its mode
  // tab; shell.js flips data-mode/hidden/aria-selected), never a parallel show/hide path. On the
  // mobile sheet, opening also raises the sheet so the switch is visible.
  const modeTab = (m) => shell.querySelector(`.assistant__modes [data-shell-mode="${m}"]`);
  const setOpen = (v) => {
    modeTab(v ? "catalog" : "chat")?.click();
    if (v && matchMedia("(max-width: 768px)").matches) shell.setAttribute("data-aside-open", "");
  };
  // [data-peek] hooks: "open" forces open, "close" forces closed, "toggle" (default) flips.
  // preventDefault so a hook can be a real <a> (the Catalog tab is href="/grain" for no-JS nav /
  // for pages without the pane, e.g. /loop) yet switch the panel in place where this island runs.
  for (const t of document.querySelectorAll("[data-peek]")) {
    const mode = t.getAttribute("data-peek");
    t.addEventListener("click", (e) => { e.preventDefault(); setOpen(mode === "open" ? true : mode === "close" ? false : !isOpen()); });
  }

  // lazy-load /catalog the first time the pane becomes visible — whichever way it opened (a
  // [data-peek] hook or the panel's own Catalog mode tab).
  const ensureSrc = () => { if (isOpen() && !frame.getAttribute("src")) frame.setAttribute("src", "/catalog"); };
  new MutationObserver(ensureSrc).observe(pane, { attributes: true, attributeFilter: ["hidden"] });
  ensureSrc();

  // once the embedded catalog loads, put it in "single" mode (show one entry at a time) and
  // default to the first entry so the pane isn't blank before the first hover. Pointer-only:
  // on touch we skip single mode and leave the full scrollable catalog.
  frame.addEventListener("load", () => {
    // touch: no single mode — honour a tap that fired before the frame finished loading.
    if (!canHover) { if (pendingTouch) { scrollToInFrame(pendingTouch); pendingTouch = null; } return; }
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

  let last = null, showTimer = 0, pendingTouch = null;
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
    pane.setAttribute("data-peek-slug", slug);   // observable state (e2e + reference)
    showInFrame(slug);   // reveal-one: the pane shows just this entry, cross-fading — no scrolling
  }

  // Everything below is the ENHANCED hover/tap bridge — a PROGRESSIVE ENHANCEMENT gated on `demo`
  // existing. A page with no [data-peek-root] (every non-grain consumer) still got a fully working
  // catalog pane above; it just has nothing to hover/tap INTO the pane from, which is correct — it
  // has no grain component demo on the page to bridge from in the first place.
  if (demo) demo.addEventListener("mouseover", (e) => {
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

  // TOUCH bridge (coarse pointer / no hover): scroll a component's entry into view in the full
  // catalog — the reveal a mouse gets for free by hovering, driven by a finger.
  function scrollToInFrame(slug) {
    try {
      const el = frame.contentDocument?.getElementById(slug);
      if (!el) return;
      const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    } catch { /* iframe not ready / cross-origin — ignore */ }
  }
  // A TAP on a catalogued component opens the Catalog pane (raises the sheet on mobile) and brings
  // that entry into view. Only fires on touch; leaves operable controls alone so a real press isn't
  // swallowed (links/buttons/inputs, and the door clients [data-action] / peek hooks [data-peek]).
  if (demo && !canHover) demo.addEventListener("click", (e) => {
    if (e.target.closest("a,button,input,textarea,select,label,[data-action],[data-peek]")) return;
    let el = e.target, slug = null;
    while (el && el !== demo && !slug) {
      if (el.classList) for (const cls in MAP) if (el.classList.contains(cls)) { slug = MAP[cls]; break; }
      el = el.parentElement;
    }
    if (!slug) return;
    pendingTouch = slug;
    pane.setAttribute("data-peek-slug", slug);            // observable state (e2e + reference), as on hover
    setOpen(true);                                        // open + raise the Catalog sheet
    if (frame.getAttribute("src")) { scrollToInFrame(slug); pendingTouch = null; }   // loaded → now; else on load
  });
})();
