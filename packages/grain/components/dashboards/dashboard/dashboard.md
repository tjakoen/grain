# Dashboard

The page a dashboard sits on. A head names the dashboard, the period and what every delta on the
page compares against, so a reader never has to guess the baseline. Below it, a strip of stat tiles
that adds columns as the screen grows, then a grid of panels that runs one column on a phone, two on
a tablet, three on a desktop and four on an ultrawide.

The layout queries its own width, not the viewport's, so a dashboard inside a sidebar or a catalog
panel lays itself out for the room it actually has. A panel spans two columns with data-span="2"
and the whole row with data-span="full".

Stat tiles, trend charts and data tables are the existing molecules; this layer composes them and
adds the dash panel, the delta, the bullet graph and the rank list. Every tile and panel carries a
data-surface slug so a tour, a lamp or the reasoner can point at one number rather than at the page.

## Overview

### A dashboard with a KPI strip and three panels

```html
<div class="dash" data-surface="dashboard:sales">
  <header class="dash__head">
    <h2 class="dash__title">Sales</h2>
    <p class="dash__period">1 to 14 November, compared with the two weeks before</p>
  </header>
  <div class="dash__kpis">
    <div class="stat" data-surface="stat:revenue">
      <span class="stat__value">€48.2k</span>
      <span class="stat__label">Revenue</span>
      <span class="delta" data-dir="up"><span class="delta__glyph" aria-hidden="true">▲</span> 12% <span class="delta__base">vs prior</span></span>
    </div>
    <div class="stat" data-surface="stat:orders">
      <span class="stat__value">1,204</span>
      <span class="stat__label">Orders</span>
      <span class="delta" data-dir="down"><span class="delta__glyph" aria-hidden="true">▼</span> 3% <span class="delta__base">vs prior</span></span>
    </div>
    <div class="stat" data-surface="stat:refunds">
      <span class="stat__value">0</span>
      <span class="stat__label">Refunds</span>
      <span class="delta" data-dir="flat" data-small-base><span class="delta__base">was 1</span></span>
    </div>
  </div>
  <div class="dash__grid">
    <section class="dash-panel" data-span="2" data-surface="panel:revenue-by-source">
      <header class="dash-panel__head"><h3 class="dash-panel__title">Revenue by source</h3></header>
      <ol class="rank-list">
        <li class="rank-list__row" style="--share: 0.52"><span class="rank-list__name">Direct</span><span class="rank-list__value">€25.1k</span></li>
        <li class="rank-list__row" style="--share: 0.31"><span class="rank-list__name">Search</span><span class="rank-list__value">€14.9k</span></li>
        <li class="rank-list__row" style="--share: 0.17"><span class="rank-list__name">Referral</span><span class="rank-list__value">€8.2k</span></li>
      </ol>
    </section>
    <section class="dash-panel" data-surface="panel:target">
      <header class="dash-panel__head"><h3 class="dash-panel__title">Monthly target</h3></header>
      <div class="bullet" role="img" aria-label="Revenue €48.2k of a €60k target" style="--value: 0.8; --target: 0.9; --poor: 0.5; --fair: 0.75">
        <span class="bullet__bar"></span><span class="bullet__target"></span>
      </div>
      <p class="bullet__legend">€48.2k of €60k</p>
    </section>
  </div>
</div>
```

## Accessibility

The head is a real heading, and each panel title is the next level down, so a screen reader's
heading list reads as the dashboard's table of contents. The period line is plain text rather than
a tooltip, because it is the one sentence a reader must not miss.

Tiles read in source order, left to right and then down; the grid never reorders them visually, so
keyboard and reading order match what is on screen. The layout has no motion.
