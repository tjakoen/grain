# Presentation

A **deck**. Full-bleed slides, staged fragments, an overview grid, present mode, a speaker-notes
strip, a second-window presenter view, and a print sheet that lands everything first.

It knows nothing about any particular talk. The organism owns *which slide is up and how far into
it we are*; the app owns the slides, the figures, and every animation on them. That split is the
whole design: one seam, no registry, no per-slide config.

CSS plus one island, `grain/scripts/presentation.js`. Load it and the markup below is live with no
per-page wiring.

## Markup

```html
<div class="presentation" data-present data-deck data-hash data-minutes="20" data-channel="my-talk">

  <div class="presentation__bar">
    <p class="presentation__hint">← → move · <kbd>D</kbd> light/dark · <kbd>.</kbd> blank</p>
  </div>

  <section class="presentation__slide" data-title="Title">
    <p class="slide-eyebrow">An eyebrow</p>
    <h1 class="slide-head" data-size="xl">The claim</h1>
    <ul class="beats">
      <li class="frag">Lands on the first press</li>
      <li class="frag">Then this one</li>
    </ul>
    <ul class="slide-notes" hidden>
      <li>What to say here. Never rendered on the slide.</li>
    </ul>
  </section>

  <nav class="presentation__dots" data-dots aria-label="Slides"></nav>
  <div class="presentation__controls">
    <button class="presentation__ctl" type="button" data-ctl="prev" aria-label="Back">‹</button>
    <span class="presentation__ctl" data-wide aria-hidden="true"><span data-pos>1 / 1</span></span>
    <button class="presentation__ctl" type="button" data-ctl="next" aria-label="Forward">›</button>
    <button class="presentation__ctl" type="button" data-ctl="grid" aria-pressed="false">⊞</button>
    <button class="presentation__ctl" type="button" data-ctl="notes" aria-pressed="false">☰</button>
    <button class="presentation__ctl" type="button" data-ctl="presenter">◫</button>
    <button class="presentation__ctl" type="button" data-present-toggle>⤢</button>
  </div>
  <div class="presentation__notes" data-inline-notes aria-live="polite"></div>
  <div class="presentation__grid" data-grid></div>
</div>
```

The dot strip and the overview grid are filled by the script from the slides themselves, so a deck
never maintains two lists that can disagree. `data-title` is what shows in both, and in the
presenter window.

The catalog renders this example flat rather than live, and that is the honest thing to do: a deck
sizes itself from its own box with `container-type: size` and lays its slides out absolutely, so
one dropped into a catalog panel collapses to nothing. Read the code, or open a real deck.

**Opt in with `data-deck`.** Without the script the markup still renders whichever slide carries
`data-current`, which is what a static export and a print run get.

## Sizing is one number

`--u0` comes from the deck's own box in container query units, and `--u` is `--u0 × --fit`. Every
size in the component is a multiple of `--u`.

`--fit` is the shrink factor the script measures per slide: it drops the factor until the slide's
body fits its box, so a dense slide scales as one piece instead of reflowing into a mess. Anything
marked `aria-expanded="false"` is measured **open**, so clicking a card on stage can never overflow
a slide that fit a moment ago.

Two consequences worth knowing. A slide sitting near `--fit: 0.6` is not a rendering bug, it is the
component telling you the slide carries two ideas and wants to be two slides. And fragments only
change opacity and transform, never layout, so one measurement per slide holds for every step.

## Fragments and figures

`.frag` starts hidden and lands on a press. `data-frag` picks how: `rise` (the default), `fade`,
`grow`, or `dim` for a beat that lands quieter than the ones above it.

Figures get two hooks that need no per-deck script. `[data-draw]` draws an SVG stroke in, using a
`--draw-len` set to the path length. `[data-lit]` fades an element up once its slide arrives, or
once its own fragment lands if it sits inside one.

Slides can also declare steps that no fragment represents, for an app-driven animation:
`data-steps="1"` adds a press that fires the seam without changing the markup.

## The seam

One event on the deck element, and it is the entire contract:

```js
deck.addEventListener("presentation:slide", (e) => {
  const { index, step, slide, title, entered, total } = e.detail;
});
```

`entered` is true on the first event for a slide and false on later steps within it, so an app can
start an animation once and advance a figure per step. A second event, `presentation:print`, fires
before printing so an app can land its own figures in their final state.

## Keys, and giving one back

Arrows and space move, `Home` and `End` jump, `O` opens the overview, `N` toggles notes, `P` opens
the presenter window, `F` presents, and `.` blanks the screen. A swipe is an arrow key.

A slide can claim a key for its own control with `data-cede="ArrowUp ArrowDown"`, and the deck
yields it while that slide is current. A guess marker the room drives with the up and down arrows
is the case this exists for.

## The presenter window

`P` opens the same page again with `?presenter=1`. It shows the current title, its notes, what is
next, and a clock that turns accent past `data-minutes`. The two windows stay in step over a
`BroadcastChannel` named by `data-channel`, and arrows pressed in the presenter window drive the
main one. The audience never sees it.

## Print

`Cmd+P` lands every fragment and every figure first, then lays one slide per page. The component
re-runs its fit pass under print rules, because print swaps `--u0` to viewport units and a deck
that skipped that step would print every slide at the screen's factor.

## Grade

A deck follows grain's grade mechanism like anything else: `data-grade="grain"` on a line the
machine drafted. The organism deliberately does **not** re-face type on arrival. An earlier build
did, and from the back of a room a third of a second of shifting letterforms reads as a glitch
rather than a signal. The script still sets `data-settling` while a slide lands, so a consumer that
wants the effect can style it.
