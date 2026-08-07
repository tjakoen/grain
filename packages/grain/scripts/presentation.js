// grain/scripts/presentation.js: the PRESENTATION island, the behaviour half of the
// organisms/presentation surface.
//
// It owns the deck and nothing else: which slide is current, which fragments have landed, the
// fit-to-box pass, the dot matrix, the overview grid, present mode, the notes strip, the presenter
// window, and print. It knows nothing about any particular talk.
//
// THE SEAM. A consuming app hooks its own per-slide behaviour by listening on the deck element:
//
//   deck.addEventListener("presentation:slide", (e) => {
//     const { index, step, slide, title, entered } = e.detail;
//   });
//
// `entered` is true on the first event for a slide (the arrival) and false on later steps within
// it, so an app can start an animation once and advance figures per step. That is the whole
// contract: no registry, no per-slide config, no framework.
//
// OPT-IN: mark the root `.presentation` with `data-deck`. Zero-JS the markup still renders the
// first slide (author it with `data-current`), which is what the static export and a print run get.
(() => {
  "use strict";
  if (window.grain && window.grain.presentation) return;      // idempotent, like the other islands

  const SETTLE_MS = 420;   // how long a slide reads as "in transit" before its type commits to clean

  function init() {
    for (const deck of document.querySelectorAll(".presentation[data-deck]")) mount(deck);
  }

  function mount(deck) {
    const slides = [...deck.querySelectorAll(".presentation__slide")];
    if (!slides.length) return;
    const dotsEl = deck.querySelector("[data-dots]");
    const posEl = deck.querySelector("[data-pos]");
    const gridEl = deck.querySelector("[data-grid]");
    const stripEl = deck.querySelector("[data-inline-notes]");
    const total = slides.length;
    const channel = "BroadcastChannel" in window
      ? new BroadcastChannel(deck.dataset.channel || "grain.presentation") : null;
    const isPresenter = new URLSearchParams(location.search).get("presenter") === "1";

    let at = 0, step = 0, settleTimer = null;

    const frags = (s) => [...s.querySelectorAll(".frag")];
    const steps = (s) => frags(s).length + (Number(s.dataset.steps) || 0);
    const notesOf = (s) => [...(s.querySelector(".slide-notes")?.children || [])].map((li) => li.innerHTML);

    /* ---- fit: shrink a dense slide until it fits its own box -------------------
       Fragments only change opacity and transform, never layout, so one measurement per slide
       holds for every step. Any [aria-expanded] card is measured OPEN, so clicking one on stage
       can never overflow. */
    slides.forEach((s) => {
      if (s.querySelector(".presentation__body")) return;
      const body = document.createElement("div");
      body.className = "presentation__body";
      [...s.children].forEach((c) => { if (!c.classList.contains("slide-notes")) body.append(c); });
      s.prepend(body);
    });

    function fit(s) {
      const body = s.querySelector(".presentation__body");
      if (!body) return;
      const shown = s.hasAttribute("data-current");
      if (!shown) { s.style.display = "flex"; s.style.visibility = "hidden"; }
      const collapsed = [...s.querySelectorAll('[aria-expanded="false"]')];
      collapsed.forEach((c) => c.setAttribute("aria-expanded", "true"));
      // measure the WORST case, which is the slide mid-settle: the grain face and its extra
      // letter-spacing are wider than the clean one, so a slide that fits when settled can still
      // overflow on the way in. Measuring settled would ship exactly that silent overflow.
      const wasSettling = s.hasAttribute("data-settling");
      s.setAttribute("data-settling", "");
      s.style.setProperty("--fit", "1");
      const cs = getComputedStyle(s);
      const room = () => s.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      let f = 1;
      while (f > 0.5 && body.scrollHeight > room()) {
        f = Math.round((f - 0.04) * 100) / 100;
        s.style.setProperty("--fit", String(f));
      }
      collapsed.forEach((c) => c.setAttribute("aria-expanded", "false"));
      if (!wasSettling) s.removeAttribute("data-settling");
      if (!shown) { s.style.display = ""; s.style.visibility = ""; }
    }
    const fitAll = () => slides.forEach(fit);

    /* ---- paint ------------------------------------------------------------- */
    function paint(entered) {
      slides.forEach((s, i) => s.toggleAttribute("data-current", i === at));
      const now = slides[at];
      frags(now).forEach((f, i) => f.classList.toggle("is-on", i < step));
      // a figure draws itself in once its slide has arrived, or once its own fragment lands
      now.querySelectorAll("[data-draw], [data-lit]").forEach((el) => {
        const own = el.closest(".frag");
        el.classList.toggle("is-drawn", !own || own.classList.contains("is-on"));
      });

      if (entered) {
        now.setAttribute("data-settling", "");
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => now.removeAttribute("data-settling"), SETTLE_MS);
      }

      dotsEl?.querySelectorAll(".presentation__dot").forEach((d, i) => {
        d.toggleAttribute("data-seen", i <= at);
        d.toggleAttribute("data-now", i === at);
      });
      gridEl?.querySelectorAll(".presentation__cell").forEach((c, i) => c.toggleAttribute("data-now", i === at));
      if (posEl) posEl.textContent = `${at + 1} / ${total}`;
      if (stripEl) stripEl.innerHTML = `<ul>${notesOf(now).map((n) => `<li>${n}</li>`).join("")}</ul>`;

      syncControls();
      deck.dispatchEvent(new CustomEvent("presentation:slide", {
        detail: { index: at, step, slide: now, title: now.dataset.title || "", entered, total },
      }));
      channel?.postMessage({ type: "state", at, step });
      if (deck.hasAttribute("data-hash")) history.replaceState(null, "", `#${at + 1}`);
    }

    function go(i, s = 0) {
      const next = Math.max(0, Math.min(total - 1, i));
      deck.dataset.dir = next < at ? "back" : "fwd";
      const entered = next !== at || !slides[at].hasAttribute("data-current");
      at = next; step = s;
      paint(entered);
    }
    function next() {
      if (step < steps(slides[at])) { step += 1; paint(false); return; }
      if (at < total - 1) go(at + 1, 0);
    }
    function prev() {
      if (step > 0) { step -= 1; paint(false); return; }
      if (at > 0) go(at - 1, steps(slides[at - 1]));
    }

    /* ---- chrome ------------------------------------------------------------ */
    if (dotsEl) {
      dotsEl.innerHTML = slides.map((s, i) =>
        `<button class="presentation__dot" type="button" data-to="${i}" title="${s.dataset.title || i + 1}">` +
        `<span class="sr-only">${i + 1}</span></button>`).join("");
    }
    if (gridEl) {
      gridEl.innerHTML = slides.map((s, i) =>
        `<button class="presentation__cell" type="button" data-to="${i}">` +
        `<span class="presentation__n">${String(i + 1).padStart(2, "0")}</span>` +
        `<p class="presentation__t">${s.dataset.title || ""}</p></button>`).join("");
    }
    /* the control cluster: the same moves the keys make, for a presenter whose hands are on a
       laptop, a reader at a desk, and a touch screen with no arrow keys at all */
    deck.addEventListener("click", (e) => {
      const to = e.target.closest("[data-to]");
      if (to) { deck.dataset.view = "slides"; go(Number(to.dataset.to), 0); return; }
      const ctl = e.target.closest("[data-ctl]");
      if (ctl) {
        switch (ctl.dataset.ctl) {
          case "prev": prev(); break;
          case "next": next(); break;
          case "notes": deck.toggleAttribute("data-notes"); requestAnimationFrame(fitAll); break;
          case "grid": deck.dataset.view = deck.dataset.view === "grid" ? "slides" : "grid"; break;
          case "presenter": window.open(`${location.pathname}?presenter=1`, "grain-presenter", "width=1100,height=760"); break;
          default: break;
        }
        syncControls();
        return;
      }
      if (e.target.closest("[data-present-toggle]")) togglePresent();
    });

    function syncControls() {
      const first = at === 0 && step === 0;
      const last = at === total - 1 && step >= steps(slides[at]);
      deck.querySelector('[data-ctl="prev"]')?.toggleAttribute("disabled", first);
      deck.querySelector('[data-ctl="next"]')?.toggleAttribute("disabled", last);
      deck.querySelector('[data-ctl="notes"]')
        ?.setAttribute("aria-pressed", String(deck.hasAttribute("data-notes")));
      deck.querySelector('[data-ctl="grid"]')
        ?.setAttribute("aria-pressed", String(deck.dataset.view === "grid"));
    }

    /* ---- keys -------------------------------------------------------------- */
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // a deck that is not presenting only claims the arrow keys; letters stay the app's
      const owns = deck.hasAttribute("data-present") || deck.contains(document.activeElement) || deck.hasAttribute("data-solo");
      switch (e.key) {
        case "ArrowRight": case "PageDown": case " ":
          if (typing(e)) return;
          e.preventDefault(); next(); break;
        case "ArrowLeft": case "PageUp":
          if (typing(e)) return;
          e.preventDefault(); prev(); break;
        case "ArrowUp": if (typing(e) || cedes(deck, "ArrowUp")) return; e.preventDefault(); go(at - 1, 0); break;
        case "ArrowDown": if (typing(e) || cedes(deck, "ArrowDown")) return; e.preventDefault(); go(at + 1, 0); break;
        case "Home": if (typing(e)) return; e.preventDefault(); go(0, 0); break;
        case "End": if (typing(e)) return; e.preventDefault(); go(total - 1, 0); break;
        case "Escape": deck.dataset.view = "slides"; if (deck.hasAttribute("data-present")) togglePresent(); break;
        default: break;
      }
      if (!owns || typing(e)) return;
      switch (e.key.toLowerCase()) {
        case "o": deck.dataset.view = deck.dataset.view === "grid" ? "slides" : "grid"; break;
        case "n": deck.toggleAttribute("data-notes"); requestAnimationFrame(fitAll); break;
        case "p": window.open(`${location.pathname}?presenter=1`, "grain-presenter", "width=1100,height=760"); break;
        case "f": togglePresent(); break;
        case "d": {
          const root = document.documentElement;
          const dark = root.dataset.colorScheme
            ? root.dataset.colorScheme === "dark"
            : matchMedia("(prefers-color-scheme: dark)").matches;
          root.dataset.colorScheme = dark ? "light" : "dark";
          break;
        }
        case ".": deck.style.visibility = deck.style.visibility === "hidden" ? "" : "hidden"; break;
        default: break;
      }
    });

    /* An app can claim a key for a slide's own control (the arrows on a guess marker, say) by
       setting data-cede="ArrowUp ArrowDown" on the current slide. The deck yields, nothing more. */
    function cedes(d, key) {
      const s = d.querySelector(".presentation__slide[data-current]");
      return !!s && (s.dataset.cede || "").split(/\s+/).includes(key);
    }

    function togglePresent() {
      const on = deck.toggleAttribute("data-present");
      if (on) document.documentElement.requestFullscreen?.().catch(() => { /* the deck is still full-bleed */ });
      else if (document.fullscreenElement) document.exitFullscreen();
      requestAnimationFrame(fitAll);
    }
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && deck.hasAttribute("data-present")) {
        deck.removeAttribute("data-present");
        requestAnimationFrame(fitAll);
      }
    });

    // touch: a swipe is an arrow key
    let x0 = null;
    deck.addEventListener("touchstart", (e) => { x0 = e.changedTouches[0].clientX; }, { passive: true });
    deck.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) (dx < 0 ? next : prev)();
      x0 = null;
    }, { passive: true });

    /* ---- print: land everything first, so Cmd+P is the real deck ----------- */
    addEventListener("beforeprint", () => {
      // print swaps --u's source to viewport units (see the component's @media print block), so
      // the fit pass has to run again under those rules or every slide prints at the screen's --fit
      fitAll();
      slides.forEach((s) => {
        frags(s).forEach((f) => f.classList.add("is-on"));
        s.querySelectorAll("[data-draw], [data-lit]").forEach((el) => el.classList.add("is-drawn"));
        s.removeAttribute("data-settling");
      });
      deck.dispatchEvent(new CustomEvent("presentation:print"));
    });

    /* ---- the presenter window ---------------------------------------------- */
    if (isPresenter) {
      document.body.dataset.mode = "presenter";
      const p = (sel) => document.querySelector(sel);
      let t0 = Date.now();
      const show = (i) => {
        const s = slides[i];
        if (p("[data-p-pos]")) p("[data-p-pos]").textContent = `${i + 1} / ${total}`;
        if (p("[data-p-title]")) p("[data-p-title]").textContent = s.dataset.title || "";
        if (p("[data-p-notes]")) p("[data-p-notes]").innerHTML = notesOf(s).map((n) => `<li>${n}</li>`).join("");
        if (p("[data-p-next]")) p("[data-p-next]").textContent = slides[i + 1]?.dataset.title || "End of deck";
      };
      channel?.addEventListener("message", (e) => { if (e.data?.type === "state") show(e.data.at); });
      addEventListener("keydown", (e) => {
        if (e.key === "t" || e.key === "T") t0 = Date.now();
        if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", " ", "Home", "End"].includes(e.key)) {
          channel?.postMessage({ type: "key", key: e.key });
        }
      });
      setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        const el = p("[data-p-clock]");
        if (!el) return;
        el.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        el.toggleAttribute("data-over", s > Number(deck.dataset.minutes || 20) * 60);
      }, 500);
      show(0);
    } else {
      channel?.addEventListener("message", (e) => {
        if (e.data?.type !== "key") return;
        const k = e.data.key;
        if (k === "ArrowRight" || k === " ") next();
        else if (k === "ArrowLeft") prev();
        else if (k === "ArrowUp") go(at - 1, 0);
        else if (k === "ArrowDown") go(at + 1, 0);
        else if (k === "Home") go(0, 0);
        else if (k === "End") go(total - 1, 0);
      });
    }

    /* ---- boot -------------------------------------------------------------- */
    addEventListener("resize", fitAll);
    if (document.fonts) document.fonts.ready.then(fitAll);
    // the deck may live in a pane that resizes without the window (a rail collapsing, say)
    if ("ResizeObserver" in window) new ResizeObserver(() => fitAll()).observe(deck);
    fitAll();
    const fromHash = Number(location.hash.slice(1));
    go(deck.hasAttribute("data-hash") && Number.isFinite(fromHash) && fromHash >= 1 ? fromHash - 1 : 0, 0);

    (window.grain ||= {}).presentation = { go, next, prev, fitAll, deck };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();