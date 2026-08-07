// grain/components/organisms/presentation/presentation.test.ts — DRIFT GUARD for the deck's CSS.
//
// Scope, stated honestly: this package has no DOM in test, so these are grep-style contract guards
// in the drawer.test.ts mould. They catch an obligation being DELETED, which is the realistic
// regression here, not one being subtly wrong. Whether a slide actually fits its box on a
// projector is measured in a browser against a consumer, and no assertion in this file claims
// otherwise.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const css = readFileSync(join(here, "presentation.css"), "utf8");
const md = readFileSync(join(here, "presentation.md"), "utf8");

test("every size is a multiple of --u, so a dense slide scales as one piece", () => {
  expect(css).toMatch(/--u:\s*calc\(var\(--u0\)\s*\*\s*var\(--fit/);
  // a raw px or rem font-size inside a slide would survive the fit pass and break the scaling
  const slideBlock = css.slice(css.indexOf(".presentation .slide-eyebrow"), css.indexOf(".presentation .sr-only"));
  expect(slideBlock).not.toMatch(/font-size:\s*\d+(\.\d+)?(px|rem)/);
});

test("the deck is its own container, or the container query units size against the page", () => {
  expect(css).toMatch(/\.presentation\s*\{[^}]*container-type:\s*size/);
  expect(css).toMatch(/--u0:\s*min\([\d.]+cqw,\s*[\d.]+cqh\)/);
});

test("a slide with no JS still renders: display is driven by [data-current]", () => {
  expect(css).toMatch(/\.presentation__slide\s*\{[^}]*display:\s*none/);
  expect(css).toMatch(/\.presentation__slide\[data-current\]\s*\{\s*display:\s*flex/);
});

test("fragments move opacity and transform only, never layout", () => {
  const frag = css.match(/\.presentation \.frag\s*\{([^}]*)\}/);
  expect(frag).not.toBeNull();
  expect(frag![1]).toMatch(/transition:\s*opacity[^;]*transform/);
  expect(frag![1]).not.toMatch(/display|height|margin|padding/);
});

test("the bar stacks above the slides, or a link in it is visible and dead", () => {
  // the bar is the first child and a slide is inset:0 with z-index auto, so the slide wins the
  // paint order and swallows the clicks. It looks fine, because slides are transparent.
  const bar = css.match(/\.presentation__bar\s*\{([^}]*)\}/);
  expect(bar).not.toBeNull();
  expect(bar![1]).toMatch(/z-index:\s*[1-9]/);
});

test("speaker notes never render on the slide itself", () => {
  expect(css).toMatch(/\.presentation__slide \.slide-notes\s*\{\s*display:\s*none/);
});

test("print lands the figures and re-derives the unit from the page, not the screen", () => {
  const printBlock = css.slice(css.indexOf("@media print"));
  expect(printBlock).toMatch(/--u0:\s*min\([\d.]+vw,\s*[\d.]+vh\)/);
  expect(printBlock).toMatch(/\.presentation \.frag\s*\{\s*opacity:\s*1\s*!important/);
  expect(printBlock).toMatch(/\[data-draw\]\s*\{\s*stroke-dashoffset:\s*0\s*!important/);
  expect(printBlock).toMatch(/page-break-after:\s*always/);
});

test("the chrome is hidden in print, so a printed deck is slides and nothing else", () => {
  const printBlock = css.slice(css.indexOf("@media print"));
  for (const part of ["__dots", "__controls", "__notes", "__grid", "__bar"]) {
    expect(printBlock).toContain(`.presentation${part}`);
  }
});

test("arrival does not re-face type, and the .md says why", () => {
  // a consumer may style [data-settling]; the component must not ship the swap itself
  expect(css).not.toMatch(/\[data-settling\][^{]*\{[^}]*font-family/);
  expect(md).toMatch(/data-settling/);
});

test("the .md documents the one seam an app is allowed to use", () => {
  expect(md).toMatch(/presentation:slide/);
  expect(md).toMatch(/presentation:print/);
  expect(md).toMatch(/entered/);
});

test("no em-dashes and no hardcoded colors, per the standards this package follows", () => {
  expect(css).not.toContain("\u2014");
  expect(md).not.toContain("\u2014");
  expect(css).not.toMatch(/:\s*#[0-9a-fA-F]{3,8}\b/);
});
