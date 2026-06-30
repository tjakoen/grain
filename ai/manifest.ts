// /app/ai/manifest.ts — the AI's instruction manual, per screen.
//
// A machine-readable projection of what's addressable (targets) and invokable
// (actions) on a screen, plus the in-view state the reasoner needs (MVP steps 2–4).
// The AI reads this; it is never hand-maintained against the UI.
//
// Accepts are HARVESTED from components (data-accepts) and inverted from the action
// registry — never hand-typed — so the manifest provably can't drift from what's on
// screen or from the allowed vocabulary. See AI-INTERFACE §4 and framework/render/accepts.ts.

import type { ActionName } from "./contract.ts";
import { ACTIONS } from "./contract.ts";

export interface ManifestTarget {
  id: string;            // a surface address, e.g. "item:ITM-1"
  kind: string;          // "item"
  accepts: ActionName[]; // verbs valid on this target right now
}

export interface Manifest {
  screen: string;
  actions: Array<{ name: ActionName; depth: string; accepts: string[] }>;
  targets: ManifestTarget[];
  inView: Record<string, unknown>;
  note: string;
}

export function buildManifest(
  screen: string,
  targets: ManifestTarget[],
  inView: Record<string, unknown> = {},
): Manifest {
  return {
    screen,
    actions: Object.values(ACTIONS).map((a) => ({ name: a.name, depth: a.depth, accepts: a.accepts })),
    targets,
    inView,
    note: "Accepts are derived, never hand-typed: item targets are harvested from the " +
          "component's data-accepts; regions are inverted from the action registry. So the " +
          "manifest can't drift from the UI or the allowed vocabulary (AI-INTERFACE §4).",
  };
}
