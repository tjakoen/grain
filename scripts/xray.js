// grain/scripts/xray.js — X-RAY: see the page the way the AI sees it (a GRAIN dev-mode island).
//
// Outlines every operable surface ([data-surface]) and labels it with its kind + the verbs the
// registry allows on it — the manifest, drawn onto the page. It's the visual twin of the
// terminal's `context` command; both read grain/ai/manifest-dom.ts (the live-DOM projection).
//
// STANDALONE — no terminal required. Four ways in, all independent:
//   1. window.grain.xray.{on,off,toggle}()   — from devtools on any GRAIN page
//   2. ?xray in the URL                        — a shareable "see it as the AI does" link
//   3. click any [data-xray-toggle] control    — e.g. a status-bar affordance
//   4. Ctrl+Shift+X                            — keyboard chord
// The terminal's `xray` command is just a fifth caller of window.grain.xray (no dependency either
// way). One <script type="module"> tag drops it onto any page; a <link> to ai.css carries the CSS.
//
// CLIENT-SAFE: the only import is the pure manifest-dom projection, lazy-loaded via /modules
// (transpiled on request) using the same base resolution the dispatcher uses, so it works under a
// subpath (GitHub Pages) and on a static export.
//
// PERSISTENCE: x-ray survives MPA navigation (localStorage key `grain.xray.on`). While enabled the
// lazy manifest-dom.js import loads on EVERY page — acceptable: this is a dev island, only on when
// you asked for it. A shared `?xray` link wins on boot AND persists, so the toggle sticks after you
// land. (House per-island pattern — dotted key + try/catch for private mode; matches tabs.js.)
(() => {
  "use strict";
  if (window.grain && window.grain.xray) return;   // idempotent: safe if loaded per-page AND globally

  const HTML = document.documentElement;
  const assetBase = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
  const KEY = "grain.xray.on";
  const persist = (v) => { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* private mode */ } };
  let mod = null;

  async function projection() {
    if (!mod) mod = await import(assetBase + "/modules/grain/ai/manifest-dom.js");
    return mod;
  }

  // Stamp each [data-surface] with its label; the CSS (ai.css) draws the outline + label from it.
  async function stampLabels() {
    const { harvestTargets, targetLabel } = await projection();
    // harvestTargets reads the DOM structurally (getAttribute / querySelectorAll) — the browser's
    // real Element satisfies that interface, so document is a valid DomRoot with no adapter.
    const byId = new Map(harvestTargets(document).map((t) => [t.id, t]));
    for (const el of document.querySelectorAll("[data-surface]")) {
      const t = byId.get(el.getAttribute("data-surface"));
      if (t) el.setAttribute("data-xray-label", targetLabel(t));
    }
  }
  function clearLabels() {
    for (const el of document.querySelectorAll("[data-xray-label]")) el.removeAttribute("data-xray-label");
  }

  const isOn = () => HTML.hasAttribute("data-xray");
  async function on() { if (isOn()) return; HTML.setAttribute("data-xray", ""); persist(true); await stampLabels(); }
  function off() { if (!isOn()) return; HTML.removeAttribute("data-xray"); persist(false); clearLabels(); }
  function toggle() { return isOn() ? off() : on(); }

  // ── entry points ────────────────────────────────────────────────────────────────────────────
  // devtools API
  window.grain = window.grain || {};
  window.grain.xray = { on, off, toggle, isOn };

  // a [data-xray-toggle] control anywhere (status bar, footer…)
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("[data-xray-toggle]")) { e.preventDefault(); toggle(); }
  });

  // Ctrl+Shift+X — a chord that doesn't collide with the browser's ⌘/Ctrl+X (cut)
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "X" || e.key === "x")) { e.preventDefault(); toggle(); }
  });

  // boot: ?xray in the URL wins (a self-demoing, shareable link — and on() persists it so it
  // sticks after you navigate); otherwise restore the stored preference (survives MPA nav).
  try {
    if (new URLSearchParams(location.search).has("xray")) on();
    else if (localStorage.getItem(KEY) === "1") on();
  } catch { /* no-op */ }
})();
