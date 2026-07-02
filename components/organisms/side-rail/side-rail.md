# Side rail

The vertical navigation rail inside the app-shell: brand → nav-items → spacer → footer
items. A layout class composed with `b-icon` and `nav-item`. When the shell carries
`data-rail-collapsed="true"` the labels drop and glyphs center (icons-only). On mobile the
shell turns the whole rail into a drawer. See the live composition at `/dashboard`.

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
