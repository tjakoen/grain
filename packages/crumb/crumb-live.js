// crumb/crumb-live.js — the CRUMB tour CLIENT: drives grain's traveling lamp (in PASSTHROUGH mode)
// + real navigation between steps. Two presentations of the SAME tour data:
//   - popover  (B2): a floating <dialog> anchored to the lit surface — the quick guided walk.
//   - frame    (B3): a routed app-shell VARIANT — a fixed top-bar + a combined nav/content sidebar
//                    + a bordered viewport. NOT an iframe (that would spawn a 2nd OpChannel
//                    subscriber and break grain's single-door audit model, PLAN.md); the host page
//                    is the real page, navigated in place, read as "framed". One sidebar component,
//                    `data-mode="demo|dev"` flipped live — variants as an attribute, never a
//                    DemoSidebar/DevSidebar split (grain non-negotiable). Native ES module, no build.
//
// The design law (PLAN.md): the tour is a PROJECTION. It highlights, explains, and (dev mode)
// collects a verified mark — it NEVER mutates app state. Step routing is real navigation via the
// `navigate` idiom (location.assign), so tour progress must survive a page load: it lives in
// sessionStorage and this module RESUMES on every page it's injected into. One lamp is on at a time
// (a tour runs while the AI is idle), so reusing grain's createSpotlight is safe (lesson 1).
import { createSpotlight } from "/scripts/ai-spotlight.js";

const KEY = "crumb:active";        // sessionStorage: { id, step, mode, frame }  (step -1 = intro card)
const cache = new Map();           // id -> Tour (avoid re-fetching across a same-page next/prev)

// the mount prefix the host serves CRUMB's routes under — must match the `prefix` passed to
// createCrumbRoutes (routes.ts), default "/crumb". A host that mounts CRUMB elsewhere declares it
// once via `<html data-crumb-prefix="/...">` so the client fetches tour data from the right place.
const PREFIX = (document.documentElement.dataset.crumbPrefix || "/crumb").replace(/\/+$/, "");

