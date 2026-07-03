// grain/components/examples.test.ts — a guardrail on component catalog examples.
//
// The catalog renders EVERY component's `.md` examples on one page, so an example that grabs focus
// or otherwise acts on load misbehaves for the whole catalog. `autofocus` is the known footgun: it
// stole focus and scroll-jumped /catalog on every load (and hung the e2e). This test keeps that
// class of mistake out of the examples — a cheap conformance check, colocated with the components.
import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function mdFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) mdFiles(full, out);
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

test("no component example uses autofocus (it scroll-jumps /catalog on load)", () => {
  const offenders = mdFiles(import.meta.dir).filter((f) => /\bautofocus\b/.test(readFileSync(f, "utf8")));
  expect(offenders).toEqual([]);
});
