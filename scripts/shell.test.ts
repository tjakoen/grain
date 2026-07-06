// grain/scripts/shell.test.ts — DRIFT GUARD for the app-shell island. shell.js is a browser module
// (no DOM in bun; its behavior lives in the e2e). Here we guard the persistence CONTRACTS it relies
// on: the dotted house keys, and that every localStorage touch is wrapped in try/catch so private
// mode never throws. The console open-state persister is a single observer (three writers, one sink).
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const js = readFileSync(join(import.meta.dir, "shell.js"), "utf8");

test("persists the console open-state under grain.shell.console-open via one observer", () => {
  expect(js).toMatch(/"grain\.shell\.console-open"/);
  // restore on boot + observe the attribute at the source (captures all three writers)
  expect(js).toMatch(/getItem\(CONSOLE_KEY\)\s*===\s*"1"/);
  expect(js).toMatch(/attributeFilter:\s*\["data-console-open"\]/);
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
