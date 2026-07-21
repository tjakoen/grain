// grain/scripts/notepad.js — the NOTEPAD island (organisms/notepad; DEMO-PLAN piece 2).
//
// A rail pane that is the AI's memory made VISIBLE and EDITABLE. It adds three behaviours to a
// composed `.notepad` pane, no markup to write beyond the organism:
//   1. a source⇄rendered toggle (flips `data-mode`);
//   2. persistence — the markdown SOURCE is the canonical state, mirrored to localStorage
//      (`grain.notepad`), so an AI note or a human commit survives MPA navigation + reload;
//   3. the human's Commit is already a normal `[data-action="note.replace"]` trigger through the
//      ONE door (the dispatcher fires it, reading the textarea via `data-from`) — this island only
//      OWNS the persistence + toggle, never a parallel write path.
//
// The DOM is a PROJECTION; the source is the truth. Each `.notepad__entry` carries its markdown in
// `data-md` (written by `note.*` ops / `notepadEntry`), so the whole pad's source is just the entries'
// `data-md` joined — the island watches the pane and re-derives it whenever an op lands (an AI append,
// or the human's committed replace). It watches the whole `.notepad` (subtree), NOT the body node,
// because a `note.replace` swaps the body's outerHTML — an observer bound to the body would go deaf.
//
// renderMarkdown + notepadEntry are imported from grain's OWN client-safe kit over the module server
// (§19.2) — the SAME renderer the chat settles with and the SAME entry markup the reasoner emits, so
// there is ONE markdown renderer and ONE entry shape on the page, never a drifting browser copy.
//
// OPT-IN: presence of a `.notepad` pane is the opt-in; drop the organism + one <script type="module">
// tag and it wires itself. Persona-neutral — "the AI", never any product's desk.
(() => {
  "use strict";
  if (window.grain && window.grain.notepad) return;   // idempotent

  const assetBase = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
  const KEY = "grain.notepad";              // canonical committed markdown source
  const DRAFT_KEY = "grain.notepad.draft";  // the human's uncommitted textarea text (kept across reload)

  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } };

  // Join every entry's markdown source, in order — the whole pad's canonical markdown.
  const deriveSource = (body) =>
    [...body.querySelectorAll(".notepad__entry")]
      .map((e) => e.getAttribute("data-md") || "")
      .filter((s) => s.trim().length)
      .join("\n\n");

  // Lazy module load (shared across panes): the kit is client-safe, served by the module server.
  let kitPromise = null;
  const kit = () => (kitPromise ??= import(assetBase + "/modules/grain/ai/reasoner-kit.js").catch(() => null));

  async function wire(pane) {
    if (pane.dataset.notepadWired) return;
    pane.dataset.notepadWired = "1";

    const body = () => pane.querySelector(".notepad__body");
    const src = pane.querySelector(".notepad__source");
    const toggle = pane.querySelector(".notepad__toggle");
    const commit = pane.querySelector(".notepad__commit");

    // ── toggle: flip source⇄rendered. Entering source shows the draft (or the canonical source). ──
    if (toggle) toggle.addEventListener("click", () => {
      const toSource = pane.getAttribute("data-mode") !== "source";
      pane.setAttribute("data-mode", toSource ? "source" : "rendered");
      if (toSource && src) { src.value = read(DRAFT_KEY) ?? read(KEY) ?? ""; src.focus(); }
    });

    // ── the human's working draft persists as they type (committing is the door's job) ──
    if (src) src.addEventListener("input", () => write(DRAFT_KEY, src.value));
    // Commit itself flows through the ONE door (the dispatcher fires the [data-action="note.replace"]
    // and empties the field). We only retire the local draft here — once committed it's canonical, and
    // sync (below) reflects that canonical straight back into the now-empty textarea.
    if (commit) commit.addEventListener("click", () => write(DRAFT_KEY, null));

    // ── restore persisted state: if the server rendered nothing but we have a saved pad, render it ──
    const b0 = body();
    const saved = read(KEY);
    if (b0 && !b0.querySelector(".notepad__entry") && saved && saved.trim()) {
      const m = await kit();
      // Restored content is settled history — render it clean (grade is a LIVE provenance signal,
      // not persisted; the SOURCE is what we keep). Falls back to no-op if the kit can't load.
      if (m) b0.innerHTML = m.notepadEntry(saved, "user");
    }

    // ── mirror the canonical source to localStorage whenever an op lands (append / replace) ──
    const sync = () => {
      const b = body();
      if (!b) return;
      const md = deriveSource(b);
      write(KEY, md);
      // Reflect the latest committed source into the textarea while the human isn't editing it and
      // has no uncommitted draft (an AI append or a fresh commit lands here; a live draft is left be).
      if (src && document.activeElement !== src && !read(DRAFT_KEY)) src.value = md;
    };
    new MutationObserver(sync).observe(pane, { childList: true, subtree: true });
    sync();   // seed from whatever is present now (SSR entries or the just-restored ones)
  }

  const wireAll = () => document.querySelectorAll(".notepad").forEach(wire);

  window.grain = window.grain || {};
  window.grain.notepad = { wire, wireAll };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireAll);
  else wireAll();
})();
