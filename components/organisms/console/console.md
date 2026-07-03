# console

The AI's narration **terminal** — hidden at rest, it rises from the bottom as a centered bordered box
when the AI takes over a screen, narrating its steps as `action-badge` lines. The `sidebar-panel`
(chat) slides away while it's up; a toggle switches chat ⇄ terminal mid-run. CSS-only (no `.html`).

**Parent context (required):** lives inside the shell's `.app-shell__console` region and is raised by
the shell's `data-acting` / `data-console-open` / `data-chat-open` attributes (set by
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
