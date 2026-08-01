# Drawer

A **modal side panel**: a scrim over the page and a column that slides in from the edge.
Where a lightbox centers one thing to *look* at, a drawer docks a place to *work* — a
create/edit form, a record's detail, a preview — beside the list you opened it from, so the
context behind it stays visible.

CSS-only (no `.html`). The behavior is `grain/scripts/drawer.js`; load it and the markup
below is live with no per-page wiring.

**State is the plain `hidden` attribute**, not a class. A server can ship an open drawer,
and a page with no JS at all renders a closed one rather than an overlay stranded across
the screen.

## Markup

```html
<button class="btn" data-drawer-open="new-client">New client</button>

<aside class="drawer" id="new-client" data-drawer hidden>
  <div class="drawer__backdrop" data-drawer-close></div>
  <div class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="new-client-title">
    <header class="drawer__head">
      <h2 id="new-client-title">New client</h2>
      <button class="icon-btn" data-variant="ghost" data-drawer-close aria-label="Close">✕</button>
    </header>
    <div class="drawer__body">…a form…</div>
  </div>
</aside>
```

`data-drawer-open` names the drawer's id; with no value it opens the page's only
`[data-drawer]`. Anything marked `data-drawer-close` closes it — the scrim carries it, and so
should a close button in the head. The close control is a plain grain `.icon-btn`, not a
drawer-specific class; the organism owns the panel, not the button.

The catalog renders this example as an empty panel on purpose: the drawer is
`position: fixed`, so a live one would cover the whole catalog rather than sit in its box.
Read the code, or see it in a shell.

## What the script does that a hand-rolled drawer usually doesn't

A drawer is modal, and three obligations come with covering the page. `drawer.js` ships all
three so no consumer has to remember them:

- **Focus moves in** on open — to the first control in the panel, or the panel itself.
- **Tab stays inside** while it's up, wrapping at both ends, and the rest of the page goes
  `inert` (one attribute that stops focus, pointer events and screen-reader attention alike —
  the `aria-hidden` + `tabindex` dance it replaces never stopped a click).
- **Focus returns** to the control that opened it on close. Dropping focus to `<body>` leaves
  a keyboard user at the top of the page with no idea where they were.

Escape and a scrim click both close. Only one drawer is ever open; opening a second closes
the first.

**Seam:** `window.grain.drawer` — `{ open(idOrElement), close(), current() }`. The element
also emits `grain:drawer-open` / `grain:drawer-close` (bubbling), which is where a consumer
hangs its own work: loading a fragment into `.drawer__body`, resetting a form, saving a
draft.

## Docking to the other edge

`data-side="start"` puts the panel on the leading edge instead — a filter or navigation
panel, where the trailing edge is the working one. Only the anchoring and the slide
direction change.

```html
<aside class="drawer" data-side="start" data-drawer hidden>…</aside>
```
