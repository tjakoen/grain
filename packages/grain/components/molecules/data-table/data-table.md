# Data table

A **dense table of records** — the list view of a workspace app: rows you scan and open.
Uppercase sticky header, tight cells, full-width rules, hover, and an optional
whole-row link affordance.

This is not the `table` molecule. That one is a **content** table (MILL maps Markdown pipe
tables to it; prose padding, first column flush left) for reading. This one is for working.
Reaching for the wrong one should be a decision, not an accident — if you are rendering
Markdown, you want `table`.

CSS-only (no `.html`): nothing data-binds it, the rows are yours.

**Parent context (optional but load-bearing):** the header only sticks if an **ancestor** is
the scroll container — `position: sticky` resolves against the nearest scrollable ancestor.
Inside an `app-shell` that is `.app-shell__main` and it works with no effort. On a page that
scrolls on `<body>`, or inside a box with no `overflow`, the header simply scrolls away with
the rows; nothing breaks, but you don't get what the demo shows.

## Example

```html
<table class="data-table">
  <thead><tr><th>Name</th><th>Code</th><th>Owner</th></tr></thead>
  <tbody>
    <tr data-href="#acme">
      <td><a href="#acme">Acme Advisory</a><br><span class="data-table__sub">since 2021</span></td>
      <td>acme</td>
      <td><span class="data-table__sub">jane@acme.test</span></td>
    </tr>
    <tr data-href="#borden">
      <td><a href="#borden">Borden &amp; Co</a></td>
      <td>borden</td>
      <td><span class="data-table__sub">ops@borden.test</span></td>
    </tr>
  </tbody>
</table>
```

## Whole-row links

`tr[data-href]` gets the pointer cursor and nothing else. The navigation is yours to wire —
`data-href` is a plain markup hint, not a vocabulary verb, and no grain script reads it.

**Keep a real `<a>` in the row anyway.** A pointer cursor is not a link: a row that only
responds to a click handler can't be tabbed to, opened in a new tab, or read out as a
destination. The anchor is the navigation; the row affordance is a convenience over it.

## Empty

The empty state is a **row**, not a replacement for the table — the header stays, so the
columns still say what would be here once there is data.

```html
<table class="data-table">
  <thead><tr><th>Name</th><th>Code</th><th>Owner</th></tr></thead>
  <tbody><tr class="data-table__empty"><td colspan="3">No clients yet.</td></tr></tbody>
</table>
```

## AI

Carries the shared in-transit idiom: `data-commit="pending"` on the table, or a
`[data-grade="grain"]` ancestor, draws the dashed terminal edge — the same signal the atoms
and `table` use.
