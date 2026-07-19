# Content index

A collection's listing — what MILL's live content route emits at a collection's index
(`/notes`, `/grain/docs`): a ruled list of entries, each with a meta line, a linked title,
a summary, and tag badges. CSS-only: MILL composes it; nothing data-binds it.

## Listing
```html
<ul class="content-index">
  <li class="content-index__item">
    <p class="content-index__meta">2026-07-04 · ~8 min</p>
    <h2 class="content-index__title"><a href="/notes/the-browser-grew-up">The Browser Grew Up</a></h2>
    <p class="content-index__summary">The honest ledger of what betting on the native platform bought me.</p>
    <div class="note__tags"><span class="badge" data-status="active">native-first</span></div>
  </li>
</ul>
```

## Variant: log

`data-variant="log"` on the `<ul>` reads the listing as commit history — mono date gutter,
title as the message, tags as branch chips. Opt in per collection (MILL's `indexVariant`);
default listing is unchanged for collections that don't ask for it.

```html
<ul class="content-index" data-variant="log">…</ul>
```
