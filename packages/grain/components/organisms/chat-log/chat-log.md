# Chat log

A vertical thread that lays out `chat-message`s. Each `chat-message` positions itself — **you** to the
right, **the AI** to the left — via `align-self`, which only works inside a flex column. The chat-log
provides that column, so messages **can't silently misalign**: compose them here, not in a bare `div`.

## Thread

```html
<div class="chat-log">
  <div class="chat-message" data-role="you"><span class="chat-message__who">You</span><span class="chat-message__body">Plan my Thursday.</span></div>
  <div class="chat-message" data-role="ai" data-grade="grain"><span class="chat-message__who">GRAIN</span><span class="chat-message__body">On it — three deep-work blocks, review at 2.</span></div>
</div>
```
