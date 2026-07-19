# Icon

Inline SVG glyphs from the shared sprite (`/assets/sprite.svg`). One class — `.icon`;
`size` is an attribute. Monochrome and `currentColor`, so an icon flips ink ↔ grain with
its surroundings. Icons are **decorative** (`aria-hidden`) — label the control that wraps
them (see `b-icon-button`), not the glyph.

Pass the whole sprite reference in `sym` (the binding vocabulary can't concatenate a name).

## Glyphs

```html
<b-icon sym="/assets/sprite.svg#loop"></b-icon>
<b-icon sym="/assets/sprite.svg#tasks"></b-icon>
<b-icon sym="/assets/sprite.svg#knowledge"></b-icon>
<b-icon sym="/assets/sprite.svg#rules"></b-icon>
<b-icon sym="/assets/sprite.svg#traces"></b-icon>
<b-icon sym="/assets/sprite.svg#settings"></b-icon>
<b-icon sym="/assets/sprite.svg#menu"></b-icon>
<b-icon sym="/assets/sprite.svg#close"></b-icon>
<b-icon sym="/assets/sprite.svg#chevron-left"></b-icon>
<b-icon sym="/assets/sprite.svg#chevron-right"></b-icon>
<b-icon sym="/assets/sprite.svg#send"></b-icon>
<b-icon sym="/assets/sprite.svg#search"></b-icon>
<b-icon sym="/assets/sprite.svg#spark"></b-icon>
<b-icon sym="/assets/sprite.svg#check"></b-icon>
<b-icon sym="/assets/sprite.svg#plus"></b-icon>
```

## Sizes

```html
<b-icon sym="/assets/sprite.svg#loop" size="sm"></b-icon>
<b-icon sym="/assets/sprite.svg#loop"></b-icon>
<b-icon sym="/assets/sprite.svg#loop" size="lg"></b-icon>
```
