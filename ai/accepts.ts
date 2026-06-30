// /framework/render/accepts.ts — harvest component-declared affordances.
//
// Scans each component's .html for `data-kind` + `data-accepts` and returns a
// kind → action-names map. This is the single source the AI manifest reads, so it
// can't drift from what the components actually expose (docs/AI-INTERFACE.md §4).
// Generic: it knows nothing about the app's specific verbs or surfaces.
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const KIND = /\bdata-kind="([^"]+)"/;
const ACCEPTS = /\bdata-accepts="([^"]+)"/;

export interface Accepts {
  /** kind → declared action names, e.g. { item: ["item.archive"] }. */
  byKind(): Record<string, string[]>;
  refresh(): void;
}

export function createAccepts(componentsDir: string | string[]): Accepts {
  let cache: Record<string, string[]> | null = null;

  function build(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!e.name.endsWith(".html")) continue;
        const html = readFileSync(full, "utf8");
        const kind = KIND.exec(html)?.[1];
        const accepts = ACCEPTS.exec(html)?.[1];
        if (kind && accepts) out[kind] = accepts.split(/\s+/).filter(Boolean);
      }
    }
    for (const root of ([] as string[]).concat(componentsDir)) walk(root);   // one or many roots
    return out;
  }

  return {
    byKind() { return (cache ??= build()); },
    refresh() { cache = null; },
  };
}
