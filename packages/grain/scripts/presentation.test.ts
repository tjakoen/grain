// grain/scripts/presentation.test.ts — DRIFT GUARD for the presentation island.
//
// Scope, stated honestly: this package has no DOM in test (zero runtime deps, and a hand-rolled
// fake would test the fake), so these are grep-style contract guards in the drawer.test.ts mould.
// They catch an obligation being DELETED, which is the realistic regression. Whether the fit pass
// actually stops a slide overflowing on a projector is measured in a browser against a consumer,
// and nothing in this file claims otherwise.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const js = readFileSync(join(here, "presentation.js"), "utf8");

test("mounting is opt-in on [data-deck], so decks in a page don't get claimed by accident", () => {
  expect(js).toMatch(/querySelectorAll\("\.presentation\[data-deck\]"\)/);
});

test("it is idempotent, like the other islands: a second load is a no-op", () => {
  expect(js).toMatch(/if \(window\.grain && window\.grain\.presentation\) return/);
});

test("the seam is one event carrying enough for an app to drive its own figures", () => {
  expect(js).toMatch(/new CustomEvent\("presentation:slide"/);
  for (const key of ["index", "step", "slide", "title", "entered", "total"]) {
    expect(js).toMatch(new RegExp(`\\b${key}\\b`));
  }
});

test("the fit pass measures the WORST case: expandable cards open", () => {
  // clicking a card on stage must never overflow a slide that fit a moment ago
  expect(js).toMatch(/aria-expanded="false"/);
  expect(js).toMatch(/setAttribute\("aria-expanded", "true"\)/);
});

test("the fit pass has a floor, so a runaway slide cannot loop forever", () => {
  expect(js).toMatch(/while \(f > 0\.\d+ && body\.scrollHeight > room\(\)\)/);
});

test("print lands every fragment and figure first, then tells the app to do the same", () => {
  const printBlock = js.slice(js.indexOf('addEventListener("beforeprint"'));
  expect(printBlock).toMatch(/classList\.add\("is-on"\)/);
  expect(printBlock).toMatch(/classList\.add\("is-drawn"\)/);
  expect(printBlock).toMatch(/new CustomEvent\("presentation:print"\)/);
  // print swaps the unit's source, so the fit pass has to run again under those rules
  expect(printBlock).toMatch(/fitAll\(\)/);
});

test("a slide can claim a key back from the deck with data-cede", () => {
  expect(js).toMatch(/dataset\.cede/);
  expect(js).toMatch(/function cedes/);
});

test("the presenter window is the same page, synced, and never shown to the room", () => {
  expect(js).toMatch(/presenter=1/);
  expect(js).toMatch(/BroadcastChannel/);
  expect(js).toMatch(/postMessage\(\{ type: "key"/);
});

test("the D key defers to grain's theme control, so it persists like the button", () => {
  // flipping data-color-scheme here as well looks identical and forgets the choice the moment
  // you leave the deck, which is how the key and the button came to disagree
  const block = js.slice(js.indexOf('case "d"'), js.indexOf('case "."'));
  expect(block).toMatch(/querySelector\("\[data-toggle-scheme\]"\)/);
  expect(block).toMatch(/ctl\.click\(\)/);
  // the standalone fallback stays, for a deck on a page with no theme island
  expect(block).toMatch(/root\.dataset\.colorScheme = dark \? "light" : "dark"/);
});

test("typing in a field never moves the deck", () => {
  expect(js).toMatch(/INPUT\|TEXTAREA\|SELECT/);
  expect(js).toMatch(/isContentEditable/);
});

test("the fit pass re-runs on resize and on fonts loading, not once at boot", () => {
  expect(js).toMatch(/addEventListener\("resize", fitAll\)/);
  expect(js).toMatch(/document\.fonts.*fitAll/s);
  expect(js).toMatch(/ResizeObserver/);
});

test("the public seam is small and named, and there is no back channel into the deck", () => {
  expect(js).toMatch(/\(window\.grain \|\|= \{\}\)\.presentation = \{ go, next, prev, fitAll, deck \}/);
});

test("no em-dashes, per the standards this package follows", () => {
  expect(js).not.toContain("—");
});
