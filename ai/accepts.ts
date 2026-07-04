// /framework/render/accepts.ts — harvest component-declared affordances.
//
// Scans each component's .html for `data-kind` + `data-accepts` and returns a
// kind → action-names map. This is the single source the AI manifest reads, so it
// can't drift from what the components actually expose (docs/AI-INTERFACE.md §4).
// Generic: it knows nothing about the app's specific verbs or surfaces.
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const KIND = /\bdata-kind=["']([^"']+)["']/;
const ACCEPTS = /\bdata-accepts=["']([^"']+)["']/;
// every wired trigger (global — a component may have several). The negative lookbehind skips
// the BINDING directive `data-bind-data-action="path"` (a bound view-model field, not a literal verb).
const ACTION = /(?<![-\w])data-action="([^"]+)"/g;

interface Harvest {
  byKind: Record<string, string[]>;
  actions: string[];              // distinct verbs any component WIRES via data-action
}

export interface Accepts {
  /** kind → declared action names, e.g. { item: ["item.archive"] }. */
  byKind(): Record<string, string[]>;
  /** every distinct verb wired via `data-action` in a component template (drift-guarded in server.ts). */
  actions(): string[];
  refresh(): void;
}

export function createAccepts(componentsDir: string | string[]): Accepts {
  let cache: Harvest | null = null;

  function build(): Harvest {
    const byKind: Record<string, string[]> = {};
    const actions = new Set<string>();
    function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!e.name.endsWith(".html")) continue;
        const html = readFileSync(full, "utf8");
        const kind = KIND.exec(html)?.[1];
        const accepts = ACCEPTS.exec(html)?.[1];
        if (kind && accepts) byKind[kind] = accepts.split(/\s+/).filter(Boolean);
        else if (kind) console.warn(`[accepts] ${full}: data-kind="${kind}" found but no data-accepts — kind excluded from manifest`);
        for (const m of html.matchAll(ACTION)) actions.add(m[1]);   // data-action="verb" on any control
      }
    }
    for (const root of ([] as string[]).concat(componentsDir)) walk(root);   // one or many roots
    return { byKind, actions: [...actions] };
  }

  return {
    byKind() { return (cache ??= build()).byKind; },
    actions() { return (cache ??= build()).actions; },
    refresh() { cache = null; },
  };
}
