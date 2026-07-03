// grain/scripts/theme.js — the theming controls (GRAIN). Sets the two ORTHOGONAL token axes on
// <html>: `data-color-scheme` (light | dark, or unset = follow the OS) and `data-theme` (the
// flavor; unset = the default, Sourdough). Both are pure TOKEN re-skins (grain/styles/variables.css)
// — a client-side VIEW PREFERENCE: static-safe, no deps, NOT the AI door. Persists to localStorage.
//
// Declarative: any control drives it with `data-toggle-scheme` (light⇄dark), `data-set-scheme="…"`,
// or `data-set-theme="…"` — no per-page handlers. Also exposed as `window.grain.theme`.
// NOTE (FOUC): saved prefs are applied when this module runs (deferred), so a non-default saved
// pref can flash once on first paint; the shell phase adds an inline <head> bootstrap to pre-set
// the attributes before styles apply. See README §4/§6.
(() => {
  "use strict";
  const html = document.documentElement;
  const KEY_S = "grain-color-scheme", KEY_T = "grain-theme";
  const store = (() => { try { return window.localStorage; } catch { return null; } })();
  const get = (k) => { try { return store && store.getItem(k); } catch { return null; } };
  const put = (k, v) => { try { if (store) v == null ? store.removeItem(k) : store.setItem(k, v); } catch {} };

  // scheme: "light" | "dark" | "auto"  (auto = drop the attr → follow prefers-color-scheme)
  function setScheme(s) {
    if (!s || s === "auto") { html.removeAttribute("data-color-scheme"); put(KEY_S, null); }
    else { html.setAttribute("data-color-scheme", s); put(KEY_S, s); }
  }
  const scheme = () => html.getAttribute("data-color-scheme") || "auto";
  function toggleScheme() {
    const eff = scheme() === "auto"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : scheme();
    setScheme(eff === "dark" ? "light" : "dark");
  }
  // flavor: any data-theme value ("" / "sourdough" = the default)
  function setTheme(t) {
    if (!t || t === "sourdough") { html.removeAttribute("data-theme"); put(KEY_T, null); }
    else { html.setAttribute("data-theme", t); put(KEY_T, t); }
  }
  const theme = () => html.getAttribute("data-theme") || "sourdough";

  // apply saved prefs (no saved scheme → stay auto, so the OS wins with no forced-override flash)
  const s = get(KEY_S); if (s) html.setAttribute("data-color-scheme", s);
  const t = get(KEY_T); if (t) html.setAttribute("data-theme", t);

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-toggle-scheme],[data-set-scheme],[data-set-theme]");
    if (!el) return;
    if (el.hasAttribute("data-toggle-scheme")) toggleScheme();
    else if (el.hasAttribute("data-set-scheme")) setScheme(el.getAttribute("data-set-scheme"));
    else if (el.hasAttribute("data-set-theme")) setTheme(el.getAttribute("data-set-theme"));
  });

  window.grain = window.grain || {};
  window.grain.theme = { setScheme, setTheme, toggleScheme, scheme, theme };
})();
