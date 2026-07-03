# Figure

An image with an optional caption. The `clipped` variant gives the editorial clipped-photo
edge (a hard corner clip, no border). MILL maps a standalone Markdown image to this;
composed by hand, so nothing data-binds it. Images never overflow the column.

## Caption
```html
<figure class="figure">
  <img src="/screenshots/loop-desk.png" alt="The desk mid-act">
  <figcaption class="figure__caption">The spotlight travels to the surface it edits.</figcaption>
</figure>
```

## Clipped photo
```html
<figure class="figure" data-variant="clipped">
  <img src="/screenshots/loop-desk.png" alt="The desk, clipped">
</figure>
```
