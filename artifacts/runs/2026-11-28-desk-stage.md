---
title: Desk stage organism, the page seen as a 3D monitor on a desk
date: 2026-11-28
status: partial
lane: high
branch: claude/pensive-cori-w04xrv
skills: [voice]
scope: [packages/grain/components/organisms/desk-stage, packages/grain/scripts/desk-stage.js, packages/grain/styles/variables.css]
scopeGrowth: packages/grain/README.md got one entry for the new script, the same place every other island is listed
touched: [desk-stage.css, desk-stage.md, desk-stage.js, desk-stage.test.ts, variables.css (two stage tokens), README.md]
dirty: ["all of the above | nothing committed, the repo rule is commit only when asked"]
plans: []
gates: ["bun run check | all five packages exit 0", "bun test in packages/grain | 452 pass, 0 fail", "bun run test | every package exits 0"]
diffstat: no commits, working tree only
unpushed: "0 | nothing committed"
doctor: session-start hook warned that standards skills are not synced here and the estate timer is not installed; neither carried into this work
verifiedBy: nobody yet
---

## What was built

The desk stage: a flat page that can zoom out into a 3D scene where it is the screen of a monitor on a
desk, and zoom back with nothing lost. One live page node and one camera move. The resting state is
display contents, so a page that never zooms out pays nothing. A shade lamp flips light and dark.

## What was driven, not just grepped

Against a harness page loading the real stylesheet and script in Chromium (1280 by 800, 2x density):

- zoom out, Escape back in: view returned to flat, a half-typed input kept its value, scroll position
  300 returned to 300, and a marker element sat at the same pixel before and after
- the lamp click flipped the scheme to dark, and a click on the screen returned to flat
- a 420px viewport set the html attribute to off, hid the toggle, and refused to stage
- the in view's first frame matched the flat page (screenshot)

## What was not done

- **Not wired into tjakoen.github.io.** This is the grain component only. The real portfolio has not
  been tried, so its fixed elements, its classic or overlay scrollbar, and its own scroll container are
  unchecked.
- **Not run on a phone or a real GPU.** The phone path is a media query and a script gate, tested by
  resizing a desktop browser. Large 3D layers behaved differently between runs, so a real GPU may differ.
- **Not in the AI vocabulary.** No surface kind or verb in contract.ts names the stage, so an AI cannot
  operate it. Decided as view chrome, like the theme controls. Say so if you want the verb.
- **The script tests are grep guards.** They catch a rule being deleted, not an image being wrong.
- Mid-zoom text softness and a thin sliver on the monitor's right side are known and not fixed.

## What needs human eyes

The whole look against the reference photo, in light and in dark, at the rest angle and while dragging.
Everything above was judged from screenshots by the run that built it.

## Lesson worth keeping

Two planes that touch edge to edge got depth-sorted wrongly: the floor painted over the plinth front.
A gap of 3px fixed it. It looked like a texture-size limit for an hour and was not.
