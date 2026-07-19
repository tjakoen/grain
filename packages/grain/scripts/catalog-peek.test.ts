// grain/scripts/catalog-peek.test.ts — the peek island bridges a rendered CSS class → a catalog
// slug via a hand-maintained MAP. If a component's title (and thus its slug) drifts, the MAP
// silently stops revealing that component on hover. This guards the slug side: every slug the MAP
// targets must be a real grain component slug.
import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function componentSlugs(dir: string, out: Set<string> = new Set<string>()): Set<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) componentSlugs(full, out);
    else if (e.name.endsWith(".md") && !e.name.endsWith(".ai.md")) {
      const title = (readFileSync(full, "utf8").match(/^#\s+(.+)$/m) || [])[1];
      if (title) out.add(slugify(title.trim()));
    }
  }
  return out;
}

test("every catalog-peek MAP slug resolves to a real grain component", () => {
  const js = readFileSync(join(import.meta.dir, "catalog-peek.js"), "utf8");
  const mapBody = js.match(/const MAP = \{([\s\S]*?)\};/)?.[1] ?? "";
  const slugs = [...mapBody.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
  expect(slugs.length).toBeGreaterThan(5);   // sanity: the MAP was actually parsed
  const known = componentSlugs(join(import.meta.dir, "..", "components"));
  const orphans = slugs.filter((s) => !known.has(s));
  expect(orphans).toEqual([]);
});
