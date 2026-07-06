# activity-bar

The VS Code **activity bar**: a slim vertical icon column at the far edge of the app-shell rail.
Icon-only entries — an explorer toggle at the top, app links (with a `.activity-bar__spacer` to push
some to the bottom). Persona-neutral and CSS-only: the consumer supplies the links, hrefs, and
glyphs. A layout class composed of native `<a>`/`<button>` + `b-icon`, not a data-bound tag.

Entries are plain links (`.activity-bar__item`) — no panel-switching JS. Each MUST carry an
`aria-label` + `title` (icon-only, so the text label is the accessible name). Mark the current
section's item `aria-current="true"` (or `"page"`) for the accent left-edge.

## Parent context (state it here — lesson 3)

- Mounts as the **first child of `.app-shell__rail`**, sibling of a nested `.side-rail`. The rail
  opts into a flex row automatically: `.app-shell__rail:has(> .activity-bar)` (app-shell.css). A
  rail without an activity-bar is unaffected — the `:has()` rule simply never matches.
- **Collapse:** `[data-rail-collapsed="true"]` hides the `.side-rail` (the tree) and leaves only the
  icon strip — the VS Code "collapsed to icons" look. Falls out of the existing collapse attribute;
  no new JS.
- **Mobile:** it's part of the rail, so it rides the off-canvas drawer for free (the drawer is
  `position: fixed` on `.app-shell__rail`). Nothing special.

```html
<aside class="app-shell__rail" data-tab-source>
  <nav class="activity-bar" aria-label="Activity">
    <button class="activity-bar__item" data-shell="rail-toggle" aria-current="true"
            title="Explorer" aria-label="Explorer"><b-icon sym="/assets/sprite.svg#files"></b-icon></button>
    <span class="activity-bar__spacer"></span>
    <a class="activity-bar__item" href="/calendar" data-section="calendar" data-tab-label="Calendar"
       title="Calendar" aria-label="Calendar"><b-icon sym="/assets/sprite.svg#traces"></b-icon></a>
  </nav>
  <div class="side-rail" data-variant="explorer"> …brand + file-tree… </div>
</aside>
```

## Rejected alternative (why not a 4th grid column)

The activity bar could have been its own `grid-template-columns` track on `.app-shell`. Rejected: the
mobile drawer is `position: fixed` on `.app-shell__rail` — an in-rail strip rides that drawer for
free, whereas a separate column would need its own drawer plumbing. Keeping it in-rail also keeps
`data-tab-source` singular (tabs.js takes the first match) and lets the existing collapse attribute
do the icon-strip fold. The cost is one `:has()` opt-in rule in app-shell.css — cheap and contained.
