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

  // switch chat ⇄ terminal while the desk acts (CSS reacts to data-chat-open). Two triggers:
  // ⤢ in the console (terminal form) and ↘ in the chat's thinking box (chat form).
  for (const t of shell.querySelectorAll('[data-shell="chat-toggle"]'))
    t.addEventListener("click", () => shell.toggleAttribute("data-chat-open"));

  // the terminal's expand control (the "desk is acting" indicator) reveals/hides the narration feed
  shell.querySelector('[data-shell="console-toggle"]')?.addEventListener("click", () => shell.toggleAttribute("data-console-open"));

  // mobile: the assistant is a bottom sheet — tap its header (the grab bar) to raise/lower it
  shell.querySelector(".assistant__head")?.addEventListener("click", () => {
    if (mobile.matches) shell.toggleAttribute("data-aside-open");
  });

  // Keep the narration feed where you're looking: in the terminal box, or — mid-run, chat open —
  // in the chat's own "thinking" box. ONE trace element (data-surface="console"), reparented; the
  // desk's appends land wherever it currently lives (like the wireframe).
  const feedHome = shell.querySelector(".console__box");
  const thinkingBox = shell.querySelector(".chat-thinking");
  const placeFeed = () => {
    const feed = shell.querySelector(".console__feed");
    if (!feed) return;
    const inChat = shell.getAttribute("data-acting") === "true" && shell.hasAttribute("data-chat-open");
    const dest = inChat ? thinkingBox : feedHome;
    if (dest && feed.parentElement !== dest) dest.appendChild(feed);
  };
  new MutationObserver(placeFeed).observe(shell, { attributes: true, attributeFilter: ["data-acting", "data-chat-open"] });
  placeFeed();

  // the mobile scrim dismisses the drawer; so does following a nav link
  shell.querySelector(".app-shell__scrim")?.addEventListener("click", () => setOpen(false));
  for (const a of shell.querySelectorAll(".side-rail .nav-item"))
    a.addEventListener("click", () => { if (mobile.matches) setOpen(false); });

  // crossing the breakpoint clears any stuck drawer / sheet state
  mobile.addEventListener?.("change", () => { setOpen(false); shell.removeAttribute("data-aside-open"); });

  // mark the CURRENT route in the rail + tabs — aria-current is accessible AND already styled
  // (nav-item/tab CSS targets [aria-current="page"]). The shared app-frame is identical on every
  // page; this is what tells you where you are, from the URL.
  const here = location.pathname.replace(/\/+$/, "") || "/";
  for (const a of shell.querySelectorAll(".side-rail .nav-item, .tab-bar .tab")) {
    const href = (a.getAttribute("href") || "").replace(/\/+$/, "") || "/";
    if (href === here) a.setAttribute("aria-current", "page");
  }
})();
