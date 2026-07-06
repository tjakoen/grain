// grain/scripts/ai-spotlight.js — GRAIN's reusable "AI is acting" spotlight: THE TRAVELING LAMP.
// One fixed-position frame (.ai-lamp) whose rect GLIDES between surfaces — the dim is the lamp's
// own cutout shadow, so hole and veil move together (styled by grain/ai/ai.css; the glide speed
// is the --ai-focus-move / --ai-focus-ease tokens). The lit element is never restyled: a rect is
// a rect, so every surface kind gets the same treatment by construction. Both the real dispatcher
// and client-side demos drive this ONE factory (AI-INTERFACE §5c) — never re-implement it.
// Native ES module, no build. Reduced-motion is handled by ai.css (the glide transition is off).
export function createSpotlight({ onInterrupt } = {}) {
  let backdrop = null, lamp = null, labelEl = null, lit = null;
  const PAD = 6;   // breathing room between the surface and the lamp's frame

  function ensure() {
    if (backdrop) return;
    backdrop = document.createElement("div");            // invisible click-catcher: the interrupt gesture
    backdrop.className = "ai-backdrop";
    if (onInterrupt) backdrop.addEventListener("click", onInterrupt);
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
      if (backdrop) backdrop.classList.remove("is-on");
      if (lamp) lamp.classList.remove("is-on");
      if (labelEl) labelEl.hidden = true;
      if (lit) { lit.classList.remove("ai-spotlit", "is-click"); lit = null; }
    },
    isOn() { return !!backdrop && backdrop.classList.contains("is-on"); },
  };
}
