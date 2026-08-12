# Gallery

A captioned image grid: the companion to `card-grid`, for pictures rather than facts. Every tile is
equal weight, cropped to one ratio, caption underneath. Composed by hand, so nothing data-binds it.

It is not a hero strip. A strip runs one photo big to carry a post; a gallery is the roll that hero
was picked from, and it belongs where a reader can scan it and move on. Tile width tunes with
`--gallery-min` (default `15rem`, the same idiom as `--card-min`), the crop with `--gallery-ratio`.

## Gallery
```html
<div class="gallery">
  <figure class="gallery__item">
    <span class="gallery__link"><img src="/assets/figure-sample.svg" alt="An abstract field of grain strokes"></span>
    <figcaption class="gallery__caption">The caption is the alt text: it has to work read aloud and read on the page.</figcaption>
  </figure>
  <figure class="gallery__item">
    <span class="gallery__link"><img src="/assets/figure-sample.svg" alt="The same field, second frame"></span>
    <figcaption class="gallery__caption">One sentence, what is actually in the frame.</figcaption>
  </figure>
</div>
```

## Wired to the lightbox

Wrap the grid in `data-lightbox-group` and mark each tile `data-lightbox` (`scripts/lightbox.js`).
**One group per gallery**, so prev/next never walks out of it into another strip on the same page.
Keep the trigger an `<a href>` pointing at the full image: with no JS, or a modified click, it
degrades to a plain navigation, which is the no-JS-safe fallback.

```html
<div class="gallery" data-lightbox-group>
  <figure class="gallery__item">
    <a class="gallery__link" data-lightbox href="/assets/figure-sample.svg">
      <img src="/assets/figure-sample.svg" alt="An abstract field of grain strokes" loading="lazy" decoding="async">
    </a>
    <figcaption class="gallery__caption">Clicking any tile opens the viewer and walks the whole group.</figcaption>
  </figure>
</div>
```

## Wider tiles, square crop
```html
<div class="gallery" style="--gallery-min: 20rem; --gallery-ratio: 1 / 1;">
  <figure class="gallery__item">
    <span class="gallery__link"><img src="/assets/figure-sample.svg" alt="A square crop of the same field"></span>
    <figcaption class="gallery__caption">Both knobs are custom properties, set them on the grid.</figcaption>
  </figure>
</div>
```

**Alt text is the caption here**, so write one that carries both jobs: read aloud, and read on the
page under the picture.
