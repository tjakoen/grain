// grain/scripts/ai-spotlight.js — GRAIN's reusable "AI is acting" spotlight: THE TRAVELING LAMP.
// One fixed-position frame (.ai-lamp) whose rect GLIDES between surfaces — the dim is the lamp's
// own cutout shadow, so hole and veil move together (styled by grain/ai/ai.css; the glide speed
// is the --ai-focus-move / --ai-focus-ease tokens). The lit element is never restyled: a rect is
// a rect, so every surface kind gets the same treatment by construction. Both the real dispatcher
// and client-side demos drive this ONE factory (AI-INTERFACE §5c) — never re-implement it.
// Native ES module, no build. Reduced-motion is handled by ai.css (the glide transition is off).
//
// PASSTHROUGH MODE (added for CRUMB, the guided-tour layer). Normally the backdrop is a solid
// click-catcher: any click while the lamp is on → `onInterrupt` (the "ask the AI to stop"
// gesture). A guided TOUR needs the opposite for the LIT target — the human must be able to
// click the highlighted surface to inspect/verify it. Passthrough cuts a hole in the backdrop's
// click-catch area AT THE LAMP'S GEOMETRY (never per-surface — grain lesson 8), so the pointer
// falls straight through to the target while everything else still blocks (guarding the tour
// from stray page clicks). The visual is untouched: the dim is the LAMP's own cutout shadow
// (a separate, pointer-events:none element), so cutting the transparent backdrop changes only
// what's clickable, never what's lit.

// The backdrop is a full-viewport fixed element; to make ONE rectangular region click-through
// we clip it to "everything except that rect" via a polygon with a slit bridging out to the
// hole and back (the standard overlay-hole technique). Pure geometry → unit-testable without a
// browser (grain tests DOM behavior with structural fakes; lesson 9: test the motion, not
// presence). `hole` is the lamp's client rect {left,top,width,height}; returns a clip-path
// string, or "" for no hole (full-cover backdrop).
export function backdropClip(hole) {
  if (!hole) return "";
  const { left: x, top: y, width: w, height: h } = hole;
  return `polygon(0px 0px, 100% 0px, 100% 100%, 0px 100%, 0px 0px, ` +
    `${x}px ${y}px, ${x}px ${y + h}px, ${x + w}px ${y + h}px, ${x + w}px ${y}px, ${x}px ${y}px)`;
}

