# Side rail

The vertical navigation rail inside the app-shell: brand → nav-items → spacer → footer
items. A layout class composed with `b-icon` and `nav-item`. When the shell carries
`data-rail-collapsed="true"` the labels drop and glyphs center (icons-only). On mobile the
shell turns the whole rail into a drawer.

The brand mark (`.side-rail__brand > b-icon`) carries `var(--color-accent)` — hueless under the
default theme, a hue under an accent theme (the accent reaches the brand + the presence star;
DESIGN-SYSTEM §2). Pairs with the `activity-bar` organism when the shell wants a VS Code-style
icon column (see `activity-bar.md`).

## Example

```html
<aside class="side-rail" style="height:240px;border:1px solid var(--color-line)">
  <div class="side-rail__brand"><b-icon sym="/assets/sprite.svg#spark"></b-icon><span>Grain</span></div>
  <a class="nav-item" aria-current="page"><b-icon sym="/assets/sprite.svg#loop"></b-icon><span class="nav-item__label">Overview</span></a>
  <a class="nav-item"><b-icon sym="/assets/sprite.svg#tasks"></b-icon><span class="nav-item__label">Tasks</span></a>
  <a class="nav-item"><b-icon sym="/assets/sprite.svg#knowledge"></b-icon><span class="nav-item__label">Library</span></a>
  <div class="side-rail__spacer"></div>
  <a class="nav-item"><b-icon sym="/assets/sprite.svg#settings"></b-icon><span class="nav-item__label">Settings</span></a>
</aside>
```

## Grouped, counted, and signed

Three optional pieces for a rail with more in it than a handful of destinations — a workspace
app rather than a site. All three collapse with the rail: the label goes entirely, the counts
go with the nav-item labels, and the foot keeps its mark and drops its text.

- `.side-rail__label` — a section heading between runs of items. Not a `.side-rail__group`
  (that's a collapsible `<details>`); this only separates.
- `.nav-item__count` — how much is waiting in a destination (see `nav-item.md`). The value is
  the consumer's to keep current.
- `.side-rail__foot` — a mark plus two lines of identity, pinned under the spacer.
  **Persona-neutral:** grain ships the shape; who it names — an account, a workspace,
  "signed out" — is the consumer's, exactly like the topbar's presence label.

```html
<aside class="side-rail" style="height:280px;border:1px solid var(--color-line)">
  <div class="side-rail__brand"><b-icon sym="/assets/sprite.svg#spark"></b-icon><span>Grain</span></div>
  <a class="nav-item"><b-icon sym="/assets/sprite.svg#loop"></b-icon><span class="nav-item__label">Home</span></a>
  <span class="side-rail__label">Workspace</span>
  <a class="nav-item" aria-current="page"><b-icon sym="/assets/sprite.svg#tasks"></b-icon><span class="nav-item__label">Tickets</span><span class="nav-item__count">12</span></a>
  <a class="nav-item"><b-icon sym="/assets/sprite.svg#knowledge"></b-icon><span class="nav-item__label">Clients</span><span class="nav-item__count">3</span></a>
  <div class="side-rail__spacer"></div>
  <a class="nav-item"><b-icon sym="/assets/sprite.svg#settings"></b-icon><span class="nav-item__label">Settings</span></a>
  <div class="side-rail__foot">
    <span class="side-rail__avatar">TS</span>
    <span class="side-rail__who"><strong>Local workspace</strong>no account</span>
  </div>
</aside>
```
