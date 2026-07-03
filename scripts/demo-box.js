// grain/scripts/demo-box.js — a reusable, contained "demo box": a demonstration surface that runs
// a DECLARATIVE scripted sequence over its own contents. Keeps demo JavaScript out of pages — a page
// just writes markup + a JSON step list; this island runs it. Native ES module; the typing effect +
// reduced-motion rule come from the shared grain/scripts/type-effect.js (no duplicated animation).
//
//   <div data-demo="loop">            data-demo = "loop" | "trigger" | "once"
//     …content with #ids / .classes…
//     <button data-demo-play>replay</button>              (trigger mode)
//     <script type="application/json" class="demo-box__steps">
//       [ {"type":"#line","value":"Hello","caret":"#c","speed":45},
//         {"attr":"#row","name":"data-grade","value":"grain"}, {"wait":1500},
//         {"clear":"#row","name":"data-grade"}, {"text":"#b","value":"done"} ]
//     </script>
//   </div>
//
// Selectors are scoped to the box (contained). Reduced-motion runs ONE instant pass (no typing, no
// waits, no loop) so every demo lands on a sensible final state.
import { typeText, reducedMotion } from "/scripts/type-effect.js";

const rm = reducedMotion();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const box of document.querySelectorAll("[data-demo]")) setup(box);

function setup(box) {
  const scriptEl = box.querySelector(".demo-box__steps");
  if (!scriptEl) return;
  let steps;
  try { steps = JSON.parse(scriptEl.textContent); } catch { return; }
  if (!Array.isArray(steps)) return;
  const q = (sel) => (sel ? box.querySelector(sel) : null);

  async function run(s) {
    const el = q(s.type || s.attr || s.clear || s.text);
    if (s.type != null)       { await typeText(el, s.value ?? "", { speed: s.speed, caret: q(s.caret) }); }
    else if (s.attr != null)  { if (el) el.setAttribute(s.name, s.value); }
    else if (s.clear != null) { if (el) el.removeAttribute(s.name); }
    else if (s.text != null)  { if (el) el.textContent = s.value ?? ""; }
    else if (s.wait != null)  { if (!rm) await sleep(s.wait); }
  }

  const playOnce = async () => { for (const s of steps) await run(s); };
  const mode = box.getAttribute("data-demo");

  if (mode === "trigger") {
    box.querySelector("[data-demo-play]")?.addEventListener("click", playOnce);
    playOnce();                                   // auto-play once on load; replayable
  } else if (mode === "loop") {
    if (rm) playOnce(); else (async () => { for (;;) await playOnce(); })();
  } else {
    playOnce();
  }
}
