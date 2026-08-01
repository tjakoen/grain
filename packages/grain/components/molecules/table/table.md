# Table

A content data table — MILL maps Markdown pipe tables (`| a | b |` + `|---|---|`) to it.
Ruled and monochrome, not zebra-striped; the `.table-scroll` wrapper keeps wide tables
scrolling inside their own box. CSS-only: composed by MILL or written by hand.

For a **list of records** — a workspace app's rows you scan and open, with a sticky header
and whole-row links — reach for `data-table` instead. This one is for reading.

## Table
```html
<div class="table-scroll">
  <table class="table">
    <thead><tr><th>You change…</th><th>…also update</th></tr></thead>
    <tbody>
      <tr><td>An action verb</td><td>contract.ts → reasoner → tests → docs</td></tr>
      <tr><td>A design token</td><td>grain/styles/variables.css only</td></tr>
    </tbody>
  </table>
</div>
```
