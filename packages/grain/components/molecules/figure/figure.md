# Figure

An image with an optional caption. The `clipped` variant gives the editorial clipped-photo
edge (a hard corner clip, no border). MILL maps a standalone Markdown image to this;
composed by hand, so nothing data-binds it. Images never overflow the column.

## Caption
```html
<figure class="figure">
  <img src="/assets/figure-sample.svg" alt="An abstract field of grain strokes">
  <figcaption class="figure__caption">A caption sits under the image, set small.</figcaption>
</figure>
```

## Clipped photo
```html
<figure class="figure" data-variant="clipped">
  <img src="/assets/figure-sample.svg" alt="The same image, clipped">
</figure>
```
