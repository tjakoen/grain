# Tab

One open view in the tab-bar, editor-style: a boxed tab with an optional icon
(`.tab__icon`), a mono label, and an optional close affordance (`.tab__close`). The active
tab carries a top accent line and merges into its pane. The close is presentational by
default (pointer-events off; a click lands on the tab's link) — wire it as a real button
only when views are genuinely closable.

## States

### Active
```html
<a class="tab" aria-current="page"><span class="tab__icon"><b-icon sym="/assets/sprite.svg#tasks" size="sm"></b-icon></span>Overview<span class="tab__close" aria-hidden="true"><b-icon sym="/assets/sprite.svg#close" size="sm"></b-icon></span></a>
```

### Default + closable
```html
<a class="tab"><span class="tab__icon"><b-icon sym="/assets/sprite.svg#loop" size="sm"></b-icon></span>Tasks<span class="tab__close" aria-hidden="true"><b-icon sym="/assets/sprite.svg#close" size="sm"></b-icon></span></a>
<a class="tab">Library · notes</a>
```
