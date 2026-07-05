// grain/ai/manifest-dom.test.ts — UNIT: the client-side DOM→manifest projection.
// The DOM walk is exercised with plain fakes (the module takes a structural DomRoot, not
// lib.dom), so kind derivation, accepts intersection/inversion, and push-only classification
// are all testable without a browser. Full DOM behavior is covered by the terminal e2e.
import { test, expect } from "bun:test";
import { deriveKind, deriveAccepts, targetLabel, harvestTargets, domManifest, type DomEl } from "./manifest-dom.ts";
import { actionsForKind } from "./contract.ts";

const el = (attrs: Record<string, string>): DomEl => ({ getAttribute: (n) => attrs[n] ?? null });

test("deriveKind: explicit data-kind wins; a registered kind is not push-only", () => {
  expect(deriveKind("item:ITM-1", "item")).toEqual({ kind: "item", pushOnly: false });
});

test("deriveKind: derives kind from the address prefix when data-kind is absent", () => {
  expect(deriveKind("item:ITM-9", null)).toEqual({ kind: "item", pushOnly: false });
  expect(deriveKind("chat-log", null)).toEqual({ kind: "chat-log", pushOnly: false });
});

test("deriveKind: a display feed no verb targets is push-only", () => {
  expect(deriveKind("console", null)).toEqual({ kind: "console", pushOnly: true });
  expect(deriveKind("plan", null)).toEqual({ kind: "plan", pushOnly: true });
});

test("deriveKind: an unknown explicit data-kind is push-only (not a registry kind)", () => {
  expect(deriveKind("weird", "made-up")).toEqual({ kind: "made-up", pushOnly: true });
});

test("deriveAccepts: explicit data-accepts is intersected with the real registry", () => {
  expect(deriveAccepts("item", "item.archive")).toEqual(["item.archive"]);
  // a stray/misspelled verb is dropped, not trusted
  expect(deriveAccepts("item", "item.archive bogus.verb")).toEqual(["item.archive"]);
});

test("deriveAccepts: with no explicit list, a registered kind inverts the registry", () => {
  expect(deriveAccepts("chat-log", null)).toEqual(actionsForKind("chat-log"));
  expect(deriveAccepts("chat-log", null)).toContain("chat.send");
});

test("deriveAccepts: a push-only kind accepts nothing", () => {
  expect(deriveAccepts("console", null)).toEqual([]);
});

test("targetLabel: verbs joined, else push-only", () => {
  expect(targetLabel({ id: "item:1", kind: "item", accepts: ["item.archive"] })).toBe("item · item.archive");
  expect(targetLabel({ id: "console", kind: "console", accepts: [], pushOnly: true })).toBe("console · push-only");
});

test("harvestTargets: walks [data-surface], skips empties, derives each", () => {
  const root = {
    querySelectorAll: () => [
      el({ "data-surface": "item:ITM-1", "data-kind": "item", "data-accepts": "item.archive" }),
      el({ "data-surface": "chat-log" }),
      el({ "data-surface": "console" }),
      el({ "data-surface": "" }),   // skipped
    ],
  };
  const targets = harvestTargets(root);
  expect(targets.map((t) => t.id)).toEqual(["item:ITM-1", "chat-log", "console"]);
  expect(targets[0]).toMatchObject({ kind: "item", accepts: ["item.archive"], pushOnly: false });
  expect(targets[1].accepts).toContain("chat.send");
  expect(targets[2]).toMatchObject({ kind: "console", accepts: [], pushOnly: true });
});

test("domManifest: same shape as the server manifest, marked a live-DOM projection", () => {
  const doc = {
    body: el({ "data-screen": "grain" }),
    querySelectorAll: () => [el({ "data-surface": "chat-log" })],
  };
  const m = domManifest(doc);
  expect(m.screen).toBe("grain");
  expect(m.actions.length).toBeGreaterThan(0);      // the full verb registry, as the server sends
  expect(m.targets[0].id).toBe("chat-log");
  expect(m.inView).toEqual({ surfaces: ["chat-log"] });
  expect(m.note).toMatch(/live dom/i);
});