function getState() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } }
function setState(s) { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); }
// MIRRORED from core/nav.ts, verbatim, and drift-guarded by crumb-live.test.ts: this module is
// browser-native and served as a host asset, so it cannot import a .ts sibling (its one import is
// the host-served /scripts/ai-spotlight.js). See core/nav.ts for why the decision is not just a
// pathname compare: a target carrying query or fragment state used to reload forever.
const routeOf = (pathname) => (pathname.replace(/\/+$/, "") || "/");
function needsNavigation(target, here) {
  const cut = target.search(/[?#]/);
  const path = routeOf(cut < 0 ? target : target.slice(0, cut));
  const rest = cut < 0 ? "" : target.slice(cut);
  if (path !== routeOf(here.pathname)) return true;
  return rest !== "" && rest !== here.search + here.hash;
}
// A relative or absent route/at is not a navigable pathname — a host with nothing sensible to
// go to (a hash-router SPA under one project-page subpath, say) declares no route at all, and
// this is the ONE gate that decides whether resume() is allowed to call location.assign. Trust
// is server-side only up to a point: routes.ts/core/schema.ts already coerce a non-absolute
// `route`/`at` to null, but a host can also hand-author tour JSON directly (routes.ts is optional
// plumbing, not mandatory), so the client re-checks rather than assuming it always got clean data.
const isRoutable = (p) => typeof p === "string" && p.startsWith("/");

async function fetchTour(id) {
  if (cache.has(id)) return cache.get(id);
  const res = await fetch(`${PREFIX}/tours/${id}.json`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`crumb: tour "${id}" not found (${res.status})`);
  const tour = await res.json();
  cache.set(id, tour);
  return tour;
}

// A tour offers the demo|dev toggle only when it actually carries review content — otherwise the
// flip would be a no-op switch (a step's review/verify/status is what dev mode adds over demo).
const hasDevContent = (tour) => tour.steps.some((s) => s.review || s.verify || s.status);
// The card index: a tour with a `## prompt` section has one state past its last step.
const lastIndex = (tour) => tour.steps.length - (tour.prompt ? 0 : 1);
const isPromptIndex = (tour, idx) => !!tour.prompt && idx === tour.steps.length;

// ---- the prompt card's answers (in memory, deliberately) --------------------
// The card is the one place a tour takes input, and it does not navigate, so the answers do not need
// to survive a page load. Keeping them out of sessionStorage also keeps half-written review notes out
// of a store the rest of the site can read.
const answerStore = new Map();                     // tourId -> { askId: text }
const answersOf = (id) => answerStore.get(id) || {};
function setAnswer(id, ask, text) { answerStore.set(id, { ...answersOf(id), [ask]: text }); }

// MIRRORED from core/prompt.ts, verbatim, drift-guarded by crumb-live.test.ts (same reason as
// needsNavigation above: this module cannot import a .ts sibling from a host asset path).
const PROMPT_TOKEN = /\{([a-z0-9][a-z0-9_-]*)\}/gi;
function composePrompt(template, tour, answers) {
  return template.replace(PROMPT_TOKEN, (whole, token) => {
    if (token === "title") return tour.title;
    if (token === "tour") return tour.id;
    const answer = answers[token];
    return answer && answer.trim() !== "" ? answer.trim() : whole;
  });
}

// The card body, shared by both presentations (the class prefix is the only difference, the way the
// step body already works). It collects answers, composes text, and offers it: no submit, no write to
// the app, and the destination is whatever URL template the tour declared.
function promptBody(tour, p) {
  const card = tour.prompt;
  const answers = answersOf(tour.id);
  const composed = composePrompt(card.template, tour, answers);
  const fields = card.asks.map((a) =>
    `<label class="${p}__ask"><span class="${p}__asklabel">${esc(a.label)}</span>` +
    `<textarea class="${p}__askinput" rows="2" data-crumb-ask="${esc(a.id)}">${esc(answers[a.id] || "")}</textarea>` +
    `</label>`).join("");
  // grain's handoff.js is the vendor-neutral way to carry text into another service, and it is a
  // host script: when the host has not loaded it, the button would be inert, so it is not rendered
  // at all and the text below stands on its own.
  const handoff = card.handoff && window.grainHandoff
    ? `<button class="btn" data-handoff data-handoff-url="${esc(card.handoff)}" data-handoff-source=".${p}__composed">Open in a session</button>`
    : "";
  return `${card.intro ? `<p class="${p}__say">${esc(card.intro)}</p>` : ""}${fields}` +
    `<label class="${p}__ask"><span class="${p}__asklabel">The prompt to paste back</span>` +
    `<textarea class="${p}__composed" rows="6" readonly>${esc(composed)}</textarea></label>${handoff}`;
}

// Live recompose on every keystroke, without re-rendering the card (a re-render would steal the
// caret out of the field being typed into).
function wirePrompt(root, tour) {
  root.querySelectorAll("[data-crumb-ask]").forEach((el) => (el.oninput = () => {
    setAnswer(tour.id, el.getAttribute("data-crumb-ask"), el.value);
    const out = root.querySelector("[readonly]");
    if (out) out.value = composePrompt(tour.prompt.template, tour, answersOf(tour.id));
  }));
  const out = root.querySelector("[readonly]");
  if (out) out.onfocus = () => out.select();       // no clipboard permission needed to take it
}
const surfaceLabel = (s) => (s.surface || "").replace(/^nav:|^note:/, "").replace(/[:/]+/g, " ").trim() || "step";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---- prefill: the tour's only write, and it goes through the door -----------
// The design law, amended 2026-08-09 (PLAN.md): a tour may stage text into its OWN field surface,
// but only by raising the SAME `field.set` Intent a human's own typing would raise — never by
// touching `.value` directly. That is what makes a staged field indistinguishable, downstream, from
// one the AI filled during a real session: same op, same grade, same "clears on a human touch"
// behavior. This function is the one and only place in the client that may call `door.submit`; it
// is asserted by crumb-live.test.ts (no `.value =` in its body, a `door.submit(` call inside it).
//
// Returns null when there is nothing to show (no declared prefill, or no live field to stage it
// into — a step may target a surface a given page doesn't render); otherwise one of three honest
// outcomes the step card displays via stagedNote(): "staged", "occupied", "offline".
//
// The surfaces this walk has already handed to the door. The grade check below covers the ordinary
// re-render, but only AFTER the fill has actually landed: door.submit is async (it crosses the same
// reasoner every other Intent does), so a re-render inside that window — a demo|dev flip is one
// keystroke away and re-renders in place — would find the field still empty and ask a second time.
// The op is idempotent, so the field would be fine; the narration the reasoner emits per fill is
// not, and a tour that says it staged one draft should not leave two lines saying so. Cleared when
// a walk ends, and a real navigation reloads this module anyway (the fresh page needs its own fill).
const stagedSurfaces = new Set();

function prefillStep(step) {
  if (!step || !step.prefill) return null;
  const el = document.querySelector(`[data-surface="${step.surface}"]`);
  if (!el || !("value" in el)) return null;
  const held = el.value !== "";
  // A non-empty value NOT wearing the AI's ink is the human's own writing — the door's own grade
  // rule (ai-dispatch.js) already says a trusted input event strips data-grade="grain", so this is
  // the same "who owns this text" test the rest of grain uses, not a new one invented here.
  if (held && el.getAttribute("data-grade") !== "grain") return "occupied";
  // Already staged by THIS tour (stepping back to a step and forward again re-renders it): the
  // value and the grain grade are both still there, so calling door.submit a second time would be
  // redundant at best and, worse, would re-fire a timeline entry for a write that already happened.
  if (held && el.getAttribute("data-grade") === "grain") return "staged";
  if (!window.grain?.door?.submit || document.body.dataset.aiOnline === "false") return "offline";
  if (stagedSurfaces.has(step.surface)) return "staged";   // asked already; the fill is still in flight
  stagedSurfaces.add(step.surface);
  window.grain.door.submit("field.set", step.surface, { value: step.prefill });
  return "staged";
}

// The honesty marker: shown wherever prefillStep() had something to say, in BOTH presentations
// (the prefix `p` is the same "crumb-pop" / "crumb-sidebar" split promptBody already uses). Wording
// is exact and load-bearing — this is the line that keeps a staged field from being mistaken for a
// real one, which is the failure mode the feasibility audit was written to head off.
function stagedNote(result, p) {
  if (result === null) return "";
  const text = result === "staged"
    ? "Staged by the tour. The tour filled this field through the app's own door; nothing was sent."
    : result === "occupied"
      ? "Left as it was. You have already written here, so the tour did not touch it."
      : "The door is offline, so this field stays empty and the step shows the real state.";
  return `<p class="${p}__staged" data-staged="${result}">${text}</p>`;
}

// ---- the one lamp (passthrough) ---------------------------------------------
let spot = null, escBound = false;
function lamp() { return spot || (spot = createSpotlight({ passthrough: true })); }
function bindEsc() {
  if (escBound) return;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && getState()) { e.preventDefault(); end(); } });
  escBound = true;
}
// light (or clear) the current step's surface — shared by both presentations.
function lightStep(step, intro) {
  const surfaceEl = step && step.surface ? document.querySelector(`[data-surface="${step.surface}"]`) : null;
  if (surfaceEl) { surfaceEl.scrollIntoView({ block: "center", behavior: "smooth" }); lamp().on(""); lamp().move(surfaceEl); }
  else if (intro) lamp().off();
  return surfaceEl;
}

