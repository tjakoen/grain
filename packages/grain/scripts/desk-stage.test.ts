// grain/scripts/desk-stage.test.ts — DRIFT GUARD for the desk stage island.
//
// Scope, stated honestly, as in drawer.test.ts: this package has no DOM in test, so these are
// grep-style contract guards. They catch a load-bearing rule being DELETED, which is the realistic
// regression. The behavior itself (the in view matches flat, state survives the round trip, the lamp
// flips the scheme, phones refuse) was driven in a real browser against a harness page; see the
// run report. A grep cannot prove an image looks right, and this does not claim to.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const js = readFileSync(join(import.meta.dir, "desk-stage.js"), "utf8");
const css = readFileSync(join(import.meta.dir, "..", "components/organisms/desk-stage/desk-stage.css"), "utf8");
const vars = readFileSync(join(import.meta.dir, "..", "styles/variables.css"), "utf8");

test("idempotent, like every grain island", () => {
  expect(js).toMatch(/if \(window\.grain && window\.grain\.deskStage\) return/);
});

test("the page is moved, never cloned: one live node keeps its state", () => {
  expect(js).toMatch(/world\.append\(buildRig\(\), page\)/);
  expect(js).not.toMatch(/cloneNode|outerHTML|innerHTML/);
});

test("the resting view costs the page nothing: contents or flow-root, rig not rendered", () => {
  expect(css).toMatch(/\.desk-stage\[data-view="flat"\] \.desk-stage__world \{ display: contents; \}/);
  expect(css).toMatch(/\.desk-stage\[data-view="flat"\] \.desk-stage__page \{ display: var\(--ds-flat-page\); \}/);
  expect(css).toMatch(/\.desk-stage\[data-view="flat"\] \.desk-stage__rig \{ display: none; \}/);
});

test("the in view maps the screen plane onto the viewport (the seamless-swap identity)", () => {
  expect(css).toMatch(/calc\(var\(--ds-P\) \* \(1 - var\(--ds-k\)\) \+ 38px\)/);
  expect(css).toMatch(/translate3d\(0, calc\(-1 \* var\(--ds-cy\)\)/);
});

test("the page is inert while staged and its scroll position is carried both ways", () => {
  expect(js).toMatch(/page\.inert = true/);
  expect(js).toMatch(/page\.inert = false/);
  expect(js).toMatch(/page\.scrollTop = y/);
  expect(js).toMatch(/window\.scrollTo\(0, y\)/);
  expect(css).toMatch(/overflow-anchor: none/);   // else the browser nudges scrollTop and the round trip drifts
});

test("phones refuse: gated on the --bp-phone token, toggles hidden, a staged page is returned to flat", () => {
  expect(js).toMatch(/--bp-phone/);
  expect(js).toMatch(/data-desk-stage-support", supported\(\) \? "on" : "off"/);
  expect(css).toMatch(/html:not\(\[data-desk-stage-support="on"\]\) \[data-desk-stage-toggle\] \{ display: none; \}/);   // no dead button if the script never ran
});

test("the support flag on <html> does not collide with the stage's own opt-in attribute", () => {
  // init() finds the stage with [data-desk-stage]; an attribute of the same name on <html> would
  // be matched first and the stage would silently never build (found on the real portfolio).
  expect(js).toMatch(/document\.querySelector\("\.desk-stage\[data-desk-stage\]"\)/);
  expect(js).not.toMatch(/setAttribute\("data-desk-stage", /);
});

test("reduced motion keeps the feature and drops the animation", () => {
  const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/);
  expect(block).not.toBeNull();
  expect(block![1]).toMatch(/transition-duration/);
  expect(block![1]).toMatch(/animation: none/);
});

test("the orbit is limited and springs back, so the view stays frontal", () => {
  expect(js).toMatch(/const ORBIT = \{/);
  expect(js).toMatch(/setAttribute\("data-settling", ""\)/);
});

test("the lamp is the only in-scene control and reuses grain's theme door when present", () => {
  expect(js).toMatch(/t\.toggleScheme\(\)/);
});

test("the shadows are the two stage tokens, defined for both schemes", () => {
  expect(css).toMatch(/var\(--stage-cast\)/);
  expect(css).toMatch(/var\(--stage-lit\)/);
  const defs = vars.match(/--stage-cast:/g) ?? [];
  expect(defs.length).toBeGreaterThanOrEqual(3);   // :root, the dark media query, the forced-dark attribute
});

test("planes that must not touch keep a gap: the floor sits under the plinth", () => {
  expect(css).toMatch(/var\(--ds-floor\) \+ 3px/);
});

test("boxes carry no bottom face (it would sit coplanar with what they stand on)", () => {
  expect(js).toMatch(/\["f", "b", "l", "r", "t"\]/);
});

test("the md documents what the stage cannot do", () => {
  const md = readFileSync(join(import.meta.dir, "..", "components/organisms/desk-stage/desk-stage.md"), "utf8");
  expect(md).toMatch(/## Limits/);
  expect(md).toMatch(/## Where it is off/);
  expect(md).toMatch(/Not in the vocabulary yet/);
});
