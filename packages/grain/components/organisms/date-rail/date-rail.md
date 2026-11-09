# Date rail

Dates for a note that tells a dated story. When the page has room, each section's date hangs in the left margin beside it, with a hairline between the dates and the prose, and the date of the section you are reading stays pinned near the top while you scroll through it. The note keeps its normal reading measure: the rail borrows the margin, never a column of the text.

Without room in the margin, on a phone or in a narrow pane, each date folds into a small uppercase label above its heading with a hairline under it. The label is sticky at the top of the column while its section is on screen, and the next section's label pushes it off. An empty label is hidden.

Both states are plain CSS. Each date is `position: sticky` inside its own section, so the section's end is what releases it. There is no scroll listener and no animation, which is also why there is nothing to switch off under reduced motion. It reads only palette tokens and draws no shadow, so it follows light and dark with the theme.

**Parent context:** the margin state is decided by the width of the page's main column, not the viewport, so a page opts in by naming that column as a size container called `page`, for example `.app-shell__main { container: page / inline-size; }`. The dates hang in the margin once that column is at least 54rem wide. A page with no `page` container always gets the folded labels, which fit anywhere. Sticky also needs a scrolling ancestor with no `overflow: hidden` between it and the rail. Tune the rail with `--date-rail-width` (5rem), `--date-rail-gap` (`--space-5`) and `--date-rail-top` on `.date-rail`. CSS-only (no `.html`).

## Authoring it from MILL

Opt a note in with `layout: timeline` in its frontmatter, then open each H2 with its date and a spaced middle dot, as in `## Aug 18 · Then it had to keep score`. The marker is plain Markdown, so the file still reads sensibly anywhere else, where the date simply shows as part of the heading.

```html flat
---
title: The reviewer that learned to be wrong
layout: timeline
---

An opening paragraph stays above the rail.
```

MILL's default layout then wraps every H2 and the prose under it in a rail section, adds `data-layout="timeline"` to the note, and slugs each heading from its text without the date, so an anchor does not move when a date is corrected. An H2 without a marker still gets a section, with an empty rail slot. A consumer with its own layout can call `dateRailBody(body)` from `@tjakoen/mill` to get the same markup.

## Example

The box below names itself the page container, so it shows the margin state when the catalog is wide and folds when it is not.

```html
<div style="container:page / inline-size;height:22rem;overflow:auto;border:1px solid var(--color-line);padding:var(--space-4) var(--space-4) var(--space-4) 7rem">
  <article class="note" data-layout="timeline">
    <p>An opening paragraph stays above the rail and reads at full width.</p>
    <div class="date-rail">
      <section class="date-rail__section">
        <p class="date-rail__date"><time>Aug 18</time></p>
        <div class="date-rail__body">
          <h2 id="then-it-had-to-keep-score">Then it had to keep score</h2>
          <p>The first version only commented. It had no way to know whether a comment had landed, so it could not tell a good finding from noise.</p>
          <p>Keeping score meant writing down every finding and what the author did with it.</p>
          <p>Scroll on and the date beside this section stays pinned until the section ends.</p>
        </div>
      </section>
      <section class="date-rail__section">
        <p class="date-rail__date"><time>Sep 17</time></p>
        <div class="date-rail__body">
          <h2 id="the-talk-was-the-old-version">The talk was the old version</h2>
          <p>By the time it was presented, the thing on the slides had already been replaced.</p>
          <p>The next date takes over as this section reaches the top.</p>
        </div>
      </section>
      <section class="date-rail__section">
        <p class="date-rail__date"><time>Nov 2</time></p>
        <div class="date-rail__body">
          <h2 id="where-it-stands">Where it stands</h2>
          <p>A short closing section, so the last handover is visible too.</p>
        </div>
      </section>
    </div>
  </article>
</div>
```
