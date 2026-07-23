// grain/scripts/made-with.test.ts — the byline is a CONTRACT: every GRAIN app mounts this
// exact line, so its content and both form factors are pinned here (drift = fleet-wide drift).
import { test, expect } from "bun:test";
import { madeWith } from "./made-with.js";

test("block form: a footer.made-with linking GRAIN and tjakoen", () => {
  const html = madeWith();
  expect(html).toStartWith('<footer class="made-with">');
  expect(html).toEndWith("</footer>");
  expect(html).toContain('made with <a href="https://tjakoen.github.io/grain">GRAIN</a>');
  expect(html).toContain('by <a href="https://tjakoen.github.io">tjakoen</a>');
});

test("inline form: a span with data-inline, same line", () => {
  const html = madeWith({ inline: true });
  expect(html).toStartWith('<span class="made-with" data-inline>');
  expect(html).toEndWith("</span>");
  expect(html).toContain(">GRAIN</a>");
  expect(html).toContain(">tjakoen</a>");
});

test("both forms carry identical content (one source of truth)", () => {
  const inner = (s: string) => s.replace(/^<[^>]+>/, "").replace(/<\/[a-z]+>$/, "");
  expect(inner(madeWith())).toBe(inner(madeWith({ inline: true })));
});
