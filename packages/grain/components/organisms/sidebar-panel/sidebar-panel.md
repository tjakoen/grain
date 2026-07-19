# sidebar-panel

The workspace's right-hand panel — a header / scrolling body / footer column that fills the shell's
`.app-shell__aside` region. Its default use is the **assistant** (chat). CSS-only (no `.html`):
compose the markup in your frame.

**Parent context (required):** lives inside `.app-shell__aside` (grain `app-shell`). The takeover
behavior keys off the shell's `data-acting` / `data-chat-open` / `data-aside-open` attributes, and on
mobile it becomes a bottom sheet — all driven by the shell + `grain/scripts/ai-dispatch.js`, not this
CSS. Persona-neutral: any label ("Assistant", a product name) is the consumer's.

```html
<aside class="app-shell__aside">
  <div class="assistant">
    <div class="assistant__head"><span>Assistant</span></div>
    <div class="assistant__log" data-surface="chat-log">…messages…</div>
    <div class="assistant__composer">
      <input data-action="chat.send" data-target="chat-log" data-surface="chat-input">
      <button class="icon-btn" data-action="chat.send" data-target="chat-log" data-from="chat-input">…</button>
    </div>
  </div>
</aside>
```

On an AI takeover the panel slides away so the `console` can narrate; the chat⇄terminal toggle brings
it back. See `console` (its counterpart) and `app-shell` (the grid + takeover state).

**Optional modes.** A panel can carry several panes switched by small tabs in the head — the
consumer names the modes (a catalog, settings, anything). Add `.assistant__modes` (buttons
`[data-shell-mode="…"]`) to the head and wrap each body in `.assistant__pane[data-pane="…"]`,
marking the inactive ones `hidden` (SSR ships the initial state, so no-JS shows the default pane).
`grain/scripts/shell.js` flips `data-mode` on `.assistant`, `hidden` on the panes, and
`aria-selected` on the tabs — value-agnostic. A panel with no panes (the plain assistant) is
untouched.

```html
<div class="assistant" data-mode="chat">
  <div class="assistant__head"><span>Assistant</span>
    <nav class="assistant__modes" aria-label="Panel mode">
      <button type="button" data-shell-mode="chat" aria-selected="true">Chat</button>
      <button type="button" data-shell-mode="catalog" aria-selected="false">Catalog</button>
    </nav>
  </div>
  <div class="assistant__pane" data-pane="chat">…log + composer…</div>
  <div class="assistant__pane" data-pane="catalog" hidden>…anything…</div>
</div>
```
