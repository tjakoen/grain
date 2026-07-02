# Chat message

One line of the assistant conversation. `data-role="you"` is clean and right-aligned (your
words, committed); `data-role="ai"` carries `data-grade="grain"` — the AI's speech stays
grain (grain = AI, AI-INTERFACE §5). Composed inside a flex chat log; the single writer emits
matching markup over the door (`chat.send`), streaming the reply into the `__body`.

## Roles

### You (human — clean)
```html
<div class="chat-message" data-role="you"><span class="chat-message__who">You</span><span class="chat-message__body">Plan my Thursday.</span></div>
```

### Desk (AI — grain)
```html
<div class="chat-message" data-role="ai" data-grade="grain"><span class="chat-message__who">Desk</span><span class="chat-message__body">On it — Thursday's light. Here's a plan…</span></div>
```
