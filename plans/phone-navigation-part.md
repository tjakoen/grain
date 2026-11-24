---
id: phone-navigation-part
status: todo
track: grain
depends: []
touches:
  - packages/grain/components/organisms/phone-nav
  - packages/grain/components/organisms/app-shell/app-shell.css
  - packages/grain/components/molecules/nav-item
owner: ai
---

# Make phone navigation a reusable GRAIN part

GRAIN has no reusable phone-navigation primitive. The app-shell owns the wide layouts and
turns the rail into a left drawer below 640px, but the phone pattern the native-PWA
baseline describes — a fixed bottom tab bar whose fifth slot is a "More" button that raises a
menu sheet of every surface — has been hand-rolled twice: once in Avero Desk's `src/portal`
stopgap and once in the portfolio's `portfolio-frame`. This plan specifies the reusable part
that both could adopt, drawn from those two working implementations and from the baseline's
`ui-sheet` reference, without changing any component source in this run.

The part is one custom element, `<ui-phone-nav>` (matching the baseline's `ui-sheet` /
`UiSheet` naming), plus a documented recipe for the menu sheet that reuses the
app-shell's existing rail rather than inventing a second overlay. The plan records the
public markup and API, the composition with app-shell and the 600/640 breakpoint, the focus
and ARIA and safe-area and reduced-motion rules, how the icon grid and the host's own
contents share the sheet, and the tests that would prove it. It also names what Desk's
stopgap does that must stay out of the general part.

- [ ] Write the plan (this file), reviewed against Desk, the portfolio, and the baseline.

## The part: `<ui-phone-nav>`

The reusable unit is the bottom bar. It owns the bar itself and the "More" behaviour; the
menu sheet is the app-shell rail it opens, and the sheet's contents belong to the host. The
bar and the sheet are one navigation landmark at any width: the bar is the phone's `nav`, and
the rail it opens is the same landmark in sheet form, so a host never has two competing
navigation regions.

### Public markup

```html
<div class="app-shell" data-pwa-layout data-rail-open="false">
  <header class="app-shell__topbar">…</header>

  <aside class="app-shell__rail" id="menu" aria-label="Menu">
    <div class="drawer-head">
      <span class="drawer-head__title">Menu</span>
      <button type="button" class="drawer-head__close"
              data-phone-nav-close aria-label="Close the menu">✕</button>
    </div>
    <nav class="phone-menu" aria-label="All sections">
      <a class="phone-menu__item" href="#today" aria-current="page">…Today</a>
      <a class="phone-menu__item" href="#clients">…Clients</a>
      <!-- every surface the app offers -->
    </nav>
    <div class="rail-body">…host's own page contents…</div>
    <div class="rail-foot">…theme / scheme / sign-out…</div>
  </aside>

  <main class="app-shell__main">…</main>

  <ui-phone-nav label="Main" menu-target="menu" more-label="More">
    <a class="ui-phone-nav__item" href="#today" aria-current="page">Today</a>
    <a class="ui-phone-nav__item" href="#clients">Clients</a>
    <a class="ui-phone-nav__item" href="#services">Services</a>
    <a class="ui-phone-nav__item" href="#money">Money</a>
  </ui-phone-nav>
</div>
```

### API

- **Children.** The element's light-DOM children are the primary destinations, up to four,
  each an `<a class="ui-phone-nav__item">` with a visible text label and an optional leading
  glyph. The element renders them into a `<nav aria-label="…">` with the label from the
  `label` attribute, and leaves any `aria-current="page"` the host put on one of them exactly
  where it is. Four is a hard ceiling because the fifth slot is always the intrinsic "More"
  button; that is the baseline's "limit primary destinations to five with visible labels"
  rule, with the fifth reserved for the menu.
- **Attributes.** `label` names the landmark (default `"Main"`); `menu-target` is the `id` of
  the element the More button opens, normally the app-shell rail; `more-label` sets the fifth
  slot's text (default `"More"`); an optional `more-icon` supplies the glyph.
- **The More button.** The element appends `<button type="button" class="ui-phone-nav__more"
  aria-expanded="false" aria-controls="{menu-target}">` as the fifth slot. It is a button, not
  a link, so it carries `aria-expanded`/`aria-controls` and never `aria-current`.
- **State.** The single source of truth is the `data-rail-open` attribute on `menu-target` —
  the app-shell's existing contract, which the CSS already reads. The element toggles it, and
  observes it so that any close route (the sheet's Close, the scrim, Escape, choosing a
  destination) keeps `aria-expanded` on More correct.
- **Events.** Opening and closing dispatch a bubbling `phone-nav-open` / `phone-nav-close`
  (with the trigger in `detail`), mirroring `ui-sheet`'s `sheet-close`, so a host can load
  content or reset state without reimplementing the toggle.

### What it delegates