export function createSpotlight({ onInterrupt, passthrough = false } = {}) {
  let backdrop = null, lamp = null, labelEl = null, lit = null;
  const PAD = 6;   // breathing room between the surface and the lamp's frame

  function ensure() {
    if (backdrop) return;
    backdrop = document.createElement("div");            // invisible click-catcher: the interrupt gesture
    backdrop.className = "ai-backdrop";
    if (onInterrupt) backdrop.addEventListener("click", onInterrupt);
    // The backdrop catches CLICKS (the interrupt gesture) but must NOT lock scrolling — the user
    // still wants to read/adjust the page while the AI works. Forward wheel + touch drags to the
    // page's own scroll region (the app-shell's main pane, else the document). A tap still fires
    // `click` → interrupt; a wheel or drag just scrolls (owner 2026-07-17).
    const scrollRegion = () => document.querySelector(".app-shell__main") || document.scrollingElement || document.documentElement;
    backdrop.addEventListener("wheel", (e) => { scrollRegion().scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });
    let touchY = null;
    backdrop.addEventListener("touchstart", (e) => { touchY = e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
    backdrop.addEventListener("touchmove", (e) => {
      if (touchY == null || !e.touches[0]) return;
      const y = e.touches[0].clientY;
      scrollRegion().scrollTop += touchY - y; touchY = y; e.preventDefault();
    }, { passive: false });
    document.body.appendChild(backdrop);
    lamp = document.createElement("div");                // the one traveling frame (+ its shadow = the dim)
    lamp.className = "ai-lamp";
    document.body.appendChild(lamp);
    labelEl = document.createElement("div");
    labelEl.className = "ai-acting-label";
    document.body.appendChild(labelEl);
    // the lamp FOLLOWS its surface through scroll/resize (it is position:fixed, the page isn't).
    // While the page scrolls, the long focus-glide would FIGHT the scroll (every scroll frame
    // re-targets the transition → visible stutter), so following swaps to a short linear chase
    // and the glide is restored once the scroll settles.
    let followTimer = null;
    const follow = () => {
      if (!(lit && lamp.classList.contains("is-on"))) return;
      lamp.style.transitionDuration = "0.12s"; lamp.style.transitionTimingFunction = "linear";
      place(lit);
      clearTimeout(followTimer);
      followTimer = setTimeout(() => { lamp.style.transitionDuration = ""; lamp.style.transitionTimingFunction = ""; }, 140);
    };
    addEventListener("scroll", follow, { capture: true, passive: true });
    addEventListener("resize", follow, { passive: true });
  }

  // A form control's lit surface is its whole labeled FIELD (grain lesson 8, designed out here:
  // the rule lives in WHERE the lamp points, not in per-kind CSS).
  const frameTarget = (el) => el.closest?.(".field") || el;

  function place(el) {
    const r = frameTarget(el).getBoundingClientRect();
    // travel via transform (composited — stays smooth even while the page lays out under it)
    lamp.style.transform = `translate3d(${r.left - PAD}px, ${r.top - PAD}px, 0)`;
    lamp.style.width = `${r.width + PAD * 2}px`;
    lamp.style.height = `${r.height + PAD * 2}px`;
    // passthrough: the backdrop's click-catch hole tracks the lamp (same rect), so the lit
    // target stays clickable as it glides. The hole rides `follow` too — it never lags a scroll.
    if (passthrough) backdrop.style.clipPath = backdropClip(
      { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }

  return {
    // raise the veil; `text` names what the AI is doing (empty → no label)
    on(text) {
      ensure();
      labelEl.textContent = text || "";
      labelEl.hidden = !text;
      if (!lit) {
        // no surface yet: the lamp wakes as a closed iris and the first move blooms it open.
        // A page may declare WHERE the light lives ([data-lamp-origin] — e.g. a drawn
        // lamp's head): the iris then opens from that spot, so the object and the light read
        // as one thing. Default: viewport center.
        const origin = document.querySelector("[data-lamp-origin]");
        let ox = innerWidth / 2, oy = innerHeight / 2;
        if (origin) { const r = origin.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; }
        lamp.style.transitionProperty = "opacity";           // wake AT the origin — never glide there
        lamp.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
        lamp.style.width = "0px"; lamp.style.height = "0px";
        void lamp.offsetWidth;                               // commit the position before restoring the glide
        lamp.style.transitionProperty = "";
      }
      void lamp.offsetWidth;                 // reflow so the opacity fade runs
      backdrop.classList.add("is-on");
      lamp.classList.add("is-on");
    },
    // glide the lamp onto ONE surface (off the previous one); click = pulse it
    move(el, { click = false } = {}) {
      ensure();
      if (lit && lit !== el) lit.classList.remove("ai-spotlit", "is-click");
      lit = el || null;
      if (el) {
        el.classList.add("ai-spotlit");      // semantic marker only — the visual is the lamp
        place(el);
        if (click) this.pulse(el);
      }
    },
    // a click ripple; remove→reflow→add restarts the animation if the same element is re-pulsed
    pulse(el) { if (!el) return; el.classList.remove("is-click"); void el.offsetWidth; el.classList.add("is-click"); setTimeout(() => el.classList.remove("is-click"), 500); },
    // drop the veil and release the lit surface (the lamp fades out in place)
    off() {
      if (backdrop) { backdrop.classList.remove("is-on"); backdrop.style.clipPath = ""; }
      if (lamp) lamp.classList.remove("is-on");
      if (labelEl) labelEl.hidden = true;
      if (lit) { lit.classList.remove("ai-spotlit", "is-click"); lit = null; }
    },
    isOn() { return !!backdrop && backdrop.classList.contains("is-on"); },
  };
}
