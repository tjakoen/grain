# Chat message

One line of the assistant conversation. `data-role="you"` is clean and right-aligned (your
words, committed); `data-role="ai"` carries `data-grade="grain"` — the AI's speech stays
grain (grain = AI, AI-INTERFACE §5). The single writer emits matching markup over the door
(`chat.send`), streaming the reply into the `__body`.

**Parent context (required):** a message positions itself with `align-self`, which only works in a
flex column — so **compose messages inside a [`chat-log`](#chat-log)**. In a bare `div` the
alignment silently does nothing.

**Legibility floor.** A bubble renders at `--text-sm`, under the `>= --text-2xl` floor where
Redaction 50's grade texture reads as texture rather than roughness (CLAUDE.md lesson 4). So an
AI message (`data-grade="grain"` or mid-stream `data-commit="pending"`) renders in
`--font-grain-fine` (Redaction 35 only) instead of the sitewide `--font-grain` (Redaction 50) — the
grain signal still reads, just without the roughest strokes turning to mush at bubble size.

## Roles

### You (human — clean)
```html
<div class="chat-message" data-role="you"><span class="chat-message__who">You</span><span class="chat-message__body">Plan my Thursday.</span></div>
```

### The AI (grain)
```html
<div class="chat-message" data-role="ai" data-grade="grain"><span class="chat-message__who">GRAIN</span><span class="chat-message__body">On it — three deep-work blocks, review at 2.</span></div>
```

## Actionable chat dialog (the AI offers a follow-up)

An AI message can put **action controls** in front of the person — buttons that fire an `Intent`
through the one door, exactly like a control on the page. Add a `chat-message__actions` row of
`b-button`s carrying the vocabulary: `data-action` (the verb), `data-target` (the surface),
`data-ai-run` (so they're presence-gated — disabled + honest when the AI is offline). The
dispatcher fires them even though they live in the chat (the chat is exempt from the "click =
interrupt" rule, not from the vocabulary). The offer text stays grain (the AI is speaking); the
buttons render clean, because clicking them is the **human's** move, not AI-authored value.

```html
<div class="chat-message" data-role="ai" data-grade="grain">
  <span class="chat-message__who">GRAIN</span>
  <span class="chat-message__body">I read your three newest notes and wrote a digest.</span>
  <div class="chat-message__actions">
    <button class="btn" data-variant="soft" data-ai-run data-action="note.append" data-target="notepad" type="button">Add to my notes</button>
    <button class="btn" data-variant="outline" data-ai-run data-action="demo.run" data-target="screen" type="button">See what's new</button>
  </div>
</div>
```

Every verb here must exist in `ai/contract.ts` and walk the usual alignment row — an action button
in the chat is a door client like any other, so a new verb needs its reasoner branch + tests.

## Consent notice (the desk asks before it stores anything)

A consent question is not an AI offer, so it carries no `data-action`: the app owns the policy and
the endpoint. It is still an AI message (`data-role="ai"`, grain), because the desk asks it, and its
buttons stay clean because choosing is the human's move. Use the actions row with
`data-consent="allow|deny"`, name what is stored and for how long, and make the decline real.

```html
<div class="chat-message" data-role="ai" data-grade="grain" data-consent-notice>
  <span class="chat-message__who">GRAIN</span>
  <span class="chat-message__body">May the desk remember this conversation on this device with a cookie? It stores a session id for 30 days. Not now loses only the remembering.</span>
  <div class="chat-message__actions">
    <button class="btn" data-variant="soft" data-consent="allow" type="button">Remember this chat</button>
    <button class="btn" data-variant="outline" data-consent="deny" type="button">Not now</button>
  </div>
</div>
```

The app sets the server-issued id on `data-desk-session` (see `scripts/ai-dispatch.js`) or as
`window.__DESK_SESSION__` before the dispatcher runs, handles the two buttons, sets the cookie only
on allow, and dismisses the notice after either choice. A static site with no consent endpoint
simply never renders the notice.
