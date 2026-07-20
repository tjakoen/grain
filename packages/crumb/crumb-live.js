// crumb/crumb-live.js — the CRUMB tour CLIENT: drives grain's traveling lamp (in PASSTHROUGH mode)
// + a <dialog> popover + REAL navigation between steps. Native ES module, no build (grain idiom).
//
// The design law (PLAN.md): the tour is a PROJECTION. It highlights, explains, and collects a
// verified mark — it NEVER mutates app state. Step routing is real navigation via the `navigate`
// idiom (location.assign), not an SPA fake, so tour progress must survive a page load: it lives in
// sessionStorage and this module RESUMES on every page it's injected into. One lamp is on at a
// time (a tour runs while the AI is idle), so reusing grain's createSpotlight is safe (lesson 1:
// use the mechanism, don't reinvent it).
import { createSpotlight } from "/scripts/ai-spotlight.js";

const KEY = "crumb:active";        // sessionStorage: { id, step, mode }  (step -1 = the intro card)
const cache = new Map();           // id -> Tour (avoid re-fetching across a same-page next/prev)

function getState() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } }
function setState(s) { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); }
const routeOf = (p) => (p.replace(/\/+$/, "") || "/");

async function fetchTour(id) {
  if (cache.has(id)) return cache.get(id);
  const res = await fetch(`/crumb/tours/${id}.json`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`crumb: tour "${id}" not found (${res.status})`);
  const tour = await res.json();
  cache.set(id, tour);
  return tour;
}

// ---- the one lamp (passthrough) + the one popover, created lazily ------------
let spot = null, pop = null, escBound = false;
function lamp() { return spot || (spot = createSpotlight({ passthrough: true })); }
function popover() {
  if (pop) return pop;
  pop = document.createElement("dialog");
  pop.className = "crumb-pop";
  pop.setAttribute("data-mode", "demo");
  document.body.appendChild(pop);
  if (!escBound) {
    // non-modal <dialog> doesn't auto-close on Escape — bind it so the tour always releases.
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && getState()) { e.preventDefault(); end(); } });
    escBound = true;
  }
  return pop;
}

// place the card near its surface (below if there's room, else above), clamped to the viewport;
// centered when there's no surface (the intro / a missing target).
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

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderCard(tour, idx, mode) {
  const n = tour.steps.length;
  const intro = idx < 0;
  const step = intro ? null : tour.steps[idx];
  const surfaceEl = step && step.surface ? document.querySelector(`[data-surface="${step.surface}"]`) : null;

  const p = popover();
  p.setAttribute("data-mode", mode);
  const dev = mode === "dev";
  const progress = intro ? "" : `<span class="crumb-pop__count">${idx + 1} / ${n}</span>`;
  const statusChip = step && step.status
    ? `<span class="crumb-pop__status" data-status="${esc(step.status)}">${esc(step.status.replace(/-/g, " "))}</span>` : "";
  const body = intro
    ? `<p class="crumb-pop__say">${esc(tour.intro || "Take a quick guided tour.")}</p>`
    : `${dev && step.review ? `<p class="crumb-pop__review">${esc(step.review)}</p>` : ""}` +
      `<p class="crumb-pop__say">${esc(step.say)}</p>` +
      `${step.verify ? `<p class="crumb-pop__verify"><b>Try it:</b> ${esc(step.verify)}</p>` : ""}`;

  const nextLabel = intro ? "Start" : (idx >= n - 1 ? "Finish" : "Next");
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

  p.querySelector('[data-crumb="end"]').onclick = end;
  p.querySelector('[data-crumb="next"]').onclick = next;
  const prevBtn = p.querySelector('[data-crumb="prev"]');
  if (prevBtn) prevBtn.onclick = prev;

  if (!p.open) p.show();          // non-modal: keeps the lit surface clickable (passthrough)
  // light the surface AFTER the card exists so we can place the card relative to it
  if (surfaceEl) { surfaceEl.scrollIntoView({ block: "center", behavior: "smooth" }); lamp().on(""); lamp().move(surfaceEl); }
  else if (intro) lamp().off();   // intro has no target — no lamp
  requestAnimationFrame(() => placeCard(p, surfaceEl));
  p.querySelector('[data-crumb="next"]').focus({ preventScroll: true });
}

// resume from sessionStorage: fetch the tour, navigate to the step's route if needed, else render.
async function resume() {
  const st = getState();
  if (!st) return;
  let tour;
  try { tour = await fetchTour(st.id); } catch (e) { console.warn(e); setState(null); return; }
  if (st.step >= tour.steps.length) { end(); return; }
  const step = st.step >= 0 ? tour.steps[st.step] : null;
  const need = routeOf(step && step.at ? step.at : (st.step < 0 ? tour.route : location.pathname));
  if (need !== routeOf(location.pathname)) { location.assign(need); return; }   // real nav; resume() re-fires on load
  renderCard(tour, st.step, st.mode || tour.mode);
}

async function go(step) {
  const st = getState();
  if (!st) return;
  const tour = await fetchTour(st.id);
  if (step >= tour.steps.length) { end(); return; }
  setState({ ...st, step });
  await resume();
}
function next() { const st = getState(); if (st) go(st.step + 1); }
function prev() { const st = getState(); if (st) go(Math.max(-1, st.step - 1)); }

function end() {
  setState(null);
  if (spot) spot.off();
  if (pop && pop.open) pop.close();
}

// start a tour from its intro card (step -1). `mode` overrides the tour's default when given.
async function start(id, mode) {
  const tour = await fetchTour(id).catch((e) => { console.warn(e); return null; });
  if (!tour) return;
  setState({ id, step: -1, mode: mode || tour.mode });
  await resume();
}

// ---- wiring -----------------------------------------------------------------
// declarative launcher: any `[data-crumb-start="<id>"]` (optionally `data-crumb-mode`) starts it —
// no inline JS in the host, the grain way.
addEventListener("click", (e) => {
  const t = e.target.closest?.("[data-crumb-start]");
  if (!t) return;
  e.preventDefault();
  start(t.getAttribute("data-crumb-start"), t.getAttribute("data-crumb-mode") || undefined);
});
// keep the card glued to its surface through scroll/resize (the lamp already follows on its own)
let repos = null;
addEventListener("scroll", () => { if (pop && pop.open) { clearTimeout(repos); repos = setTimeout(reposition, 60); } }, { passive: true, capture: true });
addEventListener("resize", reposition, { passive: true });
function reposition() {
  const st = getState();
  if (!st || !pop || !pop.open || st.step < 0) return;
  const tour = cache.get(st.id);
  const step = tour && tour.steps[st.step];
  const el = step && step.surface ? document.querySelector(`[data-surface="${step.surface}"]`) : null;
  placeCard(pop, el);
}

// resume on load (the module is injected on every app page)
if (document.readyState !== "loading") resume();
else addEventListener("DOMContentLoaded", resume);

// expose a tiny programmatic API (console / tests / a command palette entry)
window.crumb = { start, next, prev, end };
