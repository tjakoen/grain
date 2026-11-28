# Desk stage

The page you are reading, seen as the screen of a 3D monitor on a desk. A reader clicks a
control, the camera pulls back, and the page turns out to have been the monitor all along. Click
the screen and the camera goes back in, with the page exactly where it was.

It exists to show that the design system holds up in a third dimension, and it is an Easter egg:
nothing depends on it, and a page that never zooms out pays nothing for it.

The behavior is scripts/desk-stage.js. Load it and the markup below is live.

## Markup

```html
<div class="desk-stage" data-desk-stage data-view="flat">
  <div class="desk-stage__page">
    ...the whole page...
  </div>
</div>

<button data-desk-stage-toggle>Desk view</button>
```

The page goes inside the stage, and everything the reader sees goes inside the page, because the
page is what becomes the screen. The toggle can live anywhere outside the stage; the script
delegates the click, so a control added later works with no wiring.

## The one idea: a single live page

The page is never cloned, screenshotted or put in an iframe. It is one node, and the camera moves
around it. So scroll position, half-typed form input, a running animation and a game in progress
all survive the trip, because nothing was ever torn down.

There are three views, held in data-view on the stage.

- **flat**: the resting state. The stage, its world and its page are display contents or
  flow-root, so the page lays out as if the stage were not there. The rig is not rendered.
- **in**: the camera sits on the screen. The screen plane is mapped exactly onto the viewport, so
  this view is pixel-identical to flat. That identity is what makes the swap between them
  invisible.
- **out**: the same camera pulled back and turned to a resting angle, with the desk in view.

Zooming out goes flat, in, out. Zooming in goes out, in, flat. The page is inert while staged,
and its scroll position is carried across both swaps.

## In the scene

A monitor, keyboard and mouse on a wide plinth, in front of a wall with window light falling across
it. The light is real soft shadow, painted on the surfaces, so it stays correct as the camera
moves, and it drifts slowly. The shade lamp is the one control in the scene: clicking it flips
light and dark, through window.grain.theme when that is loaded, so the choice persists like any
other. In dark the lamp glows and lights the wall and the desk. There is no other UI in the scene.
Click the screen, or press Escape, to go back.

Dragging orbits the camera a few degrees around the resting angle and springs back on release. It
never goes past the front, on purpose.

## Tokens

Every color is a semantic token. Two are new and live in variables.css: stage-cast, a shadow that
darkens in both schemes, and stage-lit, the tint inside a window pane. A flavor or a scheme
re-skins the whole desk with no edit here. The camera and layout are custom properties on the
stage (the ds- ones at the top of the CSS), so a consumer can move the camera or resize the screen
from its own stylesheet.

## Where it is off

Phones. Below the phone breakpoint the script sets data-desk-stage="off" on the html element, which
hides every toggle, and refuses to stage. Resizing across the breakpoint while staged returns the
page to flat. Reduced motion keeps the feature and removes the animation.

## Limits

- **One stage per page**, and it should wrap the whole page. The script takes the first one.
- **Classic scrollbars.** The staged page fills the full viewport width, so a classic (non-overlay)
  scrollbar makes the layout one scrollbar wider at the swap. Overlay scrollbars, the default on
  macOS, do not.
- **Fixed-position elements** inside the page follow the page while staged, which is what you want.
  Check any that are positioned against the viewport rather than the page.
- **Faint text mid-zoom.** For the length of the move the page is a scaled 3D layer, so text can
  soften. It is crisp at rest, because the resting view is a plain flat layer.

## What it took to make it render (so the next change does not repeat it)

- A very wide box built from six bordered faces left stretches of the face unpainted at some
  camera angles, and a transparent outline made it worse. The plinth is two bare planes, like the
  wall and floor, and the planes that need an edge draw it with a border.
- **Two planes that touch edge to edge get depth-sorted wrongly.** The plinth front and the floor
  met along one line and the floor painted over the front. The floor sits 3px below the plinth so
  they never meet. Any new surface should keep a gap from its neighbours for the same reason.
- Boxes carry no bottom face. Nothing sees it, and it sits coplanar with whatever it stands on.
- Small boxes (keyboard, mouse, monitor) take a transparent 1px outline, which is what smooths the
  jagged edge a 3D-transformed layer otherwise gets.

## Not in the vocabulary yet

The toggle and the lamp are view chrome, like the theme controls: static-safe, and not the AI
door. Nothing in ai/contract.ts names them, so an AI cannot operate the stage. Giving it a surface
kind and a set verb for the view is the natural next step if that is wanted.

Seam: window.grain.deskStage, with out(), in(), toggle(), view() and supported(). The stage emits
grain:desk-stage (bubbling) with the new view in its detail.
