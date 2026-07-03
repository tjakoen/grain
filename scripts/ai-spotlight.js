// grain/scripts/ai-spotlight.js — GRAIN's reusable "AI is acting" spotlight: the DOM side of the
// treatment styled by grain/ai/ai.css (a dimming backdrop, the acting label, ONE lit surface at a
// time, a click pulse). Both the real dispatcher and client-side demos should drive the SAME
// behavior through this one factory — the spotlight is a GRAIN AI-module capability, not something
// each caller re-implements (AI-INTERFACE §5c). Native ES module, no build. Reduced-motion is
// handled by ai.css (transitions off); this just toggles the classes.
export function createSpotlight({ onInterrupt } = {}) {
  let backdrop = null, labelEl = null, lit = null;

  function ensure() {
    if (backdrop) return;
    backdrop = document.createElement("div");
    backdrop.className = "ai-backdrop";
    if (onInterrupt) backdrop.addEventListener("click", onInterrupt);   // click the veil to interrupt
    document.body.appendChild(backdrop);
    labelEl = document.createElement("div");
    labelEl.className = "ai-acting-label";
    document.body.appendChild(labelEl);
  }

  return {
    // raise the veil; `text` names what the AI is doing (empty → no label)
    on(text) {
      ensure();
      labelEl.textContent = text || "";
      labelEl.hidden = !text;
      void backdrop.offsetWidth;             // reflow so the opacity transition runs
      backdrop.classList.add("is-on");
    },
    // lift ONE surface into the light (moving the spotlight off the previous one); click = pulse it
    move(el, { click = false } = {}) {
      if (lit && lit !== el) lit.classList.remove("ai-spotlit", "is-click");
      lit = el || null;
      if (el) { el.classList.add("ai-spotlit"); if (click) this.pulse(el); }
    },
    // a click ripple; remove→reflow→add restarts the animation if the same element is re-pulsed
    pulse(el) { if (!el) return; el.classList.remove("is-click"); void el.offsetWidth; el.classList.add("is-click"); setTimeout(() => el.classList.remove("is-click"), 500); },
    // drop the veil and release the lit surface
    off() {
      if (backdrop) backdrop.classList.remove("is-on");
      if (labelEl) labelEl.hidden = true;
      if (lit) { lit.classList.remove("ai-spotlit", "is-click"); lit = null; }
    },
    isOn() { return !!backdrop && backdrop.classList.contains("is-on"); },
  };
}