The element does not own the sheet's contents, the app switches, the theme cycle, or the
destination list — those are host data and host UI. It also does not own the scrim: the
app-shell already renders `.app-shell__scrim`, and the element binds it to close the sheet
the same way `drawer.js` binds the drawer's backdrop. The icon grid is a plain light-DOM
molecule, `.phone-menu`, in the style of `nav-item`: a styled grid of anchors, not a custom
tag, so it drops into a static page.

## Composition with app-shell and the 600/640 breakpoint

Two breakpoints describe two different things, and the part keys off the shell's, not the
baseline's.

- **640px — the shell's phone switch.** The app-shell lays out against the `shell-frame`
  container (`body:has(.app-shell)`, `container-type: inline-size`), and switches to its
  phone layout at `--bp-phone: 640px` — there the rail becomes a left drawer, the aside hides,
  and `data-rail-open` drives the drawer. Both host apps already query
  `@container shell-frame (max-width: 640px)` for their hand-rolled bars. The part adopts this
  same 640px container query, not a media query, so the viewport-toggle preview and a real
  narrow window drive the identical layout, and rotation and folding follow the container.
- **600px — the baseline's navigation-density floor.** The native-PWA reference
  `app-shell.css` describes the three-region composition with bottom tabs below 600px, a rail
  from 600 through 840, and a sidebar at 840 and above. That reference restyles the rail
  itself into the tab bar below 600px, which works for a flat app of five or fewer
  destinations and no overflow. It is not a second shell breakpoint; it is a guidance floor
  for when navigation changes form.
- **Reconciliation.** The part keeps the shell's 640px container query as its one switch, and
  treats the baseline's 600px as the *floor below which the bar must already exist*. Because
  640 > 600, a phone-width window is always below both, so the two never conflict on a real
  phone; the only discrepancy is the 600–640 band on a narrow desktop window, where the shell
  has already gone to its phone layout while the baseline would still show a rail. The part
  follows the shell and shows the tab bar through 640, which is also what Desk and the
  portfolio already do. Apps with five or fewer flat destinations and no "More" can keep the
  baseline's rail-as-tab-bar; apps with more surfaces, like Desk, need the part's "More"
  sheet. Both are valid; the part generalises the second, which is the one the baseline's
  reference does not cover.
- **Within the shell.** Below 640px the part re-aims the rail from a left drawer into a bottom
  sheet rising above the bar (`position: fixed; inset: auto 0 var(--phone-nav-h) 0;
  transform: translateY(…)`, hidden via `visibility` with a transition delay so it leaves
  paint and tab order once the slide finishes), and reserves the bar's height under `main`
  (`padding-bottom: var(--phone-nav-h)`). The `data-rail-open` attribute continues to be what
  opens and closes it. At 641px and above the whole part is `display: none` and the rail
  returns to its normal wide role, untouched.

## Focus, Escape, ARIA, safe area, reduced motion

- **Focus in.** Opening from More moves focus to the sheet's first focusable — the
  `drawer-head__close` button, which both hosts already focus — rather than leaving it on the
  now-obscured bar.
- **Focus containment.** The sheet is non-modal (the tab bar stays usable, unlike the
  `drawer` organism), so the page is not made `inert`; but Tab from the sheet's last control
  should not drop behind the scrim into hidden content. The part keeps focus within the
  sheet, or, where the app-shell has already hidden the covered regions with `visibility`,
  relies on that hiding to keep them out of tab order. The modal `drawer` organism's
  focus-trap pattern is the reference for the endpoints.
- **Focus return.** Close returns focus to the More button, by every route: the sheet's Close,
  the scrim, Escape, and choosing a destination (where focus then follows the navigation).
  This is the same obligation `drawer.js` and `ui-sheet` already honour.
- **Escape.** Escape closes the sheet and returns focus. The listener is scoped to the
  element and fires only while its own `menu-target` is open — not the document-wide listener
  Desk hand-rolled.
- **ARIA.** The active destination carries `aria-current="page"` in both the bar and the icon
  grid, so the two always name the same page. More carries `aria-expanded` (mirrored from
  `data-rail-open`) and `aria-controls` naming the rail's `id`. The rail keeps its
  `aria-label`, the grid keeps its own `aria-label` for "all sections", and the bar's
  `aria-label` names the landmark.
