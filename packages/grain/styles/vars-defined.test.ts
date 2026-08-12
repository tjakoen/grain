// grain/styles/vars-defined.test.ts — the guard that plans/grain-token-debt.md G3 asks for: every
// custom property a stylesheet READS has to be one some stylesheet DEFINES.
//
// Why this exists, concretely. crumb.css shipped five references that were defined nowhere in grain
// or crumb: --accent, --font-ui, --ink-soft, --ok and --warn. Nothing failed, nothing warned, and
// two of them rendered — `var(--ok, green)` and `var(--warn, orange)` put a literal green and a
// literal orange on screen inside a palette that collapses every status to ink on purpose. They
// survived an audit and a release because CSS has no undefined-variable error: it takes the
// fallback and says nothing.
//
// So the fallback is NOT an excuse here, it is the aggravating factor. `var(--nope)` renders as
// nothing and someone notices within the hour; `var(--nope, green)` renders as green and ships. A
// reference with a fallback is held to exactly the same bar as one without, which is the only rule
// that would have caught the five.
//
// Scope is the whole package set rather than one package, because the vocabulary is shared: grain
// defines the tokens and crumb, mill and proof spend them. A per-package check would have called
// crumb's references "external" and passed.
import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const PACKAGES = join(import.meta.dir, "..", "..");

// Directories that hold no shipped styling: dependencies, build output, and anything a package
// generates. A stylesheet under any of these is not ours to hold to the vocabulary.
const SKIP = new Set(["node_modules", "dist", "build", ".git", "coverage"]);

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) cssFiles(full, out);
    else if (e.name.endsWith(".css")) out.push(full);
  }
  return out;
}

// A DEFINITION is `--name:` in declaration position. A reference inside a value never matches,
// because `var(--x)` and `var(--x, y)` put a `)` or a `,` after the name, never a `:`.
const DEFINE = /(?:^|[;{\s])(--[a-zA-Z0-9_-]+)\s*:/g;
const REFERENCE = /var\(\s*(--[a-zA-Z0-9_-]+)/g;

// The two honest reasons a reference has no declaration, each with the receipt that makes it
// checkable. Adding a name here without one turns this guard back into the thing it replaced.
//
// 1. WRITTEN AT RUNTIME — a script sets it with style.setProperty, so no stylesheet can declare it.
// 2. AN INSTANCE KNOB — the component publishes it as a per-use parameter the CALLER supplies
//    inline (`style="--seg: 70%"`), documented in that component's .md. The fallback in the
//    stylesheet is the documented default, which is the one case where a fallback is the design
//    rather than a cover for a missing token.
const EXTERNALLY_SET = new Map<string, string>([
  ["--cmdk-top",       "runtime: grain/scripts/cmdk.js:116,130 setProperty"],
  ["--cmdk-left",      "runtime: grain/scripts/cmdk.js setProperty"],
  ["--cmdk-width",     "runtime: grain/scripts/cmdk.js setProperty"],
  ["--seg",            "instance knob: components/atoms/b-meter/b-meter.md:5,16"],
  ["--card-min",       "instance knob: components/molecules/card/card.md:4"],
  ["--gallery-min",    "instance knob: components/molecules/gallery/gallery.md:8,48"],
  ["--gallery-ratio",  "instance knob: components/molecules/gallery/gallery.md:8,48"],
  ["--media-ratio",    "instance knob: components/molecules/media-card/media-card.md:6,76"],
  ["--rail-icon-col",  "instance knob: components/molecules/nav-item/nav-item.md:4"],
  ["--draw-len",       "instance knob: components/organisms/presentation/presentation.md:82"],
]);
const SET_IN_JS = new Set<string>(EXTERNALLY_SET.keys());

// Comments are blanked, not deleted, so line numbers survive for the report. This is not a nicety:
// the first run of this check reported --ok and --warn as still-undefined in crumb.css, and they
// were, in a comment explaining that they had just been removed. A checker that reads prose finds
// defects that are not there, which costs more trust than the ones it catches.
const decomment = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function scan(re: RegExp, src: string): string[] {
  const found: string[] = [];
  for (const m of src.matchAll(re)) found.push(m[1]);
  return found;
}

test("every var(--token) a stylesheet reads is defined by some stylesheet", () => {
  const files = cssFiles(PACKAGES);
  expect(files.length).toBeGreaterThan(0);          // a silent empty sweep would pass forever

  const defined = new Set<string>(SET_IN_JS);
  for (const f of files) for (const name of scan(DEFINE, decomment(readFileSync(f, "utf8")))) defined.add(name);

  const undefinedRefs: string[] = [];
  for (const f of files) {
    const src = decomment(readFileSync(f, "utf8"));
    src.split("\n").forEach((line, i) => {
      for (const name of scan(REFERENCE, line)) {
        if (!defined.has(name)) undefinedRefs.push(`${relative(PACKAGES, f)}:${i + 1}: ${name}`);
      }
    });
  }
  expect([...new Set(undefinedRefs)]).toEqual([]);
});
