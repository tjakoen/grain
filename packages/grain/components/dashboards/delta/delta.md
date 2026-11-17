# Delta

The change beside a number: a direction glyph, the size of the change, and a one-word baseline such
as "vs prior". The baseline sits on the tile and the full sentence, if one is needed, lives in the
dashboard head, so a tile never grows a paragraph under its number.

A delta never colours itself red or green. Whether up is good depends on the measure (revenue up is
good, churn up is not), and the component cannot know which, so direction is carried by the glyph
and the words. When the base is too small for a percentage to mean anything, write "was 1" with
data-small-base instead of a loud minus 100 percent.

## Directions

### Up

```html
<span class="delta" data-dir="up" data-surface="delta:revenue"><span class="delta__glyph" aria-hidden="true">▲</span> 12% <span class="delta__base">vs prior</span></span>
```

### Down

```html
<span class="delta" data-dir="down"><span class="delta__glyph" aria-hidden="true">▼</span> 3% <span class="delta__base">vs prior</span></span>
```

### Small base

```html
<span class="delta" data-dir="flat" data-small-base><span class="delta__base">was 1</span></span>
```

```controls
select data-dir = up | down | flat
toggle data-small-base
```

## Accessibility

The glyph is hidden from assistive technology, so the delta must say its direction in words when
the number alone would be ambiguous: give the tile an accessible name such as "Orders, down 3
percent versus prior" when the visible text is only "3%". The words are what carry direction for a
colour-blind reader too, which is the reason the component has no colour to lose.