- **Safe area.** The bar and the sheet honour `env(safe-area-inset-bottom)` — the bar's
  height is `calc(3.75rem + env(safe-area-inset-bottom, 0px))` and its `padding-bottom` pads
  the home indicator; the sheet's bottom inset stops above the bar, and its foot pads the
  same inset. `viewport-fit=cover` stays on, and the baseline's `100dvh`/Visual-Viewport
  handling applies.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` the slide transition and the
  press-scale feedback go to zero, matching the baseline's token overrides (`--pwa-duration-*`
  to `0ms`, `--pwa-press-scale` to `1`). The sheet still opens and closes instantly; no
  animation is required to understand it.
- **Minimums.** Every bar slot and the sheet's Close are at least `44×44px`
  (`--pwa-target-min`), and every focusable shows a visible `:focus-visible` outline, in both
  themes.

## Icon grid and host contents

The sheet has one fixed region and two host-owned regions, and the fixed one is small:

- The **drawer head** (title + Close) and the **`.phone-menu` grid** are the reusable shell of
  the sheet. The grid is a four-column `repeat(4, minmax(0, 1fr))` of icon-over-label anchors,
  one per surface, marked `aria-current` for the active one — the pattern both hosts already
  ship, differing only in their section lists.
- The **`.rail-body` and `.rail-foot`** slots are host content: the current page's contents
  and the app switches, theme cycle, and sign-out. The part styles their container (the body
  scrolls independently and `overscroll-behavior: contain`), but never their contents.
- The grid and the host contents coexist vertically — grid first, then the host body, then the
  host foot — and the grid stays `flex: none` so the host body owns the scroll. This is the
  one place the general part draws a line Desk's stopgap does not: Desk duplicates the
  current page into the sheet's body, and that is the anti-pattern to exclude (below).

## Tests

The part is provable with the same bars the baseline's workflow sets, plus the focus contract
the `drawer` organism already tests.

- **Rendered at 320 / 390 / 700.** At 320 and 390 (both below 640) the bar is fixed at the
  bottom with five slots, every label visible and unclipped — the 320 case drops the label
  type a step so five labels clear each other, as Desk does below 360 — the four-column grid
  fits with no horizontal scroll, and the sheet opens above the bar. At 700 (above 640) the
  bar and sheet styles are absent and the rail is the normal wide rail.
- **Breakpoint boundary.** At 639, 640, and 641 the bar appears and disappears at exactly 640
  against the `shell-frame` container, and the baseline's 600/840 rail/sidebar switches still
  hold for the three-region composition on a wide window.
- **Keyboard.** Tab order runs topbar → main → bar (More is the fifth stop); opening moves
  focus to the sheet's Close; Tab stays within the sheet; Escape and scrim close and return
  focus; every tab and Close shows a visible `:focus-visible` outline.
- **Focus return.** Open from More, then close by Close, Escape, scrim, and destination
  selection — focus returns to More in every case.
- **ARIA.** `aria-current="page"` names the same page in the bar and the grid;
  `aria-expanded`/`aria-controls` on More track `data-rail-open` through every close route.
- **Safe area and reduced motion.** With `viewport-fit=cover` and a notched-device viewport,
  the bar and sheet respect `env(safe-area-inset-bottom)`; with
  `prefers-reduced-motion: reduce` the transition and press scale are instant, and 200% text
  enlargement keeps labels readable.
- **Unit surface.** The focus and Escape behaviour is testable in the same style as
  `drawer.test.ts` (open, trap, close, return); the rendered checks run through the browser
  workflow the SKILL describes, exercising 320/599/600/839/840 and a short landscape window.

## What Desk's stopgap should not generalise

The stopgap proves the pattern works, and several of its specifics belong to Desk alone:

- **The five destinations and their icons.** `PHONE_TABS` (`today`, `clients`, `services`,
  `money`) and the `ICON_PATHS` map are Desk's information architecture, not part of a nav
  part. The part takes destinations as host-provided children; the agreed IA (Today, Clients,
  Services, Money, More) stays Desk's and is untouched by this plan.
- **The section grid as "every surface".** `SECTIONS` (seven entries, three of which never
  appear in the bar) is host data. The part styles a four-column grid of whatever the host
  lists; it does not know Desk's surface names.
- **Duplicating the page into the sheet.** Desk's `.rail-body` is the current page's own
  contents, so on a phone the menu sheet holds a second copy of the page. That is the
  stopgap's real smell: two copies of every control, a taller sheet, and an extra place for
  state to drift. The general part's sheet holds navigation (the grid) and the host's foot,
  not a re-render of the page.
- **The companion-pane swap.** `data-phone-pane` replacing `main` with the aside (one pane at
  a time, with an "‹ Page" back button) is Desk's one-pane-at-a-time behaviour, orthogonal to
  navigation and not part of the part.
- **Global side effects.** The `document.addEventListener("keydown", …)` Escape handler and
  the loop that sets `aria-expanded` on every `[aria-controls="desk-rail"]` are workarounds
  for the app-shell not owning that wiring; the part scopes Escape to itself and owns
  `aria-expanded` on its own More button instead.

## Plan of work

- [ ] Add `packages/grain/components/organisms/phone-nav/` (`ui-phone-nav` element, its CSS,
  and its `.md`).
- [ ] Add the `.phone-menu` icon-grid molecule and the rail-as-menu-sheet recipe to
  `app-shell.css`, keyed off `shell-frame` at 640px, reusing `data-rail-open` and the scrim.
- [ ] Write `phone-nav.test.ts` for focus in, containment, return, and Escape, and run the
  rendered checks at 320/390/700 plus the 600/840 boundary.
- [ ] Migrate Desk and the portfolio off their hand-rolled bars, or leave them as is and let
  the next host that needs phone navigation adopt the part.
