# status-bar

The editor-style **status row** at the bottom of the app window: quiet mono meta-text
(presence, build info) on the left, small controls (theme cycle, scheme toggle, ⌘K hint) on
the right of a `__spacer`. CSS-only (no `.html`) — the consumer supplies the content; controls
here are *status, not content*, so buttons unstyle to plain text and sharpen on hover/focus.

**Parent contract (required):** place a `.status-bar` in the app-shell's `.app-shell__status`
grid row (app-shell.css owns the row). Pairs with `app-window` for the full editor-window frame.

```html
<footer class="app-shell__status status-bar">
  <span class="presence">✶ online</span>
  <span data-status-optional>0 ⊘ · 0 ⚠</span>
  <span data-status-optional>main</span>
  <span class="status-bar__spacer"></span>
  <button type="button" data-cycle-theme>◆ <span data-theme-name>sourdough</span></button>
  <button type="button" data-toggle-scheme>◐ scheme</button>
  <b-kbd keys="⌘K"></b-kbd>
</footer>
```

- The theming controls are the standard declarative ones (`scripts/theme.js`); a
  `[data-theme-name]` span inside anything gets kept in sync with the current flavor name.
- Mark middle meta-text `data-status-optional` — it hides on narrow screens so presence and
  the controls keep the row.
- Honest-status doctrine: what this row *claims* (build ref, check counts, presence) should be
  real — bake real values at export/compose time or show none.
