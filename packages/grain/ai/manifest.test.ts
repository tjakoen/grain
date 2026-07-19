// grain/ai/manifest.test.ts — UNIT: manifest builder in isolation.
import { test, expect } from "bun:test";
import { buildManifest } from "./manifest.ts";
import { ACTIONS } from "./contract.ts";
import type { ManifestTarget } from "./manifest.ts";

const targets: ManifestTarget[] = [
  { id: "item:ITM-1", kind: "item",    accepts: ["item.archive"] },
  { id: "reflection", kind: "reflection", accepts: ["say.set"] },
];

test("buildManifest: actions list matches ACTIONS registry exactly", () => {
  const m = buildManifest("loop", targets);
  const registryNames = Object.keys(ACTIONS).sort();
  const manifestNames: string[] = m.actions.map((a) => a.name as string).sort();
  expect(manifestNames).toEqual(registryNames);
});

test("buildManifest: each action entry has name, depth, accepts", () => {
  const m = buildManifest("loop", targets);
  for (const a of m.actions) {
    expect(typeof a.name).toBe("string");
    expect(["light", "heavy"]).toContain(a.depth);
    expect(Array.isArray(a.accepts)).toBe(true);
  }
});

test("buildManifest: targets are passed through unchanged", () => {
  const m = buildManifest("loop", targets);
  expect(m.targets).toEqual(targets);
});

test("buildManifest: screen is set correctly", () => {
  const m = buildManifest("grain", targets);
  expect(m.screen).toBe("grain");
});

test("buildManifest: inView defaults to empty object", () => {
  const m = buildManifest("loop", targets);
  expect(m.inView).toEqual({});
});

test("buildManifest: inView is threaded through when provided", () => {
  const inView = { items: [{ id: "ITM-1" }] };
  const m = buildManifest("loop", targets, inView);
  expect(m.inView).toEqual(inView);
});

test("buildManifest: note is a non-empty string", () => {
  const m = buildManifest("loop", targets);
  expect(typeof m.note).toBe("string");
  expect(m.note.length).toBeGreaterThan(0);
});
