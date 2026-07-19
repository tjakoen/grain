// grain/scripts/terminal.test.ts — DRIFT GUARD for the interactive terminal island. The island is
// a browser module (behavior lives in the e2e); here we guard the CONTRACT it depends on: every
// verb it submits through the door must be a REAL action in the registry (CONVENTIONS §3 — the one
// exception for browser literals, validated here), and it must expose the documented seam.
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACTIONS } from "../ai/contract.ts";

const js = readFileSync(join(import.meta.dir, "terminal.js"), "utf8");

test("every door.submit(...) verb literal is a real action in the registry", () => {
  const verbs = [...js.matchAll(/door\.submit\(\s*"([^"]+)"/g)].map((m) => m[1]);
  expect(verbs.length).toBeGreaterThan(0);
  const strays = verbs.filter((v) => !Object.hasOwn(ACTIONS, v));
  expect(strays).toEqual([]);
});

test("registers the generic builtins", () => {
  const names = [...js.matchAll(/register\(\{\s*name:\s*"([^"]+)"/g)].map((m) => m[1]);
  for (const expected of ["help", "clear", "ls", "go", "grep", "theme", "ask", "stop", "context", "xray", "exit"])
    expect(names).toContain(expected);
});

test("exposes window.grain.terminal.register (the extensibility seam)", () => {
  expect(js).toMatch(/window\.grain\.terminal\s*=\s*\{[\s\S]*\bregister\b/);
});

test("only mounts opt-in consoles (data-terminal=\"interactive\")", () => {
  expect(js).toMatch(/\.console__box\[data-terminal="interactive"\]/);
});

test("the human echo settles clean (grade=smooth), machine output stays grain (feed default)", () => {
  // the echo helper must carry grade:"smooth"; no builtin output line forces a grade
  expect(js).toMatch(/echo:[\s\S]*grade:\s*"smooth"/);
});
