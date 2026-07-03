# Chat message

One line of the assistant conversation. `data-role="you"` is clean and right-aligned (your
words, committed); `data-role="ai"` carries `data-grade="grain"` — the AI's speech stays
grain (grain = AI, AI-INTERFACE §5). The single writer emits matching markup over the door
(`chat.send`), streaming the reply into the `__body`.

**Parent context (required):** a message positions itself with `align-self`, which only works in a
flex column — so **compose messages inside a [`chat-log`](#chat-log)**. In a bare `div` the
alignment silently does nothing.

## Roles

### You (human — clean)
```html
<div class="chat-message" data-role="you"><span class="chat-message__who">You</span><span class="chat-message__body">Plan my Thursday.</span></div>
```

### The AI (grain)
```html
<div class="chat-message" data-role="ai" data-grade="grain"><span class="chat-message__who">GRAIN</span><span class="chat-message__body">On it — three deep-work blocks, review at 2.</span></div>
```
