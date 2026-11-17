# Dash panel

The surface one chart, table or ranked list sits on inside a dashboard. It has a title, an
optional action on the same line, and a state. A panel is never just a box: it is ready, loading,
empty, stale or failed, and it says which in a word a reader can act on.

Loading reuses the shared in-transit idiom, data-commit="pending", the same dashed edge a stat tile
or a button wears while the AI is writing it. Empty says what to do next rather than "No data".
Stale says when the numbers were last true. Failed says what to try.

## States

### Ready

```html
<section class="dash-panel" data-surface="panel:signups">
  <header class="dash-panel__head">
    <h3 class="dash-panel__title">Signups</h3>
    <a class="dash-panel__action" href="#signups">Open report</a>
  </header>
  <p class="dash-panel__note">312 this week</p>
</section>
```

### Loading

```html
<section class="dash-panel" data-commit="pending" aria-busy="true" data-surface="panel:signups">
  <header class="dash-panel__head"><h3 class="dash-panel__title">Signups</h3></header>
  <p class="dash-panel__note">Loading this week</p>
</section>
```

### Empty

```html
<section class="dash-panel" data-state="empty" data-surface="panel:refunds">
  <header class="dash-panel__head"><h3 class="dash-panel__title">Refunds</h3></header>
  <p class="dash-panel__note">None this period. Refunds appear here as soon as one is issued.</p>
</section>
```

### Stale

```html
<section class="dash-panel" data-state="stale" data-surface="panel:traffic">
  <header class="dash-panel__head"><h3 class="dash-panel__title">Traffic</h3></header>
  <p class="dash-panel__note">Last updated 09:40, the feed has not answered since</p>
</section>
```

```controls
select data-state = - | empty | stale | error
toggle data-commit = pending
text .dash-panel__title = Signups
text .dash-panel__note = 312 this week
```

## Accessibility

A loading panel sets aria-busy so assistive technology waits for the content instead of reading a
half-drawn panel. The state is always written as text in the note, never carried by the border
alone; the border is a second cue for sighted readers, not the only one.

The action is a real link or button with a specific label ("Open report"), never "More" or an icon
on its own.
