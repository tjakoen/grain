---
id: dashboard-layer
status: done
track: grain
depends: []
touches:
  - packages/grain/components/dashboards/
  - packages/grain/catalog/catalog.ts
  - packages/grain/README.md
  - packages/grain/CLAUDE.md
owner: ai
---

# Give GRAIN a layer for dashboards

Most of what gets built on GRAIN ends up as a dashboard: a run summary, a cockpit home, a course
report. GRAIN already had three of the pieces (stat tile, trend chart, data table), but nothing that
put them on a page together, so every dashboard reinvented its own grid, its own delta badge and its
own empty state, and the default an agent reaches for is the same row of KPI cards with a sentence
under each one. This plan adds a dashboards layer that owns the page, the panel and the few
encodings a dashboard needs that a general component library does not.

## What the layer holds

- **dashboard**: the page. A head (title, period, what the numbers compare against), a KPI strip
  that adds columns as the screen grows instead of floating a narrow column on a wide monitor, and a
  panel grid where a panel spans one, two or all columns. One column on a phone.
- **dash-panel**: the surface a chart, table or list sits on. A heading, an optional action, and
  the four states every data panel has: ready, loading (the shared data-commit="pending" idiom),
  empty with a next step, and stale with when it was last true.
- **delta**: the change beside a number. A direction glyph, the change, and a one-word baseline
  ("vs last week"). When the base is too small to make a percentage honest, it says "was 1" in a
  quiet tone instead of a red minus 100 percent.
- **bullet-graph**: a bar, a target line and grey qualitative ranges, in place of a radial gauge.
- **rank-list**: a ranked breakdown where each row carries a slim share bar along its edge rather
  than a tinted block behind the whole row.

The stat tile, trend chart and data table stay where they are, in molecules, and the dashboard
docs compose them. Moving them would break their catalog anchors.

## Rules the layer keeps

- Tokens only, monochrome by default: tone is ink level and border weight, the same doctrine as
  the stat tile. Hue is reserved for a caller who has a real reason, and the layer gives none.
- No chart library. The trend chart already proves the pattern: the caller computes coordinates,
  the component draws with tokens, and a table is the text alternative. Bars and the bullet graph
  take their values through CSS custom properties. A chart library would be a dependency and a
  decision for the owner, so it is not taken here.
- Every panel and tile is addressable through the contract. Each carries a data-surface slug, so a
  tour, a lamp or the reasoner can point at one panel, and a panel the AI is writing wears
  data-grade="grain" on its value and data-commit="pending" while in transit. These are push
  display surfaces, so no new verb and no new surface kind.
- No eyebrow labels and no tracked capitals, per grain-lint's direction.
- Each doc carries an Accessibility section, which the catalog renders as its own block.

## Steps

- [x] Read the source post and the skill it links, and take what fits GRAIN's doctrine.
- [x] Add components/dashboards with the five components, each with a doc, CSS and examples.
- [x] Teach the catalog the dashboards layer, ordered after organisms.
- [x] Add a test that holds the layer to tokens, data-surface addresses and an Accessibility section.
- [x] Screenshot the layer at phone and desktop widths.
- [ ] Owner: decide whether a heatmap with classed tiers is worth a sixth component, and whether a
      chart library is ever wanted for interactive charts. Neither is built.

## Sources

- Ram Maheshwari, LinkedIn post on a dashboard skill for coding agents
  (https://www.linkedin.com/posts/rammcodes_this-is-straight-up-magic-for-building-beautiful-share-7527972016134598656-01sA/).
  The prompt for this plan; one comment asked whether such a skill tells the agent which numbers
  matter or only how to lay them out, which is why the dashboard head states its comparison.
- dashboard-design-skill by Otabek Abdiraimov (https://github.com/abdiraimov-otabek/dashboard-design-skill).
  Taken: the slim share bar instead of a tinted row, a delta with a one-word baseline, the quiet
  "was 1" instead of a red minus 100 percent, a bullet graph instead of a gauge, a wide mode that
  adds columns, every panel state, and checking on screenshots at a phone and a desktop width.
  Not taken: its Tailwind tokens and its colour scales, because GRAIN has its own tokens and a
  monochrome doctrine.
