// /app/ai/manifest.ts — the AI's instruction manual, per screen.
//
// A machine-readable projection of what's addressable (targets) and invokable
// (actions) on a screen, plus the in-view state the reasoner needs (MVP steps 2–4).
// The AI reads this; it is never hand-maintained against the UI.
//
// Accepts are HARVESTED from components (data-accepts) and inverted from the action
// registry — never hand-typed — so the manifest provably can't drift from what's on
// screen or from the allowed vocabulary. See AI-INTERFACE §4 and framework/render/accepts.ts.

import type { ActionName, PayloadSchema } from "./contract.ts";
import { ACTIONS } from "./contract.ts";

export interface ManifestTarget {
  id: string;            // a surface address, e.g. "item:ITM-1"
  kind: string;          // "item"
  accepts: ActionName[]; // verbs valid on this target right now
}

// Each advertised action carries its full calling contract: not just name + where it applies,
// but a one-line description and the payload schema — so a reasoner reading the manifest knows
// HOW to invoke it, not merely that it exists (AI-INTERFACE §1b, §4).
export interface ManifestAction {
  name: ActionName;
  depth: string;
  accepts: string[];
  description: string;
  payload: PayloadSchema;
}

export interface Manifest {
  screen: string;
  actions: ManifestAction[];
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
    actions: Object.values(ACTIONS).map((a) => ({
      name: a.name, depth: a.depth, accepts: a.accepts, description: a.description, payload: a.payload,
    })),
    targets,
    inView,
    note: "Accepts are derived, never hand-typed: item targets are harvested from the " +
          "component's data-accepts; regions are inverted from the action registry. So the " +
          "manifest can't drift from the UI or the allowed vocabulary (AI-INTERFACE §4).",
  };
}
