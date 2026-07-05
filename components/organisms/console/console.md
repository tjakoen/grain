# console

The AI's narration **terminal** — a **docked bottom panel** (VS Code style), not a floating box. At
rest it's a slim clickable bar (`Terminal ▸`); clicking `console-toggle` — or the AI taking over
(`data-acting`) — opens the feed **in place** (the shell's `console` grid row grows, so the main pane
shrinks and scrolls). It narrates the AI's steps as `action-badge` lines. The terminal shows the AI's
**thinking**; the `sidebar-panel` (chat) is for **communication** — the two coexist, so the chat no
longer collapses during a run. CSS-only (no `.html`).

**Parent context (required):** lives inside the shell's `.app-shell__console` region (which docks
under `main`) and is opened by `data-acting` / `data-console-open` (set by
`grain/scripts/ai-dispatch.js` on a `spotlight` op, driven by `shell.js`). The AI narrates by pushing
`append` ops at the `console` surface. Persona-neutral.

```html
<section class="app-shell__console">
  <div class="console__box">
    <div class="console__bar">
      <button class="console__expand" data-shell="console-toggle">
        <b-icon sym="…#spark" size="sm"></b-icon><span class="console__label">the AI</span>
        <span class="console__acting">is acting…</span><span class="console__chev">▾</span>
      </button>
      <button class="console__toggle" data-shell="chat-toggle"></button>
    </div>
    <div class="console__feed" data-surface="console"></div>
  </div>
</section>
```

See `sidebar-panel` (its counterpart) and `app-shell` (the grid + takeover state).
