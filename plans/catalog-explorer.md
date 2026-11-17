---
id: catalog-explorer
status: done
track: grain
depends: []
touches:
  - packages/grain/catalog/catalog.ts
  - packages/grain/catalog/catalog.test.ts
  - packages/grain/components/dashboards/
  - packages/grain/README.md
owner: ai
---

# Make the catalog work like a component explorer

The catalog already groups components by layer, filters by name and shows live panels with source
to copy. What it lacked is what makes Storybook worth opening: a place to change a component's
props and watch it respond, a clear note on how it behaves for a keyboard or a screen reader, and a
sidebar that tells you where you are. It also wore tracked capitals on every label, which
grain-lint now flags as a tell of machine-made design.

## What changes

- **Playground**: a doc may carry a controls fence listing the attributes and text a reader can
  change. The catalog renders the doc's first example as a live preview beside a form of those
  controls, with a width switch (phone, tablet, full) and the source regenerated from the live
  markup, so what you copy is what you see.
- **Accessibility block**: a section titled Accessibility renders as its own labelled block, not as
  one more group of panels.
- **Search**: matches the name and the doc's opening prose, announces how many components match,
  says so when none do, and opens with the slash key. Escape clears it.
- **Keyboard**: a skip link to the components, visible focus everywhere, arrow keys moving through
  the sidebar, and the sidebar marking the component in view with aria-current.
- **Look**: sentence-case labels in place of tracked capitals, a layer count beside each group.

## What does not change

The URL stays /catalog and every anchor stays #slug, so links into the catalog keep working. No
dependency is added; the controls are a dozen lines of parsing and a small inline script. A doc
without a controls fence renders as before.

## Steps

- [x] Read Storybook's and Ladle's controls docs and decide which parts fit a dependency-free page.
- [x] Parse the controls fence and the Accessibility section, and render the playground.
- [x] Rework search, keyboard access and the sidebar, and drop the tracked capitals.
- [x] Add controls and Accessibility sections to the dashboard docs as the first users.
- [x] Test the parser, the playground markup and the search markup.
- [x] Screenshot the catalog at phone and desktop widths and run axe on it.
- [ ] Backfill controls and Accessibility sections into the existing atoms and molecules. Left for
      a follow-up so this change stays reviewable.

## Sources

- Storybook, Controls (https://storybook.js.org/docs/essentials/controls). Taken: editing a
  component's inputs in a panel and seeing the result live, with a control type chosen per input.
  Not taken: inferring controls from component types, since GRAIN components are markup and CSS.
- Ladle, Controls (https://ladle.dev/docs/controls/). Taken: the small fixed set of control kinds
  (a radio or select of options, a boolean, a text field) declared next to the story, which is the
  shape the controls fence copies.
- Storybook itself (https://storybook.js.org), from working with it rather than from a page read
  for this plan: the sidebar tree by group, the slash shortcut to search, and accessibility notes
  living beside the preview rather than on a separate page.
