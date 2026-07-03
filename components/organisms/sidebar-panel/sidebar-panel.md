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
