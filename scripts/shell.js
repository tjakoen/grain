// grain/scripts/shell.js — the app-shell island: the rail toggle. Two behaviours off ONE
// control, chosen by viewport: on desktop it COLLAPSES the rail to icons (persisted); on
// mobile it OPENS the rail as an off-canvas drawer (with a scrim). Pure DOM + a class/attr
// toggle — no framework. It knows nothing about the AI door; it's plain UI chrome.
(() => {
  "use strict";
  const shell = document.querySelector(".app-shell");
  if (!shell) return;

  const mobile = window.matchMedia("(max-width: 768px)");
  const KEY = "grain.shell.rail-collapsed";

  const setCollapsed = (v) => {
    shell.setAttribute("data-rail-collapsed", v ? "true" : "false");
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* private mode */ }
  };
  const setOpen = (v) => {
    if (v) shell.setAttribute("data-rail-open", "true");
    else shell.removeAttribute("data-rail-open");
  };

  // restore the desktop collapse preference (mobile ignores it — it's a drawer there)
  try { if (localStorage.getItem(KEY) === "1") shell.setAttribute("data-rail-collapsed", "true"); } catch { /* ignore */ }

  // the toggle(s): any control marked data-shell="rail-toggle"
  for (const btn of shell.querySelectorAll('[data-shell="rail-toggle"]')) {
    btn.addEventListener("click", () => {
      if (mobile.matches) setOpen(shell.getAttribute("data-rail-open") !== "true");
      else setCollapsed(shell.getAttribute("data-rail-collapsed") !== "true");
    });
  }

  // VS Code-style pane visibility: hide/show the aside (the assistant column) and the whole
  // console strip. Attribute-driven so app-shell.css owns the layout change; state persists.
  const PANE_KEYS = { "aside-toggle": ["data-aside-hidden", "grain.shell.aside-hidden"],
                      "console-hide": ["data-console-hidden", "grain.shell.console-hidden"] };
  for (const [name, [attr, key]] of Object.entries(PANE_KEYS)) {
    try { if (localStorage.getItem(key) === "1") shell.setAttribute(attr, "true"); } catch { /* ignore */ }
    for (const b of shell.querySelectorAll(`[data-shell="${name}"]`))
      b.addEventListener("click", () => {
        const on = shell.getAttribute(attr) !== "true";
        on ? shell.setAttribute(attr, "true") : shell.removeAttribute(attr);
        try { localStorage.setItem(key, on ? "1" : "0"); } catch { /* ignore */ }
      });
  }

  // focus the assistant's composer (e.g. a welcome page's "Ask…" start item). Links keep a real
  // href fallback for no-JS; with JS we stay on the page and hand the cursor to the chat.
  for (const el of shell.ownerDocument.querySelectorAll('[data-shell="focus-chat"]'))
    el.addEventListener("click", (e) => {
      const input = shell.querySelector(".assistant__composer input");
      if (!input) return;                       // no assistant on this page → follow the link
      e.preventDefault();
      shell.removeAttribute("data-aside-hidden");
      if (mobile.matches) shell.setAttribute("data-aside-open", "true");
      input.focus();
    });

  // the terminal's expand control (the "desk is acting" indicator) reveals/hides the narration feed
  shell.querySelector('[data-shell="console-toggle"]')?.addEventListener("click", () => shell.toggleAttribute("data-console-open"));

  // "open in terminal" (from the chat's thinking box): un-hide + expand the docked terminal so the
  // full narration is visible (the chat only shows a compact thinking indicator during a run).
  for (const b of shell.querySelectorAll('[data-shell="open-terminal"]'))
    b.addEventListener("click", () => { shell.removeAttribute("data-console-hidden"); shell.setAttribute("data-console-open", ""); });

  // OPTIONAL PANEL MODES (sidebar-panel): mode tabs ([data-shell-mode]) switch the assistant
  // between its panes — data-mode on .assistant, hidden on the inactive panes, aria-selected on
  // the tabs. Value-agnostic (the consumer names the modes); a panel with no panes has no tabs,
  // so this is a no-op there. stopPropagation keeps a tab click off the mobile grab bar below.
  const assistant = shell.querySelector(".assistant");
  const setAsideMode = (mode) => {
    if (!assistant) return;
    assistant.setAttribute("data-mode", mode);
    for (const p of assistant.querySelectorAll(".assistant__pane")) p.hidden = p.getAttribute("data-pane") !== mode;
    for (const b of assistant.querySelectorAll("[data-shell-mode]")) b.setAttribute("aria-selected", b.getAttribute("data-shell-mode") === mode ? "true" : "false");
  };
  for (const b of shell.querySelectorAll(".assistant__modes [data-shell-mode]"))
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      setAsideMode(b.getAttribute("data-shell-mode"));
      // on mobile the tabs sit INSIDE the grab bar: tapping one with the sheet closed must also
      // RAISE the sheet (otherwise the tap looks swallowed — the pane it opened stays off-screen)
      if (mobile.matches && !shell.hasAttribute("data-aside-open")) shell.setAttribute("data-aside-open", "");
    });

  // mobile: the assistant is a bottom sheet — tap its header (the grab bar) to raise/lower it
  shell.querySelector(".assistant__head")?.addEventListener("click", () => {
    if (mobile.matches) shell.toggleAttribute("data-aside-open");
  });

  // The narration feed lives in the docked terminal and STAYS there — the terminal shows the AI's
  // thinking, the chat holds the conversation, and both are visible at once (owner, 2026-07-05).
  // (No more reparenting the feed into a chat "thinking" box.)

  // the mobile scrim dismisses the drawer; so does following a nav link
  shell.querySelector(".app-shell__scrim")?.addEventListener("click", () => setOpen(false));
  for (const a of shell.querySelectorAll(".side-rail .nav-item"))
    a.addEventListener("click", () => { if (mobile.matches) setOpen(false); });

  // crossing the breakpoint clears any stuck drawer / sheet state
  mobile.addEventListener?.("change", () => { setOpen(false); shell.removeAttribute("data-aside-open"); });

  // mark the CURRENT route in the rail + tabs — aria-current is accessible AND already styled
  // (nav-item/tab CSS targets [aria-current="page"]). The shared app-frame is identical on every
  // page; this is what tells you where you are, from the URL. A tab/nav-item also claims its
  // SUBPAGES (/notes claims /notes/slug) — exact match wins, then the longest prefix; "/" only
  // ever matches exactly.
  const here = location.pathname.replace(/\/+$/, "") || "/";
  const byUrl = (sel) => {                    // longest-prefix URL match within one nav group
    let best = null, bestLen = -1;
    for (const a of shell.querySelectorAll(sel)) {
      const href = (a.getAttribute("href") || "").replace(/\/+$/, "") || "/";
      if (href === here) { best = a; bestLen = Infinity; break; }
      if (href !== "/" && here.startsWith(href + "/") && href.length > bestLen) { best = a; bestLen = href.length; }
    }
    best?.setAttribute("aria-current", "page");
  };
  // RAIL = the main menu: mark the item for the page's SECTION (data-section on .app-shell),
  // so /batch, /grain/docs, … all light "BREAD Stack". Falls back to URL match if unsectioned.
  const section = shell.getAttribute("data-section");
  const railItem = section && shell.querySelector(`.side-rail .nav-item[data-section="${section}"]`);
  if (railItem) railItem.setAttribute("aria-current", "page"); else byUrl(".side-rail .nav-item");
  // TABS = the section's submenus: mark by URL (a tab claims its own subpages too).
  byUrl(".app-shell__tabs .tab");
})();
