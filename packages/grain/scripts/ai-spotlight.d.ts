// Types for the hand-authored browser module ai-spotlight.js (THE TRAVELING LAMP). Lets TS
// consumers (the colocated test; CRUMB's tour client) import it without `any`. Keep in sync with
// the module's exports — the .js stays the SSOT (no build step).

/** A client rect the passthrough hole is cut from (the lamp's on-screen geometry). */
export interface LampRect { left: number; top: number; width: number; height: number; }

/**
 * The backdrop's click-catch clip: "the whole viewport EXCEPT `hole`", as a slit polygon, so the
 * lit target stays clickable in passthrough mode. `null`/`undefined` → "" (full-cover backdrop).
 */
export function backdropClip(hole: LampRect | null | undefined): string;

export interface Spotlight {
  on(text?: string): void;
  move(el: Element | null, opts?: { click?: boolean }): void;
  pulse(el: Element | null): void;
  off(): void;
  isOn(): boolean;
}

/** The one traveling lamp. `passthrough` cuts a click-through hole at the lit target (CRUMB). */
export function createSpotlight(opts?: { onInterrupt?: () => void; passthrough?: boolean }): Spotlight;
