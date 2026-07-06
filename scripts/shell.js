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

  // expand/collapse the terminal feed — the console bar's own control AND the title-bar terminal
  // button both toggle it (multiple triggers, so bind them all)
  for (const t of shell.querySelectorAll('[data-shell="console-toggle"]'))
    t.addEventListener("click", () => shell.toggleAttribute("data-console-open"));

  // PERSIST the terminal's open state across MPA navigation. data-console-open has THREE writers
  // (the toggle above, Ctrl+` in terminal.js, the terminal's `exit` command) — rather than chase
  // every call site, make shell.js the single persister: restore on boot, then ONE MutationObserver
  // writes the key whenever the attribute changes, whoever changed it (incl. future writers; `exit`
  // → persists closed). Kept SEPARATE from PANE_KEYS above: those are inverse-semantics *-hidden
  // click-toggles; this is a presence attribute observed at the source. (Key `grain.shell.console-open`.)
  const CONSOLE_KEY = "grain.shell.console-open";
  try { if (localStorage.getItem(CONSOLE_KEY) === "1") shell.setAttribute("data-console-open", ""); } catch { /* ignore */ }
  new MutationObserver(() => {
    try { localStorage.setItem(CONSOLE_KEY, shell.hasAttribute("data-console-open") ? "1" : "0"); } catch { /* private mode */ }
  }).observe(shell, { attributes: true, attributeFilter: ["data-console-open"] });

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

  // The narration feed lives in the docked terminal and STAYS there. During a run the terminal is
  // collapsed to its bar; the chat's "thinking" box shows a small LIVE PREVIEW of the last few
  // output lines (mirrored, not moved) with "open in terminal" to expand the full log.
  // NB: a `replace` RenderOp swaps the surface NODE (outerHTML), so observe a STABLE ancestor
  // (the console region) and re-query the feed each time — never bind to the surface node itself.
  const consoleRegion = shell.querySelector(".app-shell__console");
  const preview = shell.querySelector("[data-terminal-preview]");
  if (consoleRegion && preview) {
    // Mirror the last few narration lines into the chat, CLONING the real line nodes so each action
    // keeps its own little box (the action-badge markup) — a compact live view of the terminal.
    const mirror = () => {
      const feed = consoleRegion.querySelector('[data-surface="console"]');
      if (!feed) return;
      const last = [...feed.children].slice(-3).map((n) => n.cloneNode(true));
      preview.replaceChildren(...last);
    };
    new MutationObserver(mirror).observe(consoleRegion, { childList: true, subtree: true, characterData: true });
    mirror();
  }

  // the mobile scrim dismisses the drawer; so does following any nav link in the rail (the
  // activity-bar app links AND the file-tree files — both live under .app-shell__rail now)
  shell.querySelector(".app-shell__scrim")?.addEventListener("click", () => setOpen(false));
  for (const a of shell.querySelectorAll(".app-shell__rail a"))
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
  // ACTIVITY BAR = the app links: mark the item for the page's SECTION (data-section on .app-shell),
  // so /calendar, /mail, … light their icon. Falls back to URL match if unsectioned. (The file-tree's
  // current-file marking is site.js's job — it walks the tree + unfolds ancestors.)
  const section = shell.getAttribute("data-section");
  const railItem = section && shell.querySelector(`.activity-bar [data-section="${section}"]`);
  if (railItem) railItem.setAttribute("aria-current", "page"); else byUrl(".activity-bar a");
  // TABS = the section's submenus: mark by URL (a tab claims its own subpages too).
  byUrl(".app-shell__tabs .tab");
})();
