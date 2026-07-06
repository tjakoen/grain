# Tab bar

The top strip of open views, inside the app-shell topbar. A scrollable row of `tab`s;
place controls (a `b-kbd` for ⌘K, an AI presence marker) after it in the topbar. Tabs are
navigation (links) — active is per-page, not client state.

**Close all (opt-in):** a control marked `data-shell="tabs-close-all"` placed as a SIBLING of the
strip (not inside it, so it survives the strip's own horizontal scroll) is wired live by
`scripts/tabs.js`: it clears every non-pinned tab and, if the current page was one of them,
navigates to the first pinned tab. `tabs.js` toggles its `hidden` attribute — shown only once
there's something closable open.

## Example

```html
<div style="display:flex;align-items:stretch;border:1px solid var(--color-line)">
  <nav class="tab-bar">
    <a class="tab" aria-current="page">Overview</a>
    <a class="tab">Tasks</a>
    <a class="tab">Library · notes</a>
  </nav>
  <span style="margin-left:auto;display:flex;align-items:center;gap:.5rem;padding:0 .75rem">
    <b-kbd keys="⌘K"></b-kbd>
  </span>
</div>
```
