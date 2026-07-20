// grain/scripts/ai-spotlight.test.ts — UNIT: the traveling lamp's PASSTHROUGH geometry.
// The lamp's DOM motion is covered by the consumer e2e (a real browser); here we pin the pure
// geometry the passthrough hole is built from — lesson 9: a knob (passthrough) must be
// MECHANICALLY CONSUMED. `backdropClip` is the mechanism that turns the lamp's rect into a
// click-through hole in the backdrop; if it stops emitting the hole coords, passthrough is a
// disconnected knob and the tour can't click its target. So we assert the hole is really cut.
import { test, expect } from "bun:test";
import { backdropClip } from "./ai-spotlight.js";

test("no hole → empty clip (backdrop stays a full click-catcher)", () => {
  expect(backdropClip(null)).toBe("");
  expect(backdropClip(undefined)).toBe("");
});

test("a hole rect is cut into the backdrop as a slit polygon (all four inner corners present)", () => {
  const clip = backdropClip({ left: 100, top: 50, width: 200, height: 80 });
  expect(clip.startsWith("polygon(")).toBe(true);
  // the outer ring reaches the viewport edges…
  expect(clip).toContain("100% 100%");
  // …then bridges in to the exact target rect corners (left/top .. left+width/top+height)
  expect(clip).toContain("100px 50px");    // top-left
  expect(clip).toContain("100px 130px");   // bottom-left  (top + height)
  expect(clip).toContain("300px 130px");   // bottom-right (left + width, top + height)
  expect(clip).toContain("300px 50px");    // top-right    (left + width)
});

test("the hole tracks the rect — different geometry yields a different clip", () => {
  const a = backdropClip({ left: 0, top: 0, width: 10, height: 10 });
  const b = backdropClip({ left: 40, top: 40, width: 10, height: 10 });
  expect(a).not.toBe(b);
});
