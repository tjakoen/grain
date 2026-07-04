# Card

A bordered content tile — a hairline box, no fill (state is ink, not hue) — plus its
companion `.card-grid` (auto-fit columns; tune the minimum tile width with `--card-min`,
default `15rem`). Composed by hand: a `<div>` for a plain fact, an `<a>` for a navigable
tile (the whole tile is the link). Padding is an attribute (`data-pad="sm"`), not a class.

## Fact card
```html
<div class="card" data-pad="sm">
  <h3 class="card__title">No build step</h3>
  <p class="card__body">Nothing between source and server: no bundler, no transpiler.</p>
</div>
```

## Card grid
```html
<div class="card-grid">
  <div class="card" data-pad="sm"><h3 class="card__title">One</h3><p class="card__body">First fact.</p></div>
  <div class="card" data-pad="sm"><h3 class="card__title">Two</h3><p class="card__body">Second fact.</p></div>
</div>
```

## Navigable card
```html
<a class="card" href="/grain">
  <h3 class="card__title">GRAIN</h3>
  <p class="card__body">An AI-interaction design system. Built on BATCH.</p>
</a>
```
