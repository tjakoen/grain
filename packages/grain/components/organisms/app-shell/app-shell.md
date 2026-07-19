# App shell

The **workspace** layout — the "work-y" archetype that coexists with the single-column
editorial `.container`. A full-viewport CSS grid of five regions: a left **rail**, a top
**bar**, the **main** pane, a right **aside** (the assistant), and a bottom **console**.

It hosts arbitrary content, so it's a layout you apply with region classes (not a
data-bound tag): put `class="app-shell"` on the frame and drop content into
`app-shell__rail` / `__topbar` / `__main` / `__aside` / `__console`. `data-rail-collapsed`
narrows the rail to icons; on mobile the rail becomes a drawer (`data-rail-open`) over a
`app-shell__scrim`. See the live composition on any page of the reference app (it's the EDITOR
chrome — `tjakoen.github.io`'s `portfolio-frame`).

**Parent context (implicit, self-installing).** `.app-shell` must be a direct-or-nested child of
`<body>` — every real composition already is. `app-shell.css` sets `container-type: inline-size`
on `body:has(.app-shell)` (named `shell-frame`) because the shell's own mobile/tablet layout
breakpoints restyle `.app-shell`'s OWN grid properties, and an element can never `@container`-query
a condition on itself — only a descendant can query an ancestor container. Using `body` (rather
than a purpose-built wrapper) means the real narrow-viewport case works with zero JS; the
viewport-toggle (`data-shell="viewport-toggle"`) clamps `body[data-viewport]`'s max-width so its
preview shrinks the same container a real narrow window does. `sidebar-panel` and `status-bar`
share this container for their own mobile rules. One documented gap: `app-window`'s backdrop
padding lives on `body` itself (`.app-window-backdrop`), so it can't follow suit — it stays a real
`@media` and only responds to a genuinely narrow window, not the toggle preview.

Two **optional full-width rows** bracket the workspace: `__window` (top — the `app-window`
title bar) and `__status` (bottom — the `status-bar`). They're auto rows, so a shell that
places nothing in them renders exactly as before; fill them to dress the shell as an editor
window (see `app-window` + `status-bar`).

**Activity bar (opt-in).** Put an `activity-bar` (the VS Code icon column) as the FIRST child of
`__rail` (or of `.rail-body`, see below), with a nested `.side-rail` beside it: the container
becomes a flex row (rule lives in this sheet, alongside the mobile-drawer rules, so bundle order
can't break the drawer). A rail without one is untouched. Collapsing the rail then leaves the icon
strip only. See `activity-bar.md`.

**Rail head (opt-in).** Put a full-width `.rail-head` (a brand/title row) as the FIRST child of
`__rail`, followed by a `.rail-body` wrapping everything else (the activity-bar + side-rail row,
or a bare side-rail): the rail stacks vertically, the head sitting flush with the topbar row beside
it, everything else starting on its own line underneath. Skip both and the rail is untouched.

## Structure (capped height for the catalog; real one is `100dvh`)

```html
<div class="app-shell" data-rail-collapsed="false" style="height:280px">
  <aside class="app-shell__rail side-rail">
    <div class="side-rail__brand"><b-icon sym="/assets/sprite.svg#spark"></b-icon><span>Grain</span></div>
    <a class="nav-item" aria-current="page"><b-icon sym="/assets/sprite.svg#loop"></b-icon><span class="nav-item__label">Overview</span></a>
    <a class="nav-item"><b-icon sym="/assets/sprite.svg#tasks"></b-icon><span class="nav-item__label">Tasks</span></a>
  </aside>
  <div class="app-shell__topbar">
    <nav class="tab-bar"><a class="tab" aria-current="page">Overview</a><a class="tab">Tasks</a></nav>
  </div>
  <main class="app-shell__main" style="padding:1rem">Main content.</main>
  <aside class="app-shell__aside" style="padding:1rem">Assistant.</aside>
  <section class="app-shell__console" style="padding:.5rem 1rem">✶ the AI — idle</section>
</div>
```
