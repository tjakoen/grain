const markup = `
  <dialog aria-labelledby="sheet-heading">
    <div class="track">
      <div class="spacer" aria-hidden="true"></div>
      <section class="sheet">
        <div class="handle" aria-hidden="true"><span></span></div>
        <header>
          <h2 id="sheet-heading" tabindex="-1" autofocus></h2>
          <button type="button"></button>
        </header>
        <div class="body"><slot></slot></div>
      </section>
    </div>
  </dialog>
`;

const styles = `
  :host { display: contents; }

  dialog {
    position: fixed;
    inset: var(--sheet-viewport-top, 0px) 0 auto;
    box-sizing: border-box;
    inline-size: 100%;
    block-size: var(--sheet-viewport-height, 100vh);
    max-inline-size: none;
    max-block-size: none;
    margin: 0;
    padding: 0;
    border: 0;
    overflow: hidden;
    background: transparent;
    color: var(--color-fg, CanvasText);
    font: var(--pwa-text-body, 1rem) / var(--leading-relaxed, 1.5)
      var(--type-font, system-ui);
  }

  @supports (height: 100dvh) {
    dialog { block-size: var(--sheet-viewport-height, 100dvh); }
  }

  dialog::backdrop {
    background: var(--scrim, CanvasText);
  }

  .track {
    --sheet-top-gap: max(16px, var(--safe-top, env(safe-area-inset-top, 0px)));
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    block-size: 100%;
    padding-inline-start: max(8px, var(--safe-left, env(safe-area-inset-left, 0px)));
    padding-inline-end: max(8px, var(--safe-right, env(safe-area-inset-right, 0px)));
    overflow: hidden auto;
    overscroll-behavior-y: contain;
    scroll-snap-type: y mandatory;
    overflow-anchor: none;
    scrollbar-width: none;
  }

  :host(:dir(rtl)) .track {
    padding-inline-start: max(8px, var(--safe-right, env(safe-area-inset-right, 0px)));
    padding-inline-end: max(8px, var(--safe-left, env(safe-area-inset-left, 0px)));
  }

  .track::-webkit-scrollbar { display: none; }

  .spacer {
    flex: 0 0 100%;
    inline-size: 100%;
    scroll-snap-align: start;
  }

  .sheet {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    inline-size: min(100%, var(--sheet-max, 40rem));
    max-block-size: max(0px, calc(100% - var(--sheet-top-gap)));
    padding-block-end: var(--safe-bottom, env(safe-area-inset-bottom, 0px));
    border: 1px solid var(--color-line, ButtonText);
    border-radius: var(--radius-sheet, 24px) var(--radius-sheet, 24px) 0 0;
    overflow: hidden;
    background: var(--pwa-material-solid, var(--color-surface, Canvas));
    box-shadow: var(--pwa-shadow, none);
    scroll-snap-align: end;
  }

  .handle {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    min-block-size: var(--pwa-target-min, 44px);
    touch-action: pan-y pinch-zoom;
    -webkit-user-select: none;
    user-select: none;
  }

  .handle span {
    inline-size: 32px;
    block-size: 4px;
    border-radius: 4px;
    background: var(--color-line, ButtonText);
  }

  header {
    display: flex;
    flex: 0 0 auto;
    align-items: start;
    justify-content: space-between;
    gap: var(--space-2, 8px);
    padding-inline: var(--space-4, 16px);
  }

  h2 {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: var(--pwa-text-title, 1.25rem);
    line-height: var(--line-title, 1.2);
  }

  button {
    min-inline-size: var(--pwa-target-min, 44px);
    min-block-size: var(--pwa-target-min, 44px);
    max-inline-size: 50%;
    padding-inline: var(--space-2, 8px);
    border: 1px solid var(--color-line, ButtonText);
    border-radius: var(--radius-control, 12px);
    background: var(--color-bg, ButtonFace);
    color: var(--color-fg, ButtonText);
    font: inherit;
    overflow-wrap: anywhere;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform var(--pwa-duration-press, 100ms) var(--pwa-ease-decelerate, ease-out);
  }

  button:active { transform: scale(var(--pwa-press-scale, .98)); }

  :focus-visible {
    outline: 2px solid var(--color-fg, Highlight);
    outline-offset: -2px;
  }

  .body {
    min-block-size: 0;
    overflow: auto;
    overscroll-behavior-y: contain;
    padding: var(--space-4, 16px);
  }

  @media (max-height: 320px) {
    .handle { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .track { scroll-behavior: auto; }
    button { transition: none; }
    button:active { transform: none; }
  }
`;

