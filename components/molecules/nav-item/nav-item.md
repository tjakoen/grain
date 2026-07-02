# Nav item

A rail navigation entry — an icon + a label with an active state. A styled anchor composed
with `b-icon`. Mark the current one with `aria-current="page"` (accessible) or
`data-active="true"`. In a collapsed rail the label is hidden and the glyph centers.

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
