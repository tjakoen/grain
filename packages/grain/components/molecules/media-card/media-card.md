# Media card

A card that leads with a picture: one image, a title, an optional description, an optional row of
buttons. It borrows `card`'s vocabulary rather than inventing a second one, so the box is a
hairline with no fill, `data-pad` tunes the padding, and the whole tile is the link when the root
is an `<a>`. Composed by hand, so nothing data-binds it. The crop tunes with `--media-ratio`
(default `16 / 9`, the same idiom as `--gallery-ratio`).

**It embeds nothing.** The reason lives in the second example below, but it applies to the whole
component: there is no iframe, no third-party script and no JS of any kind in it, which makes the
no-JS case the only case there is.

## A picture that links somewhere

The plain case. The root is the anchor, so the picture is the tap target, and the description
collapses to nothing when you leave it out.

```html
<a class="media-card" href="#media-card">
  <span class="media-card__media">
    <img class="media-card__image" src="/assets/figure-sample.svg"
         alt="An abstract field of grain strokes" loading="lazy" decoding="async">
  </span>
  <span class="media-card__body">
    <span class="media-card__title">The field, in one frame</span>
    <span class="media-card__text">One sentence about where this goes, written like a link and not
      like a button.</span>
  </span>
</a>
```

## A video poster that links out

`data-layout="overlay"` moves the text onto the bottom of the picture, on a scrim, and the play
badge sits centred over it. The badge is decorative, so it is `aria-hidden` and the title is what a
screen reader is given.

This is the shape to reach for when a video lives on somebody else's platform. Embedding it would
put a third-party iframe and its scripts on the page to play something that lives over there
regardless: the visitor lands on that platform the moment they press play either way. So the tile
is one anchor over a still you host yourself, and the title says where the tap goes and whose
platform it lands on, because the picture cannot.

```html
<a class="media-card" data-layout="overlay" href="https://example.com/reel/1" rel="noopener">
  <span class="media-card__media">
    <img class="media-card__image" src="/assets/figure-sample.svg" width="1600" height="900"
         alt="A still from the recap, the room mid-session" loading="lazy" decoding="async">
    <span class="media-card__play" aria-hidden="true">▶</span>
  </span>
  <span class="media-card__body">
    <span class="media-card__title">Watch the recap on the platform it lives on</span>
  </span>
</a>
```

Both scrim colors hold their value in light and dark. A scrim darkens somebody else's photograph so
a label survives on top of it, and a photograph does not invert with the palette.

## With an action row

**When there are buttons, the root is a `<div>`, never an `<a>`.** A link inside a link is invalid
markup and browsers recover from it in their own ways, so the two are mutually exclusive: either
the whole tile navigates, or the buttons do.

```html
<div class="media-card" data-pad="sm">
  <span class="media-card__media">
    <img class="media-card__image" src="/assets/figure-sample.svg" style="--media-ratio: 3 / 2;"
         alt="The same field, second frame" loading="lazy" decoding="async">
  </span>
  <div class="media-card__body">
    <h3 class="media-card__title">Two ways out of one tile</h3>
    <p class="media-card__text">The description is optional and so is this row. Both collapse to
      nothing when they are absent.</p>
    <div class="media-card__actions">
      <a class="btn" data-size="sm" href="#media-card">Read the write-up</a>
      <a class="btn" data-size="sm" data-variant="soft" href="#media-card">See the photos</a>
    </div>
  </div>
</div>
```

## Layouts

`data-layout` carries the layout, because the two shapes share every rule they have apart from
where the text sits: the box, the crop, the hover, the badge and the pending edge. Two components
would fork all five of those to move one block of text.

| Value | What it does |
| --- | --- |
| *(omitted)* | Stacked. The text sits under the picture. |
| `overlay` | The text sits over the bottom of the picture, on a scrim. |

A beside-the-picture layout is the same decision one more time, and it is deliberately not shipped
until something asks for it. When something does, it is one more value in that table rather than a
new molecule.
