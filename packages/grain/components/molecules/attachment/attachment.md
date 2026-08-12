# Attachment

A document hanging off a page: a deck, a paper, a slide set. One quiet horizontal row, near the top,
saying what is attached and what opening it costs. Composed by hand, so nothing data-binds it.

It is deliberately **not** a `media-card`. A poster-sized tile at the top of a note reads as the
subject of the page; an attachment is the thing the page is *about*, offered on the way in. It
announces itself in one row and gets out of the way.

The whole row is the link. Children are `<span>`s inside an `<a>`, so anything that must sit on its
own line declares `display` (a `<span>` in an `<a>` does not get one for free). The component owns no
outer margin: where it sits is the consumer's layout decision.

## Attachment
```html
<a class="attachment" href="#gallery">
  <span class="attachment__kind">PDF</span>
  <span class="attachment__body">
    <span class="attachment__title">Beyond Limits, the ideation workshop</span>
    <span class="attachment__meta">32 slides · 2.5 MB · opens in a tab here</span>
  </span>
  <span class="attachment__action">Open →</span>
</a>
```

## A talk that lives on the site
```html
<a class="attachment" href="/notes/ten-times-zero">
  <span class="attachment__kind">Talk</span>
  <span class="attachment__body">
    <span class="attachment__title">Ten times zero</span>
    <span class="attachment__meta">28 slides · runs in the browser</span>
  </span>
  <span class="attachment__action">Open →</span>
</a>
```

**Write the meta line as a cost, not a boast.** Page count, size, and where it opens are the three
things someone weighs before clicking. `--space` and type come from the tokens; the only per-use knob
is the kind chip's text.
