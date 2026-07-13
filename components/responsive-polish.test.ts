// grain/components/responsive-polish.test.ts — conformance guards for the 2026-07-14
// responsive/mobile pass (grain lesson 5: don't just patch the instance, add a test that catches
// the class of misuse). Two unrelated regressions this covers:
//
// 1. The ≥44px touch-target promise (DESIGN-SYSTEM §7, b-icon-button.css's own comment) was a
//    documented number nothing enforced against a squeezing flex parent — the mobile rail-toggle
//    hamburger audited as "resolves but is untappable" because its declared width could still
//    shrink to nothing. flex-shrink: 0 is what actually holds the floor; guard that it stays wired.
// 2. The grain-grade font (Redaction 50) reads as texture only at >= --text-2xl (lesson 4); a chat
//    bubble is --text-sm, so it must use the fine fallback face, not the sitewide rough one.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

test("icon-btn's touch target can't be shrunk by a flex parent", () => {
  const css = read("components/atoms/b-icon-button/b-icon-button.css");
  expect(css).toMatch(/\.icon-btn\s*\{[^}]*flex-shrink:\s*0/);
});

test("activity-bar items meet the ≥44px touch-target floor", () => {
  const css = read("components/organisms/activity-bar/activity-bar.css");
  const m = css.match(/\.activity-bar__item\s*\{([^}]*)\}/);
  expect(m).not.toBeNull();
  const width = m![1].match(/width:\s*([\d.]+)rem/);
  expect(width).not.toBeNull();
  expect(Number(width![1]) * 16).toBeGreaterThanOrEqual(44);   // 1rem == 16px, grain's base
  expect(m![1]).toMatch(/flex-shrink:\s*0/);
});

test("--font-grain-fine exists and chat-message uses it instead of the rough face at bubble size", () => {
  const vars = read("styles/variables.css");
  expect(vars).toMatch(/--font-grain-fine:\s*"Redaction 35"/);

  const css = read("components/molecules/chat-message/chat-message.css");
  // must key --type-font (the mechanism grain.css already ships), not invent a parallel font switch
  expect(css).toMatch(/--type-font:\s*var\(--font-grain-fine\)/);
  // covers both the settled grain state and the still-streaming pending state
  expect(css).toMatch(/\[data-grade="grain"\]/);
  expect(css).toMatch(/\[data-commit="pending"\]/);
});
