// grain/scripts/shell.test.ts — DRIFT GUARD for the app-shell island. shell.js is a browser module
// (no DOM in bun; its behavior lives in the e2e). Here we guard the persistence CONTRACTS it relies
// on: the dotted house keys, and that every localStorage touch is wrapped in try/catch so private
// mode never throws. The console open-state persister is a single observer (three writers, one sink).
import { test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const js = readFileSync(join(import.meta.dir, "shell.js"), "utf8");

// grain root = one level up from scripts/. Walk it for CSS the shell attributes drive.
const grainRoot = join(import.meta.dir, "..");
function allCss(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(dir, f));
}

test("persists the console open-state under grain.shell.console-open via one observer", () => {
  expect(js).toMatch(/"grain\.shell\.console-open"/);
  // restore on boot + observe the attribute at the source (captures all three writers)
  expect(js).toMatch(/getItem\(CONSOLE_KEY\)\s*===\s*"1"/);
  expect(js).toMatch(/attributeFilter:\s*\["data-console-open"\]/);
});

// DEAD-KNOB GUARD (grain lesson 9; terminal-expand regressed in adede03). toggleAttribute() sets the
// attribute to "", which never equals "true" — so a value-form CSS selector [x="true"] for a toggled
// attribute never matches and the control flips while nothing moves. A boolean state must pick ONE
// idiom and match both sides: presence (toggleAttribute ↔ [x]) OR value (setAttribute ↔ [x="true"]).
test("no dead knobs: attrs set via toggleAttribute() have no value-form CSS selector", () => {
  const toggled = [...js.matchAll(/toggleAttribute\("([a-z-]+)"/g)].map((m) => m[1]);
  expect(toggled.length).toBeGreaterThan(0); // guard the guard: shell.js does toggle things

  const css = allCss(grainRoot).map((f) => readFileSync(f, "utf8")).join("\n");
  for (const attr of toggled) {
    const valueForm = new RegExp(`\\[${attr}="`);
    expect(css, `${attr} is presence-toggled but a CSS selector uses value form [${attr}="…"] — dead knob`)
      .not.toMatch(valueForm);
  }
});

test("every localStorage write is guarded by try/catch (private mode never throws)", () => {
  // no bare setItem outside a try block
  for (const m of js.matchAll(/localStorage\.setItem/g)) {
    const before = js.slice(0, m.index);
    const lastTry = before.lastIndexOf("try");
    const lastCatch = before.lastIndexOf("catch");
    expect(lastTry).toBeGreaterThan(lastCatch);   // inside an open try { … }
  }
});
