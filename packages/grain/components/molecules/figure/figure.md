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

## Diagram
Holds an inline SVG instead of an image. MILL emits this for a rendered mermaid fence, with the
SVG's colors written as token references so the diagram follows both theme axes without being
re-rendered. A diagram wider than the column scrolls rather than shrinking to unreadable.

```html
<figure class="figure" data-variant="diagram">
  <svg viewBox="0 0 120 40"><rect x="1" y="1" width="118" height="38"
    fill="var(--color-surface)" stroke="var(--color-line)"></rect></svg>
</figure>
```
