// grain/components/tokens.test.ts — a guardrail on the "tokens only, no hardcoded colors, ever"
// non-negotiable (CLAUDE.md). There was no automated guard for it; this walks every component
// stylesheet and fails the build if one slips a raw color instead of a var(--token) — the same
// class of cheap, colocated conformance check as examples.test.ts (lesson 5: add a conformance
// test that catches the class of misuse, don't just patch the instance).
import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) cssFiles(full, out);
    else if (e.name.endsWith(".css")) out.push(full);
  }
  return out;
}

// hex literal, excluding `url(#…)` / `sprite.svg#…` fragment refs (those are ids, not colors).
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNC = /\b(rgb|rgba|hsl|hsla)\(/;

test("no component stylesheet hardcodes a color (tokens only, ever)", () => {
  const offenders: string[] = [];
  for (const f of cssFiles(import.meta.dir)) {
    const src = readFileSync(f, "utf8");
    for (const line of src.split("\n")) {
      const hasHex = (line.match(HEX) ?? []).some((m) => {
        const idx = line.indexOf(m);
        const before = line.slice(0, idx);
        const isFragmentRef = /url\(\s*$/.test(before) || /[\w./-]$/.test(before);
        return !isFragmentRef;
      });
      const hasFunc = FUNC.test(line);
      if (hasHex || hasFunc) offenders.push(`${f}: ${line.trim()}`);
    }
  }
  expect(offenders).toEqual([]);
});
