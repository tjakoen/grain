// /frontend/scripts/ai-dispatch.js — the dispatcher island (docs/AI-INTERFACE.md §3).
//
// The ONE accepted bit of client JS. Two jobs:
//   1. Turn [data-action] interactions (click, or Enter in an input) into POST /intent
//      (the one door), applying the optimistic "pending" (grain) state on the target.
//   2. Open an SSE stream and apply RenderOps the server PUSHES, addressed by the
//      semantic surface (data-surface) — never by tag or CSS class.
// It knows render ops + the door; nothing about specific verbs.
//
// The "AI is acting" spotlight (backdrop / label / lit surface / click pulse) is GRAIN's shared
// primitive — grain/scripts/ai-spotlight.js. This dispatcher keeps the product ORCHESTRATION around
// it (surface-address resolution, per-kind AI-mode, scroll-into-view, the pending-trigger lifecycle,
// the app-shell takeover, the 20s safety timeout, and the mediated interrupt) and delegates only the
// raw DOM to createSpotlight — so the demo and the dispatcher light the page the same way.
import { createSpotlight } from "/scripts/ai-spotlight.js";

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

  const ACTING_LABEL = "✶ the AI is acting…";

  // ---- "the AI is acting": spotlight the surface the AI is touching --------------
  // The backdrop/label/lit/pulse DOM is grain's shared createSpotlight; the orchestration below is
  // this dispatcher's. clicking the veil → interrupt (ask, don't force-kill).
  const spotlight = createSpotlight({ onInterrupt: interrupt });
  let confirmEl = null;
  let spotlit = null, spotlightTimer = null;
  const isActing = () => spotlight.isOn();

  // release a surface from the spotlight. A control the AI is "using" keeps its
  // working state (data-commit) until its OUTPUT completes — held in pendingTriggers,
  // released by clearTrigger on the output's committed op — so it isn't dropped here.
  const savedPlaceholder = new WeakMap();   // restore a field's placeholder after AI typing
  function clearActing(el) {
    if (!el) return;
    el.classList.remove("ai-spotlit", "is-click");
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      if (savedPlaceholder.has(el)) { el.placeholder = savedPlaceholder.get(el); savedPlaceholder.delete(el); }
      el.removeAttribute("data-grade");   // drop the forced-clean
      el.blur();
    }
    const held = [...pendingTriggers.values()].includes(el);
    if (!held) el.removeAttribute("data-commit");
  }
  function spotlightOn(target, click) {
    spotlight.on(ACTING_LABEL);   // grain's backdrop + label
    // shell takeover (if the page uses the app-shell): the chat retracts + the console narrates
    document.querySelector(".app-shell")?.setAttribute("data-acting", "true");
    const el = find(target);
    if (spotlit && spotlit !== el) clearActing(spotlit);   // moving on → release the previous surface
    if (el) {
      spotlight.move(el, { click });             // the lamp glides onto it (pulse only on a real click)
      // Keep the lit surface fully in view WITHIN the scroll region — below the top bar and above
      // the docked terminal (both are separate grid rows, so scrolling main can't hide behind them).
      // Align to the TOP so a surface taller than the viewport is readable top-down, not centre-cropped.
      // Scroll only when it isn't already fully visible (a needless scroll cuts the lamp's glide short).
      const main = el.closest(".app-shell__main");
      const region = main ? main.getBoundingClientRect() : { top: 0, bottom: innerHeight, height: innerHeight };
      const r = el.getBoundingClientRect();
      const tallerThanView = r.height > region.height - 8;
      if (r.top < region.top + 4 || r.bottom > region.bottom - 4 || tallerThanView)
        el.scrollIntoView({ block: "start" });   // smoothness owned by CSS scroll-behavior (honors reduced-motion)
      // each KIND of surface reads AI-mode its own way:
      const tag = el.tagName, out = el.getAttribute("data-target");
      if (tag === "INPUT" || tag === "TEXTAREA") {
        // the AI composes like a human: clean ink from the first frame (no grain→smooth
        // flash), no grey placeholder ghost, the field's own caret.
        el.setAttribute("data-grade", "smooth");
        if (el.placeholder) { savedPlaceholder.set(el, el.placeholder); el.placeholder = ""; }
        el.focus();
      } else if (el.hasAttribute("data-action") && out) {
        clearTrigger(out);                            // drop any stale holder of this target first
        el.setAttribute("data-commit", "pending");   // a control being USED → working until its output finishes…
        pendingTriggers.set(out, el);                // …held, then released by the output's committed op
        armWatchdog();                                // bound its lifetime (dropped-op safety)
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
    spotlight.off();                              // drop grain's backdrop + label
    const sh = document.querySelector(".app-shell");
    if (sh) { sh.removeAttribute("data-acting"); sh.removeAttribute("data-chat-open"); sh.removeAttribute("data-console-open"); }   // hand back: everything resets
    clearActing(spotlit); spotlit = null;
    for (const t of [...pendingTriggers.keys()]) clearTrigger(t);   // backstop: turn over → nothing stays "working"
  }

  // ---- interrupt: pause, ask, and (if confirmed) ask the AI to stop --------------
  // We never abort the AI's write from the client — the user expresses "stop" and the
  // single writer halts itself gracefully (AI-INTERFACE §5c / PROJECT-PLAN §9).
  function interrupt() {
    if (!isActing()) return;                            // ask; the AI keeps working behind the modal
    showConfirm();
  }
  function ensureConfirm() {
    if (confirmEl) return;
    // a native modal <dialog>: focus-trap, Escape-to-close, ::backdrop, and top-layer
    // come free — no manual overlay/keydown plumbing. Escape = "let it finish" (the
    // AI keeps working behind it), which is the safe default.
    confirmEl = document.createElement("dialog");
    confirmEl.className = "ai-confirm";
    confirmEl.innerHTML =
      '<div class="ai-confirm__card">' +
        '<p class="ai-confirm__msg">The AI is working. Ask it to stop?</p>' +
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
  function showConfirm() { ensureConfirm(); if (!confirmEl.open) confirmEl.showModal(); }
  function hideConfirm() { if (confirmEl && confirmEl.open) confirmEl.close(); }
  function resume() { hideConfirm(); }                   // "let it finish" — it never actually stopped
  function requestStop() {                               // ask the AI to stop (mediated, graceful)
    hideConfirm();
    sendIntent({ source: "user", session, screen, surface: "screen", action: "desk.stop", payload: {} })
      .catch(() => spotlightOff());                       // if we can't even ask, release locally
  }

  // triggers (buttons/inputs) held in their own grain state until their action commits
  const pendingTriggers = new Map();   // target surface → the element that fired it

  function clearTrigger(target) {
    const trg = pendingTriggers.get(target);
    if (trg) { trg.removeAttribute("data-commit"); pendingTriggers.delete(target); }
  }

  // ---- pending-trigger WATCHDOG: every pending trigger has a BOUNDED lifetime -----------------
  // The 20s spotlight timer only arms once spotlightOn runs — but if the `spotlight` op itself is
  // DROPPED (SSE has no replay; AI-INTERFACE §3), the trigger goes pending in submit() and nothing
  // ever releases it. This watchdog is independent of the spotlight path: it (re)arms whenever a
  // trigger is pending and is REFRESHED on every received op (ops flowing = channel alive), so it
  // never trips during a healthy multi-second run — only on genuine silence (dropped ops / a hung
  // request). On fire: release every pending trigger, surface the failure on it (the existing flash
  // affordance — data-state="error" + title, no new toast system), and go honestly offline.
  const WATCHDOG_MS = 15000;
  let watchdogTimer = null;
  function armWatchdog() {                       // call after a trigger goes pending, and on each op
    clearTimeout(watchdogTimer); watchdogTimer = null;
    if (pendingTriggers.size) watchdogTimer = setTimeout(watchdogFire, WATCHDOG_MS);
  }
  function watchdogFire() {
    for (const [target, trg] of [...pendingTriggers.entries()]) {
      trg.removeAttribute("data-state"); void trg.offsetWidth;   // restart the flash
      trg.setAttribute("data-state", "error");
      trg.setAttribute("title", "The AI didn't respond — released.");
      clearTrigger(target);
    }
    markOnline(false);                           // the channel is evidently down → honest presence
    spotlightOff();                              // drop any veil + reset the shell
  }

  // ---- apply one render op -----------------------------------------------------
  // Every received op REFRESHES the watchdog (channel is alive) — done in the wrapper AFTER the op
  // is applied, so an op that clears the last pending trigger correctly stands the watchdog down.
  function applyOp(op) { applyOneOp(op); armWatchdog(); }
  function applyOneOp(op) {
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
        if (el && typeof op.html === "string") {
          el.insertAdjacentHTML("beforeend", op.html);
          const oy = getComputedStyle(el).overflowY;              // a scrolling log (chat / terminal) stays pinned to newest
          if (oy === "auto" || oy === "scroll") el.scrollTo({ top: el.scrollHeight });   // honors CSS scroll-behavior (gentle)
        }
        return;
      case "flash":
        if (!el) return;
        el.removeAttribute("data-commit");           // clear optimistic grain → rollback
        el.removeAttribute("data-state");
        void el.offsetWidth;                         // restart the animation
        el.setAttribute("data-state", "error");      // transient UI state (CONVENTIONS: data-state)
        if (op.message) el.setAttribute("title", op.message);
        return;
      case "type":                                   // streamed AI text (grain → settles clean)
        if (!el) return;
        applyType(el, op);
        return;
      case "spotlight":                              // the AI as actor: dim + light the target
        op.active ? spotlightOn(op.target, op.click) : spotlightOff();
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
      const prev = el.textContent || "";             // capture current text before we rebuild
      el.innerHTML = '<span class="stream-body"></span><span class="caret"></span>';
      el.setAttribute("data-grade", "grain");        // AI / in-transit = grain (DESIGN-SYSTEM §3)
      el.setAttribute("data-commit", "pending");
      body = el.querySelector(".stream-body");
      // OVERWRITE (op.back) re-enters an already-written surface → keep its text so the
      // the AI can backspace it. A fresh write (text, no back) starts empty (wipes any placeholder).
      if (typeof op.back === "number") body.textContent = prev;
    }
    if (typeof op.back === "number" && op.back > 0)                 // the AI revising: delete trailing chars
      body.textContent = [...body.textContent].slice(0, -op.back).join("");
    else if (typeof op.text === "string") body.textContent += op.text;   // text only — no injection
    if (op.done) {
      const caret = el.querySelector(".caret");
      if (caret) caret.remove();
      el.setAttribute("data-commit", "committed");   // finished — but grade stays grain (it's AI)
      el.classList.add("settled");                   // subtle fade-in; grade unchanged
    }
  }

  // ---- the reply channel: server door (SSE) or client door (loopback, §19.3) ----
  // `sendIntent(intent)` is the ONE wire out; which transport backs it is the page's choice
  // (<body data-ai-transport="client"> — set by a composition root / the static export).
  // Server transport: POST /intent + SSE push. Ops are pushed to a SUBSCRIBED session only — SSE
  // has NO replay. So an Intent must not be sent before this stream's subscriber is registered
  // SERVER-SIDE, or the first RenderOps are lost: typically the `spotlight` op that makes the page
  // "acting". Then the demo appears to do nothing AND can't be interrupted (isActing() stays false,
  // so clicks/Escape never raise the "stop?" prompt). The native `open` event is NOT enough — it
  // fires on response headers, which can precede the server registering the subscriber. We wait for
  // the server's `ready` handshake (emitted from inside the stream's start(), after registration).
  // Contract: AI-INTERFACE §3 — the door's reply channel must be LIVE before an intent is raised.
  // Client transport: the same door composed IN the page (static hosts have no backend); its
  // loopback channel hands ops straight to applyOp, so the reply channel is live by construction.
  const clientMode = document.body.dataset.aiTransport === "client";
  // HONEST presence: <body data-ai-online="true|false"> reflects whether the door's reply
  // channel actually came up (server `ready` handshake / client door loaded). Consumers style
  // their presence indicator + degraded mode off this — it is set by outcome, never assumed.
  const markOnline = (ok) => { document.body.dataset.aiOnline = ok ? "true" : "false"; };
  let sseIsOpen = false, markSseReady;
  const sseReady = new Promise((res) => { markSseReady = res; });
  let sendIntent;                                        // (intent) => Promise — set per transport
  if (clientMode) {
    // Which door module? A page may bring its OWN (data-ai-door — e.g. a consumer's scripted
    // scenario module exporting createClientDoor); default is grain's. Resolved against this
    // script's own URL so it works unchanged on a subpath host (no base-path rewrite needed).
    const assetBase = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
    const doorPath = document.body.dataset.aiDoor || "/modules/grain/ai/client-door.js";
    const doorReady = import(assetBase + doorPath)
      .then((m) => { const door = m.createClientDoor(applyOp); markOnline(true); return door; })
      .catch((err) => { console.error("[ai-dispatch] client door failed to load", err); markOnline(false); return null; });
    sendIntent = (intent) => doorReady.then((door) => {
      if (!door) throw new Error("client door unavailable");
      return door.handleIntent(intent);
    });
    sseIsOpen = true; markSseReady();                    // loopback: nothing to wait for
  } else {
    const es = new EventSource(`/stream?session=${encodeURIComponent(session)}`);
    let offlineTimer = null;
    // NOT { once: true }: EventSource auto-reconnects after a drop, and the server re-emits `ready`
    // from the fresh stream's start() — so a re-fired `ready` flips presence back ONLINE and cancels
    // any pending offline. (Presence = transport health, set by outcome on every up/down transition.)
    es.addEventListener("ready", () => { sseIsOpen = true; clearTimeout(offlineTimer); offlineTimer = null; markOnline(true); markSseReady(); });
    // SSE `error`. Two SEPARATE concerns, deliberately handled differently:
    //  (1) A LIVE run: SSE has no replay, so ops sent during the drop are lost and the run can't
    //      recover — release it NOW so it never hangs (mirrors the pre-debounce safety). Releasing
    //      the veil does NOT gate future clicks, so it's safe to do on any blip. Only when a run is
    //      actually live (guarded) — otherwise a benign nav-teardown error would reset persisted
    //      chrome (e.g. the terminal open-state).
    //  (2) PRESENCE/gating: the browser AUTO-RECONNECTS, so a transient blip is NOT "the door is
    //      down" — flipping offline instantly would spuriously gate a click made during the blip
    //      (and `submit()` no-ops offline). DEBOUNCE it: go offline only if still down after the
    //      reconnect grace; a re-fired `ready` cancels the timer. Presence stays "true" through a blip.
    es.onerror = () => {
      sseIsOpen = false;
      if (isActing() || pendingTriggers.size) spotlightOff();   // (1) release a live run immediately
      if (offlineTimer) return;                                 // (2) grace already ticking
      offlineTimer = setTimeout(() => {
        offlineTimer = null;
        if (sseIsOpen) return;                     // reconnected in the meantime (`ready` re-fired)
        console.warn("[ai-dispatch] /stream down past reconnect grace — going offline");
        markOnline(false);
        markSseReady();                            // unblock any waiter (degraded, like the 3s fallback)
      }, 4000);
    };
    // Degraded-mode fallback: never hang a click if the handshake never lands. This DOES re-open
    // the early-op-drop window (AI-INTERFACE §3 wants the channel live first) — deliberately, and
    // loudly: a submit that goes out un-acked means the stream is broken and ops may be lost.
    setTimeout(() => {
      if (!sseIsOpen) {
        console.warn("[ai-dispatch] no `ready` handshake after 3s — submitting anyway; early RenderOps may be dropped (broken /stream?)");
        markOnline(false);
      }
      markSseReady();
    }, 3000);
    es.addEventListener("op", (e) => {
      try { applyOp(JSON.parse(e.data)); } catch (err) { console.error("[ai-dispatch] bad op", err); }
    });
    sendIntent = (intent) => {
      // Bounded request: a hung POST /intent would pin the trigger forever (no ops come back). Abort
      // after 10s → the fetch rejects → submit()'s .catch releases the trigger + marks offline.
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 10000);
      return fetch("/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
        signal: ctl.signal,
      }).then((res) => {
        // fetch resolves on 4xx/5xx: a door-level error pushes no ops, so the trigger's pending
        // state would stick until the safety timeout — surface it to the caller's catch instead
        if (!res.ok) throw new Error(`/intent ${res.status}`);
        return res;
      }).finally(() => clearTimeout(to));
    };
  }

  // ---- send an intent through the one door -------------------------------------
  function submit(action, target, payload, trigger) {
    // Belt-and-braces presence gate: if the door's reply channel is known-down, don't pretend —
    // no-op (the CSS already disables [data-ai-run]/[data-ai-gate] controls; this covers the public
    // window.grain.door seam + any control that isn't gated). "waking" (undefined) still goes.
    if (document.body.dataset.aiOnline === "false") {
      console.info("[ai-dispatch] door offline — submit ignored (presence gating)");
      return;
    }
    // Optimistic grain goes on the TRIGGER the user touched (a button "working") — NOT
    // the target. The target's grade is driven by the server's render ops (type → grain,
    // replace → committed). Pre-graining the target wrongly grained whole regions like
    // the screen and left them stuck, since nothing cleared it.
    if (trigger) { clearTrigger(target); trigger.setAttribute("data-commit", "pending"); pendingTriggers.set(target, trigger); armWatchdog(); }
    const send = () => sendIntent({ source: "user", session, screen, surface: target, action, payload })
      .catch(() => { clearTrigger(target); markOnline(false); });   // couldn't reach the door (timeout/network) → undo + honest offline
    sseIsOpen ? send() : sseReady.then(send);                    // wait for the stream so no early ops are lost
  }

  // click a button/link with a verb
  document.addEventListener("click", (ev) => {
    if (ev.target.closest(".ai-confirm")) return;        // the confirm popup handles its own clicks
    // the assistant (chat) + the console are the AI's OWN surfaces — interacting there
    // (chatting, preparing your next message, switching chat⇄terminal) is NOT an interrupt.
    if (ev.target.closest(".app-shell__aside, .app-shell__console")) return;
    if (isActing()) { ev.preventDefault(); interrupt(); return; }   // clicking the WORKING page = ask it to stop
    const trig = ev.target.closest && ev.target.closest("[data-action]");
    if (!trig || trig.tagName === "INPUT" || trig.tagName === "TEXTAREA") return;
    const action = trig.getAttribute("data-action");
    const target = targetOf(trig);
    if (!action || !target) return;
    ev.preventDefault();
    // a control may pull its payload text from an input surface (data-from) — e.g. a Send button
    const from = trig.getAttribute("data-from");
    const src = from ? find(from) : null;
    const payload = src && "value" in src ? { text: src.value } : {};
    submit(action, target, payload, trig);
    if (src && "value" in src) src.value = "";
  });

  // Escape while the AI is acting → interrupt (ask to stop), don't force-kill
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

  // ---- the door, as a public seam (window.grain.door) --------------------------
  // A THIRD client of the one door, alongside human clicks (above) and the AI: any island can
  // raise an Intent through the SAME submit() — so it inherits the pending-trigger lifecycle and
  // the sse-ready gate for free, no parallel wire. The terminal is the first user (its `ask`/
  // `tour`/`stop` commands call this). Same idiom as window.grain.theme. (AI-INTERFACE §3.)
  window.grain = window.grain || {};
  window.grain.door = {
    /** Raise an Intent: (action, targetSurface, payload?, triggerEl?). The trigger, if given,
     *  wears data-commit="pending" until the action's output commits (control lifecycle). */
    submit: (action, target, payload = {}, trigger = null) => submit(action, target, payload, trigger),
    /** The current screen name (<body data-screen>), for callers building their own intents. */
    screen,
    /** Did the reply channel actually come up? (honest, set by outcome — never assumed.) */
    online: () => document.body.dataset.aiOnline === "true",
  };
})();
