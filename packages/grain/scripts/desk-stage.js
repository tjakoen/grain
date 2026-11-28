// grain/scripts/desk-stage.js — the desk stage's behavior: build the rig, move the camera.
//
// The page is seen as the screen of a 3D monitor on a desk. Zooming out is one camera move, so the
// page is ONE live node the whole time: never cloned, never remounted, so scroll position, form
// input and anything animating keep going. The resting state is data-view="flat", which the CSS
// renders as display: contents, so a page that never zooms out pays nothing for the stage.
//
// Views: flat (resting, plain page) -> in (camera on the screen, page fills the window) -> out
// (camera pulled back, the desk). Leaving goes out -> in -> flat. The in view is pixel-identical to
// flat, which is what makes the swap invisible.
//
// OPT-IN markup:
//   <div class="desk-stage" data-desk-stage data-view="flat">
//     <div class="desk-stage__page"> ...the page... </div>
//   </div>
//   <button data-desk-stage-toggle>Desk view</button>
// Pure view chrome: it knows nothing about the AI door. The lamp flips the color scheme through
// window.grain.theme when that is loaded, so the choice persists like any other theme choice.
(() => {
  "use strict";
  if (window.grain && window.grain.deskStage) return;   // idempotent

  const VIEW = { flat: "flat", in: "in", out: "out" };
  const MS = { zoom: 1750, flush: 60 };
  // orbit limits, in degrees, around the resting angle. Small on purpose: the view stays frontal.
  const ORBIT = { yaw: 10, pitchUp: -4, pitchDown: 6, yawPerScreen: 60, pitchPerScreen: 30 };
  const CLICK_SLOP = 6;   // px of movement that still counts as a click rather than a drag

  const html = document.documentElement;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phoneBp = () => parseFloat(getComputedStyle(html).getPropertyValue("--bp-phone")) || 640;
  const supported = () => matchMedia(`(min-width: ${phoneBp() + 1}px)`).matches;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  let root = null, world = null, page = null, busy = false;

  // ---- building the rig ----------------------------------------------------------------------
  const el = (tag, cls, attrs = {}) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const box = (part, size, seg) => {
    const b = el("div", "desk-stage__box", { "data-part": part, ...(size ? { "data-size": size } : {}) });
    if (seg) { b.setAttribute("data-edge", seg.edge); b.style.setProperty("--x", seg.x + "px"); }
    // no bottom face: nothing ever sees it, and it would sit coplanar with whatever the box stands on
    for (const f of ["f", "b", "l", "r", "t"]) b.appendChild(el("i", f));
    return b;
  };
  const contact = (w, d, x, z, kind) => {
    const c = el("div", "desk-stage__contact", kind ? { "data-kind": kind } : {});
    c.style.cssText = `--w:${w}px;--d:${d}px;--x:${x}px;--z:${z}px`;
    return c;
  };

  // A faceted cylinder (a truncated cone when rt differs from rb): N panels around the axis, each
  // a trapezoid tilted to the cone's slope. Each carries its own shade so the lamp reads as round.
  function cylinder(part, o) {
    const g = el("div", "desk-stage__cyl", { "data-part": part });
    g.style.transform = `translate3d(${o.x}px, calc(var(--ds-plinth-top) + ${o.y}px), ${o.z}px)`;
    const { rt, rb, h, N } = o;
    const wb = 2 * rb * Math.tan(Math.PI / N) * 1.03;
    const slant = Math.hypot(h, rb - rt);
    const tilt = (Math.atan2(rb - rt, h) * 180) / Math.PI;
    const inset = ((1 - rt / rb) / 2) * 100;
    for (let i = 0; i < N; i++) {
      const a = (i * 360) / N;
      const p = el("div", "desk-stage__facet");
      p.style.cssText = `width:${wb}px;height:${slant}px;left:${-wb / 2}px;top:${-slant}px;` +
        `transform:rotateY(${a}deg) translateZ(${rb}px) rotateX(${tilt}deg)`;
      const b = document.createElement("b");
      const m = 7 + (13 * (1 + Math.cos(((a - 50) * Math.PI) / 180))) / 2;   // light from the upper right
      b.style.cssText = `clip-path:polygon(${inset}% 0,${100 - inset}% 0,100% 100%,0 100%);` +
        `background:color-mix(in srgb, var(--color-fg) ${m}%, var(--color-surface))`;
      p.appendChild(b);
      g.appendChild(p);
    }
    const cap = (r, y, open) => {
      const c = el("div", "desk-stage__cap", open ? { "data-open": "" } : {});
      c.style.cssText = `width:${2 * r}px;height:${2 * r}px;left:${-r}px;top:${-r}px;transform:translateY(${y}px) rotateX(90deg)`;
      g.appendChild(c);
    };
    if (o.rims) { cap(rb, 0, true); cap(rt, -h, true); }
    if (o.cap) cap(rt, -h, false);
    return g;
  }

  // the plinth as short segments (see the .css for why): PLINTH.count of PLINTH.width, centred on 0
  const PLINTH = { count: 7, width: 480 };
  const plinthSegments = () => Array.from({ length: PLINTH.count }, (_, i) =>
    box("plinth", "wide", {
      x: (i - (PLINTH.count - 1) / 2) * PLINTH.width,
      edge: i === 0 ? "start" : i === PLINTH.count - 1 ? "end" : "mid",
    }));

  function buildRig() {
    const rig = el("div", "desk-stage__rig", { "aria-hidden": "true" });
    const wall = el("div", "desk-stage__wall");
    wall.appendChild(el("div", "desk-stage__cast"));
    rig.append(wall, el("div", "desk-stage__floor"),
      el("div", "desk-stage__floorshadow"), el("div", "desk-stage__plinth-front"), el("div", "desk-stage__plinth-top"), box("foot"), box("neck"), box("body"), box("keyboard"), box("mouse"));
    const lamp = el("div", "desk-stage__lamp", { "data-part": "lamp" });
    lamp.append(
      cylinder("base",  { rt: 44, rb: 46, h: 8,   N: 22, x: 470, y: 0,    z: -58, cap: true }),
      cylinder("stem",  { rt: 4,  rb: 4,  h: 140, N: 8,  x: 470, y: -8,   z: -58 }),
      cylinder("shade", { rt: 46, rb: 74, h: 88,  N: 44, x: 470, y: -132, z: -58, rims: true }));
    rig.append(lamp, contact(300, 140, -14, -58), contact(600, 210, -40, 55), contact(120, 150, 330, 55),
      contact(190, 190, 470, -58), contact(760, 520, 400, -20, "pool"), el("div", "desk-stage__glow"));
    rig.appendChild(el("div", "desk-stage__glare"));
    return rig;
  }

  // ---- the three views -----------------------------------------------------------------------
  const setView = (v) => root.setAttribute("data-view", v);
  const view = () => (root ? root.getAttribute("data-view") : VIEW.flat);

  async function zoomOut() {
    if (!root || busy || view() !== VIEW.flat || !supported()) return false;
    busy = true;
    const y = window.scrollY;
    root.setAttribute("data-snap", "");           // land on the in view without animating
    html.setAttribute("data-desk-stage-lock", "");
    setView(VIEW.in);
    page.inert = true;
    page.scrollTop = y;                           // the window's scroll becomes the page's own
    await nextFrame();
    root.removeAttribute("data-snap");
    await nextFrame();
    setView(VIEW.out);
    setTimeout(() => { busy = false; }, reduced() ? MS.flush : MS.zoom);
    root.dispatchEvent(new CustomEvent("grain:desk-stage", { bubbles: true, detail: { view: VIEW.out } }));
    return true;
  }

  function zoomIn() {
    if (!root || busy || view() !== VIEW.out) return false;
    busy = true;
    root.style.setProperty("--ds-rx", "0deg");
    root.style.setProperty("--ds-ry", "0deg");
    setView(VIEW.in);
    setTimeout(() => {
      if (view() !== VIEW.in) return;
      const y = page.scrollTop;
      root.setAttribute("data-snap", "");         // the flat swap must not animate either
      setView(VIEW.flat);
      html.removeAttribute("data-desk-stage-lock");
      page.inert = false;
      window.scrollTo(0, y);
      root.removeAttribute("data-snap");
      busy = false;
      root.dispatchEvent(new CustomEvent("grain:desk-stage", { bubbles: true, detail: { view: VIEW.flat } }));
    }, reduced() ? MS.flush : MS.zoom);
    return true;
  }

  const toggle = () => (view() === VIEW.flat ? zoomOut() : zoomIn());

  // ---- the lamp: the one control inside the scene ---------------------------------------------
  function flipLamp() {
    const t = window.grain && window.grain.theme;
    if (t && t.toggleScheme) { t.toggleScheme(); return; }
    const dark = html.getAttribute("data-color-scheme") === "dark" ||
      (!html.hasAttribute("data-color-scheme") && matchMedia("(prefers-color-scheme: dark)").matches);
    html.setAttribute("data-color-scheme", dark ? "light" : "dark");
  }

  // ---- a limited orbit around the resting angle, springing back on release ---------------------
  let drag = null;
  function onDown(e) {
    if (view() !== VIEW.out || busy) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    root.setAttribute("data-dragging", "");
    root.removeAttribute("data-settling");
    root.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
    const dx = (e.clientX - drag.x) / innerWidth, dy = (e.clientY - drag.y) / innerHeight;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    root.style.setProperty("--ds-ry", clamp(dx * ORBIT.yawPerScreen, -ORBIT.yaw, ORBIT.yaw) + "deg");
    root.style.setProperty("--ds-rx", clamp(-dy * ORBIT.pitchPerScreen, ORBIT.pitchUp, ORBIT.pitchDown) + "deg");
  }
  function onUp(e) {
    if (!drag) return;
    const wasClick = drag.moved < CLICK_SLOP && e.type === "pointerup";
    drag = null;
    root.removeAttribute("data-dragging");
    root.setAttribute("data-settling", "");
    root.style.setProperty("--ds-ry", "0deg");
    root.style.setProperty("--ds-rx", "0deg");
    if (!wasClick) return;
    // a click: the lamp flips the scheme, the screen zooms back in. The 3D hit test misses the
    // glare layer in some engines, so the screen is matched by its projected rectangle instead.
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (hit && hit.closest('[data-part="lamp"]')) { flipLamp(); return; }
    const r = root.querySelector('[data-part="body"] .f').getBoundingClientRect();
    if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) zoomIn();
  }

  // ---- phones and resizes: refuse, and leave cleanly if already staged -------------------------
  function syncSupport() {
    html.setAttribute("data-desk-stage-support", supported() ? "on" : "off");
    if (!supported() && root && view() !== VIEW.flat) {
      root.setAttribute("data-snap", "");
      setView(VIEW.flat);
      html.removeAttribute("data-desk-stage-lock");
      page.inert = false;
      root.removeAttribute("data-snap");
      busy = false;
    }
  }

  function init() {
    root = document.querySelector(".desk-stage[data-desk-stage]");
    if (!root || root.__deskStage) return;
    root.__deskStage = true;
    page = root.querySelector(".desk-stage__page");
    if (!page) return;
    if (!root.hasAttribute("data-view")) root.setAttribute("data-view", VIEW.flat);
    world = el("div", "desk-stage__world");
    root.insertBefore(world, page);
    world.append(buildRig(), page);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    syncSupport();
    matchMedia(`(min-width: ${phoneBp() + 1}px)`).addEventListener("change", syncSupport);
  }

  document.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("[data-desk-stage-toggle]")) { e.preventDefault(); toggle(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") zoomIn(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.grain = window.grain || {};
  window.grain.deskStage = { out: zoomOut, in: zoomIn, toggle, view, supported };
})();
