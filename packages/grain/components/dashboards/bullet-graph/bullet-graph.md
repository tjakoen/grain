# Bullet graph

A measure against its target, drawn as a bar over grey qualitative ranges with a short line at the
target. It replaces the radial gauge, which spends a circle of space to show one number and makes
two values hard to compare.

The caller passes fractions of the scale as custom properties: --value for the bar, --target for
the line, and --poor and --fair for where the two darker bands end. The component computes nothing
and judges nothing; which band counts as poor is the caller's call, and it belongs in the legend.

## Against a target

### Near target

```html
<div class="bullet" role="img" aria-label="Revenue €48.2k of a €60k target" style="--value: 0.8; --target: 0.9; --poor: 0.5; --fair: 0.75" data-surface="bullet:revenue">
  <span class="bullet__bar"></span><span class="bullet__target"></span>
</div>
```

### Well short

```html
<div class="bullet" role="img" aria-label="Signups 140 of a 400 target" style="--value: 0.35; --target: 0.8; --poor: 0.5; --fair: 0.75" data-surface="bullet:signups">
  <span class="bullet__bar"></span><span class="bullet__target"></span>
</div>
```

## Accessibility

The graph is one image to assistive technology, so its aria-label must state the value and the
target in words, unit first. Put the same numbers in a visible legend (bullet__legend) below the
graph, because a reader zoomed in or on a small screen should not need to estimate a bar length.
The ranges differ in lightness, not hue, so they survive greyscale and colour blindness.
