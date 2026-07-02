# App shell

The **workspace** layout — the "work-y" archetype that coexists with the single-column
editorial `.container`. A full-viewport CSS grid of five regions: a left **rail**, a top
**bar**, the **main** pane, a right **aside** (the assistant), and a bottom **console**.

It hosts arbitrary content, so it's a layout you apply with region classes (not a
data-bound tag): put `class="app-shell"` on the frame and drop content into
`app-shell__rail` / `__topbar` / `__main` / `__aside` / `__console`. `data-rail-collapsed`
narrows the rail to icons; on mobile the rail becomes a drawer (`data-rail-open`) over a
`app-shell__scrim`. See the live composition at `/dashboard`.

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
