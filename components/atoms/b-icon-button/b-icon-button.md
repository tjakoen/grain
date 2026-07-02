# Icon button

The "icon square" (DESIGN-SYSTEM §5): a bordered control holding one glyph. One class —
`.icon-btn`; variant and size are attributes. Icon-only, so **`label` is required** (it
becomes the `aria-label`). Same ink-hairline / invert-on-hover treatment as `b-button`.

## Default

```html
<b-icon-button sym="/assets/sprite.svg#send" label="Send"></b-icon-button>
```

## Ghost (rail / toolbar)

```html
<b-icon-button sym="/assets/sprite.svg#menu" label="Menu" variant="ghost"></b-icon-button>
```

## Sizes

```html
<b-icon-button sym="/assets/sprite.svg#search" label="Search" size="sm"></b-icon-button>
<b-icon-button sym="/assets/sprite.svg#search" label="Search"></b-icon-button>
<b-icon-button sym="/assets/sprite.svg#search" label="Search" size="lg"></b-icon-button>
```

## States

```html
<b-icon-button sym="/assets/sprite.svg#send" label="Send" data-force="hover"></b-icon-button>
<b-icon-button sym="/assets/sprite.svg#send" label="Send" data-force="focus"></b-icon-button>
<b-icon-button sym="/assets/sprite.svg#send" label="Send" disabled></b-icon-button>
```
