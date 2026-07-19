# console

The AI's narration **terminal** — a **docked bottom panel** (VS Code style), not a floating box. At
rest it's a slim clickable bar (`Terminal ▸`); clicking `console-toggle` opens the feed **in place**
(`data-console-open` — the shell's `console` grid row grows to a fixed ~16rem band, so the main pane
shrinks and scrolls). A second control, `console-grow-toggle`, expands that band further to fill the
whole shell (`data-console-expanded`, main collapses to 0) — for reading a long run back. **Every
state change glides:** the row is a `minmax(<floor>, <fr>)` grid track whose endpoints are all
lengths/fr, so `grid-template-rows` interpolates (bar → band → full-screen) instead of snapping; the
feed is `flex: 1 1 0` and just fills the row (no `max-height` reveal). During a **run**
(`data-acting`) the terminal stays **collapsed** — the `sidebar-panel` (chat) shows a live preview
and the person clicks "open in terminal" (→ `data-console-open`) to see the full feed. It narrates
the AI's steps as `action-badge` lines, each a plain row (not individually boxed — a run's lines read
as one flowing entry). The terminal shows the AI's **thinking**; the chat is for **communication** —
the two coexist, so the chat no longer collapses during a run. CSS-only (no `.html`).

**Parent context (required):** lives inside the shell's `.app-shell__console` region (which docks
under `main`). Its height is driven by `--shell-console-min` / `--shell-console-fr` on the shell
(`data-console-open` raises the floor to the band; `data-console-expanded` grows the fr to fill).
`data-acting` (set by `grain/scripts/ai-dispatch.js` on a `spotlight` op) marks a run but does NOT
open the feed. The AI narrates by pushing
`append` ops at the `console` surface. Persona-neutral.

```html
<section class="app-shell__console">
  <div class="console__box">
    <div class="console__bar">
      <button class="console__expand" data-shell="console-toggle">
        <b-icon sym="…#spark" size="sm"></b-icon><span class="console__label">the AI</span>
        <span class="console__acting">is acting…</span><span class="console__chev">▾</span>
      </button>
      <button class="console__grow" data-shell="console-grow-toggle"></button>
    </div>
    <div class="console__feed" data-surface="console"></div>
  </div>
</section>
```

## Interactive mode (opt-in) — the terminal takes a command line

Add `data-terminal="interactive"` to the `.console__box` and load `grain/scripts/terminal.js`
(`<script type="module">`). The island **injects the input row itself** (`.console__input` with a
`.console__prompt` + `.console__cmd`) — no markup to compose. The row shows whenever the console is
open (`data-console-open`) and rides the same open/close as the feed. A console *without* the
attribute (e.g. the product's `/loop` narration feed) stays display-only, untouched.

The terminal becomes a **third client of the one door**: a human types a command, and anything
AI-shaped (`ask`, `tour`, `stop`) is raised as a real Intent through `window.grain.door.submit` —
the same door a click or the AI uses (so it inherits the pending-trigger lifecycle + the ready-gate;
never a private `fetch`). Reads (`help`, `go`, `ls`, `grep`, `theme`, `context`, `xray`) run locally.

**Grade doctrine in the feed:** the feed defaults to grain (machine voice), so command *output*
stays grain; the human's **echoed command** carries `data-grade="smooth"` and settles clean. History
is `↑/↓` (localStorage), `Tab` completes commands + page slugs, `` Ctrl+` `` opens + focuses it.

**Extend it:** `window.grain.terminal.register({ name, args, help, run(ctx) })`. GRAIN ships the
generic builtins (`help`/`clear`/`exit`/`go`/`ls`/`grep`/`theme`/`ask`/`stop`/`context`/`xray`);
a consumer registers its own persona/tour commands in its own script (grain stays persona-neutral).
The `ctx` gives `{ argv, arg, raw, print, printHtml, printPre, printErr, clear, door, corpus }`.

```html
<div class="console__box" data-terminal="interactive"> … </div>
<script type="module" src="/scripts/terminal.js"></script>
```

See `sidebar-panel` (its counterpart) and `app-shell` (the grid + takeover state).
