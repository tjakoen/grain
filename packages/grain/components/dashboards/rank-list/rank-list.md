# Rank list

A ranked breakdown: sources by revenue, pages by views, courses by enrolment. Each row is a name and
a value, with a slim share bar along its bottom edge whose length is the row's share of the total.
The bar replaces a tinted block behind the whole row, which turns a list into a wall of colour and
makes the names harder to read than the numbers.

The caller sorts the rows and passes each share as --share, a fraction between 0 and 1.

## Breakdown

### Revenue by source

```html
<ol class="rank-list" data-surface="rank:revenue-by-source">
  <li class="rank-list__row" style="--share: 0.52"><span class="rank-list__name">Direct</span><span class="rank-list__value">€25.1k</span></li>
  <li class="rank-list__row" style="--share: 0.31"><span class="rank-list__name">Search</span><span class="rank-list__value">€14.9k</span></li>
  <li class="rank-list__row" style="--share: 0.17"><span class="rank-list__name">Referral</span><span class="rank-list__value">€8.2k</span></li>
</ol>
```

## Accessibility

The list is an ordered list, so a screen reader announces the rank and the count. The share bar is
decoration drawn by CSS and is never read; the value in each row is the text a reader hears, so
the value must carry its unit. Long names wrap instead of truncating, so nothing is hidden on a
phone.
