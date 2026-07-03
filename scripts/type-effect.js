// grain/scripts/type-effect.js — the shared typing/streaming effect for GRAIN's demo islands.
// One home for the char-by-char animation + the reduced-motion rule, so every demo types the same
// way (and there's a single place to tune the speed). Native ES module, no build.
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Type `text` into an element's textContent, char by char; instant under reduced motion.
// Optional `caret` element is shown while typing, hidden when done.
export async function typeText(el, text, { speed = 32, caret = null } = {}) {
  if (!el) return;
  el.textContent = "";
  if (caret) caret.hidden = false;
  if (reducedMotion()) { el.textContent = text; if (caret) caret.hidden = true; return; }
  for (const ch of text) { el.textContent += ch; await sleep(speed); }
  if (caret) caret.hidden = true;
}

// Type into an input's value (a form field the AI is filling); instant under reduced motion.
export async function typeInput(el, text, { speed = 45 } = {}) {
  if (!el) return;
  el.value = "";
  if (reducedMotion()) { el.value = text; return; }
  for (const ch of text) { el.value += ch; await sleep(speed); }
}
