// grain/styles/contrast.test.ts — holds --ink-muted to WCAG AA in every flavor and both schemes.
// Muted carries text a reader is meant to read (variables.css), so it must clear 4.5:1 on every
// surface it sits on. This reads the token blocks straight from the stylesheets, so a value that
// drifts fails here rather than in someone's audit. The floor is 4.7, not 4.5, because consumers
// paint sidebars a shade darker than paper; the "sidebar" surface below models that, 3% of the
// way from paper toward ink, which is how PANTRY's sidebar measured.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FLOOR = 4.7;
const dir = import.meta.dir;

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const lum = (c: Rgb) => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// Every rule block that declares --ink-muted, with its selector, read token by token.
function blocks(file: string) {
  const css = readFileSync(join(dir, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { where: string; tokens: Record<string, string> }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*--ink-muted[^{}]*)\}/g)) {
    const tokens: Record<string, string> = {};
    for (const d of m[2]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[d[1]!] = d[2]!;
    out.push({ where: `${file} ${m[1]!.trim()}`, tokens });
  }
  return out;
}

const all = ["variables.css", "themes/baguette.css", "themes/brioche.css", "themes/_template.css"].flatMap(blocks);

test("every flavor declares --ink-muted in light and both dark blocks", () => {
  expect(all.length).toBe(12);
});

for (const { where, tokens } of all) {
  test(`--ink-muted clears ${FLOOR}:1 on every surface: ${where}`, () => {
    const { paper, "paper-2": paper2, panel, ink, "ink-muted": muted } = tokens;
    expect([paper, paper2, panel, ink, muted].every(Boolean)).toBe(true);
    const P = rgb(paper!), I = rgb(ink!), M = rgb(muted!);
    const sidebar = P.map((v, i) => v + (I[i]! - v) * 0.03) as Rgb;
    for (const [, s] of [["paper", P], ["paper-2", rgb(paper2!)], ["panel", rgb(panel!)], ["sidebar", sidebar]] as const) {
      expect(ratio(M, s)).toBeGreaterThanOrEqual(FLOOR);
    }
    // and it stays a quieter tier than ink, not a second ink
    expect(ratio(I, P)).toBeGreaterThan(ratio(M, P) * 2);
  });
}
