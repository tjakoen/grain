# Tab bar

The top strip of open views, inside the app-shell topbar. A scrollable row of `tab`s;
place controls (a `b-kbd` for ⌘K, an AI presence marker) after it in the topbar. Tabs are
navigation (links) — active is per-page, not client state.

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
