# topbar

The app-shell top bar's **content** — a right-aligned control cluster. The shell (`app-shell`) owns
the bar's grid slot + border; this primitive is the cluster you place inside `.app-shell__topbar`.
CSS-only (no `.html`): compose the markup in your frame.

**Parent context:** lives inside `.app-shell__topbar`. `.topbar-ctl` pushes itself to the right
(`margin-left:auto`).

**The theming toggles** are grain `.icon-btn`s carrying the declarative theming controls from
`grain/scripts/theme.js` — they need no per-page JS:

```html
<header class="app-shell__topbar">
  <!-- …brand / nav… -->
  <div class="topbar-ctl">
    <button class="icon-btn" data-variant="ghost" data-toggle-scheme aria-label="Toggle light / dark">…</button>
    <button class="icon-btn" data-variant="ghost" data-cycle-theme aria-label="Cycle theme">…</button>
    <b-kbd keys="⌘K"></b-kbd>
    <span class="presence"><b-icon sym="…#spark" size="sm"></b-icon> online</span>
  </div>
</header>
```

Persona-neutral: the presence label ("online", a product name, "Acme's assistant") is the consumer's — the
primitive ships no persona. The flavor list the cycle rotates is declared on `<html data-themes="…">`.

## The left slot, and a search box

A workspace bar usually says **where you are** on the left and **what you can do here** on the
right. `.topbar-crumbs` is that left slot; it needs no coordination with `.topbar-ctl`, which
pushes itself right on its own. A long trail truncates rather than shoving the controls off
the bar.

`.topbar-search` is the optional box between them. **Grain ships the box and nothing else** —
whether typing filters rows already on the page, queries a server, or opens a palette is yours
to wire to the input. A box that looks like it searches but ships no search is a contract that
fails silently, so the promise here is only "an input that belongs in a topbar".

```html
<header class="app-shell__topbar">
  <span class="topbar-crumbs"><a href="#tickets">Tickets</a> / <strong>Annual Review</strong></span>
  <div class="topbar-search"><input type="search" placeholder="Filter…" aria-label="Filter"></div>
  <div class="topbar-ctl">
    <button class="icon-btn" data-variant="ghost" data-toggle-scheme aria-label="Toggle light / dark">◐</button>
  </div>
</header>
```
