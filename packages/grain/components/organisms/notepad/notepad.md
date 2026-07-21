# Notepad

The AI's memory as a **visible, editable surface** — a rail pane both operators write through the one
door. Two modes flip on `data-mode`: **rendered** (the notes, where `note.append` / `note.replace` ops
land on the inner `notepad-body` surface) and **source** (a textarea the human edits, then commits).

The canonical state is the markdown **source**, not this rendered HTML: each `.notepad__entry` carries
its own source in `data-md`, so a client island can rebuild the whole pad's markdown (join the entries)
and mirror it to `localStorage` — the DOM is a projection, the source is the truth. Build entries with
`notepadEntry` / an `note.append` op (`ai/reasoner-kit.ts`) so the grade and the `data-md` round-trip are
never hand-rolled. An AI entry grades `grain` (provenance persists, DESIGN-SYSTEM §3); a human commit
settles clean.

The `note.*` verbs accept the `notepad` **kind** (the wrapper — also the surface the AI-acting spotlight
lights); the ops write to the inner `notepad-body` push surface. Behaviour (the source⇄rendered toggle,
localStorage mirror, and the human's Commit → `note.replace` through the door) is the consumer's island;
`grain/scripts/notepad.js` ships a persona-neutral one.

## Pane

```html
<section class="notepad" data-mode="rendered" data-surface="notepad">
  <header class="notepad__head">
    <span class="notepad__title">Notepad</span>
    <button type="button" class="notepad__toggle" aria-label="Toggle source / rendered"></button>
    <button type="button" class="notepad__commit"
            data-action="note.replace" data-target="notepad" data-from="notepad-src">Commit</button>
  </header>
  <div class="notepad__body" data-surface="notepad-body">
    <div class="notepad__entry" data-grade="grain" data-md="**New this week:** an app-like feel."><p><strong>New this week:</strong> an app-like feel.</p></div>
  </div>
  <textarea class="notepad__source" data-surface="notepad-src" aria-label="Notepad source (markdown)"
            placeholder="Write markdown…"></textarea>
</section>
```

The Commit button is a normal `[data-action]` trigger: it reads the textarea by its surface address
(`data-from="notepad-src"`, resolved the same way the chat composer's Send reads `chat-input`) and
raises `note.replace` on the `notepad` surface — the same door a page control or the AI uses, no
parallel path. The `note.append` verb (used by an AI "add to my notes" action) writes without clearing.
