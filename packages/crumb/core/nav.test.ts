// crumb/core/nav.test.ts — the navigation decision, including the reload loop it was written to end.
import { test, expect } from "bun:test";
import { routeOf, needsNavigation, type Here } from "./nav.ts";

const here = (pathname: string, search = "", hash = ""): Here => ({ pathname, search, hash });

test("routeOf drops trailing slashes and keeps the root", () => {
  expect(routeOf("/")).toBe("/");
  expect(routeOf("/notes/")).toBe("/notes");
  expect(routeOf("/notes//")).toBe("/notes");
  expect(routeOf("/notes")).toBe("/notes");
});

test("a different pathname navigates", () => {
  expect(needsNavigation("/mail", here("/notes"))).toBe(true);
  expect(needsNavigation("/mail", here("/mail"))).toBe(false);
  expect(needsNavigation("/mail/", here("/mail"))).toBe(false);
});

test("a target that declares query state navigates once, then settles (the reload loop)", () => {
  // before: routeOf("/mail?subject=grain") never equalled routeOf("/mail"), so every resume()
  // assigned again and the page reloaded forever.
  expect(needsNavigation("/mail?subject=grain", here("/mail"))).toBe(true);
  expect(needsNavigation("/mail?subject=grain", here("/mail", "?subject=grain"))).toBe(false);
  expect(needsNavigation("/notes#figure", here("/notes"))).toBe(true);
  expect(needsNavigation("/notes#figure", here("/notes", "", "#figure"))).toBe(false);
});

test("a target that declares nothing leaves the host's own params alone", () => {
  // the linkable-tour contract: ?crumb=<id> is consumed on arrival but a host's own params stay,
  // so a step with a bare `at` must not navigate them away.
  expect(needsNavigation("/notes", here("/notes", "?tag=ai"))).toBe(false);
  expect(needsNavigation("/notes", here("/notes", "", "#top"))).toBe(false);
});

test("a target whose declared query differs from the current one navigates", () => {
  expect(needsNavigation("/mail?subject=grain", here("/mail", "?subject=batch"))).toBe(true);
  expect(needsNavigation("/mail?subject=grain", here("/mail", "?subject=grain&ref=x"))).toBe(true);
});
