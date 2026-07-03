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

Persona-neutral: the presence label ("online", a product name, "TJ's Desk") is the consumer's — the
primitive ships no persona. The flavor list the cycle rotates is declared on `<html data-themes="…">`.
