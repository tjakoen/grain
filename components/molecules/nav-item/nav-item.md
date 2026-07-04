# Nav item

A rail navigation entry — the icon sits in the rail's shared icon **gutter** (a fixed
column, `--rail-icon-col`), the label beside it; all glyphs align in one vertical column
and the side-rail draws the gutter hairline. A styled anchor composed with `b-icon`. Mark
the current one with `aria-current="page"` (accessible) or `data-active="true"`. In a
collapsed rail the label is hidden and the glyph centers. Iconless entries (a group's
sub-items) indent past the gutter — the side-rail handles that.

## States

### Active
```html
<a class="nav-item" aria-current="page"><b-icon sym="/assets/sprite.svg#loop"></b-icon><span class="nav-item__label">Overview</span></a>
```

### Default
```html
<a class="nav-item"><b-icon sym="/assets/sprite.svg#tasks"></b-icon><span class="nav-item__label">Tasks</span></a>
<a class="nav-item"><b-icon sym="/assets/sprite.svg#rules"></b-icon><span class="nav-item__label">Rules</span></a>
```