// ================= PRESENTATION 1: the floating popover (B2) ==================
let pop = null;
function popover() {
  if (pop) return pop;
  pop = document.createElement("dialog");
  pop.className = "crumb-pop";
  pop.setAttribute("data-mode", "demo");
  document.body.appendChild(pop);
  bindEsc();                       // non-modal <dialog> doesn't auto-close on Escape
  return pop;
}
function placeCard(card, surfaceEl) {
  const w = card.offsetWidth, h = card.offsetHeight, M = 12;
  if (!surfaceEl) {
    card.style.left = `${Math.round((innerWidth - w) / 2)}px`;
    card.style.top = `${Math.round((innerHeight - h) / 2)}px`;
    return;
  }
  const r = surfaceEl.getBoundingClientRect();
  let top = r.bottom + M;
  if (top + h > innerHeight - M) top = Math.max(M, r.top - h - M);   // flip above
  let left = r.left + r.width / 2 - w / 2;                            // center on the surface
  left = Math.max(M, Math.min(left, innerWidth - w - M));
  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(Math.max(M, top))}px`;
}
function renderPopover(tour, idx, mode, staged) {
  const n = tour.steps.length;
  const intro = idx < 0;
  const prompt = isPromptIndex(tour, idx);
  const step = intro || prompt ? null : tour.steps[idx];
  const p = popover();
  p.setAttribute("data-mode", mode);
  const dev = mode === "dev";
  const progress = intro || prompt ? "" : `<span class="crumb-pop__count">${idx + 1} / ${n}</span>`;
  const statusChip = dev && step && step.status
    ? `<span class="crumb-pop__status" data-status="${esc(step.status)}">${esc(step.status.replace(/-/g, " "))}</span>` : "";
  const body = intro
    ? `<p class="crumb-pop__say">${esc(tour.intro || "Take a quick guided tour.")}</p>`
    : prompt
      ? promptBody(tour, "crumb-pop")
      : `${dev && step.review ? `<p class="crumb-pop__review">${esc(step.review)}</p>` : ""}` +
        `<p class="crumb-pop__say">${esc(step.say)}</p>` +
        stagedNote(staged, "crumb-pop") +
        `${dev && step.verify ? `<p class="crumb-pop__verify"><b>Try it:</b> ${esc(step.verify)}</p>` : ""}`;
  const nextLabel = intro ? "Start" : (idx >= lastIndex(tour) ? "Finish" : "Next");
  p.innerHTML =
    `<div class="crumb-pop__head">` +
      `<span class="crumb-pop__title">${esc(tour.title)}</span>${statusChip}${progress}` +
      `<button class="crumb-pop__x" data-crumb="end" aria-label="Close tour">&times;</button>` +
    `</div>` +
    `<div class="crumb-pop__body">${body}</div>` +
    `<div class="crumb-pop__foot">` +
      `${intro ? "" : `<button class="btn" data-variant="soft" data-crumb="prev">Back</button>`}` +
      `<button class="btn" data-crumb="next">${nextLabel}</button>` +
    `</div>`;
  wireControls(p);
  if (prompt) wirePrompt(p, tour);
  if (!p.open) p.show();          // non-modal: keeps the lit surface clickable (passthrough)
  const surfaceEl = lightStep(step, intro || prompt);
  requestAnimationFrame(() => placeCard(p, surfaceEl));
  p.querySelector('[data-crumb="next"]').focus({ preventScroll: true });
}

// ================= PRESENTATION 2: the frame + sidebar (B3) ===================
// A routed app-shell variant: a fixed top-bar + a combined nav/content sidebar + a bordered
// viewport. `data-crumb-frame` on <body> SHRINKS the host into the framed viewport (crumb.css)
// so the chrome wraps around the site instead of covering it (still not an iframe, PLAN.md).
// `data-mode` on the root flips the SAME step between demo (say only) and dev (review + status
// rail + verify).
let frame = null;
function frameRoot() {
  if (frame) return frame;
  frame = document.createElement("div");
  frame.className = "crumb-frame";
  document.body.appendChild(frame);
  document.body.setAttribute("data-crumb-frame", "");
  bindEsc();
  return frame;
}
function renderFrame(tour, idx, mode, staged) {
  const n = tour.steps.length;
  const intro = idx < 0;
  const prompt = isPromptIndex(tour, idx);
  const step = intro || prompt ? null : tour.steps[idx];
  const dev = mode === "dev";
  const showModes = hasDevContent(tour);
  const f = frameRoot();
  f.setAttribute("data-mode", mode);

  const modeToggle = showModes
    ? `<div class="crumb-frame__modes" role="tablist" aria-label="Tour mode">` +
        `<button class="crumb-frame__mode" role="tab" data-crumb-mode-set="demo" aria-selected="${!dev}">Demo</button>` +
        `<button class="crumb-frame__mode" role="tab" data-crumb-mode-set="dev" aria-selected="${dev}">Review</button>` +
      `</div>`
    : "";

  // the nav rail: every step, with current/visited marks + (dev) a status chip.
  const rail = tour.steps.map((s, i) => {
    const cur = i === idx ? " data-current" : "";
    const done = i < idx ? " data-visited" : "";
    const chip = dev && s.status
      ? `<span class="crumb-sidebar__chip" data-status="${esc(s.status)}">${esc(s.status.replace(/-/g, " "))}</span>` : "";
    return `<li class="crumb-sidebar__step"${cur}${done}>` +
      `<button class="crumb-sidebar__goto" data-crumb-goto="${i}">` +
        `<span class="crumb-sidebar__num">${i + 1}</span>` +
        `<span class="crumb-sidebar__label">${esc(surfaceLabel(s))}</span>${chip}` +
      `</button></li>`;
  }).join("") +
  // the prompt card gets its own rail entry, so a reviewer can see the walk ends in a question
  // rather than discovering it by pressing Next on the last step.
  (tour.prompt
    ? `<li class="crumb-sidebar__step"${prompt ? " data-current" : ""}>` +
        `<button class="crumb-sidebar__goto" data-crumb-goto="${n}">` +
          `<span class="crumb-sidebar__num">${n + 1}</span>` +
          `<span class="crumb-sidebar__label">hand it back</span>` +
        `</button></li>`
    : "");

  // the content pane: the current step (or the intro, or the prompt card).
  const detail = intro
    ? `<p class="crumb-sidebar__say">${esc(tour.intro || "Take a quick guided tour.")}</p>`
    : prompt
      ? promptBody(tour, "crumb-sidebar")
      : `${dev && step.review ? `<p class="crumb-sidebar__review">${esc(step.review)}</p>` : ""}` +
        `<p class="crumb-sidebar__say">${esc(step.say)}</p>` +
        stagedNote(staged, "crumb-sidebar") +
        `${dev && step.verify ? `<p class="crumb-sidebar__verify"><b>Try it:</b> ${esc(step.verify)}</p>` : ""}`;
  const nextLabel = intro ? "Start" : (idx >= lastIndex(tour) ? "Finish" : "Next");

  f.innerHTML =
    `<div class="crumb-frame__edge" aria-hidden="true"></div>` +
    `<header class="crumb-frame__bar">` +
      `<span class="crumb-frame__title">${esc(tour.title)}</span>` +
      `${intro || prompt ? "" : `<span class="crumb-frame__count">${idx + 1} / ${n}</span>`}` +
      `${modeToggle}` +
      `<button class="crumb-frame__x btn" data-variant="soft" data-crumb="end">Exit tour</button>` +
    `</header>` +
    `<aside class="crumb-sidebar" data-mode="${mode}">` +
      `<nav class="crumb-sidebar__nav" aria-label="Tour steps"><ol class="crumb-sidebar__list">${rail}</ol></nav>` +
      `<div class="crumb-sidebar__detail">${detail}` +
        `<div class="crumb-sidebar__foot">` +
          `${intro ? "" : `<button class="btn" data-variant="soft" data-crumb="prev">Back</button>`}` +
          `<button class="btn" data-crumb="next">${nextLabel}</button>` +
        `</div>` +
      `</div>` +
    `</aside>`;

  wireControls(f);
  if (prompt) wirePrompt(f, tour);
  lightStep(step, intro || prompt);
  const nb = f.querySelector('[data-crumb="next"]');
  if (nb) nb.focus({ preventScroll: true });
}

// ---- shared control wiring (both presentations use the same data-crumb verbs) ----
function wireControls(root) {
  root.querySelectorAll('[data-crumb="end"]').forEach((b) => (b.onclick = end));
  root.querySelectorAll('[data-crumb="next"]').forEach((b) => (b.onclick = next));
  root.querySelectorAll('[data-crumb="prev"]').forEach((b) => (b.onclick = prev));
  root.querySelectorAll("[data-crumb-goto]").forEach((b) => (b.onclick = () => go(Number(b.getAttribute("data-crumb-goto")))));
  root.querySelectorAll("[data-crumb-mode-set]").forEach((b) => (b.onclick = () => setMode(b.getAttribute("data-crumb-mode-set"))));
}

// ---- render dispatch --------------------------------------------------------
// The step is computed here, once, the same way both presentations compute it internally — and
// prefillStep() is called here, once, rather than inside renderPopover/renderFrame. Both of those
// re-render on a plain mode flip (setMode), so if EITHER of them called prefillStep itself, the
// door call would live inside the thing that also runs on every demo|dev toggle, which is exactly
// the surface a stray re-fire would hide on. Routing it through this single dispatch point means
// there is one call site to reason about. It does NOT by itself make the re-fire impossible —
// setMode re-renders through here too — so the safety is prefillStep's own: the grain grade once the
// fill has landed, and stagedSurfaces while it is still in flight.
function render(tour, idx, st) {
  const intro = idx < 0;
  const prompt = isPromptIndex(tour, idx);
  const step = intro || prompt ? null : tour.steps[idx];
  const staged = prefillStep(step);
  if (st.frame) { if (pop && pop.open) pop.close(); renderFrame(tour, idx, st.mode, staged); }
  else { teardownFrame(); renderPopover(tour, idx, st.mode, staged); }
}

// resume from sessionStorage: fetch the tour, navigate to the step's route if needed, else render.
async function resume() {
  const st = getState();
  if (!st) return;
  let tour;
  try { tour = await fetchTour(st.id); } catch (e) { console.warn(e); setState(null); return; }
  if (st.step > lastIndex(tour)) { end(); return; }
  // the prompt card (index === steps.length) has no surface and no route: it renders where it stands.
  const step = st.step >= 0 && !isPromptIndex(tour, st.step) ? tour.steps[st.step] : null;
  // step.at wins when the step names one; the intro (step -1) falls back to the tour's entry
  // route; any other step with no `at` has nothing to navigate to (stay put — that's the
  // documented "global surface" contract, not new behavior). isRoutable is what makes a relative
  // or absent value a no-op instead of a broken navigation (the fix: this used to fall through to
  // tour.route unconditionally, so Back from step 0 to the intro card forced a pathname navigation
  // even on a host — a hash-router SPA under a project-page subpath — with no sensible target).
  const target = step && step.at ? step.at : (st.step < 0 ? tour.route : null);
  // The target is assigned WHOLE (query and fragment included); the decision to go is what compares
  // pathnames. Assigning the normalized pathname instead would drop declared query state, and
  // comparing the whole target against a bare pathname is what caused the reload loop (core/nav.ts).
  if (isRoutable(target) && needsNavigation(target, location)) { location.assign(target); return; }   // real nav; resume() re-fires on load
  render(tour, st.step, st);
}

async function go(step) {
  const st = getState();
  if (!st) return;
  const tour = await fetchTour(st.id);
  if (step > lastIndex(tour)) { end(); return; }
  setState({ ...st, step });
  await resume();
}
function next() { const st = getState(); if (st) go(st.step + 1); }
function prev() { const st = getState(); if (st) go(Math.max(-1, st.step - 1)); }

// the demo|dev flip: same step index, re-render in place (no navigation) — the one-component
// attribute swap the PLAN calls non-negotiable.
async function setMode(mode) {
  const st = getState();
  if (!st || (mode !== "demo" && mode !== "dev")) return;
  setState({ ...st, mode });
  const tour = await fetchTour(st.id);
  render(tour, st.step, { ...st, mode });
}

function teardownFrame() {
  if (frame) { frame.remove(); frame = null; }
  document.body.removeAttribute("data-crumb-frame");
}
function end() {
  const st = getState();
  if (st) answerStore.delete(st.id);   // review notes die with the tour; nothing outlives the walk
  stagedSurfaces.clear();              // the next walk stages its own fields, and asks the door again
  setState(null);
  if (spot) spot.off();
  if (pop && pop.open) pop.close();
  teardownFrame();
}

// start a tour from its intro card (step -1). `opts` = { mode, frame } override the defaults.
async function start(id, opts = {}) {
  const tour = await fetchTour(id).catch((e) => { console.warn(e); return null; });
  if (!tour) return;
  setState({ id, step: -1, mode: opts.mode || tour.mode, frame: !!opts.frame });
  await resume();
}

// ---- wiring -----------------------------------------------------------------
// declarative launcher: any `[data-crumb-start="<id>"]` starts it — no inline JS in the host
// (the grain way). `data-crumb-mode` picks demo|dev; presence of `data-crumb-frame` = frame mode.
addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-crumb-start]");
  if (!t) return;
  e.preventDefault();
  start(t.getAttribute("data-crumb-start"), {
    mode: t.getAttribute("data-crumb-mode") || undefined,
    frame: t.hasAttribute("data-crumb-frame"),
  });
});
// keep the popover glued to its surface through scroll/resize (the lamp follows on its own; the
// frame chrome is fixed, so only the popover needs repositioning).
let repos = null;
addEventListener("scroll", () => { if (pop && pop.open) { clearTimeout(repos); repos = setTimeout(reposition, 60); } }, { passive: true, capture: true });
addEventListener("resize", reposition, { passive: true });
function reposition() {
  const st = getState();
  if (!st || st.frame || !pop || !pop.open || st.step < 0) return;
  const tour = cache.get(st.id);
  const step = tour && tour.steps[st.step];
  const el = step && step.surface ? document.querySelector(`[data-surface="${step.surface}"]`) : null;
  placeCard(pop, el);
}

// ---- the linkable tour: `?crumb=<id>` (+ `crumb-mode`, `crumb-frame`) --------
// The declarative launcher needs a control that already sits on the page, which is right for the
// demo tour (the dock's Tour button) and useless for a REVIEW tour: a dev tour is written for one
// change, handed to one person, once. That handoff is a link — in a handoff note, a PR comment, a
// message — so a tour has to be startable from a URL. The param names mirror the attribute
// vocabulary (`crumb`, `crumb-mode`, `crumb-frame`) rather than inventing a second set, and the
// `crumb-` prefix keeps them out of a host's own query namespace.
//
// The param is CONSUMED before the tour starts. A tour navigates for real (location.assign), and a
// param left in the URL would re-fire on the next page and reset the tour to its intro card at
// every step. Stripping it first makes the link a one-shot trigger, which is what a link is.
function fromUrl() {
  const q = new URLSearchParams(location.search);
  const id = q.get("crumb");
  if (!id) return null;
  const opts = { mode: q.get("crumb-mode") || undefined, frame: q.has("crumb-frame") };
  for (const k of ["crumb", "crumb-mode", "crumb-frame"]) q.delete(k);
  const qs = q.toString();
  history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : "") + location.hash);
  return { id, opts };
}

// resume on load (the module is injected on every app page). A link WINS over a tour already in
// sessionStorage: the tour's own navigation never carries the param, so a param that is present is
// always a fresh deliberate click, and honouring the click beats silently resuming something else.
function boot() {
  const link = fromUrl();
  return link ? start(link.id, link.opts) : resume();
}
if (document.readyState !== "loading") boot();
else addEventListener("DOMContentLoaded", boot);

// expose a tiny programmatic API (console / tests / a command palette entry)
window.crumb = { start, next, prev, end, setMode };