export class UiSheet extends HTMLElement {
  static styleNonce = "";
  static observedAttributes = ["heading", "close-label"];

  #dialog;
  #track;
  #heading;
  #button;
  #opener;
  #viewport;
  #settleTimer;
  #active = false;
  #reason = "native";

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const template = document.createElement("template");
    template.innerHTML = markup;
    const style = document.createElement("style");
    if (UiSheet.styleNonce) style.nonce = UiSheet.styleNonce;
    style.textContent = styles;
    root.append(style, template.content.cloneNode(true));

    this.#dialog = root.querySelector("dialog");
    this.#track = root.querySelector(".track");
    this.#heading = root.querySelector("h2");
    this.#button = root.querySelector("button");

    this.#button.addEventListener("click", () => this.close("button"));
    this.#dialog.addEventListener("cancel", event => {
      event.preventDefault();
      this.close("cancel");
    });
    this.#dialog.addEventListener("close", this.#finishClose);
    this.#track.addEventListener("click", event => {
      if (event.target.classList.contains("spacer")) this.close("backdrop");
    });

    if ("onscrollend" in this.#track) {
      this.#track.addEventListener("scrollend", this.#checkDismiss);
    } else {
      this.#track.addEventListener("scroll", () => {
        clearTimeout(this.#settleTimer);
        this.#settleTimer = setTimeout(this.#checkDismiss, 160);
      }, { passive: true });
    }

    this.#updateLabels();
  }

  attributeChangedCallback() {
    this.#updateLabels();
  }

  disconnectedCallback() {
    this.close("disconnect");
    this.#stopWatchingViewport();
  }

  get open() {
    return this.#dialog.open;
  }

  show(opener = this.getRootNode().activeElement) {
    if (!this.isConnected || this.#active ||
        typeof this.#dialog.showModal !== "function") return false;

    this.#dialog.returnValue = "";
    this.#opener = opener;
    this.#reason = "native";
    this.#active = true;

    try {
      this.#dialog.showModal();
    } catch (error) {
      this.#active = false;
      this.#opener = null;
      if (error.name === "InvalidStateError") return false;
      throw error;
    }

    this.#viewport = this.ownerDocument.defaultView.visualViewport;
    this.#viewport?.addEventListener("resize", this.#syncViewport);
    this.#viewport?.addEventListener("scroll", this.#syncViewport);
    this.#syncViewport();

    this.#heading.focus({ preventScroll: true });
    this.#track.scrollTop = this.#track.scrollHeight;
    return true;
  }

  close(reason = "programmatic") {
    if (!this.#dialog.open) return;
    this.#reason = String(reason);
    this.#dialog.close(this.#reason);
  }

  #updateLabels() {
    this.#heading.textContent = this.getAttribute("heading")?.trim() || "Options";
    this.#button.textContent = this.getAttribute("close-label")?.trim() || "Close";
  }

  #checkDismiss = () => {
    const { scrollTop, scrollHeight, clientHeight } = this.#track;
    if (this.open && scrollHeight - clientHeight > 2 && scrollTop <= 2) {
      this.close("swipe");
    }
  };

  #syncViewport = () => {
    const viewport = this.#viewport;
    if (viewport && Math.abs(viewport.scale - 1) < .01) {
      this.#dialog.style.setProperty("--sheet-viewport-top", viewport.offsetTop + "px");
      this.#dialog.style.setProperty("--sheet-viewport-height", viewport.height + "px");
    } else {
      this.#dialog.style.removeProperty("--sheet-viewport-top");
      this.#dialog.style.removeProperty("--sheet-viewport-height");
    }
  };

  #stopWatchingViewport() {
    this.#viewport?.removeEventListener("resize", this.#syncViewport);
    this.#viewport?.removeEventListener("scroll", this.#syncViewport);
    this.#viewport = null;
  }

  #finishClose = () => {
    clearTimeout(this.#settleTimer);
    this.#stopWatchingViewport();
    this.#active = false;
    const opener = this.#opener;
    this.#opener = null;

    if (opener?.isConnected && typeof opener.focus === "function") {
      const active = opener.getRootNode().activeElement;
      if (!active || active === this || active === this.ownerDocument.body) {
        opener.focus({ preventScroll: true });
      }
    }

    this.dispatchEvent(new CustomEvent("sheet-close", {
      bubbles: true,
      composed: true,
      detail: { reason: this.#reason, returnValue: this.#dialog.returnValue }
    }));
  };
}

if (!customElements.get("ui-sheet")) customElements.define("ui-sheet", UiSheet);
