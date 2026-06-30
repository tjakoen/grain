# List

One class — `.list` with `.list__item` children. Bullet by default (an editorial
em-dash); `data-variant="ordered"` switches to a counter. Markers are muted ink, not a
heavy disc (DESIGN-SYSTEM §4). Give each item a `data-surface` so the AI can write — or
revise — one item at a time.

## Bullet (default)
```html
<ul class="list">
  <li class="list__item">Deep-work block — 09:00–11:00</li>
  <li class="list__item">Clear the inbox</li>
  <li class="list__item">Review architecture doc</li>
</ul>
```

## Ordered
```html
<ul class="list" data-variant="ordered">
  <li class="list__item">First</li>
  <li class="list__item">Second</li>
  <li class="list__item">Third</li>
</ul>
```
