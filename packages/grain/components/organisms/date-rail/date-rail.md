# Date rail

A left-hand rail of dates for a note that tells a dated story. On desktop a hairline runs down the left of the article and each section's date sits beside it. The date of the section you are reading stays pinned near the top of the screen while you scroll through that section, then the section's end carries it away and the next date takes its place. On phone width (768px and under) the rail folds away and each date becomes a small label above its heading, with no horizontal scroll.

The handover is plain CSS. Each date is `position: sticky` inside its own section, so the section's bottom edge is what releases it. There is no scroll listener and no animation, which is also why there is nothing to switch off under reduced motion. It reads only palette tokens and draws no shadow, so it follows light and dark with the theme.

**Parent context:** sticky needs a scrolling ancestor with no `overflow: hidden` between it and the rail. A normal page scroll is that ancestor. Inside a bounded box (like the demo below) the box itself must scroll. Tune where the date pins with `--date-rail-top` and the rail's width with `--date-rail-width` on `.date-rail`. CSS-only (no `.html`).

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

```html
<div style="height:22rem;overflow:auto;border:1px solid var(--color-line);padding:var(--space-4)">
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
