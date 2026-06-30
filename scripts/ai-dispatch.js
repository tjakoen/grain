// /frontend/scripts/ai-dispatch.js — the dispatcher island (docs/AI-INTERFACE.md §3).
//
// The ONE accepted bit of client JS. Two jobs:
//   1. Turn [data-action] interactions (click, or Enter in an input) into POST /intent
//      (the one door), applying the optimistic "pending" (grain) state on the target.
//   2. Open an SSE stream and apply RenderOps the server PUSHES, addressed by the
//      semantic surface (data-surface) — never by tag or CSS class.
// It knows render ops + the door; nothing about specific verbs.
(() => {
  "use strict";

  // A stable session id for this tab; the server pushes results back on it.
  const session =
    (crypto && crypto.randomUUID && crypto.randomUUID()) ||
    "s-" + Math.random().toString(36).slice(2) + performance.now();

  const screen = document.body.dataset.screen || "";

  // ---- find an element by its semantic surface address -------------------------
  const find = (surface) =>
    document.querySelector(`[data-surface="${(window.CSS && CSS.escape) ? CSS.escape(surface) : surface}"]`);

  // The surface a trigger acts on: explicit data-target, else the nearest surface.
  function targetOf(trigger) {
    const explicit = trigger.getAttribute("data-target");
    if (explicit) return explicit;
    const host = trigger.closest("[data-surface]");
    return host ? host.getAttribute("data-surface") : null;
  }

  // ---- "the desk is acting": spotlight the surface the AI is touching --------------
  const prefersReduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  let backdrop = null, actingLabel = null, confirmEl = null;
  let spotlit = null, spotlightTimer = null;
  const isActing = () => !!backdrop && backdrop.classList.contains("is-on");

  function ensureSpotlight() {
    if (backdrop) return;
    backdrop = document.createElement("div");
    backdrop.className = "ai-backdrop";
    backdrop.addEventListener("click", interrupt);   // interrupt → ask, don't force-kill
    actingLabel = document.createElement("div");
    actingLabel.className = "ai-acting-label";
    actingLabel.textContent = "✶ the desk is acting…";
    actingLabel.hidden = true;
    document.body.append(backdrop, actingLabel);
  }
  // release a surface from the spotlight. A control the AI is "using" keeps its
  // working state (data-commit) until its OUTPUT completes — held in pendingTriggers,
  // released by clearTrigger on the output's committed op — so it isn't dropped here.
  function clearActing(el) {
    if (!el) return;
    el.classList.remove("ai-spotlit", "is-click");
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.blur();
    const held = [...pendingTriggers.values()].includes(el);
    if (!held) el.removeAttribute("data-commit");
  }
  function spotlightOn(target) {
    ensureSpotlight();
    backdrop.classList.add("is-on");
    actingLabel.hidden = false;
    const el = find(target);
    if (spotlit && spotlit !== el) clearActing(spotlit);   // moving on → release the previous surface
    if (el) {
      el.classList.add("ai-spotlit");
      el.classList.remove("is-click"); void el.offsetWidth; el.classList.add("is-click");   // pulse = "click"
      el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "center" });  // gently follow
      // each KIND of surface reads AI-mode its own way:
      const tag = el.tagName, out = el.getAttribute("data-target");
      if (tag === "INPUT" || tag === "TEXTAREA") {
        el.focus();   // the AI composes like a human — clean ink + the field's own caret
      } else if (el.hasAttribute("data-action") && out) {
        el.setAttribute("data-commit", "pending");   // a control being USED → working until its output finishes…
        pendingTriggers.set(out, el);                // …held, then released by the output's committed op
      } else if (target !== "screen") {
        el.setAttribute("data-commit", "pending");   // a text region the AI writes in → grain
      }
      spotlit = el;
    }
    clearTimeout(spotlightTimer);
    spotlightTimer = setTimeout(spotlightOff, 20000);   // safety: never stay stuck
  }
  function spotlightOff() {
    clearTimeout(spotlightTimer);
    hideConfirm();
    if (backdrop) backdrop.classList.remove("is-on");
    if (actingLabel) actingLabel.hidden = true;
    clearActing(spotlit); spotlit = null;
  }

  // ---- interrupt: pause, ask, and (if confirmed) ask the DESK to stop --------------
  // We never abort the AI's write from the client — the user expresses "stop" and the
  // single writer halts itself gracefully (AI-INTERFACE §5c / PROJECT-PLAN §9).
  function interrupt() {
    if (!isActing()) return;                            // ask; the desk keeps working behind the modal
    showConfirm();
  }
  function ensureConfirm() {
    if (confirmEl) return;
    confirmEl = document.createElement("div");
    confirmEl.className = "ai-confirm";
    confirmEl.hidden = true;
    confirmEl.innerHTML =
      '<div class="ai-confirm__card">' +
        '<p class="ai-confirm__msg">The desk is working. Ask it to stop?</p>' +
        '<div class="ai-confirm__actions">' +
          '<button class="btn" data-confirm="resume">Let it finish</button>' +
          '<button class="btn" data-confirm="stop">Ask it to stop</button>' +
        '</div>' +
      '</div>';
    confirmEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-confirm]");
      if (!b) return;
      if (b.dataset.confirm === "resume") resume();
      else requestStop();
    });
    document.body.appendChild(confirmEl);
  }
  function showConfirm() { ensureConfirm(); confirmEl.hidden = false; }
  function hideConfirm() { if (confirmEl) confirmEl.hidden = true; }
  function resume() { hideConfirm(); }                   // "let it finish" — it never actually stopped
  function requestStop() {                               // ask the desk to stop (mediated, graceful)
    hideConfirm();
    fetch("/intent", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "user", session, screen, surface: "screen", action: "desk.stop", payload: {} }),
    }).catch(() => spotlightOff());                       // if we can't even ask, release locally
  }

  // triggers (buttons/inputs) held in their own grain state until their action commits
  const pendingTriggers = new Map();   // target surface → the element that fired it

  function clearTrigger(target) {
    const trg = pendingTriggers.get(target);
    if (trg) { trg.removeAttribute("data-commit"); pendingTriggers.delete(target); }
  }

  // ---- apply one render op -----------------------------------------------------
  function applyOp(op) {
    const el = find(op.target);
    // a committed op (or a flash/rollback) ends the interaction → release its trigger
    if (op.commit === "committed" || op.op === "flash") clearTrigger(op.target);
    switch (op.op) {
      case "remove":
        if (el) el.remove();
        return;
      case "replace":
        if (el && typeof op.html === "string") el.outerHTML = op.html;   // confirmed (clean) fragment
        return;
      case "append":
        if (el && typeof op.html === "string") el.insertAdjacentHTML("beforeend", op.html);
        return;
      case "flash":
        if (!el) return;
        el.removeAttribute("data-commit");           // clear optimistic grain → rollback
        el.classList.remove("flash-error");
        void el.offsetWidth;                         // restart the animation
        el.classList.add("flash-error");
        if (op.message) el.setAttribute("title", op.message);
        return;
      case "type":                                   // streamed AI text (grain → settles clean)
        if (!el) return;
        applyType(el, op);
        return;
      case "spotlight":                              // the AI as actor: dim + light the target
        op.active ? spotlightOn(op.target) : spotlightOff();
        return;
    }
  }

  // Stream a token into a target: lazily build a grain text body + blinking caret,
  // append tokens as they arrive. On `done` the caret goes and it's marked committed,
  // but it STAYS grain — this is AI speech, and grain = AI (provenance persists).
  function applyType(el, op) {
    // the AI composing in a real form field: drive .value (no caret/stream-body),
    // and clear on `done` — exactly what pressing Enter does for a human.
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      if (typeof op.text === "string") {
        if (document.activeElement !== el) el.focus();   // human-like: focused → clean ink + real caret
        el.value += op.text;
      }
      if (op.done) { el.value = ""; el.blur(); }          // "submit" clears the field, like Enter
      return;
    }
    let body = el.querySelector(".stream-body");
    if (!body) {
      el.innerHTML = '<span class="stream-body"></span><span class="caret"></span>';
      el.setAttribute("data-grade", "grain");        // AI / in-transit = grain (DESIGN-SYSTEM §3)
      el.setAttribute("data-commit", "pending");
      body = el.querySelector(".stream-body");
    }
    if (typeof op.text === "string") body.textContent += op.text;   // text only — no injection
    if (op.done) {
      const caret = el.querySelector(".caret");
      if (caret) caret.remove();
      el.setAttribute("data-commit", "committed");   // finished — but grade stays grain (it's AI)
      el.classList.add("settled");                   // subtle fade-in; grade unchanged
    }
  }

  // ---- SSE: the server→client push channel -------------------------------------
  const es = new EventSource(`/stream?session=${encodeURIComponent(session)}`);
  es.addEventListener("op", (e) => {
    try { applyOp(JSON.parse(e.data)); } catch (err) { console.error("[ai-dispatch] bad op", err); }
  });

  // ---- send an intent through the one door -------------------------------------
  function submit(action, target, payload, trigger) {
    // Optimistic grain goes on the TRIGGER the user touched (a button "working") — NOT
    // the target. The target's grade is driven by the server's render ops (type → grain,
    // replace → committed). Pre-graining the target wrongly grained whole regions like
    // the screen and left them stuck, since nothing cleared it.
    if (trigger) { trigger.setAttribute("data-commit", "pending"); pendingTriggers.set(target, trigger); }
    fetch("/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "user", session, screen, surface: target, action, payload }),
    }).catch(() => clearTrigger(target));                        // couldn't reach the door → undo
  }

  // click a button/link with a verb
  document.addEventListener("click", (ev) => {
    if (ev.target.closest(".ai-confirm")) return;        // the confirm popup handles its own clicks
    if (isActing()) { ev.preventDefault(); interrupt(); return; }   // any click while acting = interrupt
    const trig = ev.target.closest && ev.target.closest("[data-action]");
    if (!trig || trig.tagName === "INPUT" || trig.tagName === "TEXTAREA") return;
    const action = trig.getAttribute("data-action");
    const target = targetOf(trig);
    if (!action || !target) return;
    ev.preventDefault();
    submit(action, target, {}, trig);
  });

  // Escape while the desk is acting → interrupt (ask to stop), don't force-kill
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && isActing()) { ev.preventDefault(); interrupt(); }
  });

  // Enter in an input with a verb → send its value as payload.text
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.shiftKey) return;
    const inp = ev.target;
    if (!inp.matches || !inp.matches("input[data-action]")) return;
    const action = inp.getAttribute("data-action");
    const target = targetOf(inp);
    if (!action || !target) return;
    ev.preventDefault();
    submit(action, target, { text: inp.value }, inp);
    inp.value = "";
  });
})();
