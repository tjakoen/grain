# Trend chart

A neutral display for a measure observed across ordered periods or ordered categories. The caller
supplies the title, x-axis labels, units, series values and optional comparison range; the component
assigns no meaning to direction, size, or distance from the range. It does not imply a target or
evaluate a person.

Labels may be time windows or categories such as ordered size buckets; GRAIN treats them as opaque
labels and does not infer what their order means. The caller must state a unit in the heading and the
table caption.

CSS-only. The SVG is the visual plot, and the accompanying data table is its equivalent text
alternative. Keep both synchronized when values change. The caller calculates coordinates and
chooses a consistent scale for each chart. Use the same explicit unit for the primary series and the
comparison range. The range band is optional; omit its area and table column when no comparison is
available. A missing observation should be shown as unavailable in the table and as a break in the
SVG path, not as zero.

The plot uses semantic tokens and neutral line treatments so it follows light and dark themes without
encoding a judgment. It has no animation, so it does not require motion to understand the data.

## Ordered series with comparison range

All values and labels below are invented examples. Coordinates use a 400 by 180 viewBox; x positions
must align with the ordered labels in the table. These labels could identify time windows or size
categories. The four horizontal rules are caller-chosen scale guides, not thresholds.

```html
<figure class="trend-chart">
  <figcaption class="trend-chart__head">
    <span>
      <span class="trend-chart__title">Sample measure</span><br>
      <span class="trend-chart__unit">Hours</span>
    </span>
    <span class="trend-chart__legend">Series A · shaded band: comparison range</span>
  </figcaption>
  <div class="trend-chart__plot">
    <svg class="trend-chart__svg" viewBox="0 0 400 180" role="img"
      aria-label="Sample measure in hours across four ordered labels, with a comparison range">
      <line class="trend-chart__grid" x1="48" y1="20" x2="390" y2="20"></line>
      <line class="trend-chart__grid" x1="48" y1="58" x2="390" y2="58"></line>
      <line class="trend-chart__grid" x1="48" y1="96" x2="390" y2="96"></line>
      <line class="trend-chart__grid" x1="48" y1="134" x2="390" y2="134"></line>
      <text class="trend-chart__axis-label" x="42" y="24" text-anchor="end">16</text>
      <text class="trend-chart__axis-label" x="42" y="62" text-anchor="end">12</text>
      <text class="trend-chart__axis-label" x="42" y="100" text-anchor="end">8</text>
      <text class="trend-chart__axis-label" x="42" y="138" text-anchor="end">4</text>
      <text class="trend-chart__axis-label" x="70" y="158" text-anchor="middle">A</text>
      <text class="trend-chart__axis-label" x="176" y="158" text-anchor="middle">B</text>
      <text class="trend-chart__axis-label" x="282" y="158" text-anchor="middle">C</text>
      <text class="trend-chart__axis-label" x="388" y="158" text-anchor="middle">D</text>
      <polygon class="trend-chart__range" points="70,86.5 176,77 282,96 388,67.5 388,115 282,124.5 176,115 70,124.5"></polygon>
      <polyline class="trend-chart__range-edge" points="70,86.5 176,77 282,96 388,67.5"></polyline>
      <polyline class="trend-chart__range-edge" points="70,124.5 176,115 282,124.5 388,115"></polyline>
      <polyline class="trend-chart__series" points="70,105.5 176,96 282,115 388,86.5"></polyline>
      <circle class="trend-chart__point" cx="70" cy="105.5" r="4"></circle>
      <circle class="trend-chart__point" cx="176" cy="96" r="4"></circle>
      <circle class="trend-chart__point" cx="282" cy="115" r="4"></circle>
      <circle class="trend-chart__point" cx="388" cy="86.5" r="4"></circle>
    </svg>
  </div>
  <div class="trend-chart__table-wrap">
    <table class="trend-chart__table">
      <caption class="trend-chart__caption">Values in hours</caption>
      <thead><tr><th scope="col">Label</th><th scope="col">Series A</th><th scope="col">Comparison range</th></tr></thead>
      <tbody>
        <tr><th scope="row">Group A</th><td>7</td><td>5–9</td></tr>
        <tr><th scope="row">Group B</th><td>8</td><td>6–10</td></tr>
        <tr><th scope="row">Group C</th><td>6</td><td>5–8</td></tr>
        <tr><th scope="row">Group D</th><td>9</td><td>6–11</td></tr>
      </tbody>
    </table>
  </div>
</figure>
```

## Without a comparison

Remove the range polygon, both range-edge polylines, the range phrase in the visible legend, and the
comparison column. Keep the label/value table: the chart is not the only way to read the series.

## Caller contract

- Use one `.trend-chart` root and the child class names shown above. No script or GRAIN binding is
  required.

- The SVG viewBox, scale guides, series coordinates and range coordinates are caller-owned. Map all
  series onto the same y scale, and align each x coordinate with its ordered label row.

- Supply either chronological period labels or ordered category labels. The component treats labels
  as opaque strings; state the measure and its unit in the heading and table caption. Label any
  comparison in the legend and table header.

- Use the same y scale and unit for the series and comparison range. The component draws no target
  line and assigns no favorable or unfavorable meaning to any value or direction.

- Preserve each value in the table at the same precision as the plotted point. Do not fill missing
  values with zero or visually connect across a missing period.

- The component does not color, rank, score, or explain the series. Callers may add interpretation
  outside it, with evidence and context appropriate to their product.

## In transit

The standard GRAIN pending treatment applies to the root:

```html
<figure class="trend-chart" data-commit="pending">…</figure>
```
