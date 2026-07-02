# Tab

One open view in the tab-bar — a styled link with an active state. The active tab meets its
pane below via an inset ink underline. An optional `.tab__close` holds a close glyph.

## States

### Active
```html
<a class="tab" aria-current="page">Overview</a>
```

### Default + closable
```html
<a class="tab">Tasks</a>
<a class="tab">Library · notes <span class="tab__close"><b-icon sym="/assets/sprite.svg#close" size="sm"></b-icon></span></a>
```
