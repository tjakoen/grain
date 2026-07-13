// grain/components/organisms/app-shell/app-shell.test.ts — DRIFT GUARD for the 2026-07-14
// responsive-polish fix. `.app-shell` can never legally `@container`-query a condition on itself
// (CSS containment spec: a container never matches its own query, only a descendant's), so its two
// real layout breakpoints (and the sibling shell files that share the same mobile boundary:
// sidebar-panel's bottom sheet, status-bar's narrow trim) moved from `@media (max-width: …)` — which
// only ever reads the real browser viewport, so the shell's own viewport-toggle clamp never
// triggered them (grain lesson: a documented behavior the mechanism can't render is worse than none)
// — to `@container shell-frame (max-width: …)`, a named container established on `<body>`. This test
// is the grep-style guard (lesson 5): it fails the build the moment any of these files regress back
// to a self-defeating `@media` layout breakpoint, rather than relying on a human to notice the shell
// silently stopped responding to its own preview toggle again.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const appShellCss = read("components/organisms/app-shell/app-shell.css");
const appWindowCss = read("components/organisms/app-window/app-window.css");
const sidebarPanelCss = read("components/organisms/sidebar-panel/sidebar-panel.css");
const statusBarCss = read("components/organisms/status-bar/status-bar.css");
const shellJs = read("scripts/shell.js");

// a max-width/min-width @media that ISN'T prefers-reduced-motion — i.e. a real layout breakpoint.
const MEDIA_LAYOUT_BP = /@media\s*\([^)]*(?:max|min)-width[^)]*\)/g;

test("app-shell.css establishes the shell-frame container on <body>, not on .app-shell itself", () => {
  // scoped with :has() so pages without a shell are untouched; named so descendants (app-shell +
  // sidebar-panel + status-bar) all resolve against the SAME container regardless of future nesting.
  expect(appShellCss).toMatch(/body:has\(\.app-shell\)\s*\{[^}]*container-type:\s*inline-size/);
  expect(appShellCss).toMatch(/body:has\(\.app-shell\)\s*\{[^}]*container-name:\s*shell-frame/);
});

test("app-shell.css's own layout breakpoints are @container, not @media (the self-query trap)", () => {
  expect(appShellCss).not.toMatch(MEDIA_LAYOUT_BP);
  expect(appShellCss).toMatch(/@container shell-frame \(max-width: 1100px\)/);
  expect(appShellCss).toMatch(/@container shell-frame \(max-width: 768px\)/);
});

test("sidebar-panel + status-bar mobile rules follow the shell's container, not a stale @media", () => {
  for (const [name, css] of [["sidebar-panel.css", sidebarPanelCss], ["status-bar.css", statusBarCss]] as const) {
    expect(css, `${name} still has a real-viewport-only layout @media`).not.toMatch(MEDIA_LAYOUT_BP);
    expect(css, `${name} lost its @container shell-frame mobile rule`).toMatch(/@container shell-frame \(max-width: 768px\)/);
  }
});

// app-window.css is the ONE documented exception: `.app-window-backdrop` IS <body> itself (the
// class lives on <body> in every real composition), and an element can never legally
// @container-query its own condition — only `.app-window-backdrop { padding: 0 }` may stay a real
// @media. Guard BOTH halves: the exception doesn't silently grow, and the descendant rules
// (`.app-shell.app-window`, `.window-bar`) don't regress back to @media now that they don't have to.
test("app-window.css keeps exactly the documented self-query exception, converts the rest", () => {
  const mediaBlocks = [...appWindowCss.matchAll(MEDIA_LAYOUT_BP)];
  expect(mediaBlocks.length).toBe(1);
  // the surviving @media must be the narrow one that touches only the backdrop padding.
  const afterMedia = appWindowCss.slice(mediaBlocks[0].index);
  const mediaBody = afterMedia.slice(0, afterMedia.indexOf("}") + 1);
  expect(mediaBody).toMatch(/\.app-window-backdrop\s*\{\s*padding:\s*0/);
  expect(mediaBody).not.toMatch(/\.app-shell\.app-window|\.window-bar/);
  expect(appWindowCss).toMatch(/@container shell-frame \(max-width: 768px\)\s*\{[^}]*\.app-shell\.app-window/);
  expect(appWindowCss).toMatch(/\.window-bar\s*\{\s*display:\s*none/);
});

test("the viewport-toggle clamps body[data-viewport], not .app-shell[data-viewport] — that's what makes it a real container shrink", () => {
  expect(appShellCss).toMatch(/body\[data-viewport\]\s*\{[^}]*max-width:\s*var\(--shell-viewport-w/);
  expect(appShellCss).not.toMatch(/\.app-shell\[data-viewport\]\s*\{[^}]*max-width/);
  expect(shellJs).toMatch(/document\.body\.setAttribute\("data-viewport"/);
  expect(shellJs).toMatch(/document\.body\.getAttribute\("data-viewport"\)/);
});

test("reduced-motion queries stay real @media (they read a user preference, not a size)", () => {
  expect(appShellCss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
});
