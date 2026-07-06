// grain/scripts/terminal.js — the docked console becomes an INTERACTIVE TERMINAL.
//
// The console (organisms/console) is the AI's narration feed. This island adds a command line to
// it, making the terminal a THIRD client of the one door — a human types a command, and anything
// AI-shaped (`ask`, `tour`, `stop`) is raised as a real Intent through window.grain.door.submit,
// the SAME door a click or the AI uses. Reads (help, go, ls, context, …) run locally. No parallel
// wire, no privileged path — the terminal earns the same lifecycle + ready-gate as everything else.
//
// OPT-IN: a consumer stamps `data-terminal="interactive"` on its `.console__box`; this island
// finds those boxes and INJECTS the input row itself (like cmdk injects its dialog), so adoption is
// one attribute + one <script type="module"> tag — no markup to compose. A console without the
// attribute (e.g. the product's /loop narration feed) stays display-only, untouched.
//
// EXTENSIBLE: window.grain.terminal.register({ name, args, help, run(ctx) }) adds a command. GRAIN
// ships the generic builtins below; a consumer registers its own (persona commands, page tours) in
// its own script — grain stays persona-neutral. Verb literals here are the drift-guarded exception
// (CONVENTIONS §3); terminal.test.ts checks each against the real ACTIONS registry.
(() => {
  "use strict";
  if (window.grain && window.grain.terminal) return;   // idempotent

  const PROMPT = "❯";                              // ❯
  const HISTORY_KEY = "grain.terminal.history";
  const HISTORY_CAP = 50;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ── command registry ──────────────────────────────────────────────────────────────────────────
  const registry = new Map();
  function register(cmd) {
    if (!cmd || !cmd.name || typeof cmd.run !== "function") return;
    registry.set(cmd.name, { args: "", help: "", ...cmd });
  }

  // ── the ⌘K corpus (pages + components), fetched once — shared shape with cmdk.js ────────────────
  let corpusData = null;
  async function loadCorpus() {
    if (corpusData) return corpusData;
    try { corpusData = await (await fetch("/search.json")).json(); }
    catch { corpusData = { pages: [], components: [] }; }
    return corpusData;
  }
  const corpusPages = () => (corpusData && corpusData.pages) || [];

  // ── output: append lines to a console feed ──────────────────────────────────────────────────────
  function scrollFeed(feed) {
    const oy = getComputedStyle(feed).overflowY;
    if (oy === "auto" || oy === "scroll") feed.scrollTo({ top: feed.scrollHeight });
  }
  function appendLine(feed, html, { grade, variant, state } = {}) {
    if (!feed) return;
    const div = document.createElement("div");
    div.className = "console__line";
    if (variant) div.dataset.variant = variant;
    if (grade) div.dataset.grade = grade;                // "smooth" = human/clean; default feed = grain
    if (state) div.dataset.state = state;                // "error" → the door's rejection idiom
    div.innerHTML = html;
    feed.appendChild(div);
    scrollFeed(feed);
    return div;
  }
  // a controller's output surface (bound per feed)
  function makeIO(feed) {
    return {
      print: (text) => appendLine(feed, `<span class="console__desc">${esc(text)}</span>`),
      printHtml: (html) => appendLine(feed, `<span class="console__desc">${html}</span>`),
      printPre: (text) => appendLine(feed, `<pre class="console__pre">${esc(text)}</pre>`),
      printErr: (text) => appendLine(feed, `<span class="console__desc">${esc(text)}</span>`, { state: "error" }),
      echo: (raw) => appendLine(feed,
        `<span class="console__prompt" aria-hidden="true">${PROMPT}</span><span class="console__desc">${esc(raw)}</span>`,
        { variant: "cmd", grade: "smooth" }),   // the human's typed line settles CLEAN
      clear: () => { if (feed) feed.innerHTML = ""; },
      feed,
    };
  }

  // ── run a command line ──────────────────────────────────────────────────────────────────────────
  async function run(raw, io) {
    const line = String(raw).trim();
    io.echo(line || "");
    if (!line) return;
    const argv = line.split(/\s+/);
    const name = argv.shift();
    const cmd = registry.get(name);
    if (!cmd) {
      io.printErr(`command not found: ${name}. Type ‘help’ to see what the AI understands.`);
      return;
    }
    const ctx = {
      argv, raw: line, arg: argv.join(" "),
      print: io.print, printHtml: io.printHtml, printPre: io.printPre, printErr: io.printErr, clear: io.clear,
      door: window.grain && window.grain.door,
      corpus: loadCorpus, corpusPages,
      commands: () => [...registry.values()],
    };
    try { await cmd.run(ctx); }
    catch (err) { io.printErr(`‘${name}’ failed: ${(err && err.message) || err}`); }
  }

  // ── the input row (injected) + its controller ────────────────────────────────────────────────────
  function shellOf(box) { return box.closest(".app-shell"); }
  function feedOf(box) {
    const region = box.closest(".app-shell__console") || box;
    return region.querySelector('[data-surface="console"]');
  }
  function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } }
  function saveHistory(h) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-HISTORY_CAP))); } catch { /* private mode */ } }

  function mount(box) {
    if (box.__grainTerminal) return;
    box.__grainTerminal = true;
    const feed = feedOf(box);
    const io = makeIO(feed);

    const row = document.createElement("div");
    row.className = "console__input";
    row.innerHTML =
      `<span class="console__prompt" aria-hidden="true">${PROMPT}</span>` +
      `<input class="console__cmd" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" ` +
      `spellcheck="false" aria-label="Terminal command" placeholder="type a command — try ‘help’">`;
    box.appendChild(row);
    const input = row.querySelector(".console__cmd");

    let history = loadHistory();
    let hIdx = history.length;          // points one past the end (the live line)
    let draft = "";

    input.addEventListener("keydown", async (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const raw = input.value;
        input.value = "";
        if (raw.trim()) { history = [...history.filter((h) => h !== raw.trim()), raw.trim()]; saveHistory(history); }
        hIdx = history.length; draft = "";
        await run(raw, io);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        if (hIdx === history.length) draft = input.value;
        if (hIdx > 0) { hIdx--; input.value = history[hIdx] || ""; moveCaretEnd(input); }
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        if (hIdx < history.length) { hIdx++; input.value = hIdx === history.length ? draft : (history[hIdx] || ""); moveCaretEnd(input); }
      } else if (ev.key === "Tab") {
        ev.preventDefault();
        await complete(input);
      }
      // Escape is NOT swallowed — it must reach the dispatcher's interrupt while the AI acts.
    });
  }

  function moveCaretEnd(input) { const n = input.value.length; requestAnimationFrame(() => input.setSelectionRange(n, n)); }

  // tab-complete: first token → command names; `go`/`ls`/`grep` arg → page slugs from the corpus
  async function complete(input) {
    const value = input.value;
    const parts = value.split(/\s+/);
    if (parts.length <= 1) {
      const hit = uniquePrefix([...registry.keys()], parts[0] || "");
      if (hit) input.value = hit + " ";
      return;
    }
    const cmd = parts[0];
    if (cmd === "go" || cmd === "grep" || cmd === "ls") {
      await loadCorpus();
      const slugs = corpusPages().map((p) => (p.url === "/" ? "/" : p.url.replace(/^\//, "")));
      const hit = uniquePrefix(slugs, parts.slice(1).join(" "));
      if (hit) input.value = cmd + " " + hit;
    }
    moveCaretEnd(input);
  }
  // the longest common completion of the candidates that start with `prefix` (bash-style)
  function uniquePrefix(candidates, prefix) {
    const matches = candidates.filter((c) => c.startsWith(prefix));
    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];
    let common = matches[0];
    for (const m of matches) { while (!m.startsWith(common)) common = common.slice(0, -1); }
    return common.length > prefix.length ? common : matches[0];
  }

  // ── GRAIN builtin commands (generic — any product on GRAIN would want these) ─────────────────────
  function pageMatch(slugOrTitle) {
    const q = slugOrTitle.toLowerCase();
    const pages = corpusPages();
    return pages.find((p) => p.url === "/" + q || p.url === q || (p.title || "").toLowerCase() === q)
        || pages.find((p) => p.url.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q));
  }
  register({ name: "help", args: "", help: "list what the AI understands", run(ctx) {
    for (const c of ctx.commands()) ctx.printHtml(`<b>${esc(c.name)}</b>${c.args ? " " + esc(c.args) : ""} — ${esc(c.help)}`);
  }});
  register({ name: "clear", args: "", help: "clear the terminal", run(ctx) { ctx.clear(); }});
  register({ name: "ls", args: "", help: "list the pages on this site", async run(ctx) {
    await ctx.corpus();
    for (const p of ctx.corpusPages()) ctx.printHtml(`<a href="${esc(p.url)}">${esc(p.url)}</a> — ${esc(p.title || "")}`);
  }});
  register({ name: "go", args: "<page>", help: "navigate to a page", async run(ctx) {
    if (!ctx.arg) return ctx.printErr("go where? try ‘ls’ to list pages.");
    await ctx.corpus();
    const p = pageMatch(ctx.arg);
    if (!p) return ctx.printErr(`no page matches ‘${ctx.arg}’.`);
    ctx.print(`→ ${p.url}`); location.assign(p.url);
  }});
  register({ name: "grep", args: "<term>", help: "search pages and components", async run(ctx) {
    if (!ctx.arg) return ctx.printErr("grep for what?");
    await ctx.corpus();
    const q = ctx.arg.toLowerCase();
    const hits = [...ctx.corpusPages(), ...((corpusData && corpusData.components) || [])]
      .filter((e) => `${e.title || ""} ${e.url || ""} ${e.subtitle || ""}`.toLowerCase().includes(q));
    if (!hits.length) return ctx.print(`no matches for ‘${ctx.arg}’.`);
    for (const h of hits.slice(0, 20)) ctx.printHtml(`<a href="${esc(h.url)}">${esc(h.title || h.url)}</a>`);
  }});
  register({ name: "theme", args: "<flavor>", help: "switch the theme flavor", run(ctx) {
    const t = window.grain && window.grain.theme;
    if (!t) return ctx.printErr("theming isn't loaded on this page.");
    if (!ctx.arg) return ctx.print(`themes: ${(t.themes && t.themes().join(", ")) || "?"} — current: ${t.theme && t.theme()}`);
    try { t.setTheme(ctx.arg); ctx.print(`theme → ${ctx.arg}`); }
    catch { ctx.printErr(`unknown flavor ‘${ctx.arg}’.`); }
  }});
  register({ name: "ask", args: "<question>", help: "ask the AI (it answers in the chat)", run(ctx) {
    if (!ctx.arg) return ctx.printErr("ask what?");
    if (!ctx.door) return ctx.printErr("the door isn't loaded on this page.");
    if (!document.querySelector('[data-surface="chat-log"]')) return ctx.printErr("no chat on this page to answer in.");
    if (!ctx.door.online()) return ctx.printErr("the AI is offline — can't ask right now.");
    ctx.door.submit("chat.send", "chat-log", { text: ctx.arg });
    ctx.print("→ answering in the chat.");
  }});
  register({ name: "stop", args: "", help: "ask the AI to stop (mediated)", run(ctx) {
    if (!ctx.door) return ctx.printErr("the door isn't loaded on this page.");
    if (document.querySelector(".app-shell[data-acting=\"true\"]")) { ctx.door.submit("desk.stop", "screen", {}); ctx.print("asked the AI to stop."); }
    else ctx.print("nothing is running.");
  }});
  register({ name: "context", args: "", help: "print this page as the AI sees it (the manifest)", async run(ctx) {
    const base = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
    const { domManifest } = await import(base + "/modules/grain/ai/manifest-dom.js");
    ctx.printPre(JSON.stringify(domManifest(document), null, 2));
  }});
  register({ name: "xray", args: "", help: "outline every operable surface (dev mode)", async run(ctx) {
    if (window.grain && window.grain.xray) return void window.grain.xray.toggle();
    // xray.js not loaded — load it, then toggle
    try { const base = new URL("..", import.meta.url).pathname.replace(/\/$/, ""); await import(base + "/scripts/xray.js"); window.grain.xray.toggle(); }
    catch { ctx.printErr("x-ray isn't available on this page (load /scripts/xray.js)."); }
  }});
  register({ name: "exit", args: "", help: "close the terminal", run() {
    const shell = document.querySelector(".app-shell");
    if (shell) shell.removeAttribute("data-console-open");
  }});

  // ── keybinding: Ctrl+` opens the terminal and focuses the command line ───────────────────────────
  document.addEventListener("keydown", (ev) => {
    if (ev.ctrlKey && (ev.key === "`" || ev.code === "Backquote")) {
      const box = document.querySelector('.console__box[data-terminal="interactive"]');
      if (!box) return;
      ev.preventDefault();
      const shell = shellOf(box);
      if (shell) { shell.removeAttribute("data-console-hidden"); shell.setAttribute("data-console-open", ""); }
      box.querySelector(".console__cmd")?.focus();
    }
  });

  // ── boot: mount every interactive console box; expose the seam ───────────────────────────────────
  function mountAll() { for (const box of document.querySelectorAll('.console__box[data-terminal="interactive"]')) mount(box); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();

  window.grain = window.grain || {};
  window.grain.terminal = {
    register,
    /** Programmatic run (for tests / a consumer): runs `raw` against the first interactive feed. */
    run: (raw) => { const box = document.querySelector('.console__box[data-terminal="interactive"]'); return run(raw, makeIO(box ? feedOf(box) : null)); },
    commands: () => [...registry.keys()],
  };
})();
