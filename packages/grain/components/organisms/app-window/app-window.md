# app-window

The **editor-window frame**: boxes the whole app in a bordered, radiused window on a darker
backdrop, with a title bar up top. Pairs with `status-bar` for the bottom row. CSS-only (no
`.html`): it *dresses* an `app-shell`, it doesn't render content.

**Parent contract (required):** apply `.app-window` **on the `.app-shell` element itself** and
`.app-window-backdrop` on `<body>`; the title bar is a `.window-bar` placed in the shell's
`.app-shell__window` grid row (app-shell.css owns the rows). Without an `app-shell` grid around
it, `.window-bar` is just a flex strip — the frame and rows come from the shell.

The title bar hosts, left to right:

- **`__dots`** — the window dots. Plain `<i><i><i>` for a decorative cluster (one filled, two
  hollow ink circles), or functional `<button>`s marked `data-window-close` / `data-window-clear`
  / `data-window-back`. At rest every dot reads as quiet ink; hovering the cluster reveals each
  dot's muted accent + glyph (`--color-dot-*` tokens — the one sanctioned traffic-light exception
  to the closed palette). The *behavior* is the consumer's (wire the clicks in your app script);
  give each a `title` tooltip.
- **`__ctl`** *(optional)* — a small control cluster (theme cycle, scheme toggle, pane toggles):
  unstyled text buttons, status-weight.
- **`__title`** *or* **`__search`** — the centered element. `__title` is plain mono text;
  `__search` is a *button drawn as an input* that opens the app's command palette (⌘K) — its text
  is the consumer's placeholder (e.g. the current page's breadcrumb).
- **`__end`** — a symmetry spacer; give it a width matching the leading cluster so the center
  stays centered.

```html
<body class="app-window-backdrop">
  <div class="app-shell app-window" data-surface="screen">
    <header class="app-shell__window window-bar">
      <span class="window-bar__dots">
        <button type="button" data-window-close title="Close">×</button>
        <button type="button" data-window-clear title="Clear cached data">⌫</button>
        <button type="button" data-window-back  title="Back">‹</button>
      </span>
      <span class="window-bar__ctl">
        <button type="button" data-cycle-theme title="Cycle theme">◆</button>
        <button type="button" data-toggle-scheme title="Light / dark">◐</button>
      </span>
      <button class="window-bar__search" type="button"><b-kbd keys="⌘K"></b-kbd> my-app › page</button>
      <span class="window-bar__end" style="width: 7rem"></span>
    </header>
    <!-- rail / topbar / main / aside / console … -->
    <footer class="app-shell__status status-bar">…</footer>
  </div>
</body>
```

- On mobile the window collapses: no backdrop padding, no frame, the title bar hides (the
  shell's drawer chrome carries the brand); the `status-bar` row stays.
- Tokens only — the frame re-themes with every flavor; the shadow is print-style solid offset,
  zero blur (DESIGN-SYSTEM §6).
